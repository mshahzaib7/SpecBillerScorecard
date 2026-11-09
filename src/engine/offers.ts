/**
 * Offer selection (spec 12.1). Pure: picks exactly one main offer per result.
 *
 * Priority:
 *   1. Free Scorecard Build — 2+ metrics "Not reported", or no letter grade.
 *   2. Revenue Recovery Sprint — grade D/F AND the over-90 money card is shown AND the offer is live.
 *   3. Gap-to-Top Plan — grade B/C, or D/F when the Recovery Sprint doesn't apply.
 *   4. Keep It Top — grade A.
 * An offer switched off in config falls back to the Gap-to-Top Plan; if that is
 * off too, there is no main offer (null) and the booking button carries the CTA.
 */
import { isPlaceholder, METRIC_ORDER, OFFER_CONFIG, OFFER_MIN_NOT_REPORTED, type OfferConfig, type OfferId } from './config';
import type { ScorecardResult } from './types';

/** The Recovery Sprint can only run with the flag on AND a real percentage filled in. */
export function isRecoverySprintLive(cfg: OfferConfig = OFFER_CONFIG): boolean {
  if (!cfg.recoverySprintEnabled || isPlaceholder(cfg.recoveryPercent)) return false;
  const pct = Number(cfg.recoveryPercent);
  return Number.isFinite(pct) && pct > 0 && pct <= 100;
}

export function notReportedCount(result: ScorecardResult): number {
  return METRIC_ORDER.filter((id) => result.metrics[id].availability === 'unavailable').length;
}

export function selectOffer(result: ScorecardResult, cfg: OfferConfig = OFFER_CONFIG): OfferId | null {
  const fallback: OfferId | null = cfg.gapToTopEnabled ? 'gapToTop' : null;
  const letter = result.overall.letter;

  // 1. Free Scorecard Build
  if (letter === null || notReportedCount(result) >= OFFER_MIN_NOT_REPORTED) {
    return cfg.scorecardBuildEnabled ? 'scorecardBuild' : fallback;
  }

  // 2. Revenue Recovery Sprint
  if ((letter === 'D' || letter === 'F') && result.moneyCards.some((c) => c.id === 'stuckOver90') && isRecoverySprintLive(cfg)) {
    return 'recoverySprint';
  }

  // 4. Keep It Top
  if (letter === 'A') return cfg.keepItTopEnabled ? 'keepItTop' : fallback;

  // 3. Gap-to-Top Plan (B, C, and D/F without the sprint)
  return fallback;
}
