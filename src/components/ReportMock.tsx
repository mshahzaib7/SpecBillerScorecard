import type { NumericField } from '../engine';

/**
 * "Where's this?" (DESIGN-BRIEF 7.4): a small, accurate mock of the real report, built in HTML,
 * with the cells to use highlighted in jade. Sample figures add up to the example practice
 * (charges $300,000, adjustments $120,000, payments $166,500, 1,500 claims, AR $190,000).
 */

type Cell = string;
interface Mock {
  report: string;
  sub: string;
  head: Cell[];
  rows: Cell[][];
  /** [row, col] cells to highlight. */
  hl: [number, number][];
  note: string;
  /** Wide tables scroll inside the mock on phones. */
  wide?: boolean;
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const cnt = (n: number) => n.toLocaleString('en-US');

/** The last 3 full months, e.g. ["Aug", "Sep", "Oct"]. */
function lastThreeMonths(today = new Date()): string[] {
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'long' }); // full month names, like every date on the site
  return [3, 2, 1].map((back) => fmt.format(new Date(today.getFullYear(), today.getMonth() - back, 1)));
}

const CHARGES = [98_400, 101_250, 100_350];
const CONTRACTUAL = [39_500, 40_800, 39_700];
const OTHER_ADJ = [1_200, 900, 1_400];
const INS_PAY = [49_800, 51_000, 50_400];
const PAT_PAY = [5_100, 4_900, 5_300];
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function summary(cols: { name: string; values: number[] }[], hlCols: number[], note: string): Mock {
  const months = lastThreeMonths();
  const rows: Cell[][] = months.map((m, i) => [m, ...cols.map((c) => usd(c.values[i]!))]);
  rows.push(['Total', ...cols.map((c) => usd(sum(c.values)))]);
  return {
    report: 'Charges and payments summary',
    sub: 'Last 3 full months',
    head: ['Month', ...cols.map((c) => c.name)],
    rows,
    hl: hlCols.map((c) => [3, c] as [number, number]),
    note,
  };
}

const CLAIMS: [string, number][] = [
  ['Claims submitted', 1_500],
  ['Rejected by clearinghouse', 45],
  ['Denied by payer, first submission', 135],
  ['Paid on first submission', 1_260],
  ['Paid after correction', 38],
  ['Still in process', 22],
];
function claims(hlRows: number[], note: string): Mock {
  return {
    report: 'Claims summary',
    sub: 'Last 3 full months',
    head: ['Line', 'Claims'],
    rows: CLAIMS.map(([n, v]) => [n, cnt(v)]),
    hl: hlRows.map((r) => [r, 1] as [number, number]),
    note,
  };
}

const AGING_HEAD = ['', 'Current', '31 to 60', '61 to 90', '91 to 120', '120+', 'Total'];
const AGING_INS = [70_200, 34_100, 22_800, 18_300, 20_600];
const AGING_PAT = [7_800, 4_400, 3_200, 3_200, 5_400];
function aging(hl: [number, number][], note: string): Mock {
  const tot = AGING_INS.map((v, i) => v + AGING_PAT[i]!);
  const row = (name: string, v: number[]) => [name, ...v.map(usd), usd(sum(v))];
  return {
    report: 'AR aging report',
    sub: 'As of today',
    head: AGING_HEAD,
    rows: [row('Insurance', AGING_INS), row('Patient', AGING_PAT), row('Total', tot)],
    hl,
    note,
    wide: true,
  };
}

export const REPORT_MOCKS: Record<NumericField, Mock> = {
  charges3: summary(
    [
      { name: 'Charges', values: CHARGES },
      { name: 'Contractual adj.', values: CONTRACTUAL },
      { name: 'Payments', values: INS_PAY.map((v, i) => v + PAT_PAY[i]!) },
    ],
    [1],
    'Use total charges for all 3 months.',
  ),
  adjustments3: summary(
    [
      { name: 'Charges', values: CHARGES },
      { name: 'Contractual adj.', values: CONTRACTUAL },
      { name: 'Other adj.', values: OTHER_ADJ },
    ],
    [2],
    'Use contractual adjustments only. Leave out other adjustments like bad debt.',
  ),
  payments3: summary(
    [
      { name: 'Charges', values: CHARGES },
      { name: 'Insurance paid', values: INS_PAY },
      { name: 'Patient paid', values: PAT_PAY },
    ],
    [2, 3],
    `Add these two: ${usd(sum(INS_PAY))} + ${usd(sum(PAT_PAY))} = ${usd(sum(INS_PAY) + sum(PAT_PAY))}.`,
  ),
  claimsSubmitted3: claims([0], 'Use the number of claims submitted.'),
  claimsDenied3: claims([1, 2], 'Add these two: 45 + 135 = 180.'),
  claimsPaidFirstPass3: claims([3], 'Use claims paid on first submission. Leave out claims paid after a correction.'),
  totalAR: aging([[2, 6]], 'Use the grand total.'),
  ar90: aging(
    [
      [2, 4],
      [2, 5],
    ],
    `Add these two columns: ${usd(AGING_INS[3]! + AGING_PAT[3]!)} + ${usd(AGING_INS[4]! + AGING_PAT[4]!)} = ${usd(
      AGING_INS[3]! + AGING_PAT[3]! + AGING_INS[4]! + AGING_PAT[4]!,
    )}.`,
  ),
};

export function ReportMock({ field, id }: { field: NumericField; id: string }) {
  const m = REPORT_MOCKS[field];
  const isHl = (r: number, c: number) => m.hl.some(([hr, hc]) => hr === r && hc === c);
  const hlCols = new Set(m.hl.map(([, c]) => c));
  return (
    <div className="mock" id={id}>
      <div className="mock__head">
        <span className="mock__report">{m.report}</span>
        <span className="mock__sub">{m.sub} · Example</span>
      </div>
      <div className={`mock__scroll ${m.wide ? 'mock__scroll--wide' : ''}`}>
        <table className="mock__table">
          <thead>
            <tr>
              {m.head.map((h, c) => (
                <th key={c} scope="col" className={hlCols.has(c) ? 'mock__hlcol' : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.rows.map((row, r) => (
              <tr key={r} className={r === m.rows.length - 1 && m.report !== 'Claims summary' ? 'mock__total' : undefined}>
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={c} className={isHl(r, c) ? 'mock__hl' : undefined}>
                      {cell}
                      {isHl(r, c) && <span className="sr-only"> (use this)</span>}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mock__note">{m.note}</p>
      <p className="mock__fine">Your biller's report may look different. The line names are usually the same.</p>
    </div>
  );
}
