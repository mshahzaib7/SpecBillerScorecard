/**
 * Lead flow logic (Part 3 of the Nov 14 brief): payload, subject and priority, contact methods,
 * phone rules, honeypot, and "nothing is sent before Send my report".
 * The UI behaviour (tiles, auto-advance, back) is tested in a real browser by qa/scripts/qa-lead.mjs.
 */
import { describe, expect, it, vi } from 'vitest';
import { computeScorecard, LEAD_FLOW, leadPriority } from '../../engine';
import { STRUGGLING_INPUTS } from '../../engine/__tests__/golden.fixtures';
import {
  buildLeadPayload,
  EMPTY_ANSWERS,
  enabledScreens,
  formatUsPhone,
  isSpam,
  joinNatural,
  leadSubject,
  needsPhone,
  reachLine,
  sendLead,
  softwareTiles,
  successReachLine,
  toggleMethod,
  validateDetails,
  type LeadAnswers,
  type LeadContext,
} from '../lead';

const result = computeScorecard(STRUGGLING_INPUTS);
const ctx: LeadContext = { specialty: 'behavioral', grade: 'F', offer: 'gapToTop', painPoints: ['denials'] };
const filled: LeadAnswers = {
  ...EMPTY_ANSWERS,
  billingHandler: 'company',
  providers: 'twoToFive',
  software: 'therapyNotes',
  timing: 'asap',
  review: 'no',
  methods: ['email'],
  name: 'Dana Reyes',
  practiceName: 'Harbor Behavioral Health',
  email: 'dana@harborbh.com',
};
const ENDPOINT = 'https://formspree.io/f/abc';
const okFetch = () => vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
const deps = (fetchFn: unknown) => ({ endpoint: ENDPOINT, contactEmail: 'hello@example.com', fetchFn: fetchFn as typeof fetch });
const payload = (a: LeadAnswers, c: LeadContext = ctx) => buildLeadPayload(a, c, result, STRUGGLING_INPUTS);

describe('screens', () => {
  it('7 screens, in order, the last one is the details form', () => {
    expect(enabledScreens()).toEqual(['billingHandler', 'providers', 'software', 'timing', 'review', 'contact', 'details']);
  });
  it('a screen switched off in config is skipped', () => {
    const cfg = { ...LEAD_FLOW, providers: { ...LEAD_FLOW.providers, on: false } };
    expect(enabledScreens(cfg)).not.toContain('providers');
  });
  it('never re-asks what the scorecard knows (specialty, pains, grade, numbers)', () => {
    const titles = enabledScreens()
      .map((s) => (s === 'details' ? LEAD_FLOW.details.title : LEAD_FLOW[s].title))
      .join(' ')
      .toLowerCase();
    for (const word of ['specialty', 'pain', 'grade', 'charges', 'claims']) expect(titles).not.toContain(word);
  });
});

describe('software order by specialty', () => {
  const ids = (s: Parameters<typeof softwareTiles>[0]) => softwareTiles(s).map((t) => t.id);
  it('behavioral health: SimplePractice and TherapyNotes first', () => {
    expect(ids('behavioral').slice(0, 2)).toEqual(['simplePractice', 'therapyNotes']);
  });
  it('primary care: athenaOne, eClinicalWorks, AdvancedMD first', () => {
    expect(ids('general').slice(0, 3)).toEqual(['athenaOne', 'eClinicalWorks', 'advancedMD']);
  });
  it('every specialty gets all 8 tiles, "Something else" and "Not sure" last', () => {
    for (const s of ['behavioral', 'general', 'accident', 'other', null] as const) {
      expect(ids(s)).toHaveLength(8);
      expect(ids(s).slice(-2)).toEqual(['other', 'notSure']);
    }
  });
});

describe('contact methods (multi-select)', () => {
  it('"Email me" starts selected', () => {
    expect(EMPTY_ANSWERS.methods).toEqual(['email']);
  });
  it('at least one method always stays selected', () => {
    expect(toggleMethod(['email'], 'email')).toEqual(['email']);
    expect(toggleMethod(['call', 'email'], 'email')).toEqual(['call']);
    expect(toggleMethod(['call'], 'call')).toEqual(['call']);
  });
  it('adding keeps a stable order: call, text, email', () => {
    expect(toggleMethod(['email'], 'call')).toEqual(['call', 'email']);
    expect(toggleMethod(['email', 'call'], 'text')).toEqual(['call', 'text', 'email']);
  });
  it('lines join the methods naturally, with the one-business-day promise', () => {
    expect(joinNatural(['call', 'text', 'email'])).toBe('call, text or email');
    expect(reachLine(['call', 'email'])).toBe("We'll reach you by call or email within one business day.");
    expect(reachLine(['email'])).toBe("We'll reach you by email within one business day.");
    expect(successReachLine(['call', 'text'])).toBe("We'll call or text you within one business day.");
    expect(successReachLine(['email'])).toBe("We'll email you within one business day.");
  });
});

describe('details: email always required, phone only for call or text', () => {
  it('name, practice name and email are required with email only', () => {
    expect(Object.keys(validateDetails({ ...EMPTY_ANSWERS })).sort()).toEqual(['email', 'name', 'practiceName']);
    expect(validateDetails(filled)).toEqual({});
  });
  it('email is required even when call or text is picked', () => {
    expect(validateDetails({ ...filled, methods: ['call'], phone: '(555) 555-0142', email: '' }).email).toBeDefined();
  });
  it('email must look valid', () => {
    expect(validateDetails({ ...filled, email: 'dana@' }).email).toBe(LEAD_FLOW.details.errors.emailInvalid);
  });
  it('phone: not needed for email only; required for call; required for text', () => {
    expect(needsPhone(['email'])).toBe(false);
    expect(validateDetails({ ...filled, methods: ['email'], phone: '' }).phone).toBeUndefined();
    expect(validateDetails({ ...filled, methods: ['call', 'email'], phone: '' }).phone).toBe(LEAD_FLOW.details.errors.phone);
    expect(validateDetails({ ...filled, methods: ['text'], phone: '' }).phone).toBe(LEAD_FLOW.details.errors.phone);
    expect(validateDetails({ ...filled, methods: ['text'], phone: '(555) 555-01' }).phone).toBe(LEAD_FLOW.details.errors.phoneInvalid);
    expect(validateDetails({ ...filled, methods: ['call'], phone: '(843) 555-0142' }).phone).toBeUndefined();
    expect(validateDetails({ ...filled, methods: ['call'], phone: '+1 843 555 0142' }).phone).toBeUndefined();
  });
  it('the phone formats itself as it is typed', () => {
    expect(formatUsPhone('5')).toBe('(5');
    expect(formatUsPhone('555')).toBe('(555');
    expect(formatUsPhone('5555')).toBe('(555) 5');
    expect(formatUsPhone('5555550142')).toBe('(555) 555-0142');
    expect(formatUsPhone('15555550142')).toBe('(555) 555-0142');
    expect(formatUsPhone('(555) 555-0142')).toBe('(555) 555-0142');
    expect(formatUsPhone('')).toBe('');
  });
  it('the phone placeholder is a format hint, never a value', () => {
    expect(LEAD_FLOW.details.phonePlaceholder).toBe('(555) 555-0142');
    expect(EMPTY_ANSWERS.phone).toBe('');
  });
});

describe('priority rule', () => {
  it('HIGH: as soon as possible, or grade D or F', () => {
    expect(leadPriority('asap', 'A')).toBe('HIGH');
    expect(leadPriority('looking', 'F')).toBe('HIGH');
    expect(leadPriority('soon', 'D')).toBe('HIGH');
  });
  it('MEDIUM: next month or two (grade A to C)', () => {
    expect(leadPriority('soon', 'B')).toBe('MEDIUM');
    expect(leadPriority('soon', null)).toBe('MEDIUM');
  });
  it('LOW: just looking (grade A to C)', () => {
    expect(leadPriority('looking', 'C')).toBe('LOW');
    expect(leadPriority('looking', null)).toBe('LOW');
  });
});

describe('lead email', () => {
  it('subject: priority, practice, grade, chosen methods, timing', () => {
    expect(leadSubject('Harbor Behavioral Health', 'F', ['call', 'text'], 'asap')).toBe(
      '[HIGH] New lead: Harbor Behavioral Health, grade F, wants a call or text, as soon as possible',
    );
    expect(leadSubject('Calm Minds', 'B', ['email'], 'soon')).toBe('[MEDIUM] New lead: Calm Minds, grade B, wants an email, in the next month or two');
    expect(leadSubject('Calm Minds', null, ['call', 'email'], 'looking')).toBe(
      '[LOW] New lead: Calm Minds, grade not available, wants a call or email, just looking for now',
    );
  });

  it('the payload subject uses the trimmed practice name', () => {
    expect(payload({ ...filled, practiceName: '  Harbor Behavioral Health ' })._subject).toBe(
      '[HIGH] New lead: Harbor Behavioral Health, grade F, wants an email, as soon as possible',
    );
  });

  it('body carries every answer plus specialty, pains, grade, score, offer and preferred contact', () => {
    const p = payload({ ...filled, methods: ['call', 'email'], phone: '(843) 555-0142' });
    expect(p).toMatchObject({
      priority: 'HIGH',
      name: 'Dana Reyes',
      practiceName: 'Harbor Behavioral Health',
      email: 'dana@harborbh.com',
      phone: '(843) 555-0142',
      preferredContact: 'Call, Email',
      billingHandledBy: 'An outside billing company',
      providers: '2 to 5',
      practiceSoftware: 'TherapyNotes',
      wantsHelp: 'As soon as possible',
      reviewNumbersFirst: 'No, just my contact details',
      specialty: 'Behavioral / Mental Health',
      painPoints: 'Too many denied claims',
      grade: 'F',
      overallScore: result.overall.score,
      offer: 'Close the gap to top practices. (gapToTop)',
    });
  });

  it('"Something else" software carries what was typed', () => {
    expect(payload({ ...filled, software: 'other', softwareOther: ' CentralReach ' }).practiceSoftware).toBe('Something else: CentralReach');
  });

  it('scorecard numbers are NOT sent when the visitor picked "No"', () => {
    const p = payload({ ...filled, review: 'no' });
    expect(p.scorecardNumbers).toBeUndefined();
    const json = JSON.stringify(p);
    expect(json).not.toContain('92.5'); // net collection rate
    expect(json).not.toContain('300,000'); // charges entered
  });

  it('scorecard numbers ARE sent when the visitor picked "Yes, attach my scorecard"', () => {
    const p = payload({ ...filled, review: 'yes' });
    expect(p.reviewNumbersFirst).toBe('Yes, attach my scorecard');
    expect(p.scorecardNumbers).toContain('Charges (3 months): $300,000');
    expect(p.scorecardNumbers).toContain('Net collection rate: 92.5% (watch)');
    expect(p.scorecardNumbers).toContain('Money (uncollected): vs. top $39,600, vs. good $18,000');
  });

  it('a phone typed before switching back to email only is not sent', () => {
    expect(payload({ ...filled, methods: ['email'], phone: '(843) 555-0142' }).phone).toBe('');
  });

  it('never carries the honeypot field', () => {
    expect(JSON.stringify(payload({ ...filled, website: 'x' }))).not.toContain('website');
  });
});

describe('sending', () => {
  it('honeypot submissions are rejected and nothing is sent', async () => {
    const f = okFetch();
    const out = await sendLead({ ...filled, website: 'spam.biz' }, payload(filled), deps(f));
    expect(out.kind).toBe('spam');
    expect(f).not.toHaveBeenCalled();
    expect(isSpam({ ...filled, website: ' ' })).toBe(false);
  });

  it('nothing is sent before "Send my report": answering, building and validating never call fetch', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    let a: LeadAnswers = { ...EMPTY_ANSWERS, billingHandler: 'staff', providers: 'solo', software: 'notSure', timing: 'soon', review: 'yes' };
    a = { ...a, methods: toggleMethod(a.methods, 'call') };
    validateDetails(a);
    payload(a);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('"Send my report" POSTs the JSON payload once', async () => {
    const f = okFetch();
    const p = payload(filled);
    expect(await sendLead(filled, p, deps(f))).toEqual({ kind: 'sent' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(p);
  });

  it('endpoint still a placeholder → pre-filled email with the same subject, no request', async () => {
    const f = okFetch();
    const p = payload(filled);
    const out = await sendLead(filled, p, { endpoint: '[FORM_ENDPOINT]', contactEmail: 'hello@example.com', fetchFn: f as unknown as typeof fetch });
    expect(out.kind).toBe('mailto');
    if (out.kind === 'mailto') expect(decodeURIComponent(out.href)).toContain(`subject=${p._subject}`);
    expect(f).not.toHaveBeenCalled();
  });

  it('server error → error with the email fallback', async () => {
    const f = vi.fn(async () => new Response('', { status: 500 }));
    const out = await sendLead(filled, payload(filled), deps(f));
    expect(out.kind).toBe('error');
    if (out.kind === 'error') expect(out.mailto).toMatch(/^mailto:/);
  });

  it('network failure → error, never throws', async () => {
    const f = vi.fn(async () => {
      throw new Error('offline');
    });
    expect((await sendLead(filled, payload(filled), deps(f))).kind).toBe('error');
  });

  it('endpoint and email both still placeholders → error with no fallback link', async () => {
    expect(await sendLead(filled, payload(filled), { endpoint: '[FORM_ENDPOINT]', contactEmail: '[CONTACT_EMAIL]' })).toEqual({ kind: 'error', mailto: null });
  });
});
