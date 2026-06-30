export type FormatMoneyOptions = {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/**
 * Format integer cents as localized currency (default AUD / en-AU).
 */
export function formatMoneyFromCents(
  cents: number,
  currency = "AUD",
  options?: FormatMoneyOptions
): string {
  const amount = cents / 100;
  const locale = options?.locale ?? "en-AU";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.trim() || "AUD",
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(amount);
  } catch {
    const code = currency.trim() || "AUD";
    return `${code} ${amount.toFixed(options?.maximumFractionDigits ?? 2)}`;
  }
}

/**
 * Format a major-unit amount (dollars, not cents) — e.g. reception scoreboard totals.
 */
export function formatMoneyMajor(
  amount: number,
  currency = "AUD",
  options?: Pick<FormatMoneyOptions, "locale" | "maximumFractionDigits">
): string {
  const locale = options?.locale ?? "en-AU";
  const maximumFractionDigits = options?.maximumFractionDigits ?? 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.trim() || "AUD",
      maximumFractionDigits,
      minimumFractionDigits: maximumFractionDigits,
    }).format(amount);
  } catch {
    const code = currency.trim() || "AUD";
    return `${code} ${amount.toLocaleString(undefined, { maximumFractionDigits })}`;
  }
}

/** @alias formatMoneyFromCents */
export const formatMoney = formatMoneyFromCents;
