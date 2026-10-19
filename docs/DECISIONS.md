# Decisions

Choices made while building, including where the build deliberately differs from the original brief.

## Scope and data

1. **No backend at all.** The brief asked for read-only mock route handlers under `app/api/*`. The product owner asked during the build for "no backend, all mocked", so the route handlers were dropped. Every read and write goes through in-browser Zustand stores saved to `localStorage`.
2. **Lazy, deterministic seed.** `lib/seed/build.ts` uses a fixed PRNG (mulberry32, seed `20261008`). The same day always produces identical data, which is tested. Dates are relative to _today_. The seed module loads only on first visit or reset.
3. **Couple 2's embryo timeline.** The brief says "OCR done today-2d" but also lists D5 blastocysts and a transfer tomorrow. Those can't both be true biologically, so OCR is placed at today-5. The blastocysts are graded today, two are frozen today, and the single 4AA transfer is planned for tomorrow.
4. **Couple 12 has no episode yet.** Tonye and Preye Cookey are registered and on today's waiting list for a first visit. The front desk opens their episode from the patient file. Trying to register Tonye again triggers duplicate detection.
5. **Low stock is guaranteed.** Opening stock follows the brief. Seeded dispensing reduces it, and a quarterly count adjustment takes three drugs (Ovitrelle, Cabergoline, Leuprorelin) below reorder level so the alerts always have data. One Doxycycline batch is already expired; three batches expire within 60 days.
6. **Charges carry `paid`.** `chargeSchema` gains a `paid` amount so aging buckets and part-payments are exact. Payments are allocated oldest-charge-first, and surplus becomes account credit.
7. **Extended schemas.** No field was removed. Additions include: `allergies`, `branchId`; cycle `trigger`, `ocr`, `transferPlan`, `lutealSupport`, `betaHcg`, `plan`, `cancelReason`; procedure `addenda`; storage `label`, `ownerPersonId`; donor/surrogate `history`; request kinds `refund` and `file-reopen`; audit actions `approve`, `reject`, `dispense`, `sign`, `access-denied`, `break-glass`.
8. **Schema files.** Consent, request, staff, audit, notification, waiting-list and document schemas are grouped in `lib/schemas/admin.ts` rather than four tiny files. Everything is re-exported from `lib/schemas/index.ts`.

## UI

9. **shadcn/ui throughout.** Components are installed with the shadcn CLI into `components/ui` and imported everywhere: Form, Select, Dialog, Sheet, AlertDialog, Command, Popover, Calendar, Tabs, Table, Tooltip, Sonner and others. There are no native `<select>`, date, time or datalist controls.
10. **Date and time entry.** Dates use a shadcn `DatePicker`: type `DD/MM/YYYY` or pick from a `Calendar` popover with month/year dropdowns, and the value is stored as ISO `YYYY-MM-DD`. Times use a `TimePicker`: type `HH:mm` or choose from an hour/minute popover. Typing stays fast for clinical data entry; the popovers suit mouse users.
11. **Tailwind v4.** Tailwind 4 configures themes in CSS, so design tokens live in `app/globals.css` (`:root`/`.dark` variables mapped with `@theme inline`) instead of `tailwind.config.ts`. Token values follow Part 6 of the brief.
12. **Pointer cursor.** A global base-layer rule gives every interactive element (links, buttons, tabs, options, menu items, checkboxes, switches, selects) `cursor: pointer`, and disabled controls `not-allowed`.
13. **Status chips** pair colour with a dot and a text label, so meaning is never carried by colour alone.

## Tooling and versions

14. **Pinned to stable majors with good tooling support:** Next 16.4, React 19.3, TypeScript 5.9 (TS 7 lacked typescript-eslint support), TanStack Table 8.21 (v9's API is new), Zod 4, Zustand 5, Tailwind 4.3, framer-motion 12, Vitest 4.1, ESLint 9.
15. **Git.** The brief asked for a commit after each step. A local repository was initialised and two local commits were made before the product owner asked for no git use; there have been no further commits and nothing has been pushed. Husky + lint-staged are configured for whoever adopts the repository.

## Security (demo only)

16. Passwords, the 2-step code (`123456`) and the witness PIN (`4321`) are checked in the browser. This is a presentation build, not a secure system; production would need a real identity provider and server-side authorisation.

## Accounts

17. **Profile and passwords.** `/profile` is open to every signed-in user and shows their details read-only, so staff can't edit their own name, role, email or branch; that stays with Admin → Users. Password changes go through `lib/services/auth.ts`: Zod strength rules, a matching confirmation, and the new password must differ from the current one. The current password is not asked for, because the user is already signed in (client decision). The store keeps only a SHA-256 hash salted with the user ID (`rhv-ivf:credentials`), and that store is excluded from data export. Every change, failed attempt and admin reset is audited.
18. **Single site at Redemption City.** The clinic is Overcare IVF Centre, Redemption City, KM 46 Lagos–Ibadan Expressway, Mowe, Ogun State (`lib/config.ts`). The brief's second "Warri" branch was removed at the client's request. Branch support stays in the data model (`branchId` on people, episodes and visits), and the branch switcher and filters reappear automatically once more than one branch is configured. Patient home addresses are spread around Redemption City and the Lagos–Ibadan corridor.
19. **Branding.** The product is named **Overcare IVF** via `APP_CONFIG.name` and uses an inline Overcare wordmark. The existing `rhv-ivf:` browser storage prefix is retained to preserve data already saved in users' browsers.

## Performance

20. **Lighthouse vs real measurement.** In a production build, Lighthouse (desktop, simulated throttling) scores accessibility 96–97 and best practices 100. Performance scores in the 40s–60s, held down by an estimated total blocking time of 2–5 s. Direct measurement in Chrome with a long-task observer shows real blocking time of **13–190 ms per page on a desktop CPU**, and 0.3–1.3 s under 4× CPU throttling. The remaining cost is React rendering the client-rendered pages after hydration; a client-only, localStorage-backed design can't paint server-rendered content.

    Done so far: charts lazy-loaded, seed code-split and only built on first visit, tables virtualised above 200 rows. The next step, if needed, is server components for static chrome and deferring below-the-fold panels.
