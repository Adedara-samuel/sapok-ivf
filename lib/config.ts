export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "OvaCare IVF",
  tagline: "Fertility & IVF clinic management",
  currencyCode: "NGN",
  currencySymbol: "₦",
  timezone: "Africa/Lagos",
  locale: "en-NG",
  demoPassword: "Demo@1234",
  twoFactorCode: "123456",
  witnessPin: "4321",
  storagePrefix: "ovacare",
  annualLeaveDays: 21,
  waitingTargetMinutes: 30,
} as const;

export const BRANCHES = [
  {
    id: "BR-01",
    name: "Lagos Island Fertility Centre",
    short: "Lagos Island",
    address: "14 Broad Street, Lagos Island, Lagos",
  },
  { id: "BR-02", name: "Warri Branch", short: "Warri", address: "22 Airport Road, Effurun, Warri, Delta" },
] as const;

export type BranchId = (typeof BRANCHES)[number]["id"];
