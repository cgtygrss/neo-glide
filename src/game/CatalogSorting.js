// Older native builds only return a formatted label. Prefer the numeric store
// amount when available, and retain compatibility with their localized labels.
export function displayPriceAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : Infinity;
  if (typeof value !== 'string') return Infinity;
  const digits = value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)))
    .replace(/٫/g, '.').replace(/٬/g, '').replace(/[^0-9.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!digits) return Infinity;
  const last = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
  const fraction = digits.length - last - 1;
  const hasDecimal = last >= 0 && fraction > 0 && fraction <= 2;
  const normalized = hasDecimal
    ? digits.slice(0, last).replace(/[.,]/g, '') + '.' + digits.slice(last + 1)
    : digits.replace(/[.,]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : Infinity;
}

export function sortCatalogByPrice(items, priceOf = item => item.cost ?? item.creditPrice ?? item.price) {
  return items.map((item, index) => ({ item, index, price: displayPriceAmount(priceOf(item)) }))
    .sort((a, b) => a.price - b.price || a.index - b.index)
    .map(entry => entry.item);
}

// Real money and earned credits are different units. Keep each currency's
// ascending sequence together instead of comparing dollars with credit counts.
export function sortStoreProducts(items) {
  const cash = items.filter(item => item.acquisition !== 'credits');
  const credits = items.filter(item => item.acquisition === 'credits');
  return [
    ...sortCatalogByPrice(cash, item => item.priceAmount ?? item.price),
    ...sortCatalogByPrice(credits, item => item.creditPrice),
  ];
}
