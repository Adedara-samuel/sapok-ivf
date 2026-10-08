import type {
  AppNotification,
  AuditEvent,
  Charge,
  Consent,
  Counselling,
  CultureLog,
  CustodyEvent,
  Cycle,
  Donor,
  DrugBatch,
  Embryo,
  Episode,
  HmoClaim,
  MedicalHistory,
  Note,
  Order,
  PatientDocument,
  Payment,
  Person,
  Procedure,
  Refund,
  Staff,
  StaffRequest,
  StimulationEntry,
  StockMovement,
  StoragePosition,
  Surrogate,
  Vitals,
  WaitingEntry,
} from "@/lib/schemas";

export interface SeedData {
  anchor: string;
  staff: Staff[];
  persons: Person[];
  episodes: Episode[];
  cycles: Cycle[];
  notes: Note[];
  stimulation: StimulationEntry[];
  vitals: Vitals[];
  histories: MedicalHistory[];
  procedures: Procedure[];
  embryos: Embryo[];
  storage: StoragePosition[];
  cultureLogs: CultureLog[];
  custody: CustodyEvent[];
  orders: Order[];
  batches: DrugBatch[];
  movements: StockMovement[];
  charges: Charge[];
  payments: Payment[];
  refunds: Refund[];
  claims: HmoClaim[];
  donors: Donor[];
  surrogates: Surrogate[];
  counselling: Counselling[];
  consents: Consent[];
  requests: StaffRequest[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  waiting: WaitingEntry[];
  documents: PatientDocument[];
}
