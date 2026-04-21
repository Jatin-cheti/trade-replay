const twoDecimalFormatter = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const twoDecimalUsFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number): string {
  return twoDecimalFormatter.format(value);
}

export function formatPriceUs(value: number): string {
  return twoDecimalUsFormatter.format(value);
}
