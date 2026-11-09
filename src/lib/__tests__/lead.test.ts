import { describe, expect, it, vi } from 'vitest';
import { computeScorecard } from '../../engine';
import { STRUGGLING_INPUTS } from '../../engine/__tests__/golden.fixtures';
import {
  buildLeadPayload,
  EMPTY_LEAD,
  isSpam,
  sendLead,
  validateLead,
  type LeadContext,
  type LeadFields,
} from '../lead';

const result = computeScorecard(STRUGGLING_INPUTS);
const ctx: LeadContext = { specialty: 'behavioral', grade: 'F', offer: 'gapToTop', painPoints: ['denials'] };
const filled: LeadFields = { ...EMPTY_LEAD, name: 'Dana', practiceName: 'Calm Minds', email: 'dana@calmminds.com' };
const ENDPOINT = 'https://formspree.io/f/abc';
const okFetch = () => vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
const deps = (fetchFn: unknown) => ({ endpoint: ENDPOINT, contactEmail: 'hello@example.com', fetchFn: fetchFn as typeof fetch });

describe('payload', () => {
  it('scorecard numbers are NOT included when the checkbox is unticked', () => {
    const p = buildLeadPayload(filled, ctx, result);
    expect(p.includeNumbers).toBe(false);
    expect(p.scorecard).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain('92.5');
  });

  it('scorecard numbers ARE included when ticked: 5 metrics + money cards', () => {
    const p = buildLeadPayload({ ...filled, includeNumbers: true }, ctx, result);
    expect(p.scorecard?.metrics).toEqual({ ncr: 92.5, dar: 57, ar90: 25, den: 12, fpr: 84 });
    expect(p.scorecard?.moneyCards.find((c) => c.id === 'uncollected')).toEqual({
      id: 'uncollected',
      vsGood: 18_000,
      vsTop: 39_600,
      headline: null,
    });
  });

  it('carries the hidden fields: specialty, grade, offer, pain points', () => {
    expect(buildLeadPayload(filled, ctx, result)).toMatchObject({
      specialty: 'behavioral',
      grade: 'F',
      offer: 'gapToTop',
      painPoints: ['denials'],
    });
  });

  it('never carries the honeypot field', () => {
    expect(JSON.stringify(buildLeadPayload({ ...filled, website: 'x' }, ctx, result))).not.toContain('website');
  });
});

describe('validation', () => {
  it('name, practice name and email are required', () => {
    expect(Object.keys(validateLead(EMPTY_LEAD)).sort()).toEqual(['email', 'name', 'practiceName']);
    expect(validateLead(filled)).toEqual({});
  });
  it('email must look valid', () => {
    expect(validateLead({ ...filled, email: 'dana@' }).email).toBeDefined();
  });
  it('phone is optional, but must be a US number when given', () => {
    expect(validateLead({ ...filled, phone: '(843) 555-0142' }).phone).toBeUndefined();
    expect(validateLead({ ...filled, phone: '+1 843 555 0142' }).phone).toBeUndefined();
    expect(validateLead({ ...filled, phone: '555-01' }).phone).toBeDefined();
  });
});

describe('sending', () => {
  it('honeypot submissions are rejected and nothing is sent', async () => {
    const f = okFetch();
    const out = await sendLead({ ...filled, website: 'spam.biz' }, buildLeadPayload(filled, ctx, result), deps(f));
    expect(out.kind).toBe('spam');
    expect(f).not.toHaveBeenCalled();
    expect(isSpam({ ...filled, website: ' ' })).toBe(false);
  });

  it('nothing is sent before Submit: building and validating never call fetch', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    buildLeadPayload({ ...filled, includeNumbers: true }, ctx, result);
    validateLead(filled);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('Submit POSTs the JSON payload once', async () => {
    const f = okFetch();
    const p = buildLeadPayload(filled, ctx, result);
    expect(await sendLead(filled, p, deps(f))).toEqual({ kind: 'sent' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(p);
  });

  it('endpoint still a placeholder → pre-filled email, no request', async () => {
    const f = okFetch();
    const out = await sendLead(filled, buildLeadPayload(filled, ctx, result), {
      endpoint: '[FORM_ENDPOINT]',
      contactEmail: 'hello@example.com',
      fetchFn: f as unknown as typeof fetch,
    });
    expect(out.kind).toBe('mailto');
    if (out.kind === 'mailto') expect(out.href).toMatch(/^mailto:hello@example\.com\?subject=/);
    expect(f).not.toHaveBeenCalled();
  });

  it('server error → error with the email fallback', async () => {
    const f = vi.fn(async () => new Response('', { status: 500 }));
    const out = await sendLead(filled, buildLeadPayload(filled, ctx, result), deps(f));
    expect(out.kind).toBe('error');
    if (out.kind === 'error') expect(out.mailto).toMatch(/^mailto:/);
  });

  it('network failure → error, never throws', async () => {
    const f = vi.fn(async () => {
      throw new Error('offline');
    });
    expect((await sendLead(filled, buildLeadPayload(filled, ctx, result), deps(f))).kind).toBe('error');
  });

  it('endpoint and email both still placeholders → error with no fallback link', async () => {
    const out = await sendLead(filled, buildLeadPayload(filled, ctx, result), {
      endpoint: '[FORM_ENDPOINT]',
      contactEmail: '[CONTACT_EMAIL]',
    });
    expect(out).toEqual({ kind: 'error', mailto: null });
  });
});
