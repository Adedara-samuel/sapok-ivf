# Demo script (about 12 minutes)

Before you start: open **Admin → Data tools → Reset demo data** (or the footer button) so the data matches this script. Password for every user: `Demo@1234`. 2-step code for doctor, accountant and admin: `123456`. Sign out from the user menu (top right) between steps, or use the topbar **role switcher** to change role without signing out.

The **Guided demo** button in the footer runs a 10-step tour of the same screens.

---

## 1. Front desk — dashboard, waiting list, registration (2 min)

| Click path                                                                                         | Expected result                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login → quick-pick **Peace Ogaga** → Sign in                                                       | Dashboard: 8 live tiles, 5 charts, today's schedule, alerts, recent patients.                                                                        |
| Click the **Front-desk postings today** tile                                                       | Waiting list for today: 6 visits (2 waiting, 1 called, 2 in consultation, 1 completed) with live wait timers; yesterday's 2 no-shows below.          |
| Point out **Tonye Cookey** (first visit, waiting)                                                  | Status chip "Waiting", timer counting.                                                                                                               |
| **Register new** → enter Tonye Cookey with her existing DOB and phone (copy from her patient file) | On Continue, a **Possible duplicate patient** dialog offers _Open existing file (merge)_ or _Continue as new record_. Choose **Open existing file**. |
| On Tonye's file → **Open episode** → IVF, Dr. Ifeoma Nwosu, _Unexplained_                          | Episode opens with the next IVF number; clinical tabs become available.                                                                              |
| (Optional) **Patients → New registration** for a brand-new couple                                  | 5-step wizard with calendar date pickers and age auto-calculated; PRN and IVF number assigned on save.                                               |

## 2. Counsellor — note and consent (1 min)

| Click path                                                                                             | Expected result                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Switch role to **Counsellor** → **Counselling**                                                        | "Today" tab; switch to **All** to see the 14 seeded records.                                                                     |
| **Add counselling note** → pick Tonye Cookey → client type _New_ → tick checklist items → notes → Save | Note saved; appears in Today. Phones and blood group fill in from the record.                                                    |
| Open the note (**View**) → **Print consent to IVF treatment**                                          | A4 consent preview with letterhead, identifiers, signature lines and a DEMO watermark; **Print** opens the browser print dialog. |

## 3. Doctor — couple 1 (2 min)

| Click path                                                                                       | Expected result                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login as **Dr. Ifeoma Nwosu** (code `123456`) → search (Ctrl+K) "Adaobi"                         | Patient file: sticky header with PRN, IVF no, age, partner, payer, outstanding balance.                                                          |
| **Notes** tab → Template → _Monitoring scan_ → edit → **Post note**                              | Note appears, locked; **Addendum** adds a time-stamped correction.                                                                               |
| **Prescriptions** → **Add pharmacy item** → Cetrorelix 0.25 mg, 0.25 mg SC, daily, 5 days, qty 5 | Amount auto-calculated; order goes to the pharmacy queue and the charge to billing.                                                              |
| **Cycles** → Cycle 2                                                                             | Cycle workspace: stage stepper (Stimulation), monitoring table (D2/D5/D6/D8), **follicle growth**, endometrium and hormone charts, dose changes. |
| **Add entry** → D10 scan with follicle sizes                                                     | Charts and the patient timeline update immediately.                                                                                              |
| **Trigger planning**                                                                             | "≥3 follicles ≥17 mm" readiness indicator; planned Ovitrelle trigger with OCR timing. **Print summary sheet** shows the A4 cycle summary.        |

## 4. Doctor — couple 2 (1 min)

| Click path                               | Expected result                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Open **Folasade Bello** → **Procedures** | Posted, signed OCR note (12 eggs) — locked, with an andrology note; **Print** gives the procedure report.           |
| **Cycles** → Cycle 1                     | OCR summary 12 / 9 MII / 8 fertilised; embryo list 4AA, 4AB, 3BB; **Transfer planning** shows the 4AA for tomorrow. |

## 5. Embryologist — lab board and cryo (2 min)

| Click path                                                                                               | Expected result                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login as **Emeka Okoro** → **Embryology Lab**                                                            | Daily board D0–D6, cards grouped by patient.                                                                                                                                  |
| On a culturing embryo → **Grade** → D5, 4AB → Save                                                       | Grade badge updates; the custody log records it.                                                                                                                              |
| **Move** → _Freeze (vitrify)_ → position auto-suggested → witness **Zainab Lawal**, PIN `4321` → Confirm | Embryo leaves the board; wrong PIN or same person is rejected.                                                                                                                |
| **Cryo map** tab → search "Bello"                                                                        | Tank/canister/goblet/straw grid with fill levels; red/amber rings for expired/expiring consents. Select a straw → **Print straw label** (QR code), Move, Warm, Renew consent. |

## 6. Pharmacist — dispense (1 min)

| Click path                                 | Expected result                                                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login as **Chidi Eze** → **Pharmacy**      | Dispense queue with stock on hand; alert banner for low stock and expiring batches.                                                                 |
| **Dispense** Adaobi's Cetrorelix → confirm | Stock drops (earliest-expiry batch first); the dispensed status shows on her file.                                                                  |
| **Stock** tab                              | Batches with expiry badges; Ovitrelle, Cabergoline and Leuprorelin below reorder level. **Cancelled drugs** tab lists 6 cancellations with reasons. |

## 7. Accountant — payments and reports (1 min)

| Click path                                                                             | Expected result                                                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Login as **Sade Johnson** (code `123456`) → **Billing**                                | Outstanding, 30-day collections, 90+ days, pending HMO claims.                          |
| **Check account balance** → "IVF-2026-0001" → open → **Record payment** → ₦50,000 cash | Receipt number issued; balance, aging and statement update; **Receipt** prints.         |
| **Aging** and **Account report** tabs                                                  | Aging buckets chart; report filtered by date, payer and department with CSV/PDF export. |

## 8. Manager — approvals and analytics (1.5 min)

| Click path                                                                      | Expected result                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Login as **Osaze Idemudia** → **Requests** → **Approvals inbox**                | 6 pending requests. Approve one; reject one with a reason. Requesters get a bell notification.                |
| **Dashboard** → date range _Last 12 months_                                     | Every tile and chart recomputes.                                                                              |
| **Reports → Success-rate analytics** → group by _Age band_, then _Embryologist_ | Fertilisation, cleavage, blastocyst, implantation, clinical pregnancy and live-birth rates. **Export → PDF**. |

## 9. Admin — permissions, audit, reset (1 min)

| Click path                                                                | Expected result                                                                                                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Login as **Demo Admin** (code `123456`) → **Admin → Roles & permissions** | Live matrix; untick _billing.view_ for Front Desk and their Billing menu disappears immediately.                             |
| **Audit log** → search "Access denied"                                    | The nurse's earlier attempt on `/billing`, plus every action from this demo. Filter by user, action, entity or date; export. |
| **Data tools → Reset demo data**                                          | Everything returns to the seed.                                                                                              |

### Showing the 403 page

Login as **Grace Otuyo** (nurse) and go to `/billing`: a styled 403 page appears and an `access-denied` audit event is recorded.
