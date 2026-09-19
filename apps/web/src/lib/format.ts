import i18n from "@/lib/i18n";

/** Business/financial Arabic UI conventionally uses Western digits (٠-٩
 * are for general Arabic text, not ledgers) — "ar-u-nu-latn" forces that
 * regardless of the browser's own locale data, so amounts are never
 * silently rendered in Eastern Arabic-Indic digits on some machines and
 * not others. */
function numberLocale() {
  return i18n.language === "ar" ? "ar-u-nu-latn" : "en-US";
}

/** Backend amounts are Prisma Decimal serialized as strings (e.g.
 * "1050.0000") — always format through here, never with template-literal
 * interpolation, so grouping/decimals are consistent everywhere. */
export function formatAmount(value: string | number, decimals = 2): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat(numberLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(numberLocale(), { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(numberLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
