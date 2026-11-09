# QA Report: Billing Scorecard (pre-launch audit)

**Re-test: November 10, 2026**, after the four approved fixes. First audit: November 9, 2026.
Build tested: local production build (`npm run build`, served with `vite preview` at `http://localhost:5391`). Engine and formulas unchanged (A re-run: 0 mismatches).

## Summary

| Section | Checks | Pass | Fail | Not run / skipped | Run on |
|---|---|---|---|---|---|
| A. Oracle (10,000 cases) | 10,000 cases, ~33 values each | 10,000 | **0** | 0 | re-run Nov 10 |
| B. Hand cases | 214 (98 engine-level + 116 read off the UI) | 214 | **0** | 0 | re-run Nov 10 |
| C. Validation | 27 | 27 | **0** | 0 | re-run Nov 10 |
| D. Consistency | 18 | 18 | **0** | 0 | Nov 9 (not affected by the fixes) |
| E. Lead form | 11 | 10 | **0** | 1 not verified (email arrival) | Nov 9 |
| F. Copy | 9 | 9 | **0** | 0 | re-run Nov 10 |
| G. Devices | 60 | 54 | **0** | 6 skipped (Firefox ×3, Safari ×3) | Nov 9; Firefox install retried Nov 10 |
| H. Speed | 0 | 0 | 0 | not run: needs the live URL | |

## Launch verdict: **READY** (0 failures in every section)

All three failures from the first audit are fixed and re-tested (C9 decimal claims, B-F1 hidden note, F5 copy consistency). Every number a visitor sees matches the spec and the hand calculations.

Three checks could not be done from here and should be done right after deploy, before sending real traffic:
1. **Lead email arrival (E1c):** check shahzaib.ventures@gmail.com (and spam) for the two test leads sent on November 9 (details in E). If they are not there, check which email is registered on the Formspree form.
2. **Safari and Firefox (G):** open the live site on a real iPhone (and iPad if possible) and in Firefox; run the QA-1 flow once.
3. **PageSpeed Insights (H):** mobile and desktop, 3 runs each, median.

---

## Fixes verified in this re-test

| Finding | Fix | Re-test |
|---|---|---|
| **C9** decimal claim count silently became 10× ("12.5" → "125") | Number fields keep what the visitor typed. Claim counts: anything but digits/commas/spaces shows "Please enter a whole number of claims." and blocks Next. Money: digits, commas, spaces, a $ and one decimal point; anything else shows "Numbers only, please." and blocks Next. Pasted text follows the same rules. Nothing is stripped or truncated. | C7a to C7e, C8a to C8c, C9a to C9c: PASS (UI). Unit tests added in `src/lib/__tests__/inputRules.test.ts` (9 tests, including "12.5" claims, "12k5", "1,500" claims, "$12,500.50", "12..5", pasted "$ 300,000"). |
| **B-F1** "worth asking about" note hidden on Not reported rows | The note now shows in the row without expanding it | B: All "I don't know" and QA-4 PASS |
| **F5** copy inconsistencies | Top-level verdict "Your billing is running at a top level. That's rare."; "Other specialty" outside the tile; one date format "November 9, 2026" (including the report-mock month columns); "vs." everywhere (including the lead email body) | F5: PASS |

Project test suite after the fixes: **305 / 305 pass**, `npm run build` 0 errors. First-load JS 227.1 KB.

---

## A. Independent math oracle

**Result: PASS. 0 mismatches in 10,000 cases** (re-run after the fixes: still 0).

- `qa/oracle.ts` implements spec sections 4, 5, 6 and 12.1 from the spec text. It imports nothing from `src/`.
- `qa/compare.test.ts` generates 10,000 seeded random valid input sets and compares oracle vs engine on: every metric's availability, displayed value, score (to 1e-9), status and Top performer flag; overall score and letter or no grade; every money card's presence, type, vs Good and vs Top (rounded, with the "under $100" flag) and the over-90 headline; the headline card; the biggest opportunity; the selected offer with the real config and with the Recovery Sprint on at 20%.
- Run: `npx vitest run --config qa/vitest.config.ts` · Results: `qa/oracle-results.json`

Coverage: 1,241 cases with the PI rule on; 4,813 with at least one "I don't know"; 507 with no grade; letters A 124 · B 275 · C 637 · D 848 · F 7,609; 27,678 money cards (3,219 room to grow, 80 with an "under $100" line); 2,368 with a validation warning; all four offers; 30% of cases placed exactly on anchors and targets. The engine's own validation accepted all 10,000 inputs.

Rules taken from outside sections 4 to 6: headline card = first available card in the order uncollected, cash faster, denied, over 90 (spec 9C); biggest opportunity = lowest score, ties to the higher weight then display order (spec 9F + QA B4); a card is hidden when its vs Top line rounds below $100.

Transparency note (first audit): the very first run reported 3 mismatches (`qa/oracle-results-run1.json`), all on biggest opportunity, all cases where denied + first-pass = 100% of claims so the two scores are mathematically equal (they differed by 2.8e-14 of floating-point noise). The engine applied the tie rule correctly; my oracle compared with an exact `<`. The oracle was given the same 1e-9 tie tolerance; no formula, target or expected value was changed.

## B. Hand-calculated cases

**Engine level: 98 / 98 PASS** (`qa/hand.test.ts`, `qa/hand-results.txt`): every value in the QA-1 to QA-4 tables, including scores and weighted sums, matches both the oracle and the engine. The hand calculations are correct, including QA-1's half-up rounding (2,250 → $2,300).

**Through the real UI: 116 / 116 PASS** (`qa/scripts/qa-b.mjs`, `qa/results-B-ui.json`), each case typed like a person, every figure read off the screen.

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

## C. Validation and input handling (through the UI)

**27 / 27 PASS** (`qa/scripts/qa-c.mjs`, `qa/results-C.json`)

| # | Check | Result |
|---|---|---|
| C1 | Adjustments = charges, and > charges → blocked with a message | PASS (both) |
| C2 | AR over 90 > total AR → blocked | PASS |
| C3 | Denied > submitted · first try > submitted · denied + first try > submitted → blocked | PASS (all 3) |
| C4 | NCR > 105% blocked · 100 to 105% warning only | PASS (both) |
| C5 | Days in AR > 365 → warning only | PASS |
| C6 | Fewer than 30 claims → warning only | PASS |
| C7a | "-5000" in money: kept, "Numbers only, please.", blocked | PASS |
| C7b | "abc" in money: kept, message, blocked | PASS |
| C7c | Empty required field → "Please enter this number." | PASS |
| C7d | "12k5" in money: kept, message, blocked | PASS |
| C7e | "12..5" in money: kept, message, blocked | PASS |
| C8a | "$12,500", "12,500", "12500" → same value | PASS |
| C8b | "$12,500.50" valid, shows "12,500.50" | PASS |
| C8c | Pasted "$ 300,000" valid, shows "300,000", moves on | PASS |
| C9a | "12.5" claims: kept, "Please enter a whole number of claims.", blocked | PASS (`qa/screenshots/C9-decimal-claims.png`) |
| C9b | "12k5" claims: kept, whole-number message, blocked | PASS |
| C9c | "1,500" claims valid, moves on | PASS |
| C10 | Charges 50,000,000: no overflow, no scientific notation (1440 and 390) | PASS (`qa/screenshots/C10-large-values-*.png`) |
| C11 | Fast typing 50 ms / 5 ms, 10 runs, all 8 answers exact + reveal | PASS 10/10 (re-run after the input change) |
| C12 | Back, change first try 1,260 → 1,200: statement and result show 80.0% | PASS |
| C13 | Specialty change after answering: same figures, specialty text and label change; Accident + Yes applies the PI rule (F 56.5 = 3,675 / 65) | PASS (both) |

## D. Consistency across the page

**18 / 18 PASS** (Nov 9; the fixes did not touch any figure, and A/B re-confirm every figure). `qa/scripts/qa-d.mjs`, `qa/results-D.json`. For golden 1 and QA-1:
- D1: headline figure, grade and the five values identical in the reveal, verdict band, statement, ledger, what-if at 0%, offer block, desktop and mobile sticky bars.
- D2: what-if 0% = scorecard (+$0); 100% = A 100.0; the "Good levels" snap puts every number at or better than Good; denial + first-pass never above 100 at 51 slider positions.
- D3: the Top / Good toggle switches every row; Top-only rows read "Already at Good".
- D4: print/PDF exactly 2 pages, every printed number matches the screen (`qa/print-golden1.pdf`, `qa/print-qa1.pdf`).

## E. Lead form

**10 / 10 automated checks PASS, 1 not verified** (Nov 9; `qa/scripts/qa-e.mjs`, `qa/results-E.json`, payloads `qa/results-E-payloads.json`).

**Real submissions: YES. Two REAL submissions were sent to `https://formspree.io/f/xpppgarr` on November 9 (not intercepted), both accepted with HTTP 200:**
- "QA TEST A-no-numbers (please ignore)" · practice "QA Test Practice A-no-numbers" · checkbox unticked
- "QA TEST B-with-numbers (please ignore)" · practice "QA Test Practice B-with-numbers" · checkbox ticked
- Visitor email on both: shahzaib.ventures@gmail.com. Expected subjects: "New scorecard lead: QA Test Practice A-no-numbers, grade F" and "…B-with-numbers, grade F".

**Did they reach shahzaib.ventures@gmail.com? NOT VERIFIED.** The only Gmail access available to the auditor is msuhaib797@gmail.com, and nothing from Formspree is there. Formspree delivers to the email registered on the Formspree form (not set by the site's code); on a new form it may first send a confirmation email to that account.

| # | Check | Result |
|---|---|---|
| E1a | Payload: _subject, name, practice, email, phone, specialty, grade, offer, pain points | PASS |
| E1b | Formspree accepted both (HTTP 200) | PASS |
| E1c | Lead arrives at shahzaib.ventures@gmail.com | **NOT VERIFIED** |
| E2a | Unticked: no scorecard numbers in the payload | PASS |
| E2b | Ticked: 5 values + 4 money figures included | PASS |
| E3a | Honeypot filled: nothing sent | PASS |
| E3b | No request leaves the page before Submit | PASS |
| E4 | Request blocked: friendly message, email fallback, typed values kept | PASS |
| E5a | "Thanks, QA. Your report is on its way." | PASS |
| E5b | Calendly loads only after a successful send | PASS |
| E6 | Every booking button → calendly.com/muhammadshahzaibkhan/30min, new tab | PASS |

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

## H. Speed and accessibility

**Not run.** Needs the live URL (PageSpeed Insights, mobile and desktop, 3 runs each, median).

---

## Files

- Oracle and engine checks: `qa/oracle.ts`, `qa/compare.test.ts`, `qa/hand.test.ts`, `qa/vitest.config.ts` (run: `npx vitest run --config qa/vitest.config.ts`)
- Browser scripts: `qa/scripts/` (expect the preview server on port 5391 and the Chromium/Edge paths in `qa-lib.mjs`)
- Results: `qa/oracle-results.json`, `qa/oracle-results-run1.json`, `qa/hand-results.txt`, `qa/results-*.json`, `qa/visible-text.txt`
- Screenshots: `qa/screenshots/` · PDFs: `qa/print-golden1.pdf`, `qa/print-qa1.pdf`
