# QA Report: Billing Scorecard (pre-launch audit)

**Re-test: November 14, 2026**, after four changes: the new net collection rate rule, plain-English field messages, the one-question-at-a-time lead flow, and the animation/phone-compatibility fixes. Earlier rounds: November 9 (first audit) and November 10.
Build tested: local production build (`npm run build`, served with `vite preview` at `http://localhost:5391`).

## Summary

| Section | Checks | Pass | Fail | Not run / skipped | Run on |
|---|---|---|---|---|---|
| A. Oracle (10,000 cases) | 10,000 cases, ~33 values each | 10,000 | **0** | 0 | re-run Nov 14 (new NCR rule in the oracle) |
| B. Hand cases | 214 (98 engine-level + 116 read off the UI) | 214 | **0** | 0 | re-run Nov 14 |
| C. Validation and messages | 29 | 29 | **0** | 0 | re-run Nov 14 (new wording, new NCR range) |
| C11. Fast typing | 10 runs | 10 | **0** | 0 | re-run Nov 14 |
| D. Consistency | 18 | 18 | **0** | 0 | Nov 9 (not re-run) |
| E. Lead flow | 21 browser checks + 1 real lead | 21 + 1 | **0** | 1 not verified (inbox arrival) | Nov 14 (replaces the old form checks) |
| F. Copy | 9 | 9 | **0** | 0 | Nov 10 (not re-run; new copy checked for dashes and "!" only) |
| G. Devices | 60 | 54 | **0** | 6 skipped | Nov 9 (not re-run; see M for phones) |
| M. Animations on phones | 12 configurations + 4 failure cases | 16 | **0** | 0 | Nov 14 (new) |
| H. Speed | 0 | 0 | 0 | not run: needs PageSpeed on the live URL | |

Unit tests: **353 / 353 pass** (`npm test`), `tsc` 0 errors, `npm run build` 0 errors. First-load JS 243.3 KB (81.1 KB gzipped).

## Launch verdict: **READY** (0 failures in every section run)

Still to do by hand after deploy:
1. **Lead email arrival:** check the inbox registered on the Formspree form (probably shahzaib.ventures@gmail.com, and spam) for the test lead sent on November 14 with the subject "[HIGH] New lead: QA Test Practice Nov 14, grade F, wants a call or email, as soon as possible". Formspree accepted it (HTTP 200, `{"ok":true}`); arrival could not be checked from here.
2. **A real older iPhone (iOS 14 or 15) and an Android phone with battery saver on:** run the QA-1 flow once. The build is now made for Safari 14+ and Chrome 87+ (see M), but only current WebKit and Chromium engines were available here.
3. **PageSpeed Insights (H).**

---

## November 14 changes verified

| Change | Verified by |
|---|---|
| **Net collection rate rule** (config.ts `VALIDATION`): up to 100% normal; over 100% to 105% graded with a note; over 105% to 150% shown as "Not graded", left out of the grade, money rows and biggest opportunity, note on the question and on the statement row; over 150% blocked | Spec sections 5 and 7 updated. Engine tests (charges 75,000 / adjustments 35,000: payments 50,000 = 125% not graded, 41,800 = 104.5% graded, 64,000 = 160% blocked, exact 105% and 150% edges). Oracle A updated independently: 0 mismatches, 1,356 not-graded cases. UI: C4a to C4d. |
| **13 field messages** (`src/content/messages.ts`) with the visitor's own numbers; red + warning icon blocks, amber + info icon ends "You can continue."; "Edit [field]" links on 4, 7, 8, 9, 10 | `src/content/__tests__/messages.test.ts` (one test per message, exact wording); UI: C1 to C9, C2-edit (link jumps back with the answer kept). Screenshots: `qa/screenshots/nov14/*-error4*`, `*-note5*`, `*-error9*`, `*-error10*`. |
| **Lead flow** (`src/components/LeadFlow.tsx`, all copy and flags in config.ts `LEAD_FLOW`, priority in `LEAD_PRIORITY_RULE`); old form and its copy deleted; every offer and booking button opens the flow | Unit tests in `src/lib/__tests__/lead.test.ts`; browser checks E below; screenshots `qa/screenshots/nov14/*-lead*`, `*-success*`. |
| **Animations on every phone** | Section M. |
| **Social preview tags** point at https://spec-biller-scorecard.vercel.app (were a placeholder domain) | `index.html` |

---

## A. Independent math oracle

**Result: PASS. 0 mismatches in 10,000 cases** (re-run November 14 with the new rule: still 0).

November 14: the oracle got the new rule from the spec text (net collection rate over 105% is "not graded"), and the generator now places 15% of cases between 100% and 150% (and 150% exactly on boundaries). 2,489 cases had net collection rate above 100%, 1,356 of them not graded.

- `qa/oracle.ts` implements spec sections 4, 5, 6 and 12.1 from the spec text. It imports nothing from `src/`.
- `qa/compare.test.ts` generates 10,000 seeded random valid input sets and compares oracle vs engine on: every metric's availability, displayed value, score (to 1e-9), status and Top performer flag; overall score and letter or no grade; every money card's presence, type, vs Good and vs Top (rounded, with the "under $100" flag) and the over-90 headline; the headline card; the biggest opportunity; the selected offer with the real config and with the Recovery Sprint on at 20%.
- Run: `npx vitest run --config qa/vitest.config.ts` · Results: `qa/oracle-results.json`

Coverage (Nov 14 run): 1,251 cases with the PI rule on; 1,356 with net collection rate not graded; 4,873 with at least one "I don't know"; 774 with no grade; letters A 140 · B 265 · C 592 · D 855 · F 7,374; 26,465 money cards (3,218 room to grow, 63 with an "under $100" line); 3,464 with a validation note; all four offers; 30% of cases placed exactly on anchors and targets. The engine's own validation accepted all 10,000 inputs.

Rules taken from outside sections 4 to 6: headline card = first available card in the order uncollected, cash faster, denied, over 90 (spec 9C); biggest opportunity = lowest score, ties to the higher weight then display order (spec 9F + QA B4); a card is hidden when its vs Top line rounds below $100.

Transparency note (first audit): the very first run reported 3 mismatches (`qa/oracle-results-run1.json`), all on biggest opportunity, all cases where denied + first-pass = 100% of claims so the two scores are mathematically equal (they differed by 2.8e-14 of floating-point noise). The engine applied the tie rule correctly; my oracle compared with an exact `<`. The oracle was given the same 1e-9 tie tolerance; no formula, target or expected value was changed.

## B. Hand-calculated cases

**Engine level: 98 / 98 PASS** (`qa/hand.test.ts`, `qa/hand-results.txt`): every value in the QA-1 to QA-4 tables, including scores and weighted sums, matches both the oracle and the engine. The hand calculations are correct, including QA-1's half-up rounding (2,250 → $2,300).

**Through the real UI: 116 / 116 PASS** (re-run November 14; `qa/scripts/qa-b.mjs`, `qa/results-B-ui.json`), each case typed like a person, every figure read off the screen.

| Case | Result | Key figures on screen |
|---|---|---|
| Golden 1 | 12/12 | F 56.3 · $39,600 a year · $54,000 · $5,400 · $17,100 (vs Good $18,000 · $34,000 · $4,200 · $11,400) · stuck $28,500 · biggest: first-pass 84% vs. 97% |
| Golden 2 | 11/11 | F 59.8 (not D) · first-pass Not reported |
| Golden 3 | 11/11 | A 100.0 · Top performer on all 5 · no money rows · new top-level verdict |
| Golden 4 | 11/11 | A 91.9 · all Room to grow ($14,400, $3,000, $600, $1,300) · stuck $7,600 |
| Healthy | 11/11 | B 83.2 · denial $3,000 / $1,800 · stuck $7,900 |
| All "I don't know" | 11/11 | No grade · $39,600 · $54,000 · note shown in the Not reported rows |
| QA-1 | 13/13 | C 73.5 · all Watch · over-90 vs Good $2,300 · biggest first-pass 91% vs. 97% · Gap-to-Top |
| QA-2 | 13/13 | D 62.9 · DAR 117.0 / AR90 40.4% Not graded · only Uncollected and Denied rows · PI text on expanding (brief 7.7) · Gap-to-Top |
| QA-3 | 14/14 | every metric exactly 85 → Good · B 85.0 · all Room to grow · biggest: net collection rate (tie → weight) · what-if B 85.0 → A 100.0 |
| QA-4 | 10/10 | No grade · $28,800 / $14,400 · $20,000 / $6,700 · Scorecard Build · note shown in the Not reported rows |

Screenshots: `qa/screenshots/B-<case>-verdict.png`, `-statement.png`, `-ledger.png`.

## C. Validation and messages (through the UI)

**29 / 29 PASS** (re-run November 14; `qa/scripts/qa-c.mjs`, `qa/results-C.json`). Every message is checked word for word, with its color (red blocks, amber allows) and its "Edit" link.

| # | Check | Result |
|---|---|---|
| C1 | Adjustments = charges, and > charges: message 3 with both amounts, blocked | PASS (both) |
| C2 | AR over 90 > total AR: message 10 + "Edit total AR", blocked | PASS |
| C2-edit | "Edit total AR" goes back to the total AR question, 190,000 kept | PASS |
| C3 | Denied > submitted (7) · first try > submitted (8) · denied + first try > submitted (9, "adds up to 1,580"), each with its Edit link | PASS (all 3) |
| C4a | Payments 64,000 on 75,000 / 35,000 (160%): message 4 + "Edit adjustments", blocked | PASS |
| C4b | Payments 50,000 (125%): amber note 5, Next allowed | PASS |
| C4c | Payments 41,800 (104.5%): amber note 6, Next allowed | PASS |
| C4d | 125% through to the results: row "125.0%  Not graded" with note 5 (without "You can continue."), no uncollected-money row, grade from the other four numbers | PASS |
| C5 | Days in AR 390: amber note 11 "(390 days)", allowed | PASS |
| C6 | 25 claims: amber note 12, allowed | PASS |
| C7a/b/d/e | "-5000", "abc", "12k5", "12..5" in money: kept as typed, message 1, blocked | PASS (all 4) |
| C7c | Empty required field: "Please enter this number to continue." | PASS |
| C8a to C8c | "$12,500" = "12,500" = "12500"; "$12,500.50" keeps cents; pasted "$ 300,000" accepted | PASS (all 3) |
| C9a/b | "12.5" and "12k5" claims: kept, message 2, blocked | PASS (both) |
| C9c | "1,500" claims accepted | PASS |
| C10 | Charges 50,000,000: no overflow, no scientific notation (1440 and 390) | PASS (both) |
| C11 | Fast typing (50 ms between answers, 5 ms between keys), 10 runs: all 8 answers exact, reveal shown | PASS 10/10 |
| C12 | Back, change first try 1,260 → 1,200: statement and result show 80.0% | PASS |
| C13 | Specialty change after answering (now via question 1, since the hero tiles were removed): same figures, specialty text changes; Accident + Yes applies the PI rule (F 56.5) | PASS (both) |

Test-script notes (no app change): question numbers in C8c/C9 moved up by one because the specialty is now question 1; C13 changes specialty through the questions instead of the removed hero tiles.

## D. Consistency across the page

**18 / 18 PASS** (Nov 9; the fixes did not touch any figure, and A/B re-confirm every figure). `qa/scripts/qa-d.mjs`, `qa/results-D.json`. For golden 1 and QA-1:
- D1: headline figure, grade and the five values identical in the reveal, verdict band, statement, ledger, what-if at 0%, offer block, desktop and mobile sticky bars.
- D2: what-if 0% = scorecard (+$0); 100% = A 100.0; the "Good levels" snap puts every number at or better than Good; denial + first-pass never above 100 at 51 slider positions.
- D3: the Top / Good toggle switches every row; Top-only rows read "Already at Good".
- D4: print/PDF exactly 2 pages, every printed number matches the screen (`qa/print-golden1.pdf`, `qa/print-qa1.pdf`).

## E. Lead flow

The contact form was replaced on November 14 by a 7-screen flow; the November 9 form checks (`qa/results-E*.json`) are kept for history only.

**21 / 21 browser checks PASS** (`qa/scripts/qa-lead.mjs`, `qa/results-lead.json`; Formspree intercepted, nothing real sent) + unit tests in `src/lib/__tests__/lead.test.ts`.

| # | Check | Result |
|---|---|---|
| L1a/b | Offer button opens screen 1 with focus on the question; a tap turns the tile jade with a check and moves on by itself after 250 ms | PASS |
| L2 | Back returns with the answer kept; no "step X of N" count | PASS |
| L3 | Number keys pick tiles; Enter continues | PASS |
| L4 | Software order: behavioral → SimplePractice, TherapyNotes first; primary care → athenaOne, eClinicalWorks, AdvancedMD first; "Something else" opens a field and does not move on (Enter continues) | PASS (3) |
| L5 | "Email me" starts selected and can't be the last one unselected; no auto-advance on the multi-select; "Almost done" on the last two screens | PASS (2) |
| L6 | Email only: no phone field, name/practice/email required. Call or text: mobile field shown and required; "(555) 555-0142" is a placeholder, not a value; texts hint; formats as typed; reach line "call, text or email" | PASS (4) |
| L7 | Exactly one POST on "Send my report"; subject "[HIGH] New lead: Harbor Behavioral Health, grade F, wants a call, text or email, as soon as possible"; "No" → no scorecard numbers in the request | PASS (2) |
| L8 | Success: "Thanks, Dana. Your report is on its way." + "We'll call, text or email you within one business day." + calendar | PASS |
| L9 | Nothing leaves the page before "Send my report" (no Formspree, no Calendly); "Yes" → entered numbers and scorecard attached | PASS (2) |
| L10 | Honeypot filled: nothing sent | PASS |
| L11 | Verdict, offer and founder booking buttons all open the flow; no direct Calendly links remain | PASS |

Unit-tested rules: priority HIGH (as soon as possible, or grade D/F), MEDIUM (next month or two), LOW (just looking); at least one contact method; phone required only for call or text; email always required; screens can be switched off in config.

**One REAL test lead sent (not intercepted)** on November 14 via `qa/scripts/qa-lead-real.mjs`: name "QA TEST Nov 14 (please ignore)", practice "QA Test Practice Nov 14", email shahzaib.ventures@gmail.com, call + email, numbers attached. Formspree answered **HTTP 200 `{"ok":true}`**. Subject: "[HIGH] New lead: QA Test Practice Nov 14, grade F, wants a call or email, as soon as possible". Payload: `qa/results-lead-real.json`. **Arrival in the inbox: NOT VERIFIED** (only msuhaib797@gmail.com is reachable from here; nothing from Formspree there).

## F. Copy and trust

**9 / 9 PASS** (re-run Nov 10 on 531 unique lines collected from every state of the site, including aria labels and placeholders: `qa/visible-text.txt`, `qa/results-F-scan.json`)

| # | Check | Result |
|---|---|---|
| F1 | 0 em dashes · 0 en dashes · 0 banned words · 0 exclamation marks · 0 raw placeholders · 0 NaN / undefined / Infinity / null | PASS (all six are 0) |
| F2 | Trial says 60 days everywhere; every "90 days" is AR over 90 days or the 90-day method | PASS |
| F3 | No fake testimonials, logos, client counts, ratings or guarantees | PASS |
| F4 | Spelling (dictionary check; the 6 flags Shahzaib, adj, biller, biller's, billers, telehealth are all correct) and grammar (read in full on Nov 9) | PASS |
| F5 | Copy consistent: no plain "vs" (0), one date format (only "November 10, 2026" found), "Something else" only on its tile ("Other specialty" elsewhere), top-level verdict shown at a perfect score and the old "room to reach the top" line gone there | PASS |

## G. Devices and browsers

**54 / 54 run checks PASS, 6 skipped** (Nov 9; `qa/scripts/qa-g.mjs`, `qa/results-G.json`, `qa/results-G-keyboard.json`). Each configuration ran the full QA-1 flow: correct figures (C, 73.5, $30,000 a year), no sideways scroll, number keyboard attributes, sticky bar not covering content, verdict button in the first screen on phones, no page errors. Screenshots: `qa/screenshots/G-<config>-*.png`.

| Configuration | Result |
|---|---|
| Chrome 1536×730 · 1366×768 · 1920×1080 | PASS |
| Edge 1536×730 · 1366×768 · 1920×1080 | PASS |
| Firefox 1536×730 · 1366×768 · 1920×1080 | SKIPPED: Playwright's Firefox install was retried once on Nov 10 and hung again; check by hand after deploy |
| Chromium mobile 390×844 · 375×667 · 360×800 (Android) | PASS |
| Chromium tablet 834×1194 | PASS |
| Safari / WebKit iPhone 14 · iPhone SE · iPad | SKIPPED: to be checked on a real iPhone after deploy |
| Keyboard only (Chrome) | PASS: 22/22 steps |

Note: G ran before the input fix. The input change is covered by C (re-run) and by B's UI runs, which type every value.

## M. Animations on every phone (new, November 14)

**Causes found** for "works on my phone but not on others":
1. **Reduced motion.** Many phones turn it on with battery saver or accessibility settings. The site then showed the hero demo frozen with no control and skipped every fade, so it looked broken.
2. **Older iPhones (iOS 14 / 15.0 to 15.3) and older Chrome.** The built CSS used `@layer` (ignored entirely before Safari 15.4 / Chrome 99, including Tailwind's reset and the screen-reader-only class), `dvh` units (the hero headline lost its size before Safari 15.4 / Chrome 108), `color-mix()` (Safari 16.2 / Chrome 111) and `inset`.
3. **Animated elements waited on the lazily loaded animation code** (initial opacity 0), so a slow or failed download could leave content invisible.
4. `requestIdleCallback` was already guarded (Safari has none); the hero now uses one shared helper (`src/lib/idle.ts`) that falls back to `setTimeout` and starts the demo after 2.5 s at the latest.

**Fixes:** reduced motion keeps opacity fades and quick 300 ms number changes, with no sliding, scaling, vibration or looping, and the hero shows its first frame with a "Play demo" button that plays once. IntersectionObservers use threshold 0 plus a small margin. FadeUp no longer depends on framer-motion, and nothing waits for the animation code (`src/lib/motion.tsx`: plain final-state elements until it loads; plain for the whole visit if blocked or later than 4 s). Build target Safari 14 / Chrome 87 for JS and CSS, plus `build/legacyCss.ts` (unwraps `@layer`, gives `dvh` a `vh` fallback; unit-tested). `color-mix()` replaced by precomputed colors, and `overflow: clip` and `aspect-ratio` have fallbacks. The bundle uses no other APIs missing from Safari 14 / Chrome 87.

**The CSS build step changes nothing in modern browsers:** computed styles of all 152 (home) and 647 (results + lead flow) elements are identical with and without it (`qa/scripts/qa-css-flatten.mjs`). Pixel differences found were the same size as the run-to-run noise of the same build.

**Matrix** (`qa/scripts/qa-motion.mjs`, `qa/results-motion.json`). "4x slower": Chromium uses the DevTools CPU throttle; WebKit has no CPU throttle in Playwright, so its main thread was kept 75% busy instead. WebKit was installed with `npx playwright install webkit` on Nov 14 (about 1 minute).

| Device | Reduced motion | CPU | Hero demo | Question change | Reveal | Fades on scroll | Lead screens | Hidden content |
|---|---|---|---|---|---|---|---|---|
| WebKit 390×844 | OFF | normal / 4x | loops | fade + slide | rises, counts $0 → $39,600, grade lands, 1 vibration | 6/6 | fade + slide | none |
| WebKit 390×844 | ON | normal / 4x | first frame + "Play demo" (plays once, stops on first frame) | fade only | fade only, quick count, no vibration | 6/6 (fade only) | fade only | none |
| WebKit 375×667 | OFF | normal / 4x | loops | fade + slide | rises, counts, lands, 1 vibration | 6/6 | fade + slide | none |
| WebKit 375×667 | ON | normal / 4x | first frame + "Play demo" | fade only | fade only, quick count, no vibration | 6/6 (fade only) | fade only | none |
| Chromium 360×800 | OFF | normal / 4x | loops | fade + slide | rises, counts, lands, 1 vibration | 6/6 | fade + slide | none |
| Chromium 360×800 | ON | normal / 4x | first frame + "Play demo" | fade only | fade only, quick count, no vibration | 6/6 (fade only) | fade only | none |

0 page errors in all 12 runs. WebKit reports no `requestIdleCallback` and the hero still starts.

**Animation code slow or failing** (both engines): blocked → page switches to plain mode in about 0.3 s and the question is visible (opacity 1, one question body). 3 s late → content visible the whole time, animations switch on when the code arrives.

## H. Speed and accessibility

**Not run.** Needs the live URL (PageSpeed Insights, mobile and desktop, 3 runs each, median).

---

## Files

- Oracle and engine checks: `qa/oracle.ts`, `qa/compare.test.ts`, `qa/hand.test.ts`, `qa/vitest.config.ts` (run: `npx vitest run --config qa/vitest.config.ts`)
- Browser scripts: `qa/scripts/` (expect the preview server on port 5391 and the Chromium/Edge paths in `qa-lib.mjs`; `playwright` is installed with `npm i --no-save playwright@1.65.1`, WebKit with `npx playwright install webkit`). Nov 14: `qa-lead.mjs`, `qa-lead-real.mjs`, `qa-motion.mjs`, `qa-css-flatten.mjs`, `shots-nov14.mjs`
- Results: `qa/oracle-results.json`, `qa/oracle-results-run1.json`, `qa/hand-results.txt`, `qa/results-*.json`, `qa/visible-text.txt`
- Screenshots: `qa/screenshots/` (Nov 14: `qa/screenshots/nov14/`) · PDFs: `qa/print-golden1.pdf`, `qa/print-qa1.pdf`
