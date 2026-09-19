import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class AccountMappingsService {
  async list(tx: Prisma.TransactionClient, companyId: string) {
    return tx.accountMapping.findMany({ where: { companyId }, include: { account: true }, orderBy: { key: "asc" } });
  }

  async set(tx: Prisma.TransactionClient, companyId: string, key: string, accountId: string) {
    const account = await tx.account.findFirst({ where: { id: accountId, companyId } });
    if (!account) throw new NotFoundException("Account not found in this company");
    if (account.isHeader) throw new BadRequestException("Cannot map a default to a header account");

    return tx.accountMapping.upsert({
      where: { companyId_key: { companyId, key } },
      update: { accountId },
      create: { companyId, key, accountId },
    });
  }

  /** Used internally by posting flows (Sales/Purchasing/...) to resolve
   * "where does this kind of transaction go by default" — throws a clear,
   * actionable error rather than silently posting to the wrong place when a
   * company hasn't configured a mapping it needs. */
  async require(tx: Prisma.TransactionClient, companyId: string, key: string): Promise<string> {
    const mapping = await tx.accountMapping.findUnique({ where: { companyId_key: { companyId, key } } });
    if (!mapping) {
      throw new BadRequestException(
        `No default account configured for ${key} — set one via PATCH /accounting/account-mappings/${key}`,
      );
    }
    return mapping.accountId;
  }
}
