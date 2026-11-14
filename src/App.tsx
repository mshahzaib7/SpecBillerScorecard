import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { computeScorecard, offerCopy, selectOffer, type ScorecardInputs } from './engine';
import { HERO, REPORT_HELPER } from './content/copy';
import { EMPTY_FORM, toInputs, type FormState } from './lib/formState';
import { openLeadFlow, scrollToId, useSummaryVisible } from './lib/hooks';
import { moneyFigure, UNIT_SUFFIX } from './lib/money';
import { BOOKING_LABEL } from './components/BookingButton';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { TopBar, type Summary } from './components/TopBar';
import { QuestionsRow } from './components/QuestionsRow';
import { HowItWorks } from './components/HowItWorks';
import { MobileSummary } from './components/MobileSummary';
import { LiveStatement } from './components/LiveStatement';
import { buildQuestions, QuestionFlow } from './components/QuestionFlow';

/* Post-reveal sections, the reveal and the methodology drawer load as a separate chunk. */
const loadResults = () => import('./components/Results');
const ResultsSections = lazy(() => loadResults().then((m) => ({ default: m.ResultsSections })));
const RevealOverlay = lazy(() => loadResults().then((m) => ({ default: m.RevealOverlay })));
const MethodDrawer = lazy(() => loadResults().then((m) => ({ default: m.MethodDrawer })));

interface Revealed {
  inputs: ScorecardInputs;
}

export default function App() {
  const [form, setFormState] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ id: string; focus?: string } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const openMethod = () => setMethodOpen(true);
  const closeMethod = useCallback(() => setMethodOpen(false), []);

  // Live scorecard for the statement that builds itself while the visitor answers.
  const liveResult = useMemo(() => computeScorecard(toInputs(form)), [form]);
  // The specialty is asked once, as the first question of the flow.
  const questions = useMemo(() => buildQuestions(true, form.specialty), [form.specialty]);

  // The reveal always comes from the engine; nothing is stored or sent anywhere.
  const result = useMemo(() => (revealed ? computeScorecard(revealed.inputs) : null), [revealed]);
  const offer = useMemo(() => (result ? selectOffer(result) : null), [result]);

  // A page opened with a #hash (an old link): scroll to that target once, then clean the URL.
  // The same applies if the hash changes without a reload (for example, edited in the address bar).
  useEffect(() => {
    const clean = () => {
      const { hash, pathname, search } = window.location;
      if (!hash) return;
      const id = decodeURIComponent(hash.slice(1));
      window.requestAnimationFrame(() => {
        if (id && document.getElementById(id)) scrollToId(id);
        window.history.replaceState(window.history.state, '', pathname + search);
      });
    };
    clean();
    window.addEventListener('hashchange', clean);
    return () => window.removeEventListener('hashchange', clean);
  }, []);

  // Scroll after the DOM has updated (e.g. the reveal section has mounted).
  useEffect(() => {
    if (!scrollTarget) return;
    const id = window.requestAnimationFrame(() => scrollToId(scrollTarget.id, scrollTarget.focus));
    setScrollTarget(null);
    return () => window.cancelAnimationFrame(id);
  }, [scrollTarget]);

  const setForm = (updater: (f: FormState) => FormState) => setFormState((f) => updater(f));

  const goToForm = () => {
    void loadResults(); // prefetch the results chunk while the visitor answers
    setScrollTarget({ id: 'form', focus: '.q__title' });
  };

  // Last answer in: the statement closes (reveal), then the page settles on the results.
  const submit = () => {
    setRevealed({ inputs: toInputs(form) });
    setRevealing(true);
  };
  const revealDone = () => {
    setRevealing(false);
    setScrollTarget({ id: 'results' });
  };

  // One primary action after the reveal: the selected offer, which opens the lead flow.
  const primaryLabel = offer ? offerCopy(offer).button : BOOKING_LABEL;
  const goToLead = openLeadFlow;
  const summaryVisible = useSummaryVisible(!!result && !revealing, 'results', ['form', 'offer-cta', 'lead', 'cta-final']);
  const headline = result?.headlineCard ?? null;
  const summary: Summary | null = result
    ? {
        visible: summaryVisible,
        letter: result.overall.letter,
        score: result.overall.score,
        figure: headline ? moneyFigure(headline.vsTop) : null,
        unit: headline ? UNIT_SUFFIX[headline.timeUnit] : '',
        label: primaryLabel,
        onClick: goToLead,
      }
    : null;

  return (
    <>
      <a
        className="skiplink"
        href="#form"
        onClick={(e) => {
          // Scroll and focus with JavaScript so the URL never gets a #hash.
          e.preventDefault();
          scrollToId('form', '.q__title');
        }}
      >
        Skip to the questions
      </a>
      <TopBar showStart={!result} onStart={goToForm} onMethod={openMethod} summary={summary} />
      <Hero onStart={goToForm} />
      <QuestionsRow onStart={goToForm} />
      <HowItWorks onStart={goToForm} />

      <main>
        <section className="qsec" id="form" aria-labelledby="q-title">
          <div className="container qsec__grid">
            <div className="qsec__main">
              <p className="qsec__helper">{REPORT_HELPER}</p>
              <QuestionFlow
                form={form}
                setForm={setForm}
                questions={questions}
                step={Math.min(step, questions.length - 1)}
                setStep={setStep}
                result={liveResult}
                onSubmit={submit}
                submitLabel={revealed ? 'Update my scorecard' : 'See my scorecard'}
              />
              <p className="qsec__privacy">{HERO.privacy}</p>
            </div>
            <aside className="qsec__side" aria-label="Your statement so far">
              <LiveStatement form={form} result={liveResult} />
            </aside>
          </div>
        </section>

        {result && revealed && (
          <>
            <Suspense fallback={null}>
              <ResultsSections
                result={result}
                inputs={revealed.inputs}
                offer={offer}
                primaryLabel={primaryLabel}
                onPrimary={goToLead}
                onMethod={openMethod}
              />
            </Suspense>
          </>
        )}
      </main>

      <Footer canPrint={!!result} onMethod={openMethod} />
      {methodOpen && (
        <Suspense fallback={null}>
          <MethodDrawer open={methodOpen} onClose={closeMethod} />
        </Suspense>
      )}

      {revealing && result && (
        <Suspense fallback={null}>
          <RevealOverlay result={result} specialty={revealed?.inputs.specialty ?? null} onDone={revealDone} />
        </Suspense>
      )}

      {summary && <MobileSummary summary={summary} />}
    </>
  );
}
