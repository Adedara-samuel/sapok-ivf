import type { ConsentTemplate } from "@/lib/schemas/admin";
import type { CycleOutcome, CycleProtocol, CycleStage } from "@/lib/schemas/cycle";
import type { EpisodeType } from "@/lib/schemas/episode";
import type { ProcedureType } from "@/lib/schemas/procedure";

export const DIAGNOSES = [
  "Tubal factor",
  "Male factor",
  "PCOS",
  "Diminished ovarian reserve",
  "Endometriosis",
  "Unexplained",
  "Recurrent implantation failure",
  "Recurrent miscarriage",
  "Uterine factor",
  "Advanced maternal age",
  "Poor responder",
] as const;

export const EPISODE_TYPE_LABELS: Record<EpisodeType, string> = {
  IVF: "IVF",
  ICSI: "ICSI",
  IUI: "IUI",
  FET: "FET",
  "DONOR-OOCYTE": "Donor oocyte",
  "DONOR-SPERM": "Donor sperm",
  SURROGACY: "Surrogacy",
};

export const STAGE_LABELS: Record<CycleStage, string> = {
  baseline: "Baseline",
  downreg: "Down-regulation",
  stimulation: "Stimulation",
  trigger: "Trigger",
  ocr: "Oocyte retrieval",
  fertilisation: "Fertilisation",
  culture: "Embryo culture",
  transfer: "Transfer",
  luteal: "Luteal support",
  "pregnancy-test": "Pregnancy test",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const OUTCOME_LABELS: Record<CycleOutcome, string> = {
  pending: "Pending",
  biochemical: "Biochemical",
  "clinical-pregnancy": "Clinical pregnancy",
  ongoing: "Ongoing pregnancy",
  "live-birth": "Live birth",
  miscarriage: "Miscarriage",
  negative: "Negative",
  cancelled: "Cancelled",
};

export interface ProtocolTemplate {
  id: CycleProtocol;
  name: string;
  description: string;
  drugs: string[];
}

export const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: "antagonist",
    name: "GnRH antagonist",
    description: "Gonadotrophins from D2, antagonist from D6 or lead follicle 14 mm; trigger at ≥3 follicles ≥17 mm.",
    drugs: [
      "Follitropin alfa 300 IU pen",
      "Menotrophin 150 IU inj",
      "Cetrorelix 0.25 mg",
      "Choriogonadotropin alfa 250 mcg",
    ],
  },
  {
    id: "long-agonist",
    name: "Long agonist",
    description: "Down-regulation from mid-luteal phase, stimulation once suppressed (E2 <50, lining <5 mm).",
    drugs: ["Triptorelin 0.1 mg", "Leuprorelin 3.75 mg depot", "Follitropin alfa 150 IU", "hCG 5000 IU"],
  },
  {
    id: "mild",
    name: "Mild stimulation",
    description: "Letrozole or clomiphene with low-dose gonadotrophin for poor responders.",
    drugs: ["Letrozole 2.5 mg", "Menotrophin 150 IU inj"],
  },
  {
    id: "natural",
    name: "Natural cycle",
    description: "Monitoring of the natural dominant follicle; IUI or single-oocyte retrieval.",
    drugs: ["hCG 5000 IU"],
  },
  {
    id: "fet-hrt",
    name: "FET — HRT",
    description: "Estradiol valerate from D2; add progesterone when lining ≥7 mm; transfer on P+5 for blastocysts.",
    drugs: ["Estradiol valerate 2 mg tabs", "Progesterone in oil 100 mg/2 ml", "Progesterone vaginal gel"],
  },
  {
    id: "fet-natural",
    name: "FET — natural",
    description: "LH-surge timed transfer with luteal progesterone support.",
    drugs: ["Micronised progesterone 200 mg caps"],
  },
];

export interface ProcedureFormConfig {
  type: ProcedureType;
  label: string;
  countLabel?: string;
  showEmbryologist: boolean;
  showScrubNurse: boolean;
  showEmbryoGrade: boolean;
  showTransferred: boolean;
  noteLabel: string;
  noteTemplate: string;
  chargeCode?: string;
}

export const DEFAULT_PROCEDURE_FORMS: ProcedureFormConfig[] = [
  {
    type: "OCR",
    label: "Oocyte retrieval (OCR)",
    countLabel: "Eggs retrieved",
    showEmbryologist: true,
    showScrubNurse: true,
    showEmbryoGrade: false,
    showTransferred: false,
    noteLabel: "Post-op note",
    noteTemplate:
      "TVS-guided OCR under IV sedation. Both ovaries accessible. Minimal blood loss. Patient stable post-op.",
    chargeCode: "SVC-OCR",
  },
  {
    type: "PRP",
    label: "Platelet-rich plasma (PRP)",
    countLabel: "Sessions",
    showEmbryologist: false,
    showScrubNurse: true,
    showEmbryoGrade: false,
    showTransferred: false,
    noteLabel: "Remark",
    noteTemplate: "Autologous PRP prepared and instilled. Tolerated well.",
    chargeCode: "SVC-PRP",
  },
  {
    type: "CYST_DRAINAGE",
    label: "Cyst drainage",
    countLabel: "Cysts drained",
    showEmbryologist: false,
    showScrubNurse: true,
    showEmbryoGrade: false,
    showTransferred: false,
    noteLabel: "Post-op note",
    noteTemplate: "TVS-guided aspiration of simple ovarian cyst. Clear fluid sent for cytology.",
    chargeCode: "SVC-CYST",
  },
  {
    type: "PGT",
    label: "PGT biopsy",
    countLabel: "Embryos biopsied",
    showEmbryologist: true,
    showScrubNurse: false,
    showEmbryoGrade: true,
    showTransferred: false,
    noteLabel: "Remark",
    noteTemplate: "Trophectoderm biopsy performed on D5/D6 blastocysts; samples tubed and sent for PGT-A.",
    chargeCode: "SVC-PGT",
  },
  {
    type: "ET",
    label: "Embryo transfer (ET)",
    showEmbryologist: true,
    showScrubNurse: true,
    showEmbryoGrade: true,
    showTransferred: true,
    noteLabel: "Post-op note",
    noteTemplate: "Atraumatic transfer under TAS guidance. Catheter checked, no retained embryo. Bed rest 20 min.",
    chargeCode: "SVC-ET",
  },
  {
    type: "FET",
    label: "Frozen embryo transfer (FET)",
    showEmbryologist: true,
    showScrubNurse: true,
    showEmbryoGrade: true,
    showTransferred: true,
    noteLabel: "Post-op note",
    noteTemplate: "Warmed blastocyst(s) survived 100%. Smooth transfer under ultrasound guidance.",
    chargeCode: "SVC-ET",
  },
  {
    type: "ANDROLOGY",
    label: "Andrology (sperm preparation)",
    countLabel: "Motile count (million)",
    showEmbryologist: true,
    showScrubNurse: false,
    showEmbryoGrade: false,
    showTransferred: false,
    noteLabel: "Remark",
    noteTemplate: "Density-gradient preparation; post-wash motility recorded.",
  },
  {
    type: "BIOPSY",
    label: "Testicular biopsy (TESA/TESE)",
    countLabel: "Samples obtained",
    showEmbryologist: true,
    showScrubNurse: true,
    showEmbryoGrade: false,
    showTransferred: false,
    noteLabel: "Post-op note",
    noteTemplate: "Percutaneous testicular sperm aspiration under local anaesthesia. Motile sperm seen.",
  },
];

export interface ConsentTemplateConfig {
  id: ConsentTemplate;
  title: string;
  version: string;
  validityMonths?: number;
  body: string;
}

export const DEFAULT_CONSENT_TEMPLATES: ConsentTemplateConfig[] = [
  {
    id: "ivf",
    title: "Consent to IVF treatment",
    version: "v3.1",
    body: "We consent to ovarian stimulation, oocyte retrieval, insemination of oocytes and transfer of embryos. The risks, including ovarian hyperstimulation syndrome, multiple pregnancy and the possibility that treatment may not result in pregnancy, have been explained to us.",
  },
  {
    id: "icsi",
    title: "Consent to ICSI",
    version: "v2.4",
    body: "We consent to intracytoplasmic sperm injection. We understand ICSI does not guarantee fertilisation and that a small increased risk of certain genetic conditions has been discussed.",
  },
  {
    id: "cryo-storage",
    title: "Consent to cryopreservation and storage",
    version: "v2.0",
    validityMonths: 12,
    body: "We consent to the freezing and storage of our embryos/gametes for an initial period of 12 months, renewable annually. Storage fees apply and we must notify the clinic of any change of address.",
  },
  {
    id: "embryo-disposition",
    title: "Embryo disposition",
    version: "v1.6",
    body: "In the event of death, incapacity, separation or non-renewal of storage, we direct the clinic on how stored embryos should be handled as recorded on this form.",
  },
  {
    id: "donor",
    title: "Donor programme consent",
    version: "v1.9",
    body: "We consent to the use of anonymised donor gametes. We understand that the donor's identity will not be disclosed and that we will be the legal parents of any child born.",
  },
  {
    id: "surrogacy",
    title: "Surrogacy arrangement consent",
    version: "v1.3",
    body: "We consent to the transfer of our embryos to the matched gestational carrier under the signed surrogacy agreement, subject to all legal and medical clearances.",
  },
  {
    id: "anaesthesia",
    title: "Consent to sedation/anaesthesia",
    version: "v4.0",
    body: "I consent to intravenous sedation for my procedure. I confirm I have fasted for at least 6 hours and understand the risks discussed with the anaesthetist.",
  },
  {
    id: "pgt",
    title: "Consent to preimplantation genetic testing",
    version: "v1.2",
    body: "We consent to trophectoderm biopsy and PGT-A. We understand the limits of testing, including mosaic results and a small risk of embryo damage.",
  },
];

export const INJECTION_DRUGS = [
  "Follitropin alfa 300 IU pen",
  "Follitropin alfa 150 IU",
  "Menotrophin 150 IU inj",
  "Cetrorelix 0.25 mg",
  "Ganirelix 0.25 mg",
  "Triptorelin 0.1 mg",
  "Estradiol valerate 2 mg tabs",
  "Letrozole 2.5 mg",
] as const;

export const NOTE_QUICK_PHRASES = [
  "Consents signed.",
  "Baseline scan: endometrium ___ mm, AFC ___.",
  "For D10 follicular scan.",
  "Trigger tonight at 22:00; OCR in 36 hours.",
  "Counselled on OHSS warning signs.",
  "Continue luteal support; beta-hCG in 14 days.",
  "Patient stable, discharged home with escort.",
] as const;

export const NOTE_TEMPLATES: { label: string; body: string }[] = [
  {
    label: "Baseline visit",
    body: "Came in on D2 of cycle for commencement of IVF; consents signed; baseline scan endometrium ___ mm; AFC R__ L__. Start stimulation tonight.",
  },
  {
    label: "Monitoring scan",
    body: "D__ follicular scan: leading follicles __/__ mm. E2 ____. Continue current dose; add antagonist. Next scan in 2 days.",
  },
  {
    label: "Pre-OCR review",
    body: "Fasted, consents for anaesthesia signed. Trigger taken at __:__. Vitals stable. For OCR.",
  },
  {
    label: "Post-transfer",
    body: "ET done, __ blastocyst(s) transferred. Continue progesterone support. Beta-hCG on __/__.",
  },
];

export const COMPLEXIONS = ["Fair", "Light brown", "Medium brown", "Dark brown", "Dark"] as const;
