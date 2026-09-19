import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface CreateFiscalYearInput {
  name: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class FiscalService {
  /** Creates a fiscal year and immediately generates one FiscalPeriod per
   * calendar month it spans (the common case — a company that wants
   * non-monthly periods can still open/close them individually later; we
   * don't force a shape on that, we just give a sane default). */
  async createFiscalYear(tx: Prisma.TransactionClient, companyId: string, input: CreateFiscalYearInput) {
    if (input.endDate <= input.startDate) {
      throw new BadRequestException("endDate must be after startDate");
    }

    const fiscalYear = await tx.fiscalYear.create({
      data: { companyId, name: input.name, startDate: input.startDate, endDate: input.endDate },
    });

    const periods: { name: string; startDate: Date; endDate: Date }[] = [];
    let cursor = new Date(Date.UTC(input.startDate.getUTCFullYear(), input.startDate.getUTCMonth(), 1));
    while (cursor < input.endDate) {
      const periodStart = cursor < input.startDate ? input.startDate : cursor;
      const nextMonth = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      const periodEnd = nextMonth > input.endDate ? input.endDate : new Date(nextMonth.getTime() - 1);
      periods.push({
        name: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
        startDate: periodStart,
        endDate: periodEnd,
      });
      cursor = nextMonth;
    }

    await tx.fiscalPeriod.createMany({
      data: periods.map((p) => ({ fiscalYearId: fiscalYear.id, ...p })),
    });

    return tx.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYear.id }, include: { periods: true } });
  }

  async listFiscalYears(tx: Prisma.TransactionClient, companyId: string) {
    return tx.fiscalYear.findMany({
      where: { companyId },
      include: { periods: { orderBy: { startDate: "asc" } } },
      orderBy: { startDate: "desc" },
    });
  }

  async setPeriodStatus(
    tx: Prisma.TransactionClient,
    companyId: string,
    periodId: string,
    status: "OPEN" | "CLOSED",
  ) {
    const period = await tx.fiscalPeriod.findFirst({
      where: { id: periodId, fiscalYear: { companyId } },
      include: { fiscalYear: true },
    });
    if (!period) throw new NotFoundException("Fiscal period not found");
    return tx.fiscalPeriod.update({ where: { id: periodId }, data: { status } });
  }

  /** Finds the OPEN period covering a given date, or throws — every posting
   * flow (journal entries, and everything that will post through the
   * PostingEngine in later phases) must resolve its period through this,
   * never by trusting a periodId the caller supplies directly. */
  async requireOpenPeriodForDate(tx: Prisma.TransactionClient, companyId: string, date: Date) {
    const period = await tx.fiscalPeriod.findFirst({
      where: {
        fiscalYear: { companyId },
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    if (!period) {
      throw new BadRequestException(`No fiscal period covers ${date.toISOString().slice(0, 10)} — create a fiscal year first`);
    }
    if (period.status !== "OPEN") {
      throw new ForbiddenException(`Fiscal period ${period.name} is closed — cannot post to it`);
    }
    return period;
  }
}
