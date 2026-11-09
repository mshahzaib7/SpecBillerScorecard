# DESIGN BRIEF: Billing Scorecard by Shahzaib Khan (Redesign)

You are the senior product designer and senior front-end engineer on this project. You have shipped conversion-focused products for fintech and healthcare companies, and your work is known for restraint, sharp typography and interaction details people remember. This brief replaces the visual direction in SPEC-biller-scorecard.md section 11 and the page structure in section 9. Where they conflict, this brief wins.

**What must NOT change:** the engine in `src/engine/` (formulas, scoring, money, validation, offers), `config.ts` values, and the 285 tests. You are redesigning the experience, not the math. If a new interaction needs new logic (for example the master slider in section 8), add it to the engine as a pure, tested function.

Read the whole brief before writing code. Build in the 4 rounds in section 14 and stop after each round with screenshots.

---

## 1. Who we are designing for

A practice owner or office manager in Florida or South Carolina. Age 35 to 65. Runs a behavioral health, primary care or accident/PI practice. Has been burned by a biller before or suspects the current one. Reads EOBs, AR aging reports and bank statements every week. Has no time, hates sales pitches, and trusts numbers more than adjectives.

They decide in the first 5 seconds whether this is a serious tool or a marketing gimmick. Everything on the page must say: **the person who built this knows billing better than my biller does, and he is showing me, not telling me.**

Two non-negotiable goals:
1. **Interactive from the first second to the last.** The visitor is never just reading. They tap, type, drag, compare, expand. Every action gives an instant, satisfying response.
2. **Built to convert.** Every section moves the visitor one step closer to booking a call or sending their details. No section exists for decoration.

---

## 2. The idea: "The Statement"

Practice owners live in statements: EOBs, remittances, AR aging reports, bank statements. So the whole product is designed as **a billing statement that builds itself while you answer.**

- In the hero, the visitor sees an example statement.
- While they answer questions, their own statement fills in line by line next to the questions.
- At the end, the statement "closes": the total line draws in, the grade lands, and the money gap counts up.
- The results page IS the statement: line items, columns, a total, and a clear next step.

This metaphor is our signature. It looks like nothing else on the market, it feels familiar to the audience, and it makes the tool feel like a professional document, not a quiz.

Visual language that follows from it: hairline rules, perfectly aligned columns, tabular numbers, a monospaced face for figures, square-cut color blocks, and lots of quiet white space. Precise like a well-designed bank statement, bold like a modern fintech brand.

---

## 3. Color (exact values, no others)

The brand rule: **two quiet colors set the mood, one loud color does the selling.**

```css
:root {
  /* Quiet 1: Sapphire Blue, the brand. Large flat fields. */
  --sapphire: #0042AC;
  --sapphire-deep: #00307E;   /* derived shade for depth and hover */
  --abyss: #001A47;           /* derived darkest shade, used sparingly */

  /* Quiet 2: Ocean Blue. Only in the hero gradient, chart lines, slider tracks. */
  --ocean: #00D3FB;

  /* Loud: Neon Jade, the accent. Money you could gain + the primary action. */
  --jade: #83FD80;
  --jade-press: #6EEB6B;

  /* Neutrals */
  --ink: #0A1A3A;             /* main text */
  --slate: #56627D;           /* secondary text */
  --paper: #FFFFFF;
  --mist: #F3F6FB;            /* alternate light sections */
  --rule: #D9E1EE;            /* hairlines and borders */

  /* Status (keep the existing status tokens from tokens.css for Problem / Watch / Good) */
}
```

Rules:
- **Sapphire** is used as big, flat, full-width color fields (hero, verdict band, closing section). Never as a small decoration.
- **Ocean** appears only in the hero gradient (sapphire on the left flowing into ocean on the right, like the reference), in chart lines and in slider tracks. White text never sits on ocean; ink does.
- **Jade** appears only in three places: the primary button, money the visitor could gain, and the "Top performer" mark. Always as a solid fill with ink text. Never a glow, never a gradient, never a highlighter behind text. Jade should cover about 5% of any screen. If you are unsure, use less.
- Every text and background pair must pass WCAG AA. Headline text in the hero sits on the sapphire side of the gradient, never on the ocean side.

---

## 4. Typography

Two families. Both free on Google Fonts. Self-host them, preload the two most used weights, `font-display: swap`, size-adjusted fallbacks so nothing jumps.

- **Archivo** (variable, uses weight and width axes) for everything except figures.
  - Display and headlines: weight 700, width 108 to 112. A slightly expanded grotesk feels institutional and confident, like signage at a bank, and it is not the default look of AI-built sites.
  - Body and UI: weight 400 and 500, width 100.
  - If the width axis fails to load, fall back to weight only. Never substitute another family.
- **IBM Plex Mono** (400, 500) for all figures in the statement, money values in tables, units, step counters and small labels. This is what makes the page read like a real financial document.

Banned: Inter, Poppins, Montserrat, Roboto, Geist, Space Grotesk, any serif, any italic used for emphasis, ALL CAPS labels above headings.

Scale (fluid with `clamp()`):

| Role | Family | Size | Weight / width | Line height | Tracking |
|---|---|---|---|---|---|
| Hero headline | Archivo | clamp(2.75rem, 1.1rem + 6.2vw, 7.5rem) | 700 / 110 | 0.95 | -0.035em |
| Section headline | Archivo | clamp(2rem, 1.2rem + 3vw, 4rem) | 700 / 108 | 1.0 | -0.03em |
| Card / row title | Archivo | clamp(1.125rem, 1rem + 0.5vw, 1.375rem) | 600 / 100 | 1.25 | -0.01em |
| Lead text | Archivo | clamp(1.125rem, 1rem + 0.4vw, 1.375rem) | 400 / 100 | 1.5 | 0 |
| Body | Archivo | 1rem (17px on mobile) | 400 / 100 | 1.6 | 0 |
| Grade letter | Archivo | clamp(6rem, 3rem + 14vw, 14rem) | 700 / 112 | 0.85 | -0.05em |
| Big money | Archivo | clamp(3rem, 1.5rem + 6vw, 7rem) | 700 / 108 | 0.95 | -0.04em |
| Statement figures | Plex Mono | 0.9375rem to 1.125rem | 500 | 1.4 | 0 |
| Small labels, units | Plex Mono | 0.8125rem | 400 | 1.4 | 0.01em |

Typography rules:
- Headlines are short and left-aligned. Never more than 2 lines per sentence on desktop.
- Use the color split from the reference: the first line of the hero headline in white, the second line in jade.
- Paragraphs max 60 characters wide. `text-wrap: balance` on headlines, `text-wrap: pretty` on paragraphs.
- All numbers use tabular figures. Columns of numbers are right-aligned so decimal points line up.

---

## 5. Layout, shape and texture

- 12-column grid, max width 1280px, gutters 24px (mobile 16px). Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
- **Break the grid once per screen on purpose.** Example: the hero statement sheet overlaps the bottom edge of the hero into the next section, and the jade total block sits at its corner, like the jade block in the reference. Planned overlap is what makes a layout look designed, not templated.
- Shapes: big color fields and the jade total block have **square corners**. Buttons and inputs 6px radius. The statement sheet 4px. No pills except status dots.
- Depth: only the statement sheet has a shadow, because it is "paper" sitting on the page: `0 1px 1px rgba(10,26,58,.06), 0 24px 48px -24px rgba(0,26,71,.35)`. Nothing else floats.
- Separation comes from hairline rules (`1px solid var(--rule)`) and white space, not from boxes around everything. **Never put a card inside a card.**
- Icons: a single 1.5px-stroke set, used only where they carry meaning (status, expand, share). No icon in front of every line.
- Images: no stock photos, no illustrations, no AI art. The only photo is the founder's real portrait. Every other visual is real UI or real data.

---

## 6. Anti-slop rules (check these before every screenshot)

Visual, never do:
- Glows, blurred blobs, grid or noise backgrounds, glassmorphism
- Gradient cards or gradient text (the hero background gradient is the only gradient on the site)
- Small uppercase labels above headings
- Highlighter or marker effects behind text
- Rows of identical cards with an icon, a title and two lines of text
- Centered everything. Default to left alignment.
- Fake logos, fake testimonials, star ratings, "trusted by" bars, client counts

Writing, never do:
- No em dashes or en dashes anywhere in the copy. Use a period, a comma, a colon or the word "to" (write "91 to 120 days", not "91–120"). Before each round ends, search `src/` for `—` and `–` in user-facing strings and remove them.
- Banned words: elevate, unlock, empower, seamless, leverage, robust, game-changer, journey, revolutionize, cutting-edge, streamline, supercharge, delve, harness, in today's world, peace of mind, look no further.
- No exclamation marks except in the thank-you message.
- Contractions are good ("you're", "we'll"). Sentences short. Speak like an experienced biller talking to a practice owner across a desk.
- Use the real words of the trade where they help: claims, payers, denials, AR, aging report, EOB, contractual adjustments, authorizations, timely filing. This is what tells an owner the builder knows the market.

---

## 7. Page structure and every section

The page has two states: **before** (landing and questions) and **after** (the statement and the next step). Order and purpose of each section:

### 7.1 Top bar
- Left: wordmark (section 11).
- Right: text link "How we calculate" (opens the methodology drawer) and, before results only, a small jade button "Get my scorecard".
- Transparent over the hero, turns paper white with a hairline bottom border after scrolling 40px. Height 64px desktop, 56px mobile.

### 7.2 Hero (the first 5 seconds)
Full-width field with a flat diagonal gradient from `--sapphire` (left) to `--ocean` (right). No texture.

Left column (7 of 12 columns):
- Headline, two lines:
  - Line 1 (white): **"Your biller says everything's fine."**
  - Line 2 (jade): **"See the numbers in 3 minutes."**
- Lead (white at 85% opacity): "Answer a few questions from two reports your biller already has. You'll get a grade, a line-by-line statement, and what the gap is costing you each year."
- **Interactive start, not a button.** Label in white: "What kind of practice do you run?" Below it, 4 large tappable tiles in a 2 by 2 grid (white tiles, ink text, 6px radius, 64px tall):
  - Behavioral and mental health
  - Primary care and general medicine
  - Accident and personal injury
  - Something else
  Tapping a tile saves the specialty, the tile flips to jade with a check, and the page glides to the first question. One tap is easier than any form field, and it starts the commitment.
- Small line under the tiles: "Free. No sign-up. Your numbers stay on your device unless you choose to send them."

Right column (5 of 12 columns): **the example statement sheet**, white paper with the paper shadow, perfectly straight (precision is the brand).
- Header row: "Example practice" (Archivo 600) and "Sample numbers" (Plex Mono, slate).
- Five line items, each with name, value and a status dot plus word: Net collection rate 92.5% Watch · Days in AR 57 days Watch · AR over 90 days 25.0% Problem · Denial rate 12.0% Problem · First-pass rate 84.0% Problem.
- Grade on the right of the header: "F" with "56.3 / 100".
- Bottom total: a **square jade block** that hangs over the bottom edge of the hero into the next section: "Yearly gap vs top practices" (Plex Mono) and "$39,600" (big money style, ink).
- Live demo, driven by the real engine: every 6 seconds the rows animate toward Good levels one by one, the grade climbs to B, and the jade total counts down to the remaining gap. Then it resets. Pause on hover or touch. Static with reduced motion.

Bottom of hero, across the full width: a thin row with the founder's small round photo (40px), and: "Built by Muhammad Shahzaib Khan. My team works on billing for practices in Florida and South Carolina." This puts a real person on the first screen.

### 7.3 "Why these numbers" strip (paper white, one row, three columns)
Three honest facts about the tool, each a big Plex Mono figure plus one sentence. No invented statistics.
- **5** "The same five numbers well-run practices review every month."
- **2** "Reports your biller can send you today: a charges and payments summary, and an AR aging report."
- **0** "Numbers sent anywhere unless you ask for your report."

### 7.4 The questions (the statement builds itself)
Desktop: two columns. Left (7 columns) shows **one question at a time**, large and calm. Right (5 columns) shows **"Your statement"**, a sticky paper sheet where each answer appears as a new line the moment it's entered, with the computed rate printed beside it as soon as the inputs for it exist (for example "Net collection rate 92.5%").
Mobile: one question per screen; the statement collapses to a slim bar at the top ("Your statement · 3 lines") that expands on tap.

Order of questions (specialty already chosen in the hero; if the visitor skipped the hero, ask it first):
1. "What's been bothering you about billing?" Pain chips, multi-select, large tap targets. "Pick any, or skip."
2. Last 3 full months: charges, contractual adjustments, payments received (one per screen on mobile, grouped on desktop if it stays clean).
3. Claims: submitted, denied or rejected the first time, paid on the first try.
4. Today: total AR, AR older than 90 days.

Each question has:
- A label in plain words, and a one-line hint in slate.
- A large input (56px tall, 20px text, `$` prefix for money, commas added while typing, `inputmode` set so phones show a number pad).
- **"Where's this?"** link that opens a small, accurate mock of the real report (built in HTML, not an image) with the right column or line highlighted in jade. Example for AR over 90 days: a mini AR aging table with columns Current, 31 to 60, 61 to 90, 91 to 120, 120+, and the last two columns highlighted, plus "Add these two columns." This single detail proves expertise better than any claim.
- For optional fields, a checkbox "I don't have this number". When checked, the line on the statement reads "Not reported" and a one-line note appears: "A good biller reports this every month. Worth asking about."
- Enter moves forward, Shift+Enter or the Back link moves back. Progress shows as "Question 4 of 9" in Plex Mono with a thin sapphire line that fills.
- Validation is inline, friendly and specific, and appears only after the visitor leaves the field.

### 7.5 The reveal (the "wow" moment, about 2.5 seconds, skippable)
When the last answer is in:
1. The statement sheet moves to the center (desktop) or fills the screen (mobile).
2. A hairline draws under the last line item (300ms).
3. The total row slides in: "Yearly gap vs top practices", and the jade block counts up from $0 to the real figure (900ms, ease-out).
4. The grade letter lands in the header with a short scale from 1.15 to 1 (250ms). On phones that support it, one light vibration (`navigator.vibrate(12)`), never more.
5. The page settles into the results layout below.
A "Skip" text link is visible during the animation. With reduced motion, show the final state instantly.

### 7.6 Verdict band (first thing on the results page, full-width sapphire)
Everything here must fit in the first screen on a 390 by 700 phone.
- Left: the grade letter, huge, white, with "56.3 / 100" under it in Plex Mono.
- Right: the verdict sentence by grade (keep the existing VERDICTS copy), then the money line:
  - Big jade money: "$39,600 a year"
  - Under it (white 85%): "What you'd collect on top of today if your numbers matched top practices. An estimate based on what you entered."
- The primary button for the selected offer (jade) and a white text link "See the full statement".
- If the grade is A, replace the money line with the Room-to-grow figure and the line "You're close to the top. Here's what's left."

### 7.7 Your billing statement (paper white)
The heart of the results. A real statement layout, not cards.
- Header: "Your billing statement" (section headline). Right side in Plex Mono: "Prepared [today's date] · [specialty]".
- Table columns: Number · You · Good · Top · Status. Figures right-aligned in Plex Mono.
- Each row also has a slim horizontal track under it, full row width, showing Problem / Watch / Good zones in very light status tints, ticks for Good and Top, and a marker at the visitor's value. Zone labels sit below the track and never collide with the marker (if they would, hide the label under the marker).
- Click or tap a row to expand it in place: three short columns "What this means", "Why it usually happens" (specialty-specific line first), "How we fix it". Only one row open at a time. The open row gets a 3px sapphire bar on its left edge.
- The weakest row (biggest opportunity) carries a small jade mark "Biggest opportunity" and is expanded by default.
- Not-reported rows show "Not reported" in slate with the note from 7.4.
- PI rule rows show "Not graded" with the existing explanation on expand.

### 7.8 Where the money is (mist background)
A ledger, not four cards.
- Headline: "Where the money is."
- A segmented control at the top right: **"Compare to: Top practices | Good target"** (Top selected by default). Switching animates every figure to the new value (counting, 400ms). This replaces showing two numbers on every line and is easier to read.
- Rows: name, time unit in Plex Mono ("per year", "one-time", "per month", "right now"), the figure right-aligned and large. For the over-90 row, a second slim line: "$28,500 is in claims over 90 days old right now."
- Each row has a "How we got this" toggle that shows the formula with the visitor's own numbers plugged in (reuse existing formula text).
- Footnote in slate: "Separate estimates with different time units, so they're never added together."
- Rows with nothing to show are hidden. If no rows remain, show the existing top-level message.

### 7.9 What if (paper white)
- Headline: "Drag to see what better billing pays."
- **One master slider** across the full content width: left end "Today", right end "Top practices". It moves every graded metric from the visitor's value toward the Top target by the same share (0% to 100%). As it moves: the grade letter changes live, the jade money figure updates live ("+$X a year"), and small labels show each metric's value at that point. Snap points at "Good levels" and "Top practices", with one light vibration on phones that support it.
  - Engine: add `masterSliderOverrides(result, t)` to `simulate.ts` that returns overrides at share `t` from 0 to 1, keeping denial % + first-pass % at or below 100. Add tests: t = 0 equals the scorecard exactly; t = 1 equals top-level overrides; monotonic in between.
- Below it, a text link "Adjust each number" that opens the existing 5 sliders for people who want detail.
- Desktop: the grade and money figure sit in a sapphire block to the right that stays in view while dragging (sticky), with no empty space above it.

### 7.10 The next step (full-width sapphire, the closing section)
Two columns on desktop, stacked on mobile.

Left column, the offer (selected by the existing `offers.ts` logic; keep its copy unless improved below):
- Small Plex Mono line in ocean: "Recommended for your numbers"
- Offer headline (Archivo 700, white)
- Offer body (white 85%)
- The visitor's own figure in a square jade block (big money style, ink text)
- Primary jade button with the offer's button text
- Under it, the switch reassurance as plain text with a hairline above it (no box): "Switching billers? We handle the whole move. No gap in claims, and no extra work for your staff." (only when the switch flag is on)
- For Keep It Top: the share row "Know a practice that's struggling with billing? Send them this tool." with a Share button.

Right column, the form on paper white, square corners, no shadow:
- Title: "Get your full report and fix plan by email."
- Fields: Name, Practice name, Email, Phone (optional). Labels above inputs. Placeholders are hints, not fake data (phone placeholder: "Optional").
- Checkbox: "Include my scorecard numbers so you can prepare for our call."
- Button: "Send me my report" (jade, full width).
- Under it in slate: "Only your report and one follow-up. No spam."
- After a successful submit, the form is replaced by: "Thanks, [Name]. Your report is on its way." and, if a booking link is set, an inline booking calendar loaded only at this moment (no third-party script before the visitor submits).

### 7.11 Questions owners ask (paper white, accordion)
Objections answered before the call. Each answer is a config value with an on/off flag; an answer whose flag is off or whose value is a placeholder is hidden. My team will confirm each one before launch.
- "Do I have to sign a long contract?" → "No. Try us for 90 days. If it's not working, you can leave."
- "What does it cost?" → `[PRICING_LINE]` (placeholder; hidden until filled)
- "Is my patient data safe?" → "This tool never asks for patient information. Before we touch any real claims, we sign a Business Associate Agreement with you."
- "What if my biller is doing a good job?" → "Then your scorecard will say so, and you should keep them. We'd rather earn your trust than talk you into a switch."
- "How does switching work?" → "We take over from your current biller, set up access, and work any open claims so nothing falls through the gap."
- "Who will work on my account?" → "My team. You'll have one person who knows your practice and answers your emails."

### 7.12 Founder (paper white)
- Left: the real portrait, square crop, 4px radius, about 280px wide on desktop.
- Right: the quote in Archivo 500 at lead size:
  "You didn't open your practice to chase insurance companies. That's our job. We follow up on every unpaid claim, fix denials so they stop coming back, and send you these same five numbers every month. You'll always know where your money is and what we're doing about it."
- Signature: "Muhammad Shahzaib Khan" (Archivo 600) and under it in Plex Mono: "Medical billing for practices in Florida and South Carolina".
- A final jade button: "Book my free billing review".

### 7.13 Footer (ink background, white text)
Wordmark, "How we calculate", "Save as PDF", the disclaimer ("Estimates for information only. Not financial, legal or accounting advice."), the privacy line, and "© 2026 Shahzaib Khan".

### 7.14 Methodology drawer
"How we calculate" opens a right-side drawer (full screen on mobile) instead of a long section at the bottom. Content stays the same (formulas, 90-day method, targets, anchors, weights, source note), laid out as a clean two-column reference table in Plex Mono. Keep it reachable from the top bar, every "How we got this" toggle, and the footer.

---

## 8. Interaction details (this is where it feels premium)

- **Response time:** every tap, keypress and drag shows feedback within 100ms.
- **Buttons:** hover darkens jade to `--jade-press` and lifts 1px; press moves down 1px; focus shows a 2px sapphire ring with 2px offset (white ring on sapphire backgrounds).
- **Inputs:** focus changes the border to sapphire 2px and the label to ink; a valid value shows a small check at the right edge.
- **Numbers:** all changing figures animate by counting, never by fading. Duration scales with the change size, 300 to 900ms.
- **Statement lines:** new lines enter with a 6px upward move and fade (200ms). Updated values flash a very light jade background for 600ms, then return to white.
- **Rows:** expand with height animation (250ms), chevron rotates.
- **Scroll:** sections fade up 12px when they first enter the viewport, once. No parallax, no scroll-jacking, no horizontal scroll sections.
- **Sticky summary:** after the verdict band scrolls out, a slim bar appears. Desktop: top bar shows grade, the jade gap and the primary button. Mobile: bottom bar shows the jade gap and the primary button. It hides while the form or another primary button is on screen, and while the keyboard is open.
- **Keyboard:** the whole flow works without a mouse. Visible focus everywhere.
- **Reduced motion:** every animation has an instant final state.
- **Performance:** animate only `transform` and `opacity`. Keep JS under the current size. Lighthouse 95+ on all four scores on mobile.

---

## 9. Conversion rules (check each section against these)

1. One primary action per screen. The primary action always looks the same: jade, ink text, square-ish 6px corners.
2. The first action costs nothing: a single tap on a practice type.
3. The value moment (grade + money) and the primary button appear together, in the first screen of results.
4. The visitor's own dollar figure appears next to every primary button after the reveal.
5. Every objection is answered on the page before the call: contract, cost, data safety, switching, who does the work, and "what if my biller is good".
6. Proof is shown, never claimed: real formulas, report mocks that match real reports, the founder's face and name.
7. The form asks only for what we need: 3 required fields.
8. After the form, the next step (booking) is offered immediately, inline.
9. No fake scarcity, no countdowns, no pop-ups, no exit-intent modals.
10. Personalize with what we know: use the specialty in headings and explanations ("For behavioral health practices, this usually comes from authorizations and telehealth coding.").

---

## 10. Copy deck (use as written; human tone, no dashes)

- Hero headline: "Your biller says everything's fine." / "See the numbers in 3 minutes."
- Hero lead: "Answer a few questions from two reports your biller already has. You'll get a grade, a line-by-line statement, and what the gap is costing you each year."
- Tile prompt: "What kind of practice do you run?"
- Privacy line: "Free. No sign-up. Your numbers stay on your device unless you choose to send them."
- Report helper intro (questions screen): "Ask your biller for two reports: a charges and payments summary for the last 3 full months, and an AR aging report as of today. A good biller can send both in minutes."
- Reveal skip: "Skip"
- Statement title: "Your billing statement"
- Money title: "Where the money is."
- What-if title: "Drag to see what better billing pays."
- Thank-you: "Thanks, [Name]. Your report is on its way."
- Keep existing VERDICTS, explainers, pain-point lines and offer copy unless they contain a dash or a banned word, in which case rewrite them in the same voice and list every change in your round report.

---

## 11. Wordmark and favicon

- Wordmark: "Shahzaib Khan" in Archivo 700, width 112, tracking -0.02em, followed by a small square in jade (0.38em, aligned to the baseline) that works like a full stop. Under or beside it, "Medical billing" in Plex Mono 400 at 12 to 13px in slate (white 70% on dark).
- Two versions: ink on light, white on sapphire. Built as inline SVG or HTML text, not an image.
- Favicon: a sapphire square with a smaller jade square in the bottom-right corner. Provide SVG and 32px, 180px (Apple touch) PNG.
- Config: set `SITE.companyName` to "Shahzaib Khan" and use it in the footer and page title. Page title: "Billing Scorecard · Shahzaib Khan".

---

## 12. Responsive behavior

Design at 390px first, then 834px, then 1440px, then check 320px and 1920px+.
- Phone: one question per screen, statement as a collapsible top bar, verdict band fits the first screen, sticky bottom bar after the reveal, tiles in a 2 by 2 grid, all tap targets at least 48px.
- Tablet: questions and statement side by side from 834px.
- Desktop: full layouts as described. Above 1920px, scale the root font size gently so the page fills the screen without stretching line lengths.
- Use `100dvh`, safe-area insets, `@media (hover: hover)` for hover effects. No horizontal scroll at any width.

---

## 13. What to remove from the current build

- Instrument Serif and every italic emphasis word
- Geist and Geist Mono (replaced by Archivo and IBM Plex Mono)
- All glows, grid patterns and blurred backgrounds
- Every uppercase eyebrow label ("RECOMMENDED FOR YOU", "TRUST THE MATH", "WHAT IF?", "YOUR 5 KEY NUMBERS", "WHERE THE MONEY IS")
- The highlighter effect behind money figures
- The word "about" inside large money figures (keep "estimate" nearby instead; "about" may stay in small text)
- Cards inside cards, and the 5 separate metric cards (replaced by the statement table)
- The 4 separate money cards (replaced by the money ledger)
- The long methodology section at the bottom (replaced by the drawer)
- The "Your numbers vs the levels we work toward" table in the closing section (the statement already shows it)

---

## 14. Build rounds (stop after each, send screenshots at 390px and 1440px)

**Round 1: Foundation and hero.** Fonts, tokens, wordmark, favicon, top bar, hero with the live example statement and the practice tiles, the "why these numbers" strip. Stop.

**Round 2: Questions and reveal.** The one-question flow, the live statement that builds itself, "Where's this?" report mocks for all 8 number fields, validation, the reveal sequence. Stop.

**Round 3: Results.** Verdict band, billing statement table with expanding rows, money ledger with the compare toggle, what-if with the master slider (engine function plus tests), sticky summary bars. Stop.

**Round 4: Closing and polish.** Offer, form, success state with inline booking, FAQ, founder, footer, methodology drawer, print/PDF (2 pages). Then run the full quality check below. Stop.

---

## 15. Quality check (end of Round 4)

- All existing tests plus the new master-slider tests pass. `npm run build` has zero errors. `npm audit` shows 0 vulnerabilities.
- No em dash or en dash in any user-facing string (search and report the count: it must be 0). No banned word (search and report).
- No raw placeholder text visible anywhere.
- Contrast: every text and background pair passes WCAG AA; list the ratios.
- Lighthouse mobile and desktop: 95+ on Performance, Accessibility, Best Practices and SEO.
- Screenshots at 320, 390, 834, 1440 and 1920px for: hero, a question with "Where's this?" open, the reveal end state, verdict band, statement with one row open, money ledger in both compare modes, what-if at 0%, 50% and 100%, closing section, form success state.
- Run all 7 test cases (healthy, struggling, golden 1 to 4, all "I don't know") through the real UI and confirm the figures match the golden tables.
- Report every copy change you made and why.
