/**
 * QA section A: 10,000 random valid input sets through the independent oracle and the real engine.
 * The oracle (qa/oracle.ts) does not import src/. This file is the only place the two meet.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeScorecard, OFFER_CONFIG, selectOffer, UNKNOWN, validateInputs, type ScorecardInputs } from '../src/engine';
import { isRecoverySprintLive } from '../src/engine/offers';
import { ORDER, oracle, oracleOffer, type OInputs } from './oracle';

/* Seeded PRNG so every run is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261109);
const U = (a: number, b: number) => a + (b - a) * rnd();
const I = (a: number, b: number) => Math.floor(U(a, b + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
const chance = (p: number) => rnd() < p;

/** A random input set that respects every validation rule in spec section 7. */
function generate(): OInputs {
  const boundary = chance(0.3); // 30%: land exactly on anchors / targets
  const specialty = pick(['behavioral', 'general', 'accident', 'other'] as const);
  const attorney = specialty === 'accident' ? chance(0.5) : null;

  const charges = boundary ? I(1, 300) * 9000 : chance(0.2) ? Math.round(U(5000, 3_000_000) * 100) / 100 : I(5000, 3_000_000);
  const adjustments = boundary ? I(0, Math.floor((charges * 0.75) / 1000)) * 1000 : Math.round(charges * U(0, 0.75));
  const net = charges - adjustments;

  const ncrPct = boundary && chance(0.7) ? pick([80, 90, 95, 98, 100, 105]) : U(60, 105);
  let payments = Math.round((net * ncrPct) / 100);
  while ((payments * 100) / net > 105) payments -= 1;

  const sub = chance(0.01) ? 0 : chance(0.1) ? I(1, 29) : boundary ? I(1, 60) * 100 : I(30, 6000);
  const denPct = boundary && chance(0.7) ? pick([3, 5, 10, 20]) : U(0, 30);
  const denied = Math.min(sub, Math.round((sub * denPct) / 100));
  const fprPct = boundary && chance(0.7) ? pick([75, 90, 95, 97]) : U(50, 100);
  const firstPass = Math.min(sub - denied, Math.round((sub * fprPct) / 100));

  const darDays = boundary && chance(0.7) ? pick([30, 40, 60, 90]) : chance(0.03) ? U(366, 600) : U(10, 160);
  const totalAR = chance(0.005) ? 0 : Math.round((darDays * charges) / 90);
  const arPct = boundary && chance(0.7) ? pick([10, 15, 20, 40]) : U(0, 60);
  const ar90 = Math.min(totalAR, Math.round((totalAR * arPct) / 100));

  return {
    specialty,
    attorney,
    charges3: charges,
    adjustments3: adjustments,
    payments3: payments,
    claimsSubmitted3: sub,
    claimsDenied3: chance(0.2) ? 'unknown' : denied,
    claimsPaidFirstPass3: chance(0.2) ? 'unknown' : firstPass,
    totalAR,
    ar90: chance(0.2) ? 'unknown' : ar90,
  };
}

const toEngine = (i: OInputs): ScorecardInputs => ({
  specialty: i.specialty,
  arIncludesAttorneyCases: i.attorney,
  painPoints: [],
  charges3: i.charges3,
  adjustments3: i.adjustments3,
  payments3: i.payments3,
  claimsSubmitted3: i.claimsSubmitted3,
  claimsDenied3: i.claimsDenied3 === 'unknown' ? UNKNOWN : i.claimsDenied3,
  claimsPaidFirstPass3: i.claimsPaidFirstPass3 === 'unknown' ? UNKNOWN : i.claimsPaidFirstPass3,
  totalAR: i.totalAR,
  ar90: i.ar90 === 'unknown' ? UNKNOWN : i.ar90,
});

const LIVE = { ...OFFER_CONFIG, recoverySprintEnabled: true, recoveryPercent: 20 };

describe('QA A: oracle vs engine', () => {
  it('10,000 random valid input sets agree on every value', () => {
    const N = 10_000;
    const mismatches: string[] = [];
    let invalid = 0;
    const counts = { pi: 0, unknownAny: 0, noGrade: 0, letters: {} as Record<string, number>, cards: 0, roomToGrow: 0, under100: 0, warnings: 0, offers: {} as Record<string, number> };

    for (let n = 0; n < N; n++) {
      const inp = generate();
      const eIn = toEngine(inp);
      const v = validateInputs(eIn);
      if (!v.valid) {
        invalid++;
        mismatches.push(`#${n} generator produced input the engine rejects: ${JSON.stringify(v.errors)} ${JSON.stringify(inp)}`);
        continue;
      }
      if (v.warnings.length) counts.warnings++;
      const o = oracle(inp);
      const e = computeScorecard(eIn);
      const diff: string[] = [];
      const cmp = (what: string, a: unknown, b: unknown) => {
        if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(`${what}: oracle=${JSON.stringify(a)} engine=${JSON.stringify(b)}`);
      };

      for (const id of ORDER) {
        const om = o.metrics[id];
        const em = e.metrics[id];
        cmp(`${id}.availability`, om.availability, em.availability);
        cmp(`${id}.display`, om.display, em.displayValue);
        if (om.score === null || em.score === null) cmp(`${id}.score`, om.score, em.score);
        else if (Math.abs(om.score - em.score) > 1e-9) diff.push(`${id}.score: oracle=${om.score} engine=${em.score}`);
        cmp(`${id}.status`, om.status, em.status);
        cmp(`${id}.topPerformer`, om.top, em.topPerformer);
      }
      cmp('overall.score', o.overallScore, e.overall.score);
      cmp('overall.letter', o.letter, e.overall.letter);
      cmp(
        'cards',
        o.cards.map((c) => ({ id: c.id, kind: c.kind, good: c.vsGood && [c.vsGood.rounded, c.vsGood.under100], top: [c.vsTop.rounded, c.vsTop.under100], head: c.headline && c.headline.rounded })),
        e.moneyCards.map((c) => ({ id: c.id, kind: c.kind, good: c.vsGood && [c.vsGood.rounded, c.vsGood.belowMinimum], top: [c.vsTop.rounded, c.vsTop.belowMinimum], head: c.headline && c.headline.rounded })),
      );
      cmp('headlineCard', o.headlineCard, e.headlineCard?.id ?? null);
      cmp('biggestOpportunity', o.biggest, e.biggestOpportunity);
      const realCfg = { scorecardBuildEnabled: OFFER_CONFIG.scorecardBuildEnabled, recoverySprintLive: isRecoverySprintLive(OFFER_CONFIG), gapToTopEnabled: OFFER_CONFIG.gapToTopEnabled, keepItTopEnabled: OFFER_CONFIG.keepItTopEnabled };
      cmp('offer (real config)', oracleOffer(o, realCfg), selectOffer(e));
      cmp('offer (sprint live, 20%)', oracleOffer(o, { ...realCfg, recoverySprintLive: true }), selectOffer(e, LIVE));

      if (diff.length) mismatches.push(`#${n} ${JSON.stringify(inp)}\n    ${diff.join('\n    ')}`);

      if (inp.specialty === 'accident' && inp.attorney) counts.pi++;
      if ([inp.claimsDenied3, inp.claimsPaidFirstPass3, inp.ar90].includes('unknown')) counts.unknownAny++;
      if (o.letter === null) counts.noGrade++;
      else counts.letters[o.letter] = (counts.letters[o.letter] ?? 0) + 1;
      counts.cards += o.cards.length;
      counts.roomToGrow += o.cards.filter((c) => c.kind === 'roomToGrow').length;
      counts.under100 += o.cards.filter((c) => c.vsGood?.under100).length;
      const off = String(selectOffer(e, LIVE));
      counts.offers[off] = (counts.offers[off] ?? 0) + 1;
    }

    const report = { N, invalidInputs: invalid, mismatches: mismatches.length, coverage: counts, first20: mismatches.slice(0, 20) };
    writeFileSync('qa/oracle-results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, first20: report.first20.length }, null, 1));
    expect(mismatches.length).toBe(0);
  });
});
