import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { JournalEntryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JournalEntriesService } from "./journal-entries.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";
import { requireActiveCompany } from "../common/require-active-company";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

@Controller("accounting/journal-entries")
export class JournalEntriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntriesService: JournalEntriesService,
  ) {}

  @Get()
  @RequirePermission("accounting", "journal_entry", "view")
  list(@CurrentUser() user: AccessTokenPayload, @Query("status") status?: JournalEntryStatus) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.journalEntriesService.list(tx, companyId, status),
    );
  }

  @Get(":id")
  @RequirePermission("accounting", "journal_entry", "view")
  get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.journalEntriesService.get(tx, companyId, id),
    );
  }

  @Post()
  @RequirePermission("accounting", "journal_entry", "create")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateJournalEntryDto) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.journalEntriesService.createDraft(tx, companyId, user.sub, {
        entryDate: new Date(dto.entryDate),
        description: dto.description,
        branchId: dto.branchId,
        lines: dto.lines,
      }),
    );
  }

  @Post(":id/post")
  @RequirePermission("accounting", "journal_entry", "post")
  post(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.journalEntriesService.post(tx, companyId, user.sub, id),
    );
  }

  @Post(":id/reverse")
  @RequirePermission("accounting", "journal_entry", "post")
  reverse(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const companyId = requireActiveCompany(user);
    return this.prisma.withTenant({ companyId, userId: user.sub }, (tx) =>
      this.journalEntriesService.reverse(tx, companyId, user.sub, id),
    );
  }
}
