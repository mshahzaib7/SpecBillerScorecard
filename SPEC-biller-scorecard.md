# MASTER PROMPT — "Is My Biller Doing a Good Job?" Scorecard (v2)

You are a senior full-stack developer AND a senior UI/UX designer building a production-quality web tool for a US medical billing (RCM) company. The audience is owners and office managers of small US medical practices (behavioral/mental health, general medicine, accident/PI). They are busy, not technical, and skeptical. The tool must look premium, feel fast, and every number it shows must be mathematically correct.

**The business goal:** show each owner, honestly and in dollars, how far their billing is from what the best practices achieve, connect that gap to the pains they told us about, and make booking a free call with us the obvious next step. Persuasion comes from real math and great presentation, never from bent numbers.

Read this whole file before writing any code. Build in the phases below. **Stop at the end of each phase, show me the results, and wait for my "go" before the next phase.**

---

## 0. Placeholders (I will fill these in)

- `[COMPANY_NAME]` — our billing company name
- `[FOUNDER_NAME]` — Muhammad Shahzaib Khan
- `[BOOKING_LINK]` — Calendly link for a free 20-minute call
- `[CONTACT_EMAIL]`
- Color palette and typography — DECIDED. See section 11 (Design system). Use those exact tokens in `src/styles/tokens.css`; every color in the app must come from a token.

---

## 1. What the tool does

The owner (optionally) picks what's bothering them about billing, then enters a few numbers from two standard billing reports (a charges/payments/adjustments summary for the last 3 months, and an AR aging report as of today). The tool:

1. Calculates 5 key billing metrics
2. Grades each one (Problem / Watch / Good) and flags "Top performer" where earned
3. Gives an overall letter grade (A–F)
4. Shows the money gap in dollars at TWO levels: vs. the "Good" target and vs. what **top-performing practices** achieve
5. Lets the owner play with "what if" sliders
6. Ends with a call-to-action tied to their own numbers and their own pains

**Everything runs in the browser. No data is ever sent to a server, stored, or tracked.**

---

## 2. Tech stack and hard rules

- Vite + React + TypeScript (strict mode) + Tailwind CSS
- `framer-motion` for animations. Gauges and charts are hand-built SVG (no heavy chart library).
- Vitest for unit tests.
- Deploy target: Vercel (static). No backend, no database, no cookies, no localStorage of financial inputs, no analytics on input values. Do not put input values in the URL.
- All calculation logic lives in ONE pure module: `src/engine/` (no React imports there). The UI only calls the engine. The "what if" simulator uses the SAME engine. Never duplicate a formula anywhere.
- All benchmark numbers, targets, score anchors and weights live in ONE config file: `src/engine/config.ts`, each with a comment noting it is a commonly cited industry benchmark. My billing team will review this file.
- **Integrity rule:** the engine must never inflate results. Same inputs → same outputs, and a genuinely top-performing practice must see top-performing results with no money gap. This is what makes the bad results believable.
- Mobile-first and fully responsive on every screen size listed in section 11.6. No horizontal scroll.
- Accessibility: WCAG AA contrast, keyboard navigable, labels on every input, status never shown by color alone (always icon + word).
- Respect `prefers-reduced-motion`.

---

## 3. Inputs (exact list)

A short 4-step form with a progress bar. Each numeric field has: a plain-English label, a "Where do I find this?" tooltip, and an "I don't know" checkbox where noted.

**Step 1 — What's bothering you? (optional, multi-select chips)**
Title: "What's frustrating you about billing right now?" Chips (store as `painPoints[]`):
- Insurance pays too slowly
- Too many denied claims
- Old unpaid claims piling up
- Not sure we're collecting everything we're owed
- Patients not paying their balances
- My biller doesn't send clear reports
- I don't know if my biller is doing a good job
- Front desk / staff overwhelmed with billing work

> Developer note: keep this list in `config.ts`. Every chip must map to a service we actually provide (see the mapping in section 9F). I will remove any we don't offer.

**Step 2 — About your practice**
- `specialty`: Behavioral / Mental Health · General Medicine / Primary Care · Accident / Personal Injury · Other
- If specialty = Accident / PI, show yes/no: `arIncludesAttorneyCases` — "Does your AR include attorney / LOP / PIP-pending cases?"

**Step 3 — Last 3 full months** (from the charges/payments/adjustments summary report)
- `charges3` — Total charges billed (USD) — required
- `adjustments3` — Total contractual adjustments (USD) — required
- `payments3` — Total payments received, insurance + patient (USD) — required
- `claimsSubmitted3` — Number of claims submitted — required for claim metrics
- `claimsDenied3` — Number of claims denied or rejected on first submission — "I don't know" allowed
- `claimsPaidFirstPass3` — Number of claims paid on first submission with no rework — "I don't know" allowed

**Step 4 — Today** (from the AR aging report)
- `totalAR` — Total accounts receivable (USD) — required
- `ar90` — AR older than 90 days (USD) — "I don't know" allowed

Helper text at top of Step 3: *"Ask your biller for two reports: a charges/payments/adjustments summary and an AR aging report. A good biller can send them in minutes."*

Currency inputs: accept "12,500", "12500" or "$12,500"; format with commas as the user types. Integer counts only for claim numbers.

---

## 4. Formulas (use EXACTLY these)

`PERIOD_DAYS = 90` (standard 3-month method — document this in the methodology panel). **Always multiply by 100 before dividing** to avoid floating-point drift.

```
netCharges         = charges3 - adjustments3
netRatio           = netCharges / charges3
avgDailyCharges    = charges3 / PERIOD_DAYS

NCR  (Net Collection Rate, %)  = payments3 * 100 / netCharges
DAR  (Days in AR, days)        = totalAR * PERIOD_DAYS / charges3
AR90 (% of AR over 90 days)    = ar90 * 100 / totalAR
DEN  (Denial rate, %)          = claimsDenied3 * 100 / claimsSubmitted3
FPR  (First-pass rate, %)      = claimsPaidFirstPass3 * 100 / claimsSubmitted3
```

If a needed input is "I don't know" or a denominator is 0, that metric is **unavailable** (never NaN, never Infinity, never 0 by default).

---

## 5. Targets and scoring (put ALL of this in config.ts)

### Two targets per metric

| Metric | Direction | "Good" target | "Top performer" target |
|---|---|---|---|
| NCR % | higher is better | 95 | 98 |
| Days in AR | lower is better | 40 | 30 |
| AR over 90 % | lower is better | 15 | 10 |
| Denial rate % | lower is better | 5 | 3 |
| First-pass rate % | higher is better | 95 | 97 |

### Score anchors (piecewise-linear, clamped at both ends)

| Metric | Anchors (value → score) |
|---|---|
| NCR % | 80→0, 90→60, 95→85, 98→100 |
| Days in AR | 30→100, 40→85, 60→60, 90→0 |
| AR over 90 % | 10→100, 15→85, 20→60, 40→0 |
| Denial rate % | 3→100, 5→85, 10→60, 20→0 |
| First-pass rate % | 75→0, 90→60, 95→85, 97→100 |

(Note: "Good" target = the score-85 anchor, "Top performer" target = the score-100 anchor, so targets, scores and statuses can never contradict each other.)

### Status per metric (derived ONLY from the score)
- score ≥ 85 → **Good**
- 60 ≤ score < 85 → **Watch**
- score < 60 → **Problem**
- Extra badge: if the value meets or beats the Top performer target → also show **"Top performer"** (score will be 100).

### Overall grade
- **Weights:** NCR 30 · DAR 20 · Denial 20 · AR90 15 · First-pass 15 (sum = 100).
- Overall score = weighted average of AVAILABLE metrics only, computed with integer weights: `sum(weight_i * score_i) / sum(available weights)`.
- Fewer than 3 metrics available → no letter grade; show "Not enough data for a grade".
- **Letter:** A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60.

### Floating-point safety (must follow)
- Interpolate as `scoreA + (value - valueA) * (scoreB - scoreA) / (valueB - valueA)` — multiply before dividing.
- Round with one shared helper: `round1(x) = Math.round(x * 10 + 1e-9) / 10`. Round the overall score ONCE with it, then use that same value for both display and letter.
- Money: `roundMoney(x) = Math.round(x / 100 + 1e-9) * 100`.
- Tests compare displayed (rounded) values exactly, and intermediate values with `toBeCloseTo(value, 6)`.

### Unknown metrics
Show the card as "Not reported" with: *"A good biller reports this number every month. If you don't have it, that's worth asking about."*

### Accident / PI rule
If specialty = Accident/PI AND `arIncludesAttorneyCases = yes`, mark DAR and AR90 as **not graded** (excluded from overall score and from money cards) and show: *"Attorney and LOP cases naturally take months to settle, so Days in AR and AR over 90 days can't be fairly graded here. For a fair grade, enter health-insurance numbers only."* Keep showing the raw values, ungraded.

---

## 6. Money gaps (two levels, honest and clearly labeled)

Each money card shows up to two lines:
- **"vs. Good target"** — shown only if the user is worse than the Good target
- **"vs. top-performing practices"** — shown if the user is worse than the Top performer target

A card appears if the metric is worse than the Top performer target. If the metric is better than Good but not yet Top, title the card **"Room to grow"** and show only the top-performer line.

**Never add cards together** (different time units). Every card shows its time unit, the word "estimate", and a "How we calculated this" expander with the formula and the user's numbers plugged in. Display as "about $X" using `roundMoney` and `Intl.NumberFormat('en-US')`.

Let `T` = the relevant target (Good or Top).

1. **Uncollected money — per year** (NCR)
   `= netCharges * 4 * (T_ncr - NCR) / 100`
2. **Cash that could come in faster — one-time** (DAR)
   `= (DAR - T_dar) * avgDailyCharges * netRatio`
3. **Denied claims above target — per month** (Denial)
   `excessDeniedPerMonth = (claimsDenied3 - T_den * claimsSubmitted3 / 100) / 3`
   `avgNetClaimValue = (charges3 / claimsSubmitted3) * netRatio`
   `= excessDeniedPerMonth * avgNetClaimValue`
   Text: "Most denials can be fixed and recovered, but each one delays your cash and costs staff time." Do NOT call this money lost.
4. **Money stuck over 90 days — right now** (AR90)
   Headline amount: `ar90 * netRatio`
   Gap lines: `(ar90 - T_ar90 * totalAR / 100) * netRatio`
   Text: "The older a claim gets, the harder it is to collect."

First-pass rate has no money card (its cost already shows up through denials and slow payments).

If no card applies at all: *"Your billing is performing at a top level. That's rare. We'd love to help you keep it that way."*

**Source line under the money section:** *"Targets are commonly cited industry benchmarks for US physician practices; 'top performer' reflects best-in-class levels. Estimates only."*

---

## 7. Validation (block bad results)

Errors (block the scorecard until fixed, with a friendly message next to the field):
- Any negative number, or a required field empty
- `adjustments3 >= charges3`
- `ar90 > totalAR`
- `claimsDenied3 > claimsSubmitted3` or `claimsPaidFirstPass3 > claimsSubmitted3`
- `claimsDenied3 + claimsPaidFirstPass3 > claimsSubmitted3`
- NCR > 105% → "Payments look too high for these charges. Please double-check the numbers."

Warnings (allow, but show a note):
- 100% < NCR ≤ 105% → "Above 100% can happen when late payments from earlier months land in this period."
- DAR > 365 → "This is unusually high. Please double-check total AR and charges."
- `claimsSubmitted3 < 30` → "Small numbers can swing a lot. Results are less reliable."

---

## 8. Mandatory tests (Phase 1 — must all pass before any UI work)

Write Vitest tests in `src/engine/__tests__/`.

### Golden test 1 — struggling practice
**Input:** charges3 300,000 · adjustments3 120,000 · payments3 166,500 · claimsSubmitted3 1,500 · claimsDenied3 180 · claimsPaidFirstPass3 1,260 · totalAR 190,000 · ar90 47,500 · specialty Behavioral Health

| Item | Expected |
|---|---|
| netCharges / netRatio | 180,000 / 0.6 |
| NCR | 92.5% → score 72.5 → Watch |
| DAR | 57.0 days → score 63.75 → Watch |
| AR90 | 25.0% → score 45 → Problem |
| Denial | 12.0% → score 48 → Problem |
| First-pass | 84.0% → score 36 → Problem |
| Overall | 56.3 → **F** |
| Uncollected / yr — vs Good / vs Top | 18,000 / 39,600 |
| Cash faster one-time — vs Good / vs Top | 34,000 / 54,000 |
| Denied above target / month — vs Good / vs Top | 4,200 / 5,400 |
| Money stuck over 90 days (headline) | 28,500 |
| Over-90 gap — vs Good / vs Top | 11,400 / 17,100 |

### Golden test 2 — renormalization + rounding edge
Same as test 1 but `claimsPaidFirstPass3 = unknown`. Overall = 5085 / 85 = 59.82… → displayed **59.8**, letter **F** (must NOT become 60 / D).

### Golden test 3 — top-performing practice (integrity check)
**Input:** charges3 300,000 · adjustments3 120,000 · payments3 178,200 · claimsSubmitted3 1,500 · claimsDenied3 30 · claimsPaidFirstPass3 1,470 · totalAR 90,000 · ar90 8,100

| Item | Expected |
|---|---|
| NCR | 99.0% → score 100 → Good + Top performer |
| DAR | 27.0 days → score 100 → Good + Top performer |
| AR90 | 9.0% → score 100 → Good + Top performer |
| Denial | 2.0% → score 100 → Good + Top performer |
| First-pass | 98.0% → score 100 → Good + Top performer |
| Overall | 100.0 → **A** |
| Money cards | none; the top-level message shows |

### Golden test 4 — "good but not top" practice
**Input:** charges3 300,000 · adjustments3 120,000 · payments3 172,800 · claimsSubmitted3 1,500 · claimsDenied3 60 · claimsPaidFirstPass3 1,425 · totalAR 105,000 · ar90 12,600

| Item | Expected |
|---|---|
| NCR | 96.0% → score 90 → Good |
| DAR | 31.5 days → score 97.75 → Good |
| AR90 | 12.0% → score 94 → Good |
| Denial | 4.0% → score 92.5 → Good |
| First-pass | 95.0% → score 85 → Good |
| Overall | (2700 + 1955 + 1850 + 1410 + 1275) / 100 = 91.9 → **A** |
| Uncollected / yr | "Room to grow" — vs Top only: 14,400 |
| Cash faster one-time | "Room to grow" — vs Top only: 3,000 |
| Denied above target / month | "Room to grow" — vs Top only: 600 (5 claims × $120) |
| Over-90 | "Room to grow" — headline 7,600; vs Top only: 1,300 |
| First-pass | exactly at Good target; no money card (by design) |

**Rule for all golden tests:** if your engine's result differs from any expected value, do NOT change a formula or a test to make them match. Stop, show me the difference, and explain which side you believe is wrong.

### Also test
- Every anchor point returns its exact score; values beyond the ends clamp to 0 or 100
- Status boundaries: score exactly 85 → Good; exactly 60 → Watch; 59.99 → Problem
- Letter boundaries: 90.0 → A, 89.9 → B, 60.0 → D, 59.9 → F
- Division by zero → metric unavailable (no NaN / Infinity anywhere)
- PI rule: DAR and AR90 excluded from overall score and money when `arIncludesAttorneyCases = yes`
- Fewer than 3 available metrics → no letter grade
- Every validation error and warning in section 7
- Card logic: no card when at/better than Top; "Room to grow" when between Good and Top; both lines when worse than Good
- Weights sum to exactly 100

At the end of Phase 1, print a table for all 4 golden cases: expected vs. actual for every value. **Stop and show me.**

---

## 9. Page design (Phase 2)

Design like a top-tier SaaS product (Stripe / Linear quality): generous white space, a clear type hierarchy, one strong accent color, soft shadows, rounded corners, and smooth but subtle motion. Calm, expert and trustworthy; never cluttered or pushy.

### A — Hero
See section 11.5 (it replaces the old hero copy).

### B — The 4-step form
One step per screen on mobile, a clean card on desktop. Progress bar. Back/Next. Pain chips are large and tappable. Live mini-preview of each computed rate under its inputs once filled (e.g., "Your net collection rate: 92.5%").

### C — The reveal (the "wow" moment)
- Animated count-up to the overall score inside a large circular gauge, then the letter grade scales in.
- One-line verdict by grade: A "Strong billing. Let's see if there's room to reach the top." · B "Solid, but money is slipping through." · C "You're leaving real money on the table." · D "Your billing needs attention." · F "Money is leaking out of your practice."
- **Headline money line** right under the grade: the largest yearly figure available (the NCR gap vs Top), e.g. *"Practices at the top level would collect about $39,600 more per year with your numbers."* If NCR is unavailable or already top, use the next available card.
- 5 **metric cards** in a responsive grid. Each shows:
  - Plain-English name (e.g., "How much of what you're owed actually gets collected")
  - The user's value, large
  - A horizontal track with Problem / Watch / Good zones, plus two ticks: **Good** and **Top**. A marker animates to the user's value.
  - Status badge (icon + word), plus the "Top performer" badge when earned
  - Tap to expand: **What this means** · **What usually causes this** · **How we fix it** (2–3 bullets each, tailored to the chosen specialty)

### D — Where the money is
The money cards from section 6. On each, make the "vs. top-performing practices" line visually prominent (larger number), with "vs. Good target" beneath it.

### E — "What if?" simulator
- Title: **"See what top-level billing would look like for your practice"**
- A slider per available metric, starting at the user's value.
- Live updates of grade, gauge and money using the same engine.
- Two buttons: "Show me Good levels" and "Show me top-performer levels". Each animates all sliders to those targets.
- Note: "This shows what changes if your numbers reach these levels. Actual results depend on your payers, specialty and processes."

### F — Call to action (the most polished section)
- Headline by grade: A "You're close to the top. Let's close the last gap." · B/C "Let's turn that gap into money in your account." · D/F "Let's stop the money leak."
- **"Your biggest opportunity"**: the metric with the lowest score, named in one sentence with its gap to Top.
- **"You told us"** block (only if pain chips were selected): for each selected pain, one line on how we handle it. Mapping lives in `config.ts`:
  - Insurance pays too slowly → "We follow up on every unpaid claim on a set schedule, not when someone remembers."
  - Too many denied claims → "We fix the root cause of each denial so it stops repeating, then rework and resubmit."
  - Old unpaid claims piling up → "We work your old AR oldest-first, before filing deadlines close."
  - Not sure we're collecting everything → "We check what was paid against what should have been paid."
  - Patients not paying balances → "We set up clear patient statements and follow-up."
  - Biller doesn't send clear reports → "You get a monthly report with these exact 5 numbers."
  - Don't know if biller is doing a good job → "You'll always know: we report against the same targets you just saw."
  - Staff overwhelmed → "We take billing work off your front desk."
  (Developer: keep each line short. I will edit them for accuracy.)
- **"Your numbers vs. the levels we work toward"**: per metric, three columns: You → Good → Top.
- **What you get on the free 20-minute call** (3 steps with icons):
  1. We walk through your scorecard together
  2. We show you the 3 biggest fixes for your practice
  3. You leave with a clear plan, whether or not you hire us
- **Why us** (only true statements): hands-on billing experience with behavioral and mental health practices in Florida and South Carolina; full-cycle work (claim submission, AR follow-up, denials); monthly reporting on these exact metrics.
- Big primary button → `[BOOKING_LINK]` ("Book my free billing review"). Secondary: email `[CONTACT_EMAIL]`.
- Founder card: `[FOUNDER_NAME]`, a short line, space for a photo.
- **Strict honesty rules for all copy:** no guarantees ("we will increase your revenue by X%"), no invented testimonials, logos, client counts or case-study numbers, no insulting the current biller. Compare numbers to targets and let them speak.

### G — How we calculate (trust builder)
Collapsible panel listing every formula, the 90-day method, both target levels, score anchors and weights, plus: *"Targets are commonly cited industry benchmarks for US physician practices. 'Top performer' reflects best-in-class levels. Benchmarks vary by specialty and payer mix."*

### H — Footer
- "Save as PDF" (uses `window.print()` with a clean print stylesheet: grade, metric values, money cards, date; hides sliders and buttons).
- Disclaimer: *"This tool gives estimates for information only. It is not financial, legal or accounting advice. No data you enter is sent or stored unless you choose to send us your report."*
- Privacy line, company name, year.

---

## 10. Quality checklist (Phase 3 — run before telling me it's done)

- [ ] All tests pass (`npm test`); all 4 golden tables printed with expected vs. actual
- [ ] `npm run build`: zero TypeScript errors; zero browser console errors/warnings
- [ ] No NaN, Infinity, "undefined" or blank values anywhere, for any input combination including "I don't know" on every optional field
- [ ] Simulator and reveal always show identical results for identical numbers
- [ ] Golden test 3 shows an A with no money cards (integrity check)
- [ ] Network tab shows no requests carrying input data
- [ ] Screenshot and check every breakpoint in section 11.6 (320 → 2560px, portrait and landscape); no overflow, no cut-off text, no awkward empty space; Lighthouse accessibility ≥ 95, performance ≥ 90
- [ ] Fonts load with `font-display: swap`, no layout shift (CLS < 0.05)
- [ ] Print/PDF output is clean on one or two pages
- [ ] All colors come from `tokens.css`
- [ ] Spelling and grammar check on all copy (US English)

Then give me: run commands, Vercel deploy steps, and a list of every value in `config.ts` (targets, anchors, weights, pain chips and their "how we handle it" lines) for my billing team to review.

---

## 11. Design system (applies to Phase 2 — follow exactly)

### 11.1 Concept
"Calm trust, sharp money." Deep sapphire says *trust and expertise* (what a practice owner needs to feel before handing over their billing). Neon jade means *money coming in / where you want to be*. It is used sparingly, so every jade element pulls the eye: the main buttons, the "Top performer" badge, and the money the owner could gain. The rule: **two quiet colors set the mood, one loud color does the selling.**

Page rhythm: the hero, the reveal (grade) and the final CTA sit on deep sapphire (dark sections). Form, metric cards, money and methodology sit on white / pale blue (light sections). This dark-light-dark rhythm makes the page feel premium and memorable instead of one flat template.

### 11.2 Color tokens (`src/styles/tokens.css`)

```css
:root {
  /* Brand */
  --color-brand: #0042AC;          /* Sapphire Blue: primary brand, links, focus rings */
  --color-brand-deep: #002B73;     /* dark section backgrounds (hero, reveal, CTA) */
  --color-brand-deeper: #001A47;   /* gradients / depth inside dark sections */
  --color-sky: #00D3FB;            /* Ocean Blue: decorative only (glows, gauge arcs, chart lines). NEVER as text on white */
  --color-accent: #83FD80;         /* Neon Jade: primary CTA background, Top performer badge, "money you could gain" */
  --color-accent-hover: #6CF069;
  --color-on-accent: #0A1A3A;      /* text on jade (contrast ~13:1). NEVER white text on jade */

  /* Neutrals (tinted toward sapphire, never pure gray) */
  --color-ink: #0A1A3A;            /* main text on light */
  --color-ink-muted: #4A5878;      /* secondary text */
  --color-ink-subtle: #7A87A3;     /* captions, placeholders (large text only) */
  --color-bg: #FFFFFF;
  --color-surface: #F5F8FF;        /* alternate light sections */
  --color-surface-2: #EAF0FB;      /* inputs, chips, card insets */
  --color-border: #DCE4F2;

  /* On dark (sapphire) sections */
  --color-on-dark: #FFFFFF;
  --color-on-dark-muted: #B9C7E6;
  --color-dark-border: rgba(255,255,255,0.12);
  --color-dark-card: rgba(255,255,255,0.06);

  /* Status (separate from brand so meaning stays clear) */
  --status-problem: #D92D20;  --status-problem-bg: #FEF3F2;
  --status-watch:   #B54708;  --status-watch-fill: #F79009;  --status-watch-bg: #FFFAEB;
  --status-good:    #067647;  --status-good-fill: #17B26A;   --status-good-bg: #ECFDF3;
  --status-top:     var(--color-accent);   /* Top performer badge = jade with ink text */
}
```

Color rules:
- Jade covers at most ~5% of any screen: only the primary CTA, the Top performer badge, and positive money figures ("could gain"). Never decoration.
- Ocean blue is only for glows and data visuals, never body text.
- Status colors only for metric statuses. Status is always icon + word + color.
- All text must pass WCAG AA (4.5:1 body, 3:1 large). Verify every pair and report the ratios.

### 11.3 Typography (free, open-license, NOT the generic "AI site" look)

- **Geist** (Google Fonts or the `geist` npm package): all headings, UI and body. Clean and precise, and not the overused Inter / Poppins look.
- **Instrument Serif, italic** (Google Fonts): ONLY for 1–2 emphasis words inside big headlines, e.g. "Is your biller *actually* doing a good job?". This serif-italic contrast is what makes the hero feel editorial and expensive. Never for body text, buttons or numbers.
- Do NOT use Inter, Poppins, Montserrat, Roboto or system-ui as the visible font.
- All numbers (grades, %, $, days) use `font-variant-numeric: tabular-nums` so they don't jitter while animating.
- Self-host or preload the two fonts; `font-display: swap`; size-adjusted fallback to avoid layout shift.

Fluid type scale (use `clamp()`, no breakpoint jumps):

| Token | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|
| `--text-hero` | clamp(2.5rem, 1.6rem + 4.5vw, 6rem) | 600 | 1.02 | -0.035em |
| `--text-h2` | clamp(2rem, 1.4rem + 2.6vw, 3.75rem) | 600 | 1.08 | -0.03em |
| `--text-h3` | clamp(1.375rem, 1.15rem + 0.9vw, 1.875rem) | 600 | 1.2 | -0.02em |
| `--text-body-lg` | clamp(1.0625rem, 1rem + 0.3vw, 1.25rem) | 400 | 1.6 | -0.005em |
| `--text-body` | 1rem (never smaller than 16px on mobile) | 400 | 1.6 | 0 |
| `--text-small` | 0.875rem | 500 | 1.5 | 0 |
| `--text-eyebrow` | 0.75rem uppercase | 600 | 1.4 | 0.12em |
| `--text-grade` (letter grade) | clamp(5rem, 3rem + 10vw, 11rem) | 600 | 1 | -0.05em |
| `--text-stat` (big numbers) | clamp(2rem, 1.5rem + 2vw, 3.25rem) | 600 | 1.05 | -0.03em |

Paragraphs max 62ch wide. Use `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs.

### 11.4 Spacing, shape, depth, motion

- 8px spacing system. Section padding: `clamp(4rem, 3rem + 6vw, 9rem)` vertical. Side gutter: `clamp(1rem, 0.5rem + 2.5vw, 2.5rem)`.
- Container: max-width 1280px; text-heavy blocks max 760px. Above 1920px, scale the root font size gently (`html { font-size: clamp(16px, 0.35vw + 10px, 20px) }` inside a `min-width: 1920px` query) so the page fills large monitors and TVs without looking tiny or stretched.
- Radius: 12px inputs/buttons, 20px cards, 28px large panels, full pill for chips and badges.
- Shadows: soft and sapphire-tinted, e.g. `0 1px 2px rgba(10,26,58,.06), 0 12px 32px -12px rgba(0,66,172,.18)`. No hard black shadows.
- Dark sections: a subtle 1px grid pattern at ~4% opacity plus one large blurred ocean-blue glow behind the key element. No stock photos, no generic illustrations, no emoji.
- Motion: 200–400ms, ease-out `cubic-bezier(.2,.8,.2,1)`. Elements fade up 16px when scrolled into view, once. Numbers count up. Gauges draw in. With `prefers-reduced-motion`, show final states instantly.
- Buttons: primary = jade background + ink text, 52–56px tall, subtle lift on hover; secondary = outline. Every tap target at least 44×44px.

### 11.5 Hero (high-converting: the first 5 seconds) — replaces 9A

Dark sapphire section. Two columns on desktop (text left, live demo right), stacked on mobile (text first, then demo).

Left column:
- Eyebrow: "FREE BILLING SCORECARD FOR US PRACTICES"
- H1: **"Is your biller *actually* doing a good job?"** ("actually" in Instrument Serif italic, tinted `--color-sky`)
- Sub: "Enter numbers from two standard reports. In 3 minutes, see your grade, how you compare to top-performing practices, and what the gap costs you per year."
- Primary CTA (jade): "Get my free scorecard →" (scrolls to the form)
- Secondary: "See an example" (loads golden test 1)
- Trust row (small, muted, simple line icons): "Free" · "No signup" · "Your numbers never leave your browser" · "Built by billers who work with FL & SC practices"

Right column, the **signature element**: a live mini scorecard using the example practice (labeled "Example practice"). The grade gauge starts at **F**, one slider glides toward the target, the grade climbs, and a jade "+$/yr" figure counts up, then loops gently. It must be driven by the real engine with real example numbers, not hard-coded frames. Pause on hover/tap; static final frame with reduced motion.

Conversion rules for the whole page:
- One primary action per screen, always the same jade button style.
- On mobile, after the hero scrolls out, show a slim sticky bottom bar: "Get my free scorecard" (before the reveal), then "Book my free billing review" (after the reveal). Hide it while the keyboard is open.
- No pop-ups, no countdown timers, no fake urgency.

### 11.6 Responsive design: perfect on every screen

Build mobile-first with fluid sizing (`clamp()`, flex/grid with `minmax()`, container queries for cards) so layouts adapt smoothly instead of snapping. Test and screenshot all of these, portrait and landscape:

| Width | Device examples |
|---|---|
| 320px | small/old Android, iPhone SE (1st gen) |
| 360–414px | most Android phones, iPhone 12–16 |
| 430px | iPhone Pro Max, large Android |
| 600–700px | foldables (unfolded), phones in landscape |
| 768px / 834px | iPad / iPad Air portrait |
| 1024px / 1180px | iPad landscape, iPad Pro, small laptops |
| 1280–1440px | laptops |
| 1920px | desktop monitors, 1080p TVs |
| 2560px | large monitors, 4K TVs at scaled resolution |

Also:
- Use `100dvh` (not `100vh`) for full-height sections; respect the iPhone notch and home bar with `env(safe-area-inset-*)`.
- Wrap hover effects in `@media (hover: hover)` so touch devices don't get stuck hover states.
- Sliders easy with a thumb (large hit area). Inputs use `inputmode="decimal"` / `"numeric"` so the right keyboard opens.
- Metric card grid: 1 column on phones, 2 on tablets, 3 + 2 on laptops; text never squeezed.
- Nothing may overflow horizontally at any width. Long dollar amounts shrink or wrap gracefully.
- SVG for all icons and gauges so they stay sharp on retina screens and TVs.

---

## 12. Offers & lead capture (the sales engine)

The scorecard is the free value (the bait). This section adds the two missing pieces: an irresistible offer matched to each result (the hook) and a simple way to capture the lead (the net). Every visitor, whatever their result, must leave with a clear, valuable next step.

### 12.1 Offer selection (pure logic in src/engine/offers.ts, fully tested)

Pick exactly ONE main offer per result, in this priority order:

1. "Free Scorecard Build" — if 2 or more metrics are "Not reported", OR there is no letter grade.
2. "Revenue Recovery Sprint" — if grade is D or F AND the over-90 money card is shown AND the offer is enabled (see below).
3. "Gap-to-Top Plan" — if grade is B or C, or D/F when the Recovery Sprint doesn't apply.
4. "Keep It Top" — if grade is A.

All offer text, flags and placeholders live in config.ts so I can edit them without touching code.

### 12.2 The four offers (copy)

1) Free Scorecard Build
- Headline: "Your biller should be able to give you these numbers."
- Body: "Send us your two standard reports and we'll build your complete scorecard for free within 48 hours, with every number filled in and explained."
- Button: "Get my free scorecard built"

2) Revenue Recovery Sprint
- Headline: "Let's go get your money back."
- Body: "We'll work your claims older than 90 days for 60 days. You pay only [RECOVERY_PERCENT]% of what we actually collect. If we recover nothing, you pay nothing."
- Show the user's own "money stuck over 90 days" figure right above the button.
- Button: "Start my recovery sprint"
- Config flag: recoverySprintEnabled. If false OR [RECOVERY_PERCENT] is still a placeholder, fall back to the Gap-to-Top Plan. Never show a placeholder on the live site.

3) Gap-to-Top Plan
- Headline: "Close the gap to top practices."
- Body: "On a free 20-minute call, we'll show you the 3 fixes that close your gap. Then try us for 90 days, with no long-term contract. Cancel anytime."
- Show the user's biggest yearly gap vs top practices above the button.
- Button: "Show me my 3 fixes"

4) Keep It Top
- Headline: "You're performing at a high level. Let's keep it that way."
- Body: "Get a free quarterly billing check-up, so you catch problems before they cost you."
- Button: "Get my free quarterly check-up"
- Plus a referral block: "Know a practice that's struggling with billing? Send them this free tool." with a Share button (Web Share API, fallback: copy link). The shared link must be the plain site URL only, never the user's numbers.

### 12.3 "We handle the switch" block (shown with every offer except Keep It Top)

- Headline: "Worried about switching billers?"
- Body: "We handle the full transition from your current biller. No gap in claims, and no extra work for your staff."
- Config flag: switchSupportEnabled (I will confirm this is true before launch).

### 12.4 Lead capture form

Place it directly under the main offer. Title: "Get your full scorecard + personalized fix plan by email."

Fields:
- Name (required)
- Practice name (required)
- Email (required, validated)
- Phone (optional, US format hint)
- Hidden: specialty, grade, chosen offer, painPoints
- Checkbox (unchecked by default): "Include my scorecard numbers so you can prepare for our call."
  Only if checked, also send the 5 metric values and the money card figures. Never send anything unless the user presses Submit.
- Consent line under the button: "We'll only use this to send your report and follow up. No spam, ever."
- Spam protection: a hidden honeypot field; reject submissions that fill it.

Sending:
- POST JSON to [FORM_ENDPOINT] (a free service such as Formspree). Keep it in config.ts.
- If [FORM_ENDPOINT] is still a placeholder, the button opens a pre-filled email to [CONTACT_EMAIL] instead.
- On success: show "Thanks, [Name]! Your report is on its way. Want to skip the wait?" with a button to [BOOKING_LINK].
- On error: friendly message plus the email fallback. Never lose what the user typed.

The "Book my free billing review" button to [BOOKING_LINK] stays available too, for people who want to talk right away.

### 12.5 Updates to earlier sections

- Privacy line everywhere becomes: "Your numbers stay in your browser unless you choose to send us your report."
- Section 10 checklist: "Network tab shows no requests carrying input data, except the lead form after the user presses Submit, and it only includes scorecard numbers if the checkbox is ticked."
- Sticky mobile bar after the reveal shows the chosen offer's button text.

### 12.6 Honesty rules for offers

- No fake scarcity, no countdown timers, no invented testimonials or results.
- Every promise in an offer must be switchable off in config.ts, so I can remove anything my team can't deliver.

### 12.7 Tests to add

- Offer priority: one test per rule in 12.1, including edge cases (no grade, exactly 2 unknown metrics, D/F with the over-90 card hidden).
- Recovery Sprint falls back to Gap-to-Top when the flag is off or [RECOVERY_PERCENT] is a placeholder.
- Golden tests, using a test config with recoverySprintEnabled = true and a real percentage (e.g. 20): test 1 → Revenue Recovery Sprint; test 2 → Revenue Recovery Sprint; test 3 → Keep It Top; test 4 → Keep It Top.
- Golden test 1 with the real config (placeholder still in place) → Gap-to-Top Plan.
- Form payload: scorecard numbers included ONLY when the checkbox is ticked; honeypot submissions rejected; nothing sent before Submit.
