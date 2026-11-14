import { describe, expect, it } from 'vitest';
import { DVH_ROOT, dvhFallback, legacySafeCss, unwrapLayers } from './legacyCss';

describe('unwrapLayers', () => {
  it('removes layer statements and unwraps blocks in place, keeping order', () => {
    expect(unwrapLayers('@layer theme,base;@layer base{h1{margin:0}}.a{color:red}')).toBe('h1{margin:0}.a{color:red}');
  });
  it('keeps nested at-rules inside a layer', () => {
    expect(unwrapLayers('@layer utilities{@media (min-width:1px){.x{top:0}}.sr-only{position:absolute}}')).toBe(
      '@media (min-width:1px){.x{top:0}}.sr-only{position:absolute}',
    );
  });
  it('handles nested layers and braces inside strings', () => {
    expect(unwrapLayers('@layer a{@layer b{.q:after{content:"}"}}}.z{}')).toBe('.q:after{content:"}"}.z{}');
  });
  it('leaves CSS without layers untouched', () => {
    expect(unwrapLayers('.a{b:c}')).toBe('.a{b:c}');
  });
});

describe('dvhFallback', () => {
  it('turns every dvh value into a var(--dvh) calc, including negatives', () => {
    expect(dvhFallback('.a{margin:clamp(-2rem,-3.2dvh,-1.25rem);min-height:calc(100dvh - 1rem)}')).toBe(
      DVH_ROOT + '.a{margin:clamp(-2rem,calc(var(--dvh,1vh)*-3.2),-1.25rem);min-height:calc(calc(var(--dvh,1vh)*100) - 1rem)}',
    );
  });
  it('works inside custom properties (where a plain fallback declaration would not)', () => {
    expect(dvhFallback('.h{--pt:clamp(.375rem,1dvh,2rem)}')).toContain('--pt:clamp(.375rem,calc(var(--dvh,1vh)*1),2rem)');
  });
  it('no dvh → unchanged', () => {
    expect(dvhFallback('.a{height:100vh}')).toBe('.a{height:100vh}');
  });
  it('the built CSS has no @layer and no raw dvh units left', () => {
    const out = legacySafeCss('@layer base{.a{height:4.6dvh}}');
    expect(out).not.toContain('@layer');
    expect(out.replace(DVH_ROOT, '')).not.toMatch(/\ddvh/);
  });
});
