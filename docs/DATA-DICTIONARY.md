# Data dictionary

Every entity is defined by a Zod schema in `lib/schemas/` (the single source of truth). Types come from `z.infer`. Dates are ISO `YYYY-MM-DD`, date-times are ISO 8601 UTC, money is in naira (₦), and IDs are prefixed strings.

Persisted stores (`localStorage` key `rhv-ivf:<name>`): `persons`, `staff`, `episodes`, `cycles`, `clinical`, `procedures`, `embryology`, `orders`, `billing`, `programme`, `counselling`, `consents`, `requests`, `notifications`, `waiting`, `audit`, `settings`, `session`, `ui`.

## People

**Person** (`persons`) — a patient, partner, donor or surrogate.

| Field                           | Type                                                                               | Notes                                      |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| id                              | string                                                                             | `PT-…`                                     |
| prn                             | string                                                                             | `PRN-BR01-000101` (per branch, sequential) |
| title                           | Mr / Mrs / Ms / Dr / Chief / Engr                                                  | optional                                   |
| firstName, lastName, otherNames | string                                                                             | min 2 letters                              |
| sex                             | F / M                                                                              |                                            |
| dob                             | date                                                                               | age shown as years, months, days           |
| maritalStatus                   | single / married / divorced / widowed                                              |                                            |
| phone                           | string                                                                             | Nigerian mobile `^0[789][01]\d{8}$`        |
| email                           | string                                                                             | optional                                   |
| address, city, state            | string                                                                             |                                            |
| nextOfKin                       | { name, phone, relationship }                                                      |                                            |
| payer                           | { category: self-pay / corporate / hmo / referral, sponsor?, company?, memberId? } |                                            |
| bloodGroup, genotype            | enums                                                                              | optional                                   |
| allergies                       | string[]                                                                           | shown as red badges                        |
| photoUrl                        | data URL                                                                           | optional (webcam/file)                     |
| roles                           | patient / partner / donor / surrogate                                              |                                            |
| branchId                        | BR-01 (Redemption City)                                                            |                                            |
| createdAt                       | date-time                                                                          |                                            |

Duplicate rule: same first + last name (case-insensitive), DOB and phone.

**Staff** (`staff`): id `S01…`, name, role (frontdesk, doctor, embryologist, nurse, counsellor, pharmacist, lab, radiology, accountant, hr, manager, admin), email, phone, branchId, active, note.

## Treatment

**Episode** (`episodes`) — a couple's treatment course.

| Field                | Notes                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| ivfNo                | `IVF-2026-0001`                                                                             |
| patientId, partnerId | Person ids                                                                                  |
| type                 | IVF, ICSI, IUI, FET, DONOR-OOCYTE, DONOR-SPERM, SURROGACY                                   |
| doctorId             | Staff id                                                                                    |
| status               | open / on-hold / closed                                                                     |
| diagnosis            | string[] (tubal factor, male factor, PCOS, …)                                               |
| openedAt, closedAt   | dates                                                                                       |
| closeReason          | live-birth, pregnancy-ongoing, not-pregnant, miscarriage, withdrawn, transferred-out, other |
| closeNote            | required when closing                                                                       |
| branchId             |                                                                                             |

**Cycle** (`cycles`): episodeId, number, kind (fresh/frozen), protocol (antagonist, long-agonist, mild, natural, fet-hrt, fet-natural), stage (baseline → … → completed / cancelled), lmp, startDate, outcome (pending, biochemical, clinical-pregnancy, ongoing, live-birth, miscarriage, negative, cancelled), amh, afc, trigger {date, drug, time}, ocr {eggs, mii, fertilised}, transferPlan {date, embryoIds}, lutealSupport, betaHcg {date, value}, plan, cancelReason.

**StimulationEntry** (`clinical.stimulation`): cycleId, date, scanDay (e.g. "D8 follicular scan"), injections [{drug, dose}], endometriumMm, follicles {right[], left[]} in mm, e2, lh, progesterone, remark, nextScan, postedBy.

**Note** (`clinical.notes`): episodeId, kind (doctor / nurse / counselling), body, authorId, createdAt, addendumOf (corrections link to the original; notes are never edited).

**Vitals** (`clinical.vitals`): episodeId, phase (pre-op / post-op / routine), at, pulse, resp, bpSys, bpDia, tempC, spo2, postedBy. Flag ranges: pulse 60–100, resp 12–20, BP ≤139/89, temp 36.1–37.5 °C, SpO₂ ≥95%.

**MedicalHistory** (`clinical.histories`): personId, obstetric {gravida, para, living, miscarriages, ectopic}, gynaecological, surgical, medical, drugAllergy, family, semen, updatedAt, updatedBy.

**PatientDocument** (`clinical.documents`): episodeId, name, category (referral, lab-report, scan, consent, id, other), sizeKb, mime, dataUrl (small files only), uploadedAt, uploadedBy.

**Procedure** (`procedures`): cycleId, type (OCR, PRP, CYST_DRAINAGE, PGT, ET, FET, ANDROLOGY, BIOPSY), date, time, surgeonId, embryologistId, scrubNurseId, count, embryoGrade, embryosTransferred, postOpNote, status (draft / posted), signatureDataUrl, signedAt (both required when posted), addenda [{body, authorId, at}].

**Consent** (`consents`): episodeId, template (ivf, icsi, cryo-storage, embryo-disposition, donor, surrogacy, anaesthesia, pgt), version, signerName, witnessName, signatureDataUrl, signedAt, expiresAt.

## Embryology

**Embryo** (`embryology.embryos`): cycleId, label (C1-E3), source (own / donor-oocyte / donor-sperm), day 0–7, stage, grade (e.g. 4AA, 8-cell G1), pgtResult (euploid / aneuploid / mosaic / not-tested), status (culturing, transferred, cryopreserved, thawed, discarded, arrested), storagePositionId.

**StoragePosition** (`embryology.storage`): tank T1–T4, canister 1–6, goblet Red/Blue/Green/Yellow, straw 1–10, itemKind (embryo / oocyte / sperm), itemId, label, ownerPersonId, storedAt, consentExpiry. Capacity: 240 straws per tank.

**CultureLog**: cycleId, date, day, note, incubator, by. **CustodyEvent**: itemId, action (stored, moved, thawed, transferred, discarded, graded, status), detail, at, by, witnessId.

## Orders, pharmacy and billing

**Order** (`orders.orders`): episodeId, kind (lab / radiology / pharmacy / service), catalogCode, name, qty, unitPrice, amount, status (ordered, in-progress, resulted, dispensed, cancelled), dosage, frequency, duration, resultText, abnormal, critical, resultAttachment, resultedAt, cancelReason, dispensedAt, dispensedBy, orderedBy, at.

**DrugBatch**: code, batchNo, qty, expiry, receivedAt. **StockMovement**: code, batchId, delta, reason, kind (receive / dispense / adjust), orderId, at, by. Usable stock excludes expired batches.

**Charge** (`billing.charges`): episodeId, orderId, description, department, amount, **paid**, payer, status (unpaid / part-paid / paid / waived), at. Every order creates one; cancelling the order waives it.

**Payment**: episodeId, amount (> 0), method (cash / transfer / pos / hmo / deposit), reference, receiptNo `RCP-000001`, receivedBy, at.

**Refund**: episodeId, amount, reason, status (pending / approved / rejected), requestId (approval), requestedBy, at.

**HmoClaim**: episodeId, hmo, amount, status (submitted / approved / rejected), submittedAt, decidedAt.

Balance = non-waived charges − payments + approved refunds. Aging buckets: 0–30, 31–60, 61–90, 90+ days on unpaid amounts.

## Programmes

**Donor** (`programme.donors`): personId, kind (oocyte / sperm), code (DON-F-003, anonymised), age, bloodGroup, height, eyeColour, hairColour, complexion, screening {hiv, hepB, hepC, syphilis, karyotype, geneticPanel}, status (screening, available, matched, in-cycle, retired), matchedEpisodeId, amh, history. Eligible = all infection tests negative, karyotype normal, genetic panel clear.

**Surrogate**: personId, code (SUR-002), age, parity, screening {medical, psychological, uterineEval, legal}, status (screening, approved, matched, pregnant, delivered, retired), matchedEpisodeId, legalSignedAt, history.

**Counselling** (`counselling`): personId, partnerId, date, complexion, afc, lmp, bloodGroup, wifePhone, husbandPhone, email, referral, children, clientType (new, returning, donor-recipient, surrogacy-intending), checklist, notes, counsellorId.

## Administration

**StaffRequest** (`requests`): kind (item, leave, manpower, job, reimbursement, confirmation, refund, file-reopen), title, details, amount, startDate, endDate, entityId, attachmentName, requesterId, status, approverId, comment, decidedAt, createdAt. Annual leave allowance: 21 days.

**AppNotification**: userId, title, body, href, at, read.

**WaitingEntry** (`waiting`): personId, episodeId, date, time, arrivedAt, calledAt, seenAt, completedAt, doctorId, purpose, status (waiting → called → in-consultation → completed; or no-show), branchId. Wait time = calledAt − arrivedAt.

**AuditEvent** (`audit`): at, actorId, action (view, create, update, post, cancel, print, export, login, reset, approve, reject, dispense, sign, access-denied, break-glass), entity, entityId, summary.

**Settings** (`settings`): clinic {clinicName, currencySymbol, receiptPrefix, ivfPrefix}, branches, permission matrix, consent templates, procedure form config, protocol templates.
