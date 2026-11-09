import { describe, expect, it } from 'vitest';
import { computeScorecard } from '../compute';
import { OFFER_CONFIG, offerCopy, type OfferConfig } from '../config';
import { isRecoverySprintLive, selectOffer } from '../offers';
import { UNKNOWN, type ScorecardInputs } from '../types';
import { GOOD_NOT_TOP_INPUTS, STRUGGLING_INPUTS, TOP_INPUTS } from './golden.fixtures';

/** Test config: the Recovery Sprint switched on with a real percentage. */
const LIVE: OfferConfig = { ...OFFER_CONFIG, recoverySprintEnabled: true, recoveryPercent: 20 };

const offer = (inputs: ScorecardInputs, cfg: OfferConfig = LIVE) => selectOffer(computeScorecard(inputs), cfg);
const with_ = (patch: Partial<ScorecardInputs>, base: ScorecardInputs = STRUGGLING_INPUTS) => ({ ...base, ...patch });

const GOLDEN_2 = with_({ claimsPaidFirstPass3: UNKNOWN });
const ALL_UNKNOWN = with_({ claimsDenied3: UNKNOWN, claimsPaidFirstPass3: UNKNOWN, ar90: UNKNOWN }, GOOD_NOT_TOP_INPUTS);

/** B-grade practice (healthy test practice). */
const HEALTHY: ScorecardInputs = with_(
  { payments3: 172_800, claimsDenied3: 120, claimsPaidFirstPass3: 1_350, totalAR: 110_000, ar90: 13_200 },
  STRUGGLING_INPUTS,
);

describe('golden tests (test config: sprint on, 20%)', () => {
  it('golden 1 → Revenue Recovery Sprint', () => expect(offer(STRUGGLING_INPUTS)).toBe('recoverySprint'));
  it('golden 2 → Revenue Recovery Sprint', () => expect(offer(GOLDEN_2)).toBe('recoverySprint'));
  it('golden 3 → Keep It Top', () => expect(offer(TOP_INPUTS)).toBe('keepItTop'));
  it('golden 4 → Keep It Top', () => expect(offer(GOOD_NOT_TOP_INPUTS)).toBe('keepItTop'));
});

describe('golden 1 with the real config (placeholder percent)', () => {
  it('→ Gap-to-Top Plan', () => {
    expect(OFFER_CONFIG.recoveryPercent).toBe('[RECOVERY_PERCENT]');
    expect(offer(STRUGGLING_INPUTS, OFFER_CONFIG)).toBe('gapToTop');
  });
});

describe('rule 1: Free Scorecard Build', () => {
  it('no letter grade → Free Scorecard Build', () => {
    const r = computeScorecard(ALL_UNKNOWN);
    expect(r.overall.letter).toBeNull();
    expect(selectOffer(r, LIVE)).toBe('scorecardBuild');
    expect(selectOffer(r, OFFER_CONFIG)).toBe('scorecardBuild');
  });

  it('exactly 2 "Not reported" metrics (grade still given) → Free Scorecard Build', () => {
    const r = computeScorecard(with_({ claimsDenied3: UNKNOWN, claimsPaidFirstPass3: UNKNOWN }));
    expect(r.overall.letter).not.toBeNull();
    expect(Object.values(r.metrics).filter((m) => m.availability === 'unavailable')).toHaveLength(2);
    expect(selectOffer(r, LIVE)).toBe('scorecardBuild');
  });

  it('exactly 1 "Not reported" metric → not the Scorecard Build', () => {
    expect(offer(GOLDEN_2)).not.toBe('scorecardBuild');
  });

  it('takes priority over the Recovery Sprint (D/F with an over-90 card)', () => {
    const r = computeScorecard(with_({ claimsDenied3: UNKNOWN, claimsPaidFirstPass3: UNKNOWN }));
    expect(['D', 'F']).toContain(r.overall.letter);
    expect(r.moneyCards.some((c) => c.id === 'stuckOver90')).toBe(true);
    expect(selectOffer(r, LIVE)).toBe('scorecardBuild');
  });

  it('PI "not graded" metrics are not counted as "Not reported"', () => {
    const r = computeScorecard(with_({ specialty: 'accident', arIncludesAttorneyCases: true }));
    expect(r.metrics.dar.availability).toBe('notGraded');
    expect(selectOffer(r, LIVE)).not.toBe('scorecardBuild');
  });
});

describe('rule 2: Revenue Recovery Sprint', () => {
  it('D/F but the over-90 card is hidden → Gap-to-Top Plan', () => {
    // ar90 at the top target (10% of AR) → no over-90 card, grade still F.
    const r = computeScorecard(with_({ ar90: 19_000 }));
    expect(['D', 'F']).toContain(r.overall.letter);
    expect(r.moneyCards.some((c) => c.id === 'stuckOver90')).toBe(false);
    expect(selectOffer(r, LIVE)).toBe('gapToTop');
  });

  it('flag off → falls back to Gap-to-Top Plan', () => {
    expect(offer(STRUGGLING_INPUTS, { ...LIVE, recoverySprintEnabled: false })).toBe('gapToTop');
  });

  it('percent still a placeholder → falls back to Gap-to-Top Plan', () => {
    expect(offer(STRUGGLING_INPUTS, { ...LIVE, recoveryPercent: '[RECOVERY_PERCENT]' })).toBe('gapToTop');
  });

  it('isRecoverySprintLive needs the flag AND a real percentage', () => {
    expect(isRecoverySprintLive(LIVE)).toBe(true);
    expect(isRecoverySprintLive({ ...LIVE, recoverySprintEnabled: false })).toBe(false);
    expect(isRecoverySprintLive({ ...LIVE, recoveryPercent: '[RECOVERY_PERCENT]' })).toBe(false);
    expect(isRecoverySprintLive({ ...LIVE, recoveryPercent: '' })).toBe(false);
    expect(isRecoverySprintLive({ ...LIVE, recoveryPercent: 'twenty' })).toBe(false);
    expect(isRecoverySprintLive({ ...LIVE, recoveryPercent: '20' })).toBe(true);
  });

  it('never fires for grades A, B or C', () => {
    expect(offer(HEALTHY)).toBe('gapToTop'); // B with an over-90 card
  });
});

describe('rules 3 and 4', () => {
  it('B → Gap-to-Top Plan', () => {
    expect(computeScorecard(HEALTHY).overall.letter).toBe('B');
    expect(offer(HEALTHY)).toBe('gapToTop');
  });

  it('C → Gap-to-Top Plan', () => {
    // DAR 45 days (score 78.75), AR90 15% (85) → overall 78.5
    const c = with_({ totalAR: 150_000, ar90: 22_500 }, HEALTHY);
    expect(computeScorecard(c).overall.letter).toBe('C');
    expect(offer(c)).toBe('gapToTop');
  });

  it('A → Keep It Top; switched off → Gap-to-Top Plan', () => {
    expect(offer(TOP_INPUTS)).toBe('keepItTop');
    expect(offer(TOP_INPUTS, { ...LIVE, keepItTopEnabled: false })).toBe('gapToTop');
  });

  it('Gap-to-Top switched off → no main offer', () => {
    expect(offer(HEALTHY, { ...LIVE, gapToTopEnabled: false })).toBeNull();
  });

  it('Scorecard Build switched off → Gap-to-Top Plan', () => {
    expect(offer(ALL_UNKNOWN, { ...LIVE, scorecardBuildEnabled: false })).toBe('gapToTop');
  });
});

describe('offer copy', () => {
  it('a switched-off promise disappears from the text', () => {
    expect(offerCopy('scorecardBuild', LIVE).body).toContain('48 hours');
    expect(offerCopy('scorecardBuild', { ...LIVE, scorecardBuild48Hours: false }).body).not.toContain('48 hours');
    expect(offerCopy('gapToTop', LIVE).body).toContain('60 days');
    expect(offerCopy('gapToTop', { ...LIVE, gapToTopTrial: false }).body).not.toContain('60 days');
  });

  it('the sprint text uses the configured percentage', () => {
    expect(offerCopy('recoverySprint', LIVE).body).toContain('only 20% of what we actually collect');
  });
});
