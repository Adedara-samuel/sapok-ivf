# Platform, accounts and AI

How the multi-hospital platform, patient & family accounts, payments, subscriptions, support and the AI assistant work, both in this demo and when the app goes live.

## 1. Hospitals (multi-tenancy)

- **One platform, many hospitals.** Each hospital (tenant) has its own link, name, logo, colour, staff, patients and money. One hospital never sees another's data.
- **Hospital link:** `/h/<slug>` (e.g. `/h/lagoon`). In production each hospital gets a subdomain such as `lagoon.overcare.ng`.
- **Demo storage:** every store is saved per hospital in `localStorage`. The main demo hospital keeps the original keys (`rhv-ivf:<store>`); the others use `rhv-ivf@<slug>:<store>` (`lib/tenancy.ts`). Platform data (hospitals, invoices, tickets) is shared under `rhv-ivf:platform`.
- **Production:** a `tenant_id` column on every table, enforced by Postgres row-level security, with the tenant resolved from the subdomain in `proxy.ts`.
- **Seeded hospitals:** _Overcare IVF_ (active, sample data), _Lagoon Fertility Centre_ (3 days late on its subscription, sample data, purple brand) and _Bloom Women's Hospital_ (starts empty, AI not in plan).

## 2. Super admin (platform owner)

- Signs in on the **normal login page**. The account is never listed among the demo users, and its password is stored only as a SHA-256 hash (`lib/stores/platform.ts`).
- **Console (`/platform`):**
  - **Overview:** hospitals, monthly recurring revenue, subscriptions paid, service charges earned and open tickets.
  - **Onboard hospital:** branding, link, plan, % service charge (with an optional cap), AI on/off, settlement bank account (with a demo "verify account" lookup), first admin user, and whether to start with sample data or empty. This creates the Paystack subaccount code and the first invoice.
  - **Hospital detail:** edit branding, plan, fee and settlement account; record offline payments; suspend or lift a suspension; demo buttons to simulate lateness; payments and fees from that hospital's own records.
  - **Support desk:** tickets from every hospital. Reply, set the status, close.
  - **Settings & audit:** the gateway fee model and the platform audit log.

## 3. Subscriptions (automated licence)

The subscription status is never switched by hand. It follows from the date the hospital is paid up to (`lib/platform/subscription.ts`):

| Paid-up date   | Status        | What staff see                                                         |
| -------------- | ------------- | ---------------------------------------------------------------------- |
| today or later | **Active**    | everything                                                             |
| 1–7 days late  | **Grace**     | reminder banner; everything still works                                |
| 8–30 days late | **Read-only** | banner; records can be viewed and printed, but every change is blocked |
| 30+ days late  | **Suspended** | only the hospital admin can sign in, and only to pay or raise a ticket |

A manual suspension by the super admin overrides the dates. A hospital pays from **Subscription & support → Pay subscription** (a simulated Paystack checkout; 12 months gets 2 months free), which extends the paid-up date and adds an invoice with a printable receipt. Read-only mode is enforced centrally (`assertWritable()` in `lib/stores/core.ts`, called by `useRunAction` and every money operation), so no screen can bypass it.

## 4. Patient & family accounts

- **Every patient belongs to at most one account.** An _individual_ account has one patient. A _family_ account has a holder (the person who pays) and any number of linked members: the couple, relatives, a sponsor.
- **Account number:** a Paystack Dedicated Virtual Account (e.g. Wema Bank 99xxxxxxxx). Paystack requires the **account holder's BVN**, meaning the patient's or the family payer's, not the hospital's. Only the last 4 digits are kept. The hospital provides its business KYC and settlement bank account once, at onboarding.
- **Where money goes:** the family transfers from any bank app → Paystack → the hospital's bank (next working day). The platform never holds patient money; the account is the hospital's record of unspent deposits.
- **Automatic deduction:** when a member is billed (a test, a drug, a procedure), the charge is paid from the account immediately if auto-debit is on. If the balance is short, part is paid and the rest waits; it is paid automatically as soon as money arrives. Only self-pay and referral charges are deducted; HMO and corporate charges go to the sponsor.
- **Credit limit:** ₦0 by default. Only a hospital admin can raise it for a family, with a reason that is audited.
- **Cancelled orders:** anything already paid from the account is returned to it.
- **Refund of unspent balance:** requested by accounts staff and approved by a manager (nobody approves their own request).
- **Safety:** the ledger is append-only and the balance is always computed from it; a gateway reference is only ever credited once (duplicate webhooks are ignored).
- **Records:** every deposit, deduction, return and refund is on the account statement, on the patient's billing tab, in the hospital audit trail, and in a message to the holder (WhatsApp in production).

### Fees

For a ₦40,000 bank transfer with a 1% platform fee:

|                                                                | Amount      |
| -------------------------------------------------------------- | ----------- |
| Patient's account is credited                                  | **₦40,000** |
| Paystack fee (demo model: 1% capped at ₦300)                   | ₦300        |
| Platform service charge (set by the super admin, per hospital) | ₦400        |
| Settled to the hospital's bank                                 | ₦39,300     |

Fees never reduce the patient's balance. Cash and POS taken at the desk don't pass through the gateway, so no fees apply. Finance staff see the breakdown in **Billing → Collections & settlements** and on each account's **Money breakdown** tab. Confirm Paystack's current pricing before go-live; the super admin can edit the fee model.

## 5. AI assistant

- **Ask AI** in the top bar (or Ctrl+J) on every screen. It knows which patient or account is open.
- **Built-in demo AI:** deterministic and offline (`lib/ai/assistant.ts`). It answers from the same data and selectors as the screens, so its numbers match the dashboards.
- **It can:** summarise a patient, list what's pending, draft referral or patient letters (as editable drafts), give account balances and low-balance lists, list debtors, show collections and fees, count procedures, give pregnancy rates, list the waiting list, stock alerts, cryo consents and pending approvals, and explain embryo grades in plain words.
- **Rules:** it only uses what the signed-in role may see (a nurse asking about billing is declined), it never gives doses, diagnoses or treatment decisions, every question is audited, and every answer is marked _AI-generated_. It can be switched on or off per hospital from the platform console.

## 6. Going live (what replaces the simulations)

| Demo                                  | Production                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `localStorage` per hospital           | PostgreSQL with `tenant_id` + row-level security                                                                  |
| "Simulate bank transfer"              | Paystack `charge.success` / dedicated-account webhook → same `receiveGatewayPayment` logic, verified by signature |
| Account number generated locally      | Paystack _Create Dedicated Virtual Account_ (holder BVN) with split to the hospital's subaccount                  |
| "Verify account"                      | Paystack _Resolve Account Number_                                                                                 |
| Simulated subscription checkout       | Paystack subscription + webhook updating the paid-up date                                                         |
| Messages logged on the account        | WhatsApp Cloud API / SMS (Termii) / email (Resend)                                                                |
| Built-in demo AI                      | Same panel and answer format backed by an LLM with tool calls into these selectors                                |
| Super-admin hash check in the browser | Server-side auth with 2FA                                                                                         |
