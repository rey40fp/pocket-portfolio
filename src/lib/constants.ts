// ─── User Roles ──────────────────────────────────────────────────────

export const USER_ROLES = {
  user: "User",
  admin: "Admin",
  wealth_manager: "Wealth Manager",
  analyst: "Analyst",
} as const;

export type UserRole = keyof typeof USER_ROLES;

export const DEFAULT_USER_ROLE: UserRole = "user";

// ─── Asset Types ─────────────────────────────────────────────────────

export const ASSET_TYPES = {
  stock: "Stock",
  etf: "ETF",
  mutual_fund: "Mutual Fund",
  bond: "Bond",
  crypto: "Crypto",
  real_estate: "Real Estate",
  cash: "Cash",
  other: "Other",
} as const;

export type AssetType = keyof typeof ASSET_TYPES;

/** Asset types that have a ticker symbol and market price */
export const MARKET_ASSET_TYPES: AssetType[] = [
  "stock",
  "etf",
  "mutual_fund",
  "bond",
  "crypto",
];

/** Asset types that are manually valued (no ticker) */
export const MANUAL_ASSET_TYPES: AssetType[] = [
  "real_estate",
  "cash",
  "other",
];

// ─── Asset Categories (sub-type for "other" assets) ──────────────────

export const ASSET_CATEGORIES = {
  vehicle: "Vehicle",
  collectible: "Collectible",
  precious_metal: "Precious Metal",
  private_equity: "Private Equity",
  other: "Other",
} as const;

export type AssetCategory = keyof typeof ASSET_CATEGORIES;

// ─── Account Types ───────────────────────────────────────────────────

export const ACCOUNT_TYPES = {
  individual: "Individual Brokerage",
  ira: "IRA",
  roth_ira: "Roth IRA",
  "401k": "401(k)",
  "529": "529 Plan",
  trust: "Trust",
  crypto_wallet: "Crypto Wallet",
  bank: "Bank Account",
  real_estate: "Real Estate",
  other: "Other",
} as const;

export type AccountType = keyof typeof ACCOUNT_TYPES;

// ─── Custodians ──────────────────────────────────────────────────────

export const CUSTODIANS = {
  fidelity: "Fidelity",
  schwab: "Schwab",
  vanguard: "Vanguard",
  td_ameritrade: "TD Ameritrade",
  robinhood: "Robinhood",
  coinbase: "Coinbase",
  kraken: "Kraken",
  etrade: "E*Trade",
  merrill_lynch: "Merrill Lynch",
  other: "Other",
} as const;

export type Custodian = keyof typeof CUSTODIANS;

// ─── Holding Source ──────────────────────────────────────────────────

export const HOLDING_SOURCES = {
  manual: "Manual",
  plaid: "Plaid",
  csv_import: "CSV Import",
} as const;

export type HoldingSource = keyof typeof HOLDING_SOURCES;

// ─── Household Member Roles ──────────────────────────────────────────

export const HOUSEHOLD_ROLES = {
  owner: "Owner",
  member: "Member",
  dependent: "Dependent",
} as const;

export type HouseholdRole = keyof typeof HOUSEHOLD_ROLES;

// ─── Household Member Status ─────────────────────────────────────────

export const HOUSEHOLD_STATUSES = {
  pending: "Pending",
  active: "Active",
  removed: "Removed",
} as const;

export type HouseholdStatus = keyof typeof HOUSEHOLD_STATUSES;

// ─── Audit Log Actions ──────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  EXPORT: "EXPORT",
  ROLE_CHANGE: "ROLE_CHANGE",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

// ─── Audit Log Resource Types ────────────────────────────────────────

export const AUDIT_RESOURCE_TYPES = {
  account: "Account",
  holding: "Holding",
  lot: "Lot",
  transaction: "Transaction",
  household: "Household",
  portfolio: "Portfolio",
  user: "User",
} as const;

export type AuditResourceType = keyof typeof AUDIT_RESOURCE_TYPES;

// ─── Sector Classifications ─────────────────────────────────────────

export const SECTORS = {
  technology: "Technology",
  healthcare: "Healthcare",
  financials: "Financials",
  consumer_discretionary: "Consumer Discretionary",
  consumer_staples: "Consumer Staples",
  energy: "Energy",
  industrials: "Industrials",
  materials: "Materials",
  real_estate: "Real Estate",
  utilities: "Utilities",
  communication_services: "Communication Services",
} as const;

export type Sector = keyof typeof SECTORS;

// ─── Time Period Selectors ───────────────────────────────────────────

export const TIME_PERIODS = {
  "1W": "1 Week",
  "1M": "1 Month",
  "3M": "3 Months",
  "6M": "6 Months",
  "1Y": "1 Year",
  ALL: "All Time",
} as const;

export type TimePeriod = keyof typeof TIME_PERIODS;
