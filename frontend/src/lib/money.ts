// Money always shows with its currency: "$250,000" in full, and "$1.2M" or
// "$250K" where space is short, chart axes included.

const full = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** "$250,000" */
export function formatMoney(value: number): string {
  return full.format(value);
}

function trim(text: string): string {
  return text.replace(/\.0$/, "");
}

/** "$520K", "$250K", "$1.2M", "$9.0M". Millions keep one decimal. */
export function formatMoneyShort(value: number, { keepDecimal = true } = {}): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const text = (abs / 1_000_000_000).toFixed(1);
    return `${sign}$${keepDecimal ? text : trim(text)}B`;
  }
  if (abs >= 999_500) {
    const text = (abs / 1_000_000).toFixed(1);
    return `${sign}$${keepDecimal ? text : trim(text)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1_000)}K`;
  }
  return `${sign}$${abs}`;
}

/** For chart axes: "$0", "$500K", "$1M", "$1.5M". */
export function formatMoneyAxis(value: number): string {
  return formatMoneyShort(value, { keepDecimal: false });
}

/** "39%" */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
