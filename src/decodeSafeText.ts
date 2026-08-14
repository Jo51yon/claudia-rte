/**
 * Two accumulated production fixes ported from SafeSpaces' SafeContent.tsx, kept separate from
 * RichText.tsx/RichTextView.tsx so both share one implementation rather than drifting apart.
 *
 * NOT ported here: SafeContent's markdown detection and markdown-to-HTML conversion. That needs
 * a real parser - this project has no markdown library as a dependency (checked package.json),
 * and a hand-rolled parser is exactly the kind of thing that looks fine in a demo and mis-renders
 * a client's own words in a printed report. That is a separate, larger decision - which library,
 * and whether markdown input is wanted here at all - not something to bolt on by hand in this
 * change. Tracked separately in richtextview-sanitize-pipeline:develop.
 */

// Named entities beyond what a browser's own HTML parser already resolves for &amp; &lt; &gt;
// &quot; &#39; - those four are handled naturally by DOMParser/innerHTML and are NOT duplicated
// here. This table exists for the ones that are NOT auto-resolved and that have shown up in
// practice: curly quotes and dashes pasted from word processors, and non-breaking space.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: '\u00A0', ndash: '\u2013', mdash: '\u2014',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  hellip: '\u2026', copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
};

/**
 * Decodes numeric (&#123;), hex (&#x1F4A9;) and the named entities above, run iteratively up to
 * 4 passes to unwind double-encoded sequences such as &amp;#39; (an apostrophe encoded once,
 * then its ampersand encoded again by a second system that assumed it was still raw text).
 * A fixed pass count rather than "loop until stable" on purpose: untrusted input that decodes to
 * more of itself (a manufactured expansion) must not be given an unbounded loop to run in.
 */
export function decodeEntities(input: string): string {
  let text = input;
  for (let pass = 0; pass < 4; pass++) {
    const before = text;
    text = text
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      })
      .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
    if (text === before) break;
  }
  return text;
}

// Characters that carry no visible glyph but corrupt rendering and text-search alike: zero-width
// space/joiner/non-joiner, byte-order mark, word joiner, left-to-right/right-to-left marks and
// embedding/override controls, and soft hyphen. Left in place, these turn into garbled glyphs or
// invisible search-breaking gaps in a printed report - the kind of defect nobody reports because
// nobody can see what is wrong, only that a name looks slightly off.
const INVISIBLE_UNICODE = /[\u200B-\u200F\u202A-\u202E\uFEFF\u2060\u00AD]/g;

export function stripInvisibleUnicode(input: string): string {
  return input.replace(INVISIBLE_UNICODE, '');
}

/** The full pipeline in the order that matters: decode first, so nothing stays hidden inside an
 *  encoded sequence past the point sanitisation runs, then strip what would otherwise render as
 *  a garbled glyph or an invisible gap. */
export function decodeSafeText(input: string): string {
  return stripInvisibleUnicode(decodeEntities(input));
}
