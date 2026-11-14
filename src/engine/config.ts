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
  ncrMaxError: 150,
  /**
   * NCR above this (and ≤ ncrMaxError) is shown but NOT graded: excluded from the overall score,
   * the money cards and the biggest opportunity, like the Accident / PI rule. A note explains why.
   */
  ncrNotGradedAbove: 105,
  /** NCR above this (and ≤ ncrNotGradedAbove) is graded normally and shows a note. */
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

/** Lead capture endpoint (spec 12.4). */
export const LEAD_CONFIG = {
  /** POST JSON endpoint (e.g. Formspree). While a placeholder, "Send my report" opens a pre-filled email instead. */
  formEndpoint: 'https://formspree.io/f/xpppgarr',
} as const;

/**
 * ============================================================================
 *  LEAD FLOW: one question per screen, in the "Next step" panel.
 *  Every screen, tile, line and promise has an `on` flag. Turn a flag to false
 *  and the site stops showing it (a screen that's off is skipped).
 *  The flow never re-asks what the scorecard already knows (specialty, pains,
 *  grade, numbers). Nothing is sent before "Send my report".
 * ============================================================================
 */
export type BillingHandlerId = 'staff' | 'company' | 'self' | 'mix';
export type ProvidersId = 'solo' | 'twoToFive' | 'sixToFifteen' | 'overFifteen';
export type SoftwareId =
  | 'simplePractice'
  | 'therapyNotes'
  | 'tebra'
  | 'advancedMD'
  | 'athenaOne'
  | 'eClinicalWorks'
  | 'other'
  | 'notSure';
export type TimingId = 'asap' | 'soon' | 'looking';
export type ReviewId = 'yes' | 'no';
export type ContactMethod = 'call' | 'text' | 'email';
/** Line icons available to tiles (see src/components/Icons.tsx). */
export type TileIcon = 'staff' | 'company' | 'self' | 'mix' | 'call' | 'text' | 'email';

export interface LeadTile<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly on: boolean;
  readonly icon?: TileIcon;
}

export const LEAD_FLOW = {
  billingHandler: {
    on: true,
    title: 'Who handles your billing right now?',
    note: { on: true, text: "There's no wrong answer. It helps us prepare for your practice." },
    tiles: [
      { id: 'staff', label: 'Someone on my staff', on: true, icon: 'staff' },
      { id: 'company', label: 'An outside billing company', on: true, icon: 'company' },
      { id: 'self', label: 'I do it myself', on: true, icon: 'self' },
      { id: 'mix', label: "It's a mix", on: true, icon: 'mix' },
    ] as readonly LeadTile<BillingHandlerId>[],
  },
  providers: {
    on: true,
    title: 'How many providers bill under your practice?',
    tiles: [
      { id: 'solo', label: 'Just me', on: true },
      { id: 'twoToFive', label: '2 to 5', on: true },
      { id: 'sixToFifteen', label: '6 to 15', on: true },
      { id: 'overFifteen', label: 'More than 15', on: true },
    ] as readonly LeadTile<ProvidersId>[],
  },
  software: {
    on: true,
    title: 'Which practice software do you use?',
    tiles: [
      { id: 'simplePractice', label: 'SimplePractice', on: true },
      { id: 'therapyNotes', label: 'TherapyNotes', on: true },
      { id: 'tebra', label: 'Tebra (Kareo)', on: true },
      { id: 'advancedMD', label: 'AdvancedMD', on: true },
      { id: 'athenaOne', label: 'athenaOne', on: true },
      { id: 'eClinicalWorks', label: 'eClinicalWorks', on: true },
      { id: 'other', label: 'Something else', on: true },
      { id: 'notSure', label: 'Not sure', on: true },
    ] as readonly LeadTile<SoftwareId>[],
    /** "Something else" opens a small text field. */
    otherLabel: 'Which software?',
    otherPlaceholder: 'Type the name',
    continueLabel: 'Continue',
    /** Tiles moved to the front for a specialty, in this order. The rest keep the list order. */
    orderBySpecialty: {
      on: true,
      behavioral: ['simplePractice', 'therapyNotes'],
      general: ['athenaOne', 'eClinicalWorks', 'advancedMD'],
    } as { on: boolean; behavioral: readonly SoftwareId[]; general: readonly SoftwareId[] },
  },
  timing: {
    on: true,
    title: 'When would you want help?',
    tiles: [
      { id: 'asap', label: 'As soon as possible', on: true },
      { id: 'soon', label: 'In the next month or two', on: true },
      { id: 'looking', label: "I'm just looking for now", on: true },
    ] as readonly LeadTile<TimingId>[],
    /** How each answer reads in the lead email subject. */
    subject: { asap: 'as soon as possible', soon: 'in the next month or two', looking: 'just looking for now' } as Record<TimingId, string>,
  },
  review: {
    on: true,
    title: 'Want us to review your numbers before we talk?',
    note: { on: true, text: "We'll only see the numbers you entered. No patient information." },
    recommended: { on: true, text: 'Recommended' },
    tiles: [
      { id: 'yes', label: 'Yes, attach my scorecard', on: true },
      { id: 'no', label: 'No, just my contact details', on: true },
    ] as readonly LeadTile<ReviewId>[],
  },
  contact: {
    on: true,
    title: 'How should we reach you? Pick any.',
    tiles: [
      { id: 'call', label: 'Call me', on: true, icon: 'call' },
      { id: 'text', label: 'Text me', on: true, icon: 'text' },
      { id: 'email', label: 'Email me', on: true, icon: 'email' },
    ] as readonly LeadTile<ContactMethod>[],
    /** Starts selected. At least one method always stays selected. */
    defaultSelected: ['email'] as readonly ContactMethod[],
    continueLabel: 'Continue',
  },
  details: {
    title: 'Where should we send your report?',
    name: 'Name',
    practiceName: 'Practice name',
    email: 'Email',
    emailHint: { on: true, text: 'Your report goes here.' },
    phone: 'Mobile number',
    /** A format hint shown inside the empty field, never a filled-in value. */
    phonePlaceholder: '(555) 555-0142',
    phoneTextHint: { on: true, text: 'A mobile number that can receive texts.' },
    submit: 'Send my report',
    sending: 'Sending…',
    consent: { on: true, text: 'Only your report and one follow-up. No spam.' },
    errors: {
      name: 'Please enter your name.',
      practiceName: 'Please enter your practice name.',
      email: 'Please enter your email. Your report goes there.',
      emailInvalid: 'Please check your email. It should look like name@practice.com.',
      phone: 'Please enter a mobile number so we can call or text you.',
      phoneInvalid: 'Please enter a 10-digit US number, like (555) 555-0142.',
    },
  },
  /** The response-time promise. Off: the sentences drop the time promise. */
  promise: { on: true, text: 'within one business day' },
  progress: { almostDone: { on: true, text: 'Almost done' } },
  back: 'Back',
  sidePanel: {
    on: true,
    title: 'Your report will include',
    /** Each line ticks on once the visitor has answered this many screens. */
    items: [
      { text: 'Your grade and statement', on: true, after: 1 },
      { text: 'The 3 fixes that matter most', on: true, after: 3 },
      { text: 'What the gap means in dollars', on: true, after: 5 },
      { text: 'Your next steps', on: true, after: 6 },
    ],
    footer: { on: true, text: 'Every request is read by a person, not a bot.' },
  },
  success: {
    title: (name: string) => (name ? `Thanks, ${name}. Your report is on its way.` : 'Thanks. Your report is on its way.'),
    /** The inline Calendly calendar. It loads only on the success screen. */
    booking: { on: true, text: 'Want to pick a time now?' },
  },
  failure: {
    mailtoTitle: 'Almost done: your email app should open with your request filled in. Just press Send.',
    mailtoRetry: 'Email app didn’t open? Use this link',
    errorTitle: "Sorry, we couldn't send that just now. Nothing you typed was lost.",
    errorFallback: 'Send it by email instead',
    errorNoFallback: 'Please try again in a moment.',
  },
} as const;

export type LeadPriority = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Lead priority, shown as "[HIGH]" at the start of the lead email subject (off: no tag).
 * HIGH: wants help as soon as possible, or the grade is D or F.
 * MEDIUM: wants help in the next month or two (also the fallback when timing isn't asked).
 * LOW: just looking.
 */
export const LEAD_PRIORITY_RULE = {
  on: true,
  high: { timing: ['asap'] as readonly TimingId[], grades: ['D', 'F'] as readonly string[] },
  low: { timing: ['looking'] as readonly TimingId[] },
} as const;

export function leadPriority(timing: TimingId | null, grade: string | null): LeadPriority {
  const rule = LEAD_PRIORITY_RULE;
  if ((timing !== null && rule.high.timing.includes(timing)) || (grade !== null && rule.high.grades.includes(grade))) return 'HIGH';
  if (timing !== null && rule.low.timing.includes(timing)) return 'LOW';
  return 'MEDIUM';
}

/**
 * "Can you answer these?" row under the hero. Order is the display order.
 * `scorecard: true` marks the questions the scorecard itself answers.
 */
export const QUESTION_CARDS: readonly { category: string; question: string; scorecard: boolean }[] = [
  { category: 'Collections', question: 'What percent of what you’re owed actually gets collected?', scorecard: true },
  { category: 'Authorizations', question: 'Are any sessions being billed after the authorization ran out?', scorecard: false },
  { category: 'Getting paid', question: 'How many days does it take you to get paid, on average?', scorecard: true },
  { category: 'Eligibility', question: 'Is insurance checked before every new patient’s first visit?', scorecard: false },
  { category: 'Denials', question: 'Which denial reason costs you the most money each month?', scorecard: false },
  { category: 'Old claims', question: 'How much of your unpaid money is older than 90 days?', scorecard: true },
  { category: 'Contracts', question: 'When did someone last check payments against your contract rates?', scorecard: false },
  { category: 'Claims', question: 'How many days pass between a visit and the claim going out?', scorecard: false },
  { category: 'Telehealth', question: 'Do your telehealth claims use the place of service each payer wants?', scorecard: false },
  { category: 'Denials', question: 'How many of your claims get denied the first time?', scorecard: true },
  { category: 'Deadlines', question: 'How many claims missed the filing deadline last year?', scorecard: false },
  { category: 'Credentialing', question: 'Is every provider credentialed with every payer you bill?', scorecard: false },
  { category: 'Secondary claims', question: 'Are secondary claims sent after the primary insurance pays?', scorecard: false },
  { category: 'Patient balances', question: 'How much do your patients owe you right now?', scorecard: false },
  { category: 'Accident cases', question: 'Do you know how much PIP each accident patient has left?', scorecard: false },
  { category: 'Reporting', question: 'Does your biller send you a monthly report you actually understand?', scorecard: false },
];
