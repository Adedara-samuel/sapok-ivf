import type { CatalogItem } from "@/lib/schemas/orders";

export const LAB_CATALOG: CatalogItem[] = [
  { code: "LAB-AMH", name: "AMH", kind: "lab", price: 25_000, refRange: "1.0–4.0 ng/mL" },
  { code: "LAB-FSH", name: "FSH", kind: "lab", price: 8_000, refRange: "3.5–12.5 IU/L (D2–3)" },
  { code: "LAB-LH", name: "LH", kind: "lab", price: 8_000, refRange: "2.4–12.6 IU/L" },
  { code: "LAB-E2", name: "Estradiol E2", kind: "lab", price: 9_000, refRange: "pg/mL by cycle day" },
  { code: "LAB-P4", name: "Progesterone", kind: "lab", price: 9_000, refRange: "<1.5 ng/mL at trigger" },
  { code: "LAB-PRL", name: "Prolactin", kind: "lab", price: 8_000, refRange: "4.8–23.3 ng/mL" },
  { code: "LAB-TSH", name: "TSH", kind: "lab", price: 8_000, refRange: "0.4–2.5 mIU/L (fertility)" },
  { code: "LAB-BHCG", name: "Beta-hCG quantitative", kind: "lab", price: 10_000, refRange: ">25 IU/L positive" },
  { code: "LAB-SA", name: "Semen analysis", kind: "lab", price: 10_000, refRange: "WHO 2021" },
  { code: "LAB-SDF", name: "Sperm DNA fragmentation", kind: "lab", price: 60_000, refRange: "<30% DFI" },
  { code: "LAB-VIRAL", name: "Viral screen HIV/HBsAg/HCV/VDRL", kind: "lab", price: 20_000, refRange: "Non-reactive" },
  { code: "LAB-BGG", name: "Blood group and genotype", kind: "lab", price: 8_000 },
  { code: "LAB-FBC", name: "FBC", kind: "lab", price: 6_000, refRange: "Hb 11.5–16.5 g/dL" },
  { code: "LAB-VITD", name: "Vitamin D", kind: "lab", price: 20_000, refRange: "30–100 ng/mL" },
  { code: "LAB-KARYO", name: "Karyotype", kind: "lab", price: 90_000 },
  { code: "LAB-TAB", name: "Thyroid antibodies", kind: "lab", price: 22_000, refRange: "TPO <35 IU/mL" },
];

export const RADIOLOGY_CATALOG: CatalogItem[] = [
  { code: "RAD-BTVS", name: "Baseline transvaginal scan", kind: "radiology", price: 15_000 },
  { code: "RAD-FTS", name: "Follicular tracking scan", kind: "radiology", price: 12_000 },
  { code: "RAD-HSG", name: "HSG", kind: "radiology", price: 45_000 },
  { code: "RAD-SSG", name: "Saline sonohysterography", kind: "radiology", price: 40_000 },
  { code: "RAD-3D", name: "3D pelvic scan", kind: "radiology", price: 25_000 },
  { code: "RAD-HYS", name: "Hysteroscopy", kind: "radiology", price: 150_000 },
];

export const SERVICE_CATALOG: CatalogItem[] = [
  { code: "SVC-CONS", name: "Consultation", kind: "service", price: 30_000 },
  { code: "SVC-COUN", name: "Counselling session", kind: "service", price: 15_000 },
  { code: "SVC-IVF", name: "IVF fresh cycle package", kind: "service", price: 1_850_000 },
  { code: "SVC-ICSI", name: "ICSI add-on", kind: "service", price: 250_000 },
  { code: "SVC-FET", name: "FET cycle package", kind: "service", price: 650_000 },
  { code: "SVC-IUI", name: "IUI cycle", kind: "service", price: 220_000 },
  { code: "SVC-OCR", name: "Oocyte retrieval", kind: "service", price: 350_000 },
  { code: "SVC-ET", name: "Embryo transfer", kind: "service", price: 200_000 },
  { code: "SVC-AH", name: "Assisted hatching", kind: "service", price: 120_000 },
  { code: "SVC-GLUE", name: "Embryo glue", kind: "service", price: 60_000 },
  { code: "SVC-PRP", name: "PRP", kind: "service", price: 120_000 },
  { code: "SVC-CYST", name: "Cyst drainage", kind: "service", price: 150_000 },
  { code: "SVC-PGT", name: "PGT-A up to 5 embryos", kind: "service", price: 900_000 },
  { code: "SVC-CRYO", name: "Embryo cryopreservation first year", kind: "service", price: 180_000 },
  { code: "SVC-STOR", name: "Annual storage renewal", kind: "service", price: 90_000 },
  { code: "SVC-DONOR", name: "Donor oocyte programme fee", kind: "service", price: 1_200_000 },
  { code: "SVC-SURR", name: "Surrogacy coordination fee", kind: "service", price: 2_500_000 },
];

export interface DrugSeed {
  code: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
  reorderLevel: number;
}

export const DRUG_SEED: DrugSeed[] = [
  { code: "DRG-MENO150", name: "Menotrophin 150 IU inj", unit: "vial", price: 46_000, stock: 120, reorderLevel: 30 },
  { code: "DRG-FOL300", name: "Follitropin alfa 300 IU pen", unit: "pen", price: 120_000, stock: 40, reorderLevel: 10 },
  { code: "DRG-FOL150", name: "Follitropin alfa 150 IU", unit: "vial", price: 70_000, stock: 60, reorderLevel: 15 },
  { code: "DRG-CET", name: "Cetrorelix 0.25 mg", unit: "vial", price: 38_000, stock: 80, reorderLevel: 20 },
  { code: "DRG-GAN", name: "Ganirelix 0.25 mg", unit: "syringe", price: 40_000, stock: 70, reorderLevel: 20 },
  { code: "DRG-LEU", name: "Leuprorelin 3.75 mg depot", unit: "depot", price: 75_000, stock: 30, reorderLevel: 8 },
  { code: "DRG-TRIP", name: "Triptorelin 0.1 mg", unit: "ampoule", price: 12_000, stock: 90, reorderLevel: 20 },
  { code: "DRG-HCG", name: "hCG 5000 IU", unit: "ampoule", price: 14_000, stock: 100, reorderLevel: 25 },
  { code: "DRG-OVI", name: "Choriogonadotropin alfa 250 mcg", unit: "pen", price: 45_000, stock: 40, reorderLevel: 10 },
  {
    code: "DRG-PIO",
    name: "Progesterone in oil 100 mg/2 ml",
    unit: "ampoule",
    price: 1_500,
    stock: 400,
    reorderLevel: 80,
  },
  {
    code: "DRG-MPROG",
    name: "Micronised progesterone 200 mg caps",
    unit: "pack of 15",
    price: 9_000,
    stock: 150,
    reorderLevel: 30,
  },
  { code: "DRG-PGEL", name: "Progesterone vaginal gel", unit: "box", price: 28_000, stock: 60, reorderLevel: 15 },
  {
    code: "DRG-EV2",
    name: "Estradiol valerate 2 mg tabs",
    unit: "pack of 28",
    price: 6_000,
    stock: 120,
    reorderLevel: 25,
  },
  { code: "DRG-LET", name: "Letrozole 2.5 mg", unit: "pack of 10", price: 4_500, stock: 150, reorderLevel: 30 },
  { code: "DRG-CLO", name: "Clomiphene 50 mg", unit: "pack of 10", price: 3_500, stock: 150, reorderLevel: 30 },
  { code: "DRG-MET", name: "Metformin 500 mg", unit: "pack of 30", price: 2_000, stock: 200, reorderLevel: 40 },
  { code: "DRG-FA", name: "Folic acid 5 mg", unit: "pack of 30", price: 1_500, stock: 300, reorderLevel: 50 },
  { code: "DRG-VD3", name: "Vitamin D3", unit: "pack", price: 3_000, stock: 200, reorderLevel: 40 },
  { code: "DRG-COQ", name: "Coenzyme Q10", unit: "pack", price: 14_000, stock: 90, reorderLevel: 20 },
  { code: "DRG-ASP", name: "Aspirin 75 mg", unit: "pack of 30", price: 1_000, stock: 300, reorderLevel: 50 },
  { code: "DRG-ENOX", name: "Enoxaparin 40 mg", unit: "syringe", price: 6_500, stock: 100, reorderLevel: 25 },
  { code: "DRG-PRED", name: "Prednisolone 5 mg", unit: "pack of 20", price: 1_500, stock: 120, reorderLevel: 25 },
  { code: "DRG-DOXY", name: "Doxycycline 100 mg", unit: "pack of 10", price: 2_500, stock: 150, reorderLevel: 30 },
  { code: "DRG-CAB", name: "Cabergoline 0.5 mg", unit: "pack of 8", price: 12_000, stock: 40, reorderLevel: 10 },
];

export const DRUG_CATALOG: CatalogItem[] = DRUG_SEED.map((d) => ({
  code: d.code,
  name: d.name,
  kind: "drug",
  price: d.price,
  unit: d.unit,
  reorderLevel: d.reorderLevel,
}));

export const FULL_CATALOG: CatalogItem[] = [...LAB_CATALOG, ...RADIOLOGY_CATALOG, ...SERVICE_CATALOG, ...DRUG_CATALOG];

const byCode = new Map(FULL_CATALOG.map((c) => [c.code, c]));

export function catalogItem(code: string): CatalogItem | undefined {
  return byCode.get(code);
}

export interface PackageBundle {
  code: string;
  name: string;
  items: string[];
  instalments: number[];
}

export const PACKAGES: PackageBundle[] = [
  {
    code: "PKG-IVF",
    name: "IVF fresh cycle bundle",
    items: ["SVC-CONS", "SVC-IVF", "SVC-OCR", "SVC-ET"],
    instalments: [50, 30, 20],
  },
  {
    code: "PKG-ICSI",
    name: "ICSI cycle bundle",
    items: ["SVC-CONS", "SVC-IVF", "SVC-ICSI", "SVC-OCR", "SVC-ET"],
    instalments: [50, 30, 20],
  },
  { code: "PKG-FET", name: "FET cycle bundle", items: ["SVC-CONS", "SVC-FET", "SVC-ET"], instalments: [60, 40] },
  { code: "PKG-IUI", name: "IUI cycle bundle", items: ["SVC-CONS", "SVC-IUI", "RAD-FTS"], instalments: [100] },
];

export const HMO_NAMES = ["Hygeia HMO", "AXA Mansard Health", "Reliance HMO", "Leadway Health", "Avon HMO"] as const;
export const CORPORATE_NAMES = [
  "Zenith Petrochem Ltd",
  "Atlantic Shipping Co",
  "Kora Telecoms",
  "Delta Agro Plc",
] as const;
