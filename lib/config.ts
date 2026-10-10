export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "RHV IVF",
  tagline: "Redeemer's Health Village · IVF & fertility care",
  currencyCode: "NGN",
  currencySymbol: "₦",
  timezone: "Africa/Lagos",
  locale: "en-NG",
  demoPassword: "Demo@1234",
  twoFactorCode: "123456",
  witnessPin: "4321",
  storagePrefix: "rhv-ivf",
  annualLeaveDays: 21,
  waitingTargetMinutes: 30,
} as const;

export const BRANCHES = [
  {
    id: "BR-01",
    name: "RHV IVF Centre, Redemption City",
    short: "Redemption City",
    address: "Redemption City, KM 46 Lagos–Ibadan Expressway, Mowe, Ogun State",
  },
] as const;

export type BranchId = (typeof BRANCHES)[number]["id"];
