// Formatting helpers. Intl does the hard work (locales, currencies, time zones) for free.
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const priceFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatPrice = (amount: number) => (amount === 0 ? "Free" : priceFormat.format(amount));
