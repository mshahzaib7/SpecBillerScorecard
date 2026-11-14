export type MetricId = 'ncr' | 'dar' | 'ar90' | 'den' | 'fpr';

export type Specialty = 'behavioral' | 'general' | 'accident' | 'other';

export type PainPointId =
  | 'slowPayment'
  | 'denials'
  | 'oldClaims'
  | 'underCollecting'
  | 'patientBalances'
  | 'noReports'
  | 'unsureBiller'
  | 'staffOverwhelmed';

/** "I don't know" marker for optional numeric fields. */
export const UNKNOWN = 'unknown' as const;
export type Unknown = typeof UNKNOWN;

/**
 * A numeric form value:
 * - number  → the user entered it
 * - null    → left empty
 * - 'unknown' → the user ticked "I don't know" (only allowed on some fields)
 */
export type NumericInput = number | null | Unknown;

export interface ScorecardInputs {
  specialty: Specialty | null;
  /** Only meaningful when specialty = 'accident'. */
  arIncludesAttorneyCases: boolean | null;
  painPoints: readonly PainPointId[];

  // Step 3 — last 3 full months
  charges3: NumericInput;
  adjustments3: NumericInput;
  payments3: NumericInput;
  claimsSubmitted3: NumericInput;
  claimsDenied3: NumericInput; // "I don't know" allowed
  claimsPaidFirstPass3: NumericInput; // "I don't know" allowed

  // Step 4 — today
  totalAR: NumericInput;
  ar90: NumericInput; // "I don't know" allowed
}

export type NumericField =
  | 'charges3'
  | 'adjustments3'
  | 'payments3'
  | 'claimsSubmitted3'
  | 'claimsDenied3'
  | 'claimsPaidFirstPass3'
  | 'totalAR'
  | 'ar90';

export type InputField = NumericField | 'specialty' | 'arIncludesAttorneyCases';

/** Which rule raised a validation issue. The UI turns the code into a message with the visitor's own numbers. */
export type IssueCode =
  | 'required'
  | 'requiredOrUnknown'
  | 'invalidNumber'
  | 'negative'
  | 'notInteger'
  | 'specialtyRequired'
  | 'attorneyRequired'
  | 'adjustmentsTooHigh'
  | 'ar90TooHigh'
  | 'deniedTooHigh'
  | 'firstPassTooHigh'
  | 'deniedPlusFirstPassTooHigh'
  | 'ncrTooHigh'
  | 'ncrNotGraded'
  | 'ncrAbove100'
  | 'darVeryHigh'
  | 'smallClaims';

export interface ValidationIssue {
  field: InputField;
  code: IssueCode;
  message: string;
}

export interface ValidationResult {
  /** True when there are no errors (warnings are allowed). */
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export type Status = 'good' | 'watch' | 'problem';

/**
 * - graded      → value available and counted in the overall score
 * - notGraded   → value available but excluded (Accident / PI attorney-case rule, or
 *                 net collection rate over 105%)
 * - unavailable → "I don't know" or a zero denominator ("Not reported")
 */
export type MetricAvailability = 'graded' | 'notGraded' | 'unavailable';

export interface MetricResult {
  id: MetricId;
  availability: MetricAvailability;
  /** Raw metric value (%, or days). null when unavailable. */
  value: number | null;
  /** value rounded with round1 — the number shown on screen. */
  displayValue: number | null;
  /** Score 0–100 (unrounded). null unless graded. */
  score: number | null;
  status: Status | null;
  topPerformer: boolean;
}

export interface OverallResult {
  /** Overall score rounded ONCE with round1. null when not enough data. */
  score: number | null;
  letter: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  gradedCount: number;
  /** sum(weight × score) — unrounded, for the methodology panel / tests. */
  weightedSum: number;
  /** sum of weights of graded metrics. */
  weightTotal: number;
}

export type MoneyCardId = 'uncollected' | 'cashFaster' | 'deniedAboveTarget' | 'stuckOver90';

export interface MoneyLine {
  /** Unrounded estimate. */
  raw: number;
  /** roundMoney(raw) — what is displayed as "about $X". */
  rounded: number;
  /** True when rounded < MONEY_MIN_DISPLAY: display as "under $100", not "about $0". */
  belowMinimum: boolean;
}

export interface MoneyCard {
  id: MoneyCardId;
  metric: MetricId;
  timeUnit: 'perYear' | 'oneTime' | 'perMonth' | 'rightNow';
  /** 'gap' = worse than Good target; 'roomToGrow' = between Good and Top. */
  kind: 'gap' | 'roomToGrow';
  /** Present only when worse than the Good target. */
  vsGood: MoneyLine | null;
  /** Always present (a card only exists when worse than Top). */
  vsTop: MoneyLine;
  /** AR over 90 only: total money stuck over 90 days (ar90 × netRatio). */
  headline: MoneyLine | null;
}

export interface BaseFigures {
  netCharges: number | null;
  netRatio: number | null;
  avgDailyCharges: number | null;
}

export interface ScorecardResult {
  validation: ValidationResult;
  base: BaseFigures;
  metrics: Record<MetricId, MetricResult>;
  overall: OverallResult;
  /** Ordered: uncollected, cashFaster, deniedAboveTarget, stuckOver90. Never summed. */
  moneyCards: MoneyCard[];
  /** The card used for the headline money line under the grade (first card, in order). */
  headlineCard: MoneyCard | null;
  /** Graded metric with the lowest score below 100 (ties → higher weight, then display order). */
  biggestOpportunity: MetricId | null;
  /** True when DAR and AR90 are excluded by the Accident / PI attorney-case rule. */
  piRuleApplied: boolean;
  /** True when net collection rate is over 105% (and at most 150%): shown, but not graded. */
  ncrRuleApplied: boolean;
}
