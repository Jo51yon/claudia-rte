import { useEffect, useRef } from 'react';
import { sanitise } from './RichText';
import { decodeSafeText } from './decodeSafeText';

/**
 * Renders a stored note, resolving media references at display time.
 *
 * Stored HTML carries data-storage-key / data-location-id rather than a src, because a
 * signed URL lives only for a short window — writing one into the note would mean every
 * image and recording was broken by the time anyone re-read it. The trade is one signing
 * call per media element per view, which is the correct side to err on for an audit record
 * that has to still work in a year.
 *
 * SANITISED HERE, NOT JUST ON SAVE. RichText.tsx calls sanitise() before persisting, but that
 * only protects content that was actually entered through that editor. It is not the only
 * writer: fields get populated directly via SQL, imports, or an MCP/API path, none of which
 * pass through RichText.tsx. A view that trusts its callers to have sanitised is only as safe
 * as every future caller remembering to. Sanitising again here is cheap - DOMParser over a
 * string - and means this component defends itself rather than depending on the discipline
 * of every writer that will ever exist.
 *
 * DECODED BEFORE SANITISING. Ported from SafeSpaces' SafeContent.tsx: numeric and hex entity
 * decoding run iteratively to unwind double-encoded sequences, and invisible Unicode is
 * stripped (zero-width characters, BOM, bidi controls, soft hyphen) that otherwise render as
 * garbled glyphs or invisible gaps in a printed report. Decode runs FIRST so nothing stays
 * hidden inside an encoded sequence past the point sanitisation runs.
 *
 * PROJECT-AGNOSTIC BY DESIGN (extracted 2026-08-14 for the Claudia shared component library,
 * see docs/_platform/component-library.md). The original PETGI copy imported
 * researchDownloadUrl directly - a project-local function. This version takes an `onResolve`
 * function as a prop instead: each consuming project supplies its own signed-URL resolver,
 * matching whatever storage-authorization path it actually has.
 */
export type RichTextResolveFn = (storageKey: string) => Promise<string>;

export default function RichTextView({
  html, onResolve,
}: {
  html: string;
  // Optional: content with no media references never calls this, so a consumer that only
  // ever stores plain formatted text can omit it entirely.
  onResolve?: RichTextResolveFn;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clean = sanitise(decodeSafeText(html));

  useEffect(() => {
    const root = ref.current;
    if (!root || !onResolve) return;
    let cancelled = false;

    const nodes = root.querySelectorAll<HTMLElement>('[data-storage-key]');
    nodes.forEach(async (el) => {
      const key = el.getAttribute('data-storage-key');
      if (!key) return;
      try {
        const url = await onResolve(key);
        if (cancelled) return;
        if (el instanceof HTMLAnchorElement) {
          el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer';
        } else {
          el.setAttribute('src', url);
        }
      } catch {
        // Leave the element as it is. A broken image is honest; a silent removal would hide
        // that evidence was attached and is now unreachable.
        el.setAttribute('data-unresolved', 'true');
      }
    });

    return () => { cancelled = true; };
  }, [clean, onResolve]);

  return <div ref={ref} className="note-body" dangerouslySetInnerHTML={{ __html: clean }} />;
}
