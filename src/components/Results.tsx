/**
 * Everything that only exists after the reveal, in one lazily loaded chunk (keeps the first
 * load small for mobile performance). App prefetches it as soon as the visitor starts answering.
 */
import type { OfferId, ScorecardInputs, ScorecardResult } from '../engine';
import { scrollToId } from '../lib/hooks';
import { Faq } from './Faq';
import { Founder } from './Founder';
import { MoneyLedger } from './MoneyLedger';
import { NextStep } from './NextStep';
import { StatementTable } from './StatementTable';
import { VerdictBand } from './VerdictBand';
import { WhatIf } from './WhatIf';

export { RevealOverlay } from './RevealOverlay';
export { MethodDrawer } from './MethodDrawer';

interface Props {
  result: ScorecardResult;
  inputs: ScorecardInputs;
  offer: OfferId | null;
  primaryLabel: string;
  onPrimary: () => void;
  onMethod: () => void;
}

export function ResultsSections({ result, inputs, offer, primaryLabel, onPrimary, onMethod }: Props) {
  return (
    <>
      <VerdictBand result={result} offerLabel={primaryLabel} onPrimary={onPrimary} onStatement={() => scrollToId('statement', 'h2')} />
      <StatementTable result={result} specialty={inputs.specialty} />
      <MoneyLedger result={result} inputs={inputs} onMethod={onMethod} />
      <WhatIf result={result} inputs={inputs} />
      <NextStep result={result} offer={offer} specialty={inputs.specialty} painPoints={inputs.painPoints} />
      <Faq />
      <Founder />
    </>
  );
}
