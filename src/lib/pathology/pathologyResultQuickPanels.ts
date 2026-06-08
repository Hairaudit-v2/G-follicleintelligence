import type { PathologyResultItemFlag } from "./pathologyResultTypes";

export type PathologyResultQuickRow = {
  test_code: string | null;
  test_label: string;
  result_unit: string | null;
  reference_range: string | null;
  flag: PathologyResultItemFlag;
};

export type PathologyResultQuickPanel = {
  id: string;
  label: string;
  rows: PathologyResultQuickRow[];
};

/** Preset marker rows (values left blank for the clinician to fill). */
export const PATHOLOGY_RESULT_QUICK_PANELS: PathologyResultQuickPanel[] = [
  {
    id: "iron_studies",
    label: "Iron studies",
    rows: [
      { test_code: "FERR", test_label: "Ferritin", result_unit: "µg/L", reference_range: null, flag: "unknown" },
      { test_code: "FE", test_label: "Serum iron", result_unit: "µmol/L", reference_range: null, flag: "unknown" },
      { test_code: "TIBC", test_label: "TIBC", result_unit: "µmol/L", reference_range: null, flag: "unknown" },
      { test_code: "TRF_SAT", test_label: "Transferrin saturation", result_unit: "%", reference_range: null, flag: "unknown" },
    ],
  },
  {
    id: "thyroid",
    label: "Thyroid",
    rows: [
      { test_code: "TSH", test_label: "TSH", result_unit: "mIU/L", reference_range: null, flag: "unknown" },
      { test_code: "FT4", test_label: "Free T4", result_unit: "pmol/L", reference_range: null, flag: "unknown" },
      { test_code: "FT3", test_label: "Free T3", result_unit: "pmol/L", reference_range: null, flag: "unknown" },
    ],
  },
  {
    id: "vitamins",
    label: "Vitamins",
    rows: [
      { test_code: "B12", test_label: "Vitamin B12", result_unit: "pmol/L", reference_range: null, flag: "unknown" },
      { test_code: "FOL", test_label: "Folate (serum)", result_unit: "nmol/L", reference_range: null, flag: "unknown" },
      { test_code: "VITD", test_label: "25-OH vitamin D", result_unit: "nmol/L", reference_range: null, flag: "unknown" },
    ],
  },
  {
    id: "hormones",
    label: "Hormones",
    rows: [
      { test_code: "TESTO", test_label: "Testosterone", result_unit: "nmol/L", reference_range: null, flag: "unknown" },
      { test_code: "SHBG", test_label: "SHBG", result_unit: "nmol/L", reference_range: null, flag: "unknown" },
      { test_code: "E2", test_label: "Estradiol", result_unit: "pmol/L", reference_range: null, flag: "unknown" },
      { test_code: "LH", test_label: "LH", result_unit: "IU/L", reference_range: null, flag: "unknown" },
      { test_code: "FSH", test_label: "FSH", result_unit: "IU/L", reference_range: null, flag: "unknown" },
      { test_code: "PRL", test_label: "Prolactin", result_unit: "mIU/L", reference_range: null, flag: "unknown" },
    ],
  },
  {
    id: "inflammatory",
    label: "Inflammatory markers",
    rows: [
      { test_code: "CRP", test_label: "CRP", result_unit: "mg/L", reference_range: null, flag: "unknown" },
      { test_code: "ESR", test_label: "ESR", result_unit: "mm/hr", reference_range: null, flag: "unknown" },
    ],
  },
  {
    id: "preop_safety",
    label: "Pre-op safety screen",
    rows: [
      { test_code: "FBC", test_label: "Full blood count", result_unit: null, reference_range: null, flag: "unknown" },
      { test_code: "UE", test_label: "Urea & electrolytes", result_unit: null, reference_range: null, flag: "unknown" },
      { test_code: "LFT", test_label: "Liver function tests", result_unit: null, reference_range: null, flag: "unknown" },
      { test_code: "COAG", test_label: "Coagulation screen", result_unit: null, reference_range: null, flag: "unknown" },
      { test_code: "G&S", test_label: "Group & save", result_unit: null, reference_range: null, flag: "unknown" },
      { test_code: "HIV", test_label: "HIV serology", result_unit: null, reference_range: null, flag: "unknown" },
      { test_code: "HBSAG", test_label: "Hepatitis B surface antigen", result_unit: null, reference_range: null, flag: "unknown" },
      { test_code: "HCV", test_label: "Hepatitis C antibody", result_unit: null, reference_range: null, flag: "unknown" },
    ],
  },
];
