export const BASE_CURRENCY = "EUR" as const;

export const ASSET_CATEGORIES = [
  "stock",
  "etf",
  "fund",
  "crypto",
  "real_estate",
  "cash",
  "bond",
  "other",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  stock: "Stock",
  etf: "ETF",
  fund: "Fund",
  crypto: "Crypto",
  real_estate: "Real estate",
  cash: "Cash",
  bond: "Bond",
  other: "Other",
};

export const PRICED_CATEGORIES: AssetCategory[] = ["stock", "etf", "fund", "crypto"];

export const TRANSACTION_TYPES = [
  "buy",
  "sell",
  "dividend",
  "income",
  "expense",
  "valuation",
  "fee",
  "transfer_in",
  "transfer_out",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  income: "Income",
  expense: "Expense",
  valuation: "Valuation",
  fee: "Fee",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
};

export const PROPERTY_EXPENSE_CATEGORIES = [
  "purchase_cost",
  "renovation",
  "repair",
  "maintenance",
  "mortgage_payment",
  "insurance",
  "property_tax",
  "utilities",
  "hoa_fee",
  "management_fee",
  "furnishing",
  "other_expense",
] as const;
export type PropertyExpenseCategory = (typeof PROPERTY_EXPENSE_CATEGORIES)[number];

export const PROPERTY_EXPENSE_CATEGORY_LABEL: Record<PropertyExpenseCategory, string> = {
  purchase_cost: "Purchase cost",
  renovation: "Renovation",
  repair: "Repair",
  maintenance: "Maintenance",
  mortgage_payment: "Mortgage payment",
  insurance: "Insurance",
  property_tax: "Property tax",
  utilities: "Utilities",
  hoa_fee: "HOA fee",
  management_fee: "Management fee",
  furnishing: "Furnishing & decor",
  other_expense: "Other",
};

export const PROPERTY_INCOME_CATEGORIES = ["rent", "deposit", "other_income"] as const;
export type PropertyIncomeCategory = (typeof PROPERTY_INCOME_CATEGORIES)[number];

export const PROPERTY_INCOME_CATEGORY_LABEL: Record<PropertyIncomeCategory, string> = {
  rent: "Rent",
  deposit: "Deposit",
  other_income: "Other",
};

export const RENTAL_STRATEGIES = ["LTR", "STR", "HYBRID"] as const;
export type RentalStrategy = (typeof RENTAL_STRATEGIES)[number];

export const RENTAL_STRATEGY_LABEL: Record<RentalStrategy, string> = {
  LTR: "Long-term rental",
  STR: "Short-term rental",
  HYBRID: "Hybrid",
};

export const ISO_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "JPY",
  "CAD",
  "AUD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
] as const;
export type IsoCurrency = (typeof ISO_CURRENCIES)[number];
