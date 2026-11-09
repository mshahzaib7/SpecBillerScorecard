import { describe, expect, it } from 'vitest';
import { computeScorecard } from '../../engine';
import { STRUGGLING_INPUTS } from '../../engine/__tests__/golden.fixtures';
import { buildLeadPayload, EMPTY_LEAD, leadSubject } from '../lead';

const result = computeScorecard(STRUGGLING_INPUTS);
const ctx = { specialty: 'behavioral' as const, grade: 'F', offer: 'gapToTop' as const, painPoints: [] };

describe('Formspree fields', () => {
  it('_subject names the practice and the grade', () => {
    const p = buildLeadPayload({ ...EMPTY_LEAD, name: 'Dana', practiceName: ' Calm Minds ', email: 'dana@calmminds.com' }, ctx, result);
    expect(p._subject).toBe('New scorecard lead: Calm Minds, grade F');
  });

  it('no grade → says so instead of "null"', () => {
    expect(leadSubject('Calm Minds', null)).toBe('New scorecard lead: Calm Minds, grade not available');
  });

  it('the visitor email is sent in the field named "email" (Formspree uses it as reply-to)', () => {
    const p = buildLeadPayload({ ...EMPTY_LEAD, name: 'Dana', practiceName: 'Calm Minds', email: 'dana@calmminds.com ' }, ctx, result);
    expect(p.email).toBe('dana@calmminds.com');
  });
});
