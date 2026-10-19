# Overcare IVF

A presentation-ready IVF clinic management system built with Next.js. It runs **entirely in the browser on synthetic data**: there is no backend, database or API. Every screen, form, report and print works against in-browser Zustand stores saved to `localStorage`.

> All patients, staff and records are fictional. Do not enter real patient information.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Production build:

```bash
pnpm build
pnpm start        # http://localhost:3000 (add -p 3100 for another port)
```

Requirements: Node 20+ (tested on Node 24) and pnpm 10+ (tested on pnpm 11).

## Signing in

Every demo account uses the password **`Demo@1234`**. The login page shows a quick-pick card for each user.

| Account                       | Role                                  | Notes                                           |
| ----------------------------- | ------------------------------------- | ----------------------------------------------- |
| Demo Admin (`admin@rhv.demo`) | Admin — **full access to everything** | 2-step code `123456`                            |
| Dr. Ifeoma Nwosu              | Doctor                                | 2-step code `123456`                            |
| Sade Johnson                  | Accountant                            | 2-step code `123456`                            |
| Peace Ogaga                   | Front desk                            |                                                 |
| Grace Otuyo                   | Nurse                                 | Cannot open Billing (demonstrates the 403 page) |
| Emeka Okoro / Zainab Lawal    | Embryologists                         | Witness PIN for lab moves: `4321`               |
| Chidi Eze                     | Pharmacist                            |                                                 |
| Osaze Idemudia                | Manager / approver                    |                                                 |

**My profile** (user menu → _My profile & password_): every user can see their own account details (read-only; only an administrator can change them), the permissions their role grants and their recent activity. They can also **change their password** without re-entering the current one, since they are already signed in (8+ characters with upper and lower case, a number and a symbol). Once changed, that user signs in with their own password; Admin → Users → _Reset password_ or **Reset demo data** returns them to `Demo@1234`.

The topbar **role switcher** lets you view the app as any role without signing out.

## Scripts

| Command                     | What it does                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                  | Development server                                                                                                              |
| `pnpm build` / `pnpm start` | Production build and server                                                                                                     |
| `pnpm typecheck`            | `tsc --noEmit` (strict)                                                                                                         |
| `pnpm lint`                 | ESLint (Next core-web-vitals + TypeScript rules)                                                                                |
| `pnpm test`                 | Vitest unit tests (schemas, seed, stores, business rules, dashboard reconciliation, permissions)                                |
| `pnpm test:e2e`             | Playwright: the demo script end-to-end against a production build (`pnpm build` first; `E2E_PORT` picks the port, default 3100) |
| `pnpm format`               | Prettier                                                                                                                        |

## Demo data

- **Reset demo data** (footer, or Admin → Data tools) restores the exact seed.
- The seed is anchored to _today_, so appointments, scans and expiries always look current. If you open the app on a later day, a banner offers a reset to move dates forward.
- Admin → Data tools also exports everything as JSON and imports a previous export (validated with Zod).

## Where to go next

- [DEMO-SCRIPT.md](DEMO-SCRIPT.md) — the 12-minute walkthrough
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the app is put together
- [DECISIONS.md](DECISIONS.md) — choices and deviations from the brief
- [DATA-DICTIONARY.md](DATA-DICTIONARY.md) — every entity and field
