/**
 * Copy for the money, simulator, call-to-action, methodology and footer sections.
 * Honesty rules: no guarantees, no invented results, no insulting the current biller.
 * Offer text lives in src/engine/config.ts (spec 12.1) so it can be edited with the flags.
 */
import type { MoneyCard, MoneyCardId } from '../engine';

export const TIME_UNIT_LABEL: Record<MoneyCard['timeUnit'], string> = {
  perYear: 'per year',
  oneTime: 'one-time',
  perMonth: 'per month',
  rightNow: 'right now',
};

export const MONEY_COPY: Record<
  MoneyCardId,
  { name: string; title: string; text: string; growText: string; headlineSuffix?: string }
> = {
  uncollected: {
    name: 'Uncollected money',
    title: 'Money you are owed but not collecting',
    text: 'Payments that should come in under your insurance contracts but are not being collected.',
    growText: "You're above the Good target. This is how much more top-performing practices would collect each year with your numbers.",
  },
  cashFaster: {
    name: 'Cash that could come in faster',
    title: 'Money that could already be in your account',
    text: 'If claims were paid as fast as the target, this much more cash would already be in your account. You get it once, not every year.',
    growText: "You're paid faster than the Good target. Top-level speed would free up this much more cash, once.",
  },
  deniedAboveTarget: {
    name: 'Denied claims above target',
    title: 'Claims held up by denials',
    text: 'Most denials can be fixed and recovered, but each one delays your cash and costs staff time.',
    growText:
      "You're within the Good target. Most denials can be fixed and recovered, but each one delays your cash and costs staff time.",
  },
  stuckOver90: {
    name: 'Money stuck over 90 days',
    title: 'Money stuck in old claims',
    text: 'The older a claim gets, the harder it is to collect.',
    growText: "You're within the Good target. The older a claim gets, the harder it is to collect.",
    headlineSuffix: 'is in claims over 90 days old right now.',
  },
};

export const MONEY_TOP_LEVEL_TEXT =
  "Your billing is performing at a top level. That's rare. We'd love to help you keep it that way.";

export const MONEY_NO_DATA_TEXT =
  "We need a few more of your numbers to estimate the money gaps. A good biller can send the two reports in minutes.";

export const MONEY_SOURCE_LINE =
  "Targets are commonly cited industry benchmarks for US physician practices; 'top performer' reflects best-in-class levels. Estimates only.";

/* ---------------------------------- Simulator ---------------------------------- */

export const SIM_COPY = {
  eyebrow: 'What if?',
  title: 'See what top-level billing would look like for your practice',
  lead: 'Move a slider, or jump straight to the Good or top-performer levels. Everything updates with the same math as your scorecard.',
  goodButton: 'Show me Good levels',
  topButton: 'Show me top-performer levels',
  resetButton: 'Back to my numbers',
  note: 'This shows what changes if your numbers reach these levels. Actual results depend on your payers, specialty and processes.',
  pairNote: 'Denied claims and claims paid on the first try come from the same pool of claims, so together they can never pass 100%.',
  extraPerYear: 'more collected per year than today',
  startHint: 'Move a slider to see how much more you could collect each year.',
} as const;

/* ------------------------------ Call to action ------------------------------ */

export const CTA_HEADLINE: Record<'A' | 'BC' | 'DF' | 'none', string> = {
  A: "You're close to the top. Let's close the last gap.",
  BC: "Let's turn that gap into money in your account.",
  DF: "Let's stop the money leak.",
  none: "Let's get you the full picture.",
};
/* ------------------------------ Methodology / footer ------------------------------ */

export const METHOD_NOTE =
  "Targets are commonly cited industry benchmarks for US physician practices. 'Top performer' reflects best-in-class levels. Benchmarks vary by specialty and payer mix.";

export const DISCLAIMER =
  'This tool gives estimates for information only. It is not financial, legal or accounting advice. No data you enter is sent or stored unless you choose to send us your report.';
