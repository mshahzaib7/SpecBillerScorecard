import {
  UNKNOWN,
  type NumericField,
  type PainPointId,
  type ScorecardInputs,
  type Specialty,
} from '../engine';
import { parseNumber } from './format';

export interface FormState {
  painPoints: PainPointId[];
  specialty: Specialty | null;
  arIncludesAttorneyCases: boolean | null;
  values: Record<NumericField, string>;
  unknown: Record<NumericField, boolean>;
}

const EMPTY_VALUES: Record<NumericField, string> = {
  charges3: '',
  adjustments3: '',
  payments3: '',
  claimsSubmitted3: '',
  claimsDenied3: '',
  claimsPaidFirstPass3: '',
  totalAR: '',
  ar90: '',
};

const NO_UNKNOWN: Record<NumericField, boolean> = {
  charges3: false,
  adjustments3: false,
  payments3: false,
  claimsSubmitted3: false,
  claimsDenied3: false,
  claimsPaidFirstPass3: false,
  totalAR: false,
  ar90: false,
};

export const EMPTY_FORM: FormState = {
  painPoints: [],
  specialty: null,
  arIncludesAttorneyCases: null,
  values: EMPTY_VALUES,
  unknown: NO_UNKNOWN,
};

/** Form strings → engine inputs. */
export function toInputs(f: FormState): ScorecardInputs {
  const field = (k: NumericField) => (f.unknown[k] ? UNKNOWN : parseNumber(f.values[k]));
  return {
    specialty: f.specialty,
    arIncludesAttorneyCases: f.specialty === 'accident' ? f.arIncludesAttorneyCases : null,
    painPoints: f.painPoints,
    charges3: field('charges3'),
    adjustments3: field('adjustments3'),
    payments3: field('payments3'),
    claimsSubmitted3: field('claimsSubmitted3'),
    claimsDenied3: field('claimsDenied3'),
    claimsPaidFirstPass3: field('claimsPaidFirstPass3'),
    totalAR: field('totalAR'),
    ar90: field('ar90'),
  };
}

const commas = (n: number) => n.toLocaleString('en-US');

/** The "See an example" practice: golden test 1 (struggling practice). */
export const EXAMPLE_FORM: FormState = {
  painPoints: [],
  specialty: 'behavioral',
  arIncludesAttorneyCases: null,
  values: {
    charges3: commas(300_000),
    adjustments3: commas(120_000),
    payments3: commas(166_500),
    claimsSubmitted3: commas(1_500),
    claimsDenied3: commas(180),
    claimsPaidFirstPass3: commas(1_260),
    totalAR: commas(190_000),
    ar90: commas(47_500),
  },
  unknown: NO_UNKNOWN,
};

export const EXAMPLE_INPUTS: ScorecardInputs = toInputs(EXAMPLE_FORM);
