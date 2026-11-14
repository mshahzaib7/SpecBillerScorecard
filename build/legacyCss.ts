/**
 * Makes the built CSS safe for older phones (target: Safari 14+, Chrome 87+), at build time only.
 *
 * 1. Cascade layers: Safari < 15.4 and Chrome < 99 ignore every rule inside `@layer` blocks,
 *    which Tailwind uses for its reset, the theme variables and utilities such as `.sr-only`
 *    (screen-reader text would show up on screen). The blocks are unwrapped in place. All layer
 *    blocks come before the site's own (unlayered) rules, so the cascade order is unchanged.
 * 2. Dynamic viewport units: Safari < 15.4 and Chrome < 108 drop any declaration that uses `dvh`
 *    (the hero headline would lose its size). Every `Ndvh` becomes `calc(var(--dvh,1vh)*N)`,
 *    with --dvh = 1dvh where supported and 1vh elsewhere.
 */

/** Index of the `}` that closes the block opened at `open` (a `{`), skipping quoted strings. */
function matchBrace(css: string, open: number): number {
  let depth = 0;
  for (let k = open; k < css.length; k++) {
    const c = css[k];
    if (c === '"' || c === "'") {
      const end = css.indexOf(c, k + 1);
      k = end === -1 ? css.length : end;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return k;
  }
  return css.length;
}

/** Removes `@layer a, b;` statements and unwraps `@layer name { ... }` blocks (also nested ones). */
export function unwrapLayers(css: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const at = css.indexOf('@layer', i);
    if (at === -1) return out + css.slice(i);
    out += css.slice(i, at);
    let j = at + '@layer'.length;
    while (j < css.length && css[j] !== ';' && css[j] !== '{') j++;
    if (css[j] === ';' || j >= css.length) {
      i = j + 1;
      continue;
    }
    const close = matchBrace(css, j);
    out += unwrapLayers(css.slice(j + 1, close));
    i = close + 1;
  }
}

/** A number (with its sign, so `-3.2dvh` stays valid) followed by dvh. */
const DVH = /(-?\d*\.?\d+)dvh\b/g;
export const DVH_ROOT = ':root{--dvh:1vh}@supports (height:1dvh){:root{--dvh:1dvh}}';

/** `4.6dvh` → `calc(var(--dvh,1vh)*4.6)`, plus the --dvh definition. */
export function dvhFallback(css: string): string {
  if (!css.includes('dvh')) return css;
  return DVH_ROOT + css.replace(DVH, (_, n: string) => `calc(var(--dvh,1vh)*${n})`);
}

export function legacySafeCss(css: string): string {
  return dvhFallback(unwrapLayers(css));
}
