# Architecture

## Overview

```
Browser
 ├─ Next.js App Router (pages are thin server components → client views)
 ├─ AppProviders: theme, tooltips, toasts, StoreGate (hydrates stores before render)
 ├─ AppShell: auth guard, route RBAC guard, sidebar, topbar, command palette, tour
 ├─ Feature views (components/<feature>/*) built from shadcn/ui primitives
 └─ Zustand stores (lib/stores/*) ── persist ──► localStorage ("rhv-ivf:<store>")
        ▲            │
        │            └─ every write: Zod validate → business rule checks → immer update → audit event
        └─ seed (lib/seed/*) loaded lazily on first visit or reset
```

There is no server-side data. Route handlers were intentionally not built (see DECISIONS.md).

## Folders

| Path                          | Contents                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                        | Routes. `(auth)/login`, `(app)/*` for the signed-in shell, plus `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`.                                                                                                      |
| `components/ui/`              | shadcn/ui components (new-york style, Radix, installed with the shadcn CLI).                                                                                                                                                          |
| `components/shared/`          | Reusable building blocks: `DataTable`, `PageHeader`, `StatTile`, `StatusChip`, `EmptyState`, `ConfirmDialog`, `SignaturePad`, `DatePicker`, `TimePicker`, `DateRangeFields`, `Combobox`, `FilePicker`, `PersonPicker`, `SectionCard`. |
| `components/forms/fields.tsx` | Typed form fields on top of the shadcn `Form` (`TextField`, `NumberField`, `DateField`, `TimeField`, `SelectField`, `TextareaField`, `CheckboxField`). Labels, `aria-describedby` and field errors are wired automatically.           |
| `components/<feature>/`       | One folder per screen: dashboard, waiting, patients, patient (file + 12 tabs), cycle, procedure, consent, counselling, programme (donors/surrogates), embryology, pharmacy, billing, reports, requests, admin, layout, print.         |
| `lib/schemas/`                | Zod schemas — the single source of truth for every type (`z.infer`).                                                                                                                                                                  |
| `lib/stores/`                 | One Zustand store per domain (`persist` + `immer`). `index.ts` holds the registry, hydration, `rootReset()` and export.                                                                                                               |
| `lib/services/`               | Workflows that span several stores (order + charge, refunds through approvals, posting a procedure, sign-in, JSON import).                                                                                                            |
| `lib/selectors/`              | Pure read-model functions: dashboard tiles/charts/alerts, analytics, billing aging, patient rows. Shared by screens and tests so numbers always reconcile.                                                                            |
| `lib/seed/`                   | Deterministic dataset factory (fixed PRNG seed) — 12 hand-authored couples + 28 generated.                                                                                                                                            |
| `lib/permissions.ts`          | Capabilities, default role matrix, route → capability map.                                                                                                                                                                            |
| `lib/constants/`              | Catalogues and prices, procedure form config, protocols, consent templates, labels.                                                                                                                                                   |
| `hooks/`                      | `usePermission`/`<Can>`, `useClinicDb`, `useZodForm`, `useRunAction`, `useHotkeys`, `useUnsavedGuard`, `useNow`, `useLookups`.                                                                                                        |
| `tests/unit`, `tests/e2e`     | Vitest and Playwright.                                                                                                                                                                                                                |

## Data flow for a write

1. A form validates with its Zod schema (react-hook-form + `zodResolver`) and shows field errors.
2. The component calls a store action (or a service) through `useRunAction`, which shows a toast and maps any `DomainError.fieldErrors` back onto the form.
3. The store action re-validates with Zod (`validate()`), enforces business rules (`assert()`), updates state with immer, and appends an audit event (`audit()`).
4. `persist` writes the store to `localStorage`.

Business rules enforced inside actions (and covered by tests in `tests/unit/stores.test.ts`):

- Posted procedure notes cannot be edited — only addenda.
- An episode cannot be closed without an outcome and a closing note; reopening needs an approved `file-reopen` request.
- Payments must be positive; refunds go through the approvals engine and cannot exceed what was paid.
- Dispensing checks usable (non-expired) stock and deducts earliest-expiry batches first.
- No duplicate person with the same name + date of birth + phone (unless explicitly confirmed).
- Embryo status moves require a different, active embryologist as witness with the correct PIN.
- Nobody approves their own request; rejections need a reason.

## Permissions (RBAC)

- `lib/permissions.ts` defines 41 capabilities and the default matrix for 12 roles. The live matrix sits in the settings store and is editable in Admin → Roles & permissions.
- `usePermission`, `useCan` and `<Can>` gate UI. The sidebar hides items the role can't use.
- `AppShell` maps the current path to a capability. If the role lacks it, the attempt is audited (`access-denied`) and the user is sent to `/forbidden` (403).
- Donor and surrogate identity is shown only to roles with `donors.identity`. Other clinical roles can "break glass", which is audited.

## Hydration

Stores use `skipHydration`. `StoreGate` (in `AppProviders`) rehydrates all stores on mount and shows a splash until ready, so server and client markup never disagree. Stores with nothing saved yet are filled from the seed. The seed module is dynamically imported only then, keeping it out of the main bundle.

## Printing and export

- `PrintDialog` (react-to-print) previews and prints A4 sheets built with `PrintSheet`: clinic letterhead, patient identifiers, page numbers and a "DEMO DATA" watermark via `@page` and print CSS in `app/globals.css`. Sheets: patient summary, cycle summary, procedure report, consent, receipt, statement, straw label (QR code), and every report.
- `DataTable` exports the filtered rows as CSV or PDF (jsPDF + autotable).

## Testing

- `tests/unit/seed.test.ts` — every seed record passes its schema; determinism; spec counts.
- `tests/unit/stores.test.ts` — business rules, audit, reset.
- `tests/unit/dashboard.test.ts` — every dashboard tile equals an independent count of the list it links to, across branch scopes and date ranges; charts and alerts come from data.
- `tests/unit/permissions.test.ts` — allowed and denied routes for every role.
- `tests/e2e/demo-script.spec.ts` — the demo script across six roles, asserting no console errors.
