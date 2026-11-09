/**
 * Prints an expected-vs-actual table for every golden case (`npm run golden`).
 * The assertions themselves live in golden.test.ts.
 */
import { it } from 'vitest';
import { computeScorecard } from '../compute';
import { GOLDEN_CASES } from './golden.fixtures';

const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : String(+v.toFixed(6));
  return String(v);
};

it('prints the golden expected-vs-actual tables', () => {
  const out: string[] = [];
  for (const g of GOLDEN_CASES) {
    const r = computeScorecard(g.inputs);
    const rows = g.checks.map((c) => {
      const a = c.actual(r);
      const pass =
        c.mode === 'close' && typeof c.expected === 'number' && typeof a === 'number'
          ? Math.abs(a - c.expected) < 5e-7
          : a === c.expected;
      return [c.label, fmt(c.expected), fmt(a), pass ? 'PASS' : 'FAIL'] as const;
    });
    const w = [0, 1, 2, 3].map((i) => Math.max(...rows.map((row) => row[i]!.length), ['Item', 'Expected', 'Actual', 'Result'][i]!.length));
    const lineOf = (cells: readonly string[]) => '| ' + cells.map((c, i) => c.padEnd(w[i]!)).join(' | ') + ' |';
    out.push('', `### ${g.name}`, lineOf(['Item', 'Expected', 'Actual', 'Result']), '|' + w.map((n) => '-'.repeat(n + 2)).join('|') + '|');
    rows.forEach((row) => out.push(lineOf(row)));
  }
  console.log(out.join('\n'));
});
