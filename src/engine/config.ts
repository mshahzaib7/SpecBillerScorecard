/**
 * ============================================================================
 *  SCORECARD CONFIGURATION — reviewed by the billing team
 * ============================================================================
 *  Every benchmark, target, score anchor, weight and threshold the engine
 *  uses lives in this file. No other file may hard-code these numbers.
 *
 *  Targets are commonly cited industry benchmarks for US physician
 *  practices. "Top performer" reflects best-in-class levels. Benchmarks
 *  vary by specialty and payer mix.
 *
 *  Consistency rule: for every metric, the "Good" target is the score-85
 *  anchor and the "Top performer" target is the score-100 anchor, so
 *  targets, scores and statuses can never contradict each other.
 *  (Enforced by a unit test.)
 * ============================================================================
 */

import type { MetricId, Specialty, PainPointId } from './types';

/** Standard 3-month method: the reporting period is treated as 90 days. */
export const PERIOD_DAYS = 90;

/**
 * Smallest money figure worth showing. A money card whose "vs. top-performing
 * practices" line rounds below this is hidden; a smaller secondary line is
 * shown as "under $100".
 */
export const MONEY_MIN_DISPLAY = 100;

/** Number of months in the reporting period (used for "per month" figures). */
export const PERIOD_MONTHS = 3;

/** Periods per year (3-month period × 4 = 12 months). Used for "per year" figures. */
export const PERIODS_PER_YEAR = 4;

export type Direction = 'higherIsBetter' | 'lowerIsBetter';

/** One point on a metric's score curve: metric value → score (0–100). */
export interface Anchor {
  readonly value: number;
  readonly score: number;
}

export interface MetricConfig {
  readonly id: MetricId;
  readonly shortName: string;
  readonly unit: '%' | 'days';
  readonly direction: Direction;
  /** "Good" target. Must equal the value of the score-85 anchor. */
  readonly goodTarget: number;
  /** "Top performer" target. Must equal the value of the score-100 anchor. */
  readonly topTarget: number;
  /** Piecewise-linear score anchors, sorted by ascending value. Clamped at both ends. */
  readonly anchors: readonly Anchor[];
  /** Integer weight in the overall score. All weights sum to exactly 100. */
  readonly weight: number;
}

export const METRICS: Readonly<Record<MetricId, MetricConfig>> = {
  // Net Collection Rate — commonly cited industry benchmark: 95%+ good, 98%+ best-in-class.
  ncr: {
    id: 'ncr',
    shortName: 'Net collection rate',
    unit: '%',
    direction: 'higherIsBetter',
    goodTarget: 95,
    topTarget: 98,
    anchors: [
      { value: 80, score: 0 },
      { value: 90, score: 60 },
      { value: 95, score: 85 },
      { value: 98, score: 100 },
    ],
    weight: 30,
  },
  // Days in AR — commonly cited industry benchmark: under 40 days good, ~30 or less best-in-class.
  dar: {
    id: 'dar',
    shortName: 'Days in AR',
    unit: 'days',
    direction: 'lowerIsBetter',
    goodTarget: 40,
    topTarget: 30,
    anchors: [
      { value: 30, score: 100 },
      { value: 40, score: 85 },
      { value: 60, score: 60 },
      { value: 90, score: 0 },
    ],
    weight: 20,
  },
  // % of AR over 90 days — commonly cited industry benchmark: under 15% good, ~10% or less best-in-class.
  ar90: {
    id: 'ar90',
    shortName: 'AR over 90 days',
    unit: '%',
    direction: 'lowerIsBetter',
    goodTarget: 15,
    topTarget: 10,
    anchors: [
      { value: 10, score: 100 },
      { value: 15, score: 85 },
      { value: 20, score: 60 },
      { value: 40, score: 0 },
    ],
    weight: 15,
  },
  // Denial rate — commonly cited industry benchmark: 5% or less good, ~3% or less best-in-class.
  den: {
    id: 'den',
    shortName: 'Denial rate',
    unit: '%',
    direction: 'lowerIsBetter',
    goodTarget: 5,
    topTarget: 3,
    anchors: [
      { value: 3, score: 100 },
      { value: 5, score: 85 },
      { value: 10, score: 60 },
      { value: 20, score: 0 },
    ],
    weight: 20,
  },
  // First-pass (clean claim) rate — commonly cited industry benchmark: 95%+ good, 97%+ best-in-class.
  // Top is 97% (not 98%) so that top-level denial (3%) + first-pass (97%) never exceed 100% of claims.
  fpr: {
    id: 'fpr',
    shortName: 'First-pass rate',
    unit: '%',
    direction: 'higherIsBetter',
    goodTarget: 95,
    topTarget: 97,
    anchors: [
      { value: 75, score: 0 },
      { value: 90, score: 60 },
      { value: 95, score: 85 },
      { value: 97, score: 100 },
    ],
    weight: 15,
  },
};

/** Display / evaluation order of the metrics. */
export const METRIC_ORDER: readonly MetricId[] = ['ncr', 'dar', 'ar90', 'den', 'fpr'];

/** Status thresholds (applied to the metric score only). */
export const STATUS_THRESHOLDS = {
  good: 85, // score ≥ 85 → Good
  watch: 60, // 60 ≤ score < 85 → Watch; below → Problem
} as const;

/** Letter-grade thresholds (applied to the rounded overall score). */
export const LETTER_THRESHOLDS = [
  { letter: 'A', min: 90 },
  { letter: 'B', min: 80 },
  { letter: 'C', min: 70 },
  { letter: 'D', min: 60 },
] as const;

/** Fewer graded metrics than this → no letter grade. */
export const MIN_METRICS_FOR_GRADE = 3;

/** Validation limits. */
export const VALIDATION = {
  /** NCR above this blocks the scorecard (error). */
  ncrMaxError: 105,
  /** NCR above this (and ≤ ncrMaxError) shows a warning. */
  ncrWarnAbove: 100,
  /** Days in AR above this shows a warning. */
  darWarnAbove: 365,
  /** Fewer claims submitted than this shows a warning. */
  smallClaimsBelow: 30,
} as const;

export const SPECIALTIES: readonly { id: Specialty; label: string }[] = [
  { id: 'behavioral', label: 'Behavioral / Mental Health' },
  { id: 'general', label: 'General Medicine / Primary Care' },
  { id: 'accident', label: 'Accident / Personal Injury' },
  { id: 'other', label: 'Other' },
];

/**
 * Pain-point chips (Step 1) and how we handle each one (CTA "You told us" block).
 * Every chip must map to a service we actually provide — billing team to review.
 */
export const PAIN_POINTS: readonly { id: PainPointId; label: string; howWeHandle: string }[] = [
  {
    id: 'slowPayment',
    label: 'Insurance pays too slowly',
    howWeHandle: 'We follow up on every unpaid claim on a set schedule, not when someone remembers.',
  },
  {
    id: 'denials',
    label: 'Too many denied claims',
    howWeHandle: 'We fix the root cause of each denial so it stops repeating, then rework and resubmit.',
  },
  {
    id: 'oldClaims',
    label: 'Old unpaid claims piling up',
    howWeHandle: 'We work your old AR oldest-first, before filing deadlines close.',
  },
  {
    id: 'underCollecting',
    label: "Not sure we're collecting everything we're owed",
    howWeHandle: 'We check what was paid against what should have been paid.',
  },
  {
    id: 'patientBalances',
    label: 'Patients not paying their balances',
    howWeHandle: 'We set up clear patient statements and follow-up.',
  },
  {
    id: 'noReports',
    label: "My biller doesn't send clear reports",
    howWeHandle: 'You get a monthly report with these exact 5 numbers.',
  },
  {
    id: 'unsureBiller',
    label: "I don't know if my biller is doing a good job",
    howWeHandle: "You'll always know: we report against the same targets you just saw.",
  },
  {
    id: 'staffOverwhelmed',
    label: 'Front desk / staff overwhelmed with billing work',
    howWeHandle: 'We take billing work off your front desk.',
  },
];

/**
 * ============================================================================
 *  BUSINESS DETAILS — fill these in before launch.
 *  A value still in [BRACKETS] is a placeholder. The site never shows a raw
 *  placeholder to visitors: UI code checks isPlaceholder() and falls back.
 * ============================================================================
 */
export const SITE = {
  companyName: 'Shahzaib Khan',
  founderName: 'Muhammad Shahzaib Khan',
  /** Calendly (or similar) link for the free 20-minute call. */
  bookingLink: 'https://calendly.com/muhammadshahzaibkhan/30min',
  contactEmail: 'shahzaib.ventures@gmail.com',
} as const;

/** True when a config value is still an unfilled [PLACEHOLDER]. */
export function isPlaceholder(value: string | number | null | undefined): boolean {
  return typeof value !== 'number' && (value === null || value === undefined || /^\s*\[.*\]\s*$/.test(value) || value.trim() === '');
}

/**
 * ============================================================================
 *  OFFERS & LEAD CAPTURE (spec section 12) — edit freely, no code changes needed.
 *  Honesty rule: every promise can be switched off here. Turn a flag to false
 *  if the team can't deliver it, and the site stops making that promise.
 * ============================================================================
 */
export type OfferId = 'scorecardBuild' | 'recoverySprint' | 'gapToTop' | 'keepItTop';

export interface OfferConfig {
  /** Free Scorecard Build. If false, those visitors get the Gap-to-Top Plan instead. */
  readonly scorecardBuildEnabled: boolean;
  /** Promise: "within 48 hours". If false, the sentence drops the time promise. */
  readonly scorecardBuild48Hours: boolean;
  /** Revenue Recovery Sprint. Shown only if true AND recoveryPercent is a real number. */
  readonly recoverySprintEnabled: boolean;
  /** Our fee as a % of what we actually collect. Placeholder until the team decides. */
  readonly recoveryPercent: number | string;
  /** Gap-to-Top Plan. If false, no main offer is shown (the booking button still is). */
  readonly gapToTopEnabled: boolean;
  /** Promise: "try us for 60 days, no long-term contract, cancel anytime". */
  readonly gapToTopTrial: boolean;
  /** Keep It Top. If false, A-grade visitors get the Gap-to-Top Plan instead. */
  readonly keepItTopEnabled: boolean;
  /** "Know a practice that's struggling?" share block under Keep It Top. */
  readonly referralEnabled: boolean;
  /** "We handle the switch" block. Confirm the team can deliver this before launch. */
  readonly switchSupportEnabled: boolean;
}

export const OFFER_CONFIG: OfferConfig = {
  scorecardBuildEnabled: true,
  scorecardBuild48Hours: true,
  recoverySprintEnabled: true,
  recoveryPercent: '[RECOVERY_PERCENT]',
  gapToTopEnabled: true,
  gapToTopTrial: true,
  keepItTopEnabled: true,
  referralEnabled: true,
  switchSupportEnabled: true, // TODO(owner): confirm before launch
};

/** Fewer graded metrics… or this many "Not reported" metrics → Free Scorecard Build. */
export const OFFER_MIN_NOT_REPORTED = 2;

export interface OfferCopy {
  readonly headline: string;
  readonly body: string;
  readonly button: string;
}

/** Offer text (spec 12.2). `body` is built from the flags above so a switched-off promise disappears. */
export function offerCopy(id: OfferId, cfg: OfferConfig = OFFER_CONFIG): OfferCopy {
  switch (id) {
    case 'scorecardBuild':
      return {
        headline: 'Your biller should be able to give you these numbers.',
        body: cfg.scorecardBuild48Hours
          ? "Send us your two standard reports and we'll build your complete scorecard for free within 48 hours, with every number filled in and explained."
          : "Send us your two standard reports and we'll build your complete scorecard for free, with every number filled in and explained.",
        button: 'Get my free scorecard built',
      };
    case 'recoverySprint':
      return {
        headline: "Let's go get your money back.",
        body: `We'll work your claims older than 90 days for 60 days. You pay only ${cfg.recoveryPercent}% of what we actually collect. If we recover nothing, you pay nothing.`,
        button: 'Start my recovery sprint',
      };
    case 'gapToTop':
      return {
        headline: 'Close the gap to top practices.',
        body: cfg.gapToTopTrial
          ? "On a free 20-minute call, we'll show you the 3 fixes that close your gap. Then try us for 60 days, with no long-term contract. Cancel anytime."
          : "On a free 20-minute call, we'll show you the 3 fixes that close your gap.",
        button: 'Show me my 3 fixes',
      };
    case 'keepItTop':
      return {
        headline: "You're performing at a high level. Let's keep it that way.",
        body: 'Get a free quarterly billing check-up, so you catch problems before they cost you.',
        button: 'Get my free quarterly check-up',
      };
  }
}

/** Shown under the offer when switchSupportEnabled is on. This is the exact line visitors see. */
export const SWITCH_BLOCK = {
  text: 'Switching billers? We handle the whole move. No gap in claims, and no extra work for your staff.',
} as const;

/** Keep It Top share row (when referralEnabled is on). These are the exact words visitors see. */
export const REFERRAL_BLOCK = {
  text: "Know a practice that's struggling with billing? Send them this tool.",
  button: 'Share',
  copied: 'Link copied',
} as const;

/** Lead form (spec 12.4). */
export const LEAD_CONFIG = {
  /** POST JSON endpoint (e.g. Formspree). While a placeholder, Submit opens a pre-filled email instead. */
  formEndpoint: 'https://formspree.io/f/xpppgarr',
} as const;
