/**
 * Closing section, FAQ, founder and footer copy (DESIGN-BRIEF 7.10 to 7.13).
 *
 * FAQ: every answer has an on/off flag. An answer whose flag is off, or whose text is still a
 * [PLACEHOLDER], is hidden from visitors. The billing team confirms each one before launch.
 */
/* The switch and share lines live in src/engine/config.ts (SWITCH_BLOCK, REFERRAL_BLOCK). */
export const CLOSING_COPY = {
  recommended: 'Recommended for your numbers',
  toldUs: 'You told us',
  callTitle: 'What happens on the call',
} as const;

export const CALL_STEPS = [
  'We go through your statement together.',
  'We show you the 3 fixes that matter most for your practice.',
  'You leave with a plan, whether you hire us or not.',
] as const;

/** The figure in the offer's jade block, by offer. */
export const OFFER_FIGURE_LABEL = {
  stuck: 'Stuck in claims over 90 days, right now',
  yearly: 'Your yearly gap vs. top practices',
  gap: 'Your biggest gap vs. top practices',
  room: 'Room to grow to top practices',
} as const;

export interface FaqItem {
  q: string;
  a: string;
  /** Turn off if the team can't stand behind this answer. */
  on: boolean;
}

export const FAQ_TITLE = 'Questions owners ask.';

export const FAQ: readonly FaqItem[] = [
  { q: 'Do I have to sign a long contract?', a: "No. Try us for 60 days. If it's not working, you can leave.", on: true },
  {
    q: 'What does it cost?',
    a: "We charge a percentage of what we actually collect for you, so we only get paid when you get paid. You'll get an exact quote on the call, based on your specialty and claim volume.",
    on: true,
  },
  {
    q: 'Is my patient data safe?',
    a: 'This tool never asks for patient information. Before we touch any real claims, we sign a Business Associate Agreement with you.',
    on: true,
  },
  {
    q: 'What if my biller is doing a good job?',
    a: "Then your scorecard will say so, and you should keep them. We'd rather earn your trust than talk you into a switch.",
    on: true,
  },
  {
    q: 'How does switching work?',
    a: 'We take over from your current biller, set up access, and work any open claims so nothing falls through the gap.',
    on: true,
  },
  { q: 'Who will work on my account?', a: "My team. You'll have one person who knows your practice and answers your emails.", on: true },
];

export const FOUNDER = {
  quote:
    "You didn't open your practice to chase insurance companies. That's our job. We follow up on every unpaid claim, fix denials so they stop coming back, and send you these same five numbers every month. You'll always know where your money is and what we're doing about it.",
  name: 'Muhammad Shahzaib Khan',
  line: 'Medical billing for practices in Florida and South Carolina',
} as const;

export const FOOTER_COPY = {
  disclaimer: 'Estimates for information only. Not financial, legal or accounting advice.',
  privacy: 'Free. No sign-up. Your numbers stay on your device unless you choose to send them.',
  method: 'How we calculate',
  print: 'Save as PDF',
} as const;

export const METHOD_DRAWER = {
  title: 'How we calculate',
  close: 'Close',
  periodTitle: 'The 90-day method',
  formulasTitle: 'Formulas',
  moneyTitle: 'Money estimates',
  targetsTitle: 'Targets, score anchors and weights',
  gradingTitle: 'Grading',
  sourceTitle: 'Source',
} as const;
