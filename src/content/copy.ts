/**
 * Page copy. Honesty rules: no guarantees, no invented results, no insulting the
 * current biller. Benchmarks/targets are NOT here — they live in src/engine/config.ts.
 */
import type { MetricId, NumericField, Specialty } from '../engine';

export const PRIVACY_LINE = 'Your numbers stay in your browser unless you choose to send us your report.';

export const VERDICTS: Record<'A' | 'B' | 'C' | 'D' | 'F', string> = {
  A: "Strong billing. Let's see if there's room to reach the top.",
  B: 'Solid, but money is slipping through.',
  C: "You're leaving real money on the table.",
  D: 'Your billing needs attention.',
  F: 'Money is leaking out of your practice.',
};

export const NOT_REPORTED_TEXT =
  "A good biller reports this number every month. If you don't have it, that's worth asking about.";

export const PI_RULE_TEXT =
  "Attorney and LOP cases naturally take months to settle, so Days in AR and AR over 90 days can't be fairly graded here. For a fair grade, enter health-insurance numbers only.";

/** Plain-English names shown on the metric cards. */
export const METRIC_PLAIN_NAME: Record<MetricId, string> = {
  ncr: "How much of what you're owed actually gets collected",
  dar: 'How long it takes to get paid, on average',
  ar90: 'How much of your unpaid money is over 90 days old',
  den: 'How many claims get denied the first time',
  fpr: 'How many claims get paid on the first try',
};

export interface FieldCopy {
  label: string;
  help: string;
  /** Short hint shown under the label. */
  hint?: string;
}

export const FIELD_COPY: Record<NumericField, FieldCopy> = {
  charges3: {
    label: 'Total charges billed',
    help: "On the charges/payments/adjustments summary for the last 3 full months, look for “Total charges” or “Gross charges”. This is what you billed before any insurance discounts.",
  },
  adjustments3: {
    label: 'Total contractual adjustments',
    help: "Same report. Look for “Contractual adjustments” (the discounts your insurance contracts require). Don't include bad-debt or courtesy write-offs.",
  },
  payments3: {
    label: 'Total payments received',
    hint: 'Insurance + patient payments',
    help: 'Same report. Add up all payments received in those 3 months, from insurance companies and from patients.',
  },
  claimsSubmitted3: {
    label: 'Number of claims submitted',
    help: "Your biller's claims report or clearinghouse report shows how many claims were sent in the last 3 months.",
  },
  claimsDenied3: {
    label: 'Number of claims denied or rejected',
    hint: 'On first submission',
    help: 'Claims that came back denied or rejected the first time they were sent. Look for a denial report or the clearinghouse rejection report.',
  },
  claimsPaidFirstPass3: {
    label: 'Number of claims paid on the first try',
    hint: 'No corrections or resubmission',
    help: 'Claims paid the first time they were sent, with no rework. Some reports call this the “clean claim” or “first-pass” count.',
  },
  totalAR: {
    label: 'Total accounts receivable (AR)',
    hint: 'As of today',
    help: 'On the AR aging report as of today, use the grand total of everything still unpaid (insurance + patient).',
  },
  ar90: {
    label: 'AR older than 90 days',
    help: 'On the same AR aging report, add the columns older than 90 days (for example “91 to 120” and “120+”). Some reports show a single “90+” column.',
  },
};

type ByIssue = { shared: string[]; specialty: Partial<Record<Specialty, string>> };
export type ByIssueBullets = ByIssue;

export interface MetricExplainer {
  means: (displayValue: string) => string[];
  causes: ByIssue;
  fixes: ByIssue;
}

export const METRIC_EXPLAINERS: Record<MetricId, MetricExplainer> = {
  ncr: {
    means: (v) => [
      `After insurance contract discounts, you collect ${v} of the money you're owed.`,
      'The rest is still unpaid, or was written off when it could have been collected.',
    ],
    causes: {
      shared: [
        'Denied or underpaid claims that are never appealed.',
        'Claims that pass the filing deadline before anyone follows up.',
      ],
      specialty: {
        behavioral: 'Missing or expired authorizations, and visit limits that run out mid-treatment.',
        general: 'Payers paying below the contracted rate, and nobody checking the payment against the contract.',
        accident: 'PIP benefits running out, and liability or LOP balances that are not followed through to settlement.',
        other: 'Payers paying below the contracted rate, and nobody checking the payment against the contract.',
      },
    },
    fixes: {
      shared: [
        'Check each payment against what the contract says should have been paid.',
        'Appeal underpaid and denied claims before the deadlines close.',
      ],
      specialty: {
        behavioral: 'Track authorizations and visit limits so sessions are covered before they happen.',
        general: 'Flag payers that keep underpaying and escalate them.',
        accident: 'Track PIP limits and keep attorney and LOP balances followed up until settlement.',
        other: 'Flag payers that keep underpaying and escalate them.',
      },
    },
  },
  dar: {
    means: (v) => [
      `On average, it takes about ${v} from the date of service until you are paid.`,
      'Every extra day is money your practice has earned but cannot use yet.',
    ],
    causes: {
      shared: [
        'Claims sent days or weeks after the visit.',
        'Unpaid claims that are not followed up on a fixed schedule.',
      ],
      specialty: {
        behavioral: 'Waiting on authorizations, or on paperwork from the provider, before claims can go out.',
        general: 'Eligibility not checked before the visit, so claims bounce and have to be redone.',
        accident: 'Waiting on PIP or liability carriers, which pay more slowly than health insurance.',
        other: 'Eligibility not checked before the visit, so claims bounce and have to be redone.',
      },
    },
    fixes: {
      shared: [
        'Send claims within a day or two of the visit.',
        'Follow up on every unpaid claim on a set schedule, starting at 30 days.',
      ],
      specialty: {
        behavioral: 'Get authorizations and provider paperwork in order before claims are due.',
        general: 'Check eligibility before each visit so claims go out right the first time.',
        accident: 'Keep a separate follow-up schedule for PIP and liability carriers.',
        other: 'Check eligibility before each visit so claims go out right the first time.',
      },
    },
  },
  ar90: {
    means: (v) => [
      `${v} of the money you're owed is more than 90 days old.`,
      'The older a claim gets, the harder it is to collect.',
    ],
    causes: {
      shared: [
        'Old claims nobody is working, because new claims come first.',
        'Denials that were never reworked and resubmitted.',
      ],
      specialty: {
        behavioral: 'Claims stuck on authorization or credentialing problems.',
        general: 'Patient balances with no statements or follow-up.',
        accident: 'Attorney and LOP cases waiting on settlement, mixed in with regular insurance AR.',
        other: 'Patient balances with no statements or follow-up.',
      },
    },
    fixes: {
      shared: [
        'Work old AR oldest-first, before filing deadlines close.',
        'Find the root cause of each stuck claim, then fix and resubmit it.',
      ],
      specialty: {
        behavioral: 'Clear authorization and credentialing problems that hold up whole groups of claims.',
        general: 'Set up clear patient statements and a follow-up routine.',
        accident: 'Separate attorney and LOP cases so insurance AR gets worked on its own schedule.',
        other: 'Set up clear patient statements and a follow-up routine.',
      },
    },
  },
  den: {
    means: (v) => [
      `About ${v} of your claims are denied or rejected the first time they are sent.`,
      'Most denials can be fixed and recovered, but each one delays your cash and costs staff time.',
    ],
    causes: {
      shared: [
        'Eligibility or insurance details that are wrong or out of date.',
        'Coding or modifier errors.',
      ],
      specialty: {
        behavioral: 'Missing authorizations, wrong telehealth codes or place of service, or provider credentialing gaps.',
        general: 'Bundling and medical-necessity edits, and diagnosis codes that do not support the service.',
        accident: 'Wrong payer order between PIP, health insurance and liability coverage.',
        other: 'Bundling and medical-necessity edits, and diagnosis codes that do not support the service.',
      },
    },
    fixes: {
      shared: [
        'Find the root cause of each denial so it stops repeating.',
        'Check eligibility and claim details before claims go out.',
      ],
      specialty: {
        behavioral: 'Check authorization, telehealth and credentialing rules for each payer.',
        general: 'Review coding against payer edits before submission.',
        accident: 'Confirm which coverage pays first before billing.',
        other: 'Review coding against payer edits before submission.',
      },
    },
  },
  fpr: {
    means: (v) => [
      `${v} of your claims are paid the first time they are sent, with no rework.`,
      'Every claim that needs rework costs staff time and delays payment.',
    ],
    causes: {
      shared: [
        'Claims sent without being checked against payer rules first.',
        'Patient demographics or insurance details entered incorrectly.',
      ],
      specialty: {
        behavioral: 'Authorization numbers missing from claims, or provider details that do not match payer records.',
        general: 'Missing referrals, or modifiers that payers reject.',
        accident: 'Claim forms missing accident details, dates of injury or claim numbers.',
        other: 'Missing referrals, or modifiers that payers reject.',
      },
    },
    fixes: {
      shared: [
        'Check every claim against payer rules before it goes out.',
        'Use what was learned from past denials to stop the same errors.',
      ],
      specialty: {
        behavioral: 'Make sure authorization and provider details are on every claim.',
        general: 'Confirm referrals and modifiers before submission.',
        accident: 'Include the accident details and claim numbers each payer needs.',
        other: 'Confirm referrals and modifiers before submission.',
      },
    },
  },
};

export function bulletsFor(issue: ByIssue, specialty: Specialty | null): string[] {
  const extra = issue.specialty[specialty ?? 'other'];
  return extra ? [...issue.shared, extra] : issue.shared;
}

/* ============================ Redesign: hero and strip (DESIGN-BRIEF 7.2, 7.3, 10) ============================ */

export const HERO = {
  line1: "Your biller says everything's fine.",
  line2: 'See the numbers in 3 minutes.',
  lead: 'Most practices lose money in places their billing reports never show. Enter a few numbers from two reports your biller already sends you, and see exactly where yours is going.',
  knowHeading: "In 3 minutes you'll know:",
  knowItems: [
    'How much of what insurance owes you actually gets collected',
    'How many dollars are sitting in claims older than 90 days',
    "What you'd collect each year if your numbers matched top practices",
  ],
  start: 'Get my free scorecard',
  privacy: 'Free. No sign-up. Your numbers stay on your device unless you choose to send them.',
  founderLine: 'Built by Muhammad Shahzaib Khan. My team works on billing for practices in Florida and South Carolina.',
} as const;

/** Hero tiles: one tap saves the specialty and starts the questions. */
export const SPECIALTY_TILES: readonly { id: Specialty; label: string }[] = [
  { id: 'behavioral', label: 'Behavioral and mental health' },
  { id: 'general', label: 'Primary care and general medicine' },
  { id: 'accident', label: 'Accident and personal injury' },
  { id: 'other', label: 'Something else' },
];

export const WHY_NUMBERS: readonly { figure: string; text: string }[] = [
  { figure: '5', text: 'The same five numbers well-run practices review every month.' },
  { figure: '2', text: 'Reports your biller can send you today: a charges and payments summary, and an AR aging report.' },
  { figure: '0', text: 'Numbers sent anywhere unless you ask for your report.' },
];

/**
 * Founder portrait. Drop the real photo in /public and set the path here, e.g. '/founder.jpg'.
 * While it is a [PLACEHOLDER], the site shows initials instead (never a stock or generated image).
 */
export const FOUNDER_PHOTO = '[FOUNDER_PHOTO]';
export const FOUNDER_INITIALS = 'SK';

/* ============================ Redesign: questions and reveal (DESIGN-BRIEF 7.4, 7.5, 10) ============================ */

export const REPORT_HELPER =
  'Ask your biller for two reports: a charges and payments summary for the last 3 full months, and an AR aging report as of today. A good biller can send both in minutes.';

export const NOT_REPORTED_NOTE = 'A good biller reports this every month. Worth asking about.';
export const DONT_HAVE_LABEL = "I don't have this number";

/** One question per screen. Labels in plain words, one-line hints in slate. */
export const QUESTION_COPY: Record<NumericField, { label: string; hint: string; line: string }> = {
  charges3: {
    label: 'What did you bill in the last 3 full months?',
    hint: 'Total charges, before any insurance discounts. From your charges and payments summary.',
    line: 'Charges, 3 months',
  },
  adjustments3: {
    label: 'How much came off in contractual adjustments?',
    hint: 'The discounts your payer contracts require. Leave out bad debt and courtesy write-offs.',
    line: 'Contractual adjustments',
  },
  payments3: {
    label: 'How much was actually paid in those 3 months?',
    hint: 'Insurance payments plus patient payments, added together.',
    line: 'Payments received',
  },
  claimsSubmitted3: {
    label: 'How many claims went out in those 3 months?',
    hint: 'Every claim sent to a payer, from your claims or clearinghouse report.',
    line: 'Claims submitted',
  },
  claimsDenied3: {
    label: 'How many came back denied or rejected the first time?',
    hint: 'Payer denials plus clearinghouse rejections, on first submission.',
    line: 'Denied or rejected',
  },
  claimsPaidFirstPass3: {
    label: 'How many were paid on the first try?',
    hint: 'Paid with no corrections and no resubmission. Some reports call these clean claims.',
    line: 'Paid on first try',
  },
  totalAR: {
    label: 'How much is still unpaid today?',
    hint: 'The grand total on your AR aging report, insurance and patient together.',
    line: 'Total AR today',
  },
  ar90: {
    label: 'How much of that is older than 90 days?',
    hint: 'On the same aging report, the columns past 90 days.',
    line: 'Unpaid over 90 days',
  },
};

export const PAIN_QUESTION = { label: "What's been bothering you about billing?", hint: 'Pick any, or skip.' } as const;
export const SPECIALTY_QUESTION = { label: 'What kind of practice do you run?', hint: 'This tailors what we tell you about your numbers.' } as const;
export const ATTORNEY_QUESTION = {
  label: 'Does your AR include attorney, LOP or PIP pending cases?',
  hint: 'Those cases often take months to settle, which changes how we grade your AR.',
  yes: 'Yes, it does',
  no: 'No, health insurance only',
} as const;

/** Statement line names for the computed rates. */
export const RATE_LINE: Record<MetricId, string> = {
  ncr: 'Net collection rate',
  dar: 'Days in AR',
  ar90: 'AR over 90 days',
  den: 'Denial rate',
  fpr: 'First-pass rate',
};

/** Reveal total row label, by the card the headline money comes from. */
export const REVEAL_TOTAL_LABEL: Record<'uncollected' | 'cashFaster' | 'deniedAboveTarget' | 'stuckOver90', string> = {
  uncollected: 'Yearly gap vs. top practices',
  cashFaster: 'Cash you would have sooner',
  deniedAboveTarget: 'Held up in denials each month',
  stuckOver90: 'Stuck over 90 days vs. top practices',
};

/* ============================ Redesign: results (DESIGN-BRIEF 7.6 to 7.9) ============================ */

/** Shown when there are too few graded numbers for a letter. */
export const NO_GRADE_VERDICT = "We need a few more of your numbers for a letter grade. Here's what we can already see.";

/** Verdict band: the line under the big jade figure, by the card the figure comes from. */
export const VERDICT_MONEY_NOTE: Record<'uncollected' | 'cashFaster' | 'deniedAboveTarget' | 'stuckOver90', string> = {
  uncollected: "What you'd collect on top of today if your numbers matched top practices. An estimate based on what you entered.",
  cashFaster: 'Cash that would already be in your account if claims were paid at top-practice speed. An estimate based on what you entered.',
  deniedAboveTarget: 'Held up in denied claims each month, compared with top practices. An estimate based on what you entered.',
  stuckOver90: 'Stuck in claims over 90 days old, beyond what top practices carry. An estimate based on what you entered.',
};
export const VERDICT_A_NOTE = "You're close to the top. Here's what's left.";
export const SEE_STATEMENT = 'See the full statement';

export const STATEMENT_COPY = {
  title: 'Your billing statement',
  cols: { number: 'Number', you: 'You', good: 'Good', top: 'Top', status: 'Status' },
  means: 'What this means',
  why: 'Why it usually happens',
  fix: 'How we fix it',
  biggest: 'Biggest opportunity',
  topMark: 'Top performer',
  notReported: 'Not reported',
  notGraded: 'Not graded',
} as const;

export const LEDGER_COPY = {
  title: 'Where the money is.',
  compareLabel: 'Compare to',
  top: 'Top practices',
  good: 'Good target',
  howWeGotThis: 'How we got this',
  atGood: 'Already at Good',
  roomToGrow: 'Room to grow',
  footnote: "Separate estimates with different time units, so they're never added together.",
  rounding: 'Rounded to the nearest $100. An estimate, not a promise.',
  allFormulas: 'See every formula',
} as const;

export const WHATIF_COPY = {
  title: 'Drag to see what better billing pays.',
  lead: 'Slide from your numbers today to top-practice levels. Every number moves by the same share, and the grade and money update with the same math as your statement.',
  today: 'Today',
  top: 'Top practices',
  goodSnap: 'Good levels',
  sliderLabel: 'Move every number toward top-practice levels',
  extraCollected: 'more collected than today',
  extraOther: 'better than today',
  atStart: 'Drag the slider to see what changes.',
  adjust: 'Adjust each number',
  hideAdjust: 'Hide the single sliders',
  note: 'This shows what changes if your numbers reach these levels. Actual results depend on your payers, specialty and processes.',
} as const;

/** Metric names inside a sentence ("Your biggest opportunity: denial rate, …"). */
export const METRIC_IN_SENTENCE: Record<MetricId, string> = {
  ncr: 'net collection rate',
  dar: 'days in AR',
  ar90: 'AR over 90 days',
  den: 'denial rate',
  fpr: 'first-pass rate',
};
export const BIGGEST_OPPORTUNITY = 'Your biggest opportunity';

/** Verdict when there are no money gaps at all (a top-level practice). */
export const VERDICT_TOP_LEVEL = "Your billing is running at a top level. That's rare.";
export const VERDICT_TOP_LEVEL_NOTE = "We'd love to help you keep it that way.";

/** Specialty names everywhere outside the hero and question tiles. */
export const SPECIALTY_LABEL: Record<Specialty, string> = {
  behavioral: 'Behavioral and mental health',
  general: 'Primary care and general medicine',
  accident: 'Accident and personal injury',
  other: 'Other specialty',
};
