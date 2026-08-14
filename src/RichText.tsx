import { useEffect, useRef, useState } from 'react';

/**
 * Rich text editor, ported from SafeSpaces' RichTextContentEditor.
 *
 * Ported: the formatting verbs (bold/italic/underline/strikethrough, lists, headings,
 * blockquote, alignment, font size, colour, remove-format, undo/redo), plus links, images,
 * attachments, code blocks, tables and in-browser media recording.
 *
 * Not ported: emoji and GIF pickers, columns layout, embedded SafeSpaces forms, magic-link
 * and field-merge dialogs, instance logo resolution, help links and plugin gating. All are
 * SafeSpaces product features with no meaning in an assessment note.
 *
 * Storage format is unchanged from SafeSpaces — sanitised HTML — so notes remain
 * interchangeable between the two products.
 *
 * MEDIA REFERENCES DO NOT EMBED URLS. A signed URL expires in a short window, so an <img src>
 * written into stored HTML would be broken by the time anyone re-read the note. Media is
 * stored as data-storage-key/data-location-id and resolved at render time by RichTextView.
 *
 * PROJECT-AGNOSTIC BY DESIGN (extracted 2026-08-14 for the Claudia shared component library,
 * see docs/_platform/component-library.md). The original PETGI copy imported
 * researchUploadFile directly from a project-local lib/storage - a relative path that could
 * not exist the same way in any other project. This version takes an `onUpload` function as
 * a prop instead: the shared component decides WHAT to upload and WHEN (image/file/recording,
 * key naming via uploadPrefix), and each consuming project decides HOW - PETGI's is a thin
 * wrapper around its own storage.ts, another project's would call its own equivalent. This is
 * the actual point of extraction: one implementation of the editor, not one implementation
 * that only happens to also work if every project reimplements the same lib/storage shape.
 */
export interface RichTextUploadResult { key: string; locationId: string }
export type RichTextUploadFn = (file: File, key: string) => Promise<RichTextUploadResult>;

const BLOCKS = [
  ['<p>', 'Paragraph'], ['<h2>', 'Heading'], ['<h3>', 'Subheading'], ['<blockquote>', 'Quote'],
  ['<pre>', 'Code'],
] as const;
const SIZES = [['2', 'Small'], ['3', 'Normal'], ['5', 'Large']] as const;
const COLOURS = ['#1B222C', '#C0533E', '#A5841F', '#4C948C', '#1F3A5F'];

export default function RichText({
  value, onChange, placeholder, uploadPrefix, onUpload,
}: {
  value: string; onChange: (html: string) => void; placeholder?: string;
  uploadPrefix?: string;
  // Optional: a consumer with no upload story at all (e.g. topic-wide policy text with no
  // assessment/record context) simply omits this - the upload buttons still render, but each
  // attempt fails with a clear, real error rather than throwing on a missing dependency.
  onUpload?: RichTextUploadFn;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<'audio' | 'video' | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  function emit() { onChange(ref.current?.innerHTML ?? ''); }
  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    emit();
  }
  function insertHtml(html: string) {
    // Explicit re-focus + selection restore, not just execCommand: this is called after an
    // async upload (store()) resolves, and any gap long enough for a file-picker dialog to
    // open and close loses both focus and the text selection execCommand needs - without
    // restoring one inside the editor, insertHTML silently does nothing. Falls back to the
    // end of the content, the same place a user's own cursor most often already was.
    const el = ref.current;
    if (el) {
      el.focus();
      const sel = window.getSelection();
      if (sel && (!sel.rangeCount || !el.contains(sel.getRangeAt(0).commonAncestorContainer))) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    document.execCommand('insertHTML', false, html);
    emit();
  }

  async function store(file: File | Blob, filename: string): Promise<{ key: string; locationId: string } | null> {
    if (!onUpload) { setError('This editor has no storage configured for uploads.'); return null; }
    const key = `${uploadPrefix ?? 'notes'}/${Date.now()}-${filename.replace(/[^\w.\-]/g, '_')}`;
    const asFile = file instanceof File ? file : new File([file], filename, { type: (file as Blob).type });
    const { locationId } = await onUpload(asFile, key);
    return { key, locationId };
  }

  async function onImage(list: FileList | null) {
    if (!list?.length) return;
    setBusy('image'); setError(null);
    try {
      for (const f of Array.from(list)) {
        const r = await store(f, f.name);
        if (r) insertHtml(
          `<img data-storage-key="${r.key}" data-location-id="${r.locationId}" alt="${f.name}" />`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); if (imageRef.current) imageRef.current.value = ''; }
  }

  async function onAttachment(list: FileList | null) {
    if (!list?.length) return;
    setBusy('file'); setError(null);
    try {
      for (const f of Array.from(list)) {
        const r = await store(f, f.name);
        if (r) insertHtml(
          `<a data-storage-key="${r.key}" data-location-id="${r.locationId}" href="#">📎 ${f.name}</a>&nbsp;`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ''; }
  }

  function link() {
    const url = prompt('Link URL');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { setError('Links must start with http:// or https://'); return; }
    exec('createLink', url);
  }

  function table() {
    const cols = Number(prompt('Columns', '3') ?? 0);
    const rows = Number(prompt('Rows', '3') ?? 0);
    if (!cols || !rows) return;
    const head = `<tr>${'<th>&nbsp;</th>'.repeat(cols)}</tr>`;
    const body = `<tr>${'<td>&nbsp;</td>'.repeat(cols)}</tr>`.repeat(Math.max(0, rows - 1));
    insertHtml(`<table class="note-table"><thead>${head}</thead><tbody>${body}</tbody></table><p></p>`);
  }

  /** In-browser capture for field evidence — a plant floor or an interview room. */
  async function startRecording(kind: 'audio' | 'video') {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video' ? { video: true, audio: true } : { audio: true });
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = kind === 'video' ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        setBusy('recording');
        try {
          const r = await store(blob, `${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`);
          if (r) insertHtml(kind === 'video'
            ? `<video controls data-storage-key="${r.key}" data-location-id="${r.locationId}"></video>`
            : `<audio controls data-storage-key="${r.key}" data-location-id="${r.locationId}"></audio>`);
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(null); setRecording(null); }
      };
      recorder.current = mr;
      mr.start();
      setRecording(kind);
    } catch (e) {
      setError(`Could not start recording: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  function stopRecording() { recorder.current?.stop(); }

  const btn = (label: string, title: string, fn: () => void, active = false) => (
    <button type="button" className="rte-btn" title={title} key={title}
            style={active ? { color: 'var(--navy)', fontWeight: 600 } : undefined}
            onMouseDown={(e) => { e.preventDefault(); fn(); }}>{label}</button>
  );

  return (
    <div className={`rte${focused ? ' focused' : ''}`}>
      <div className="rte-toolbar">
        {btn('B', 'Bold', () => exec('bold'))}
        {btn('I', 'Italic', () => exec('italic'))}
        {btn('U', 'Underline', () => exec('underline'))}
        {btn('S', 'Strikethrough', () => exec('strikeThrough'))}
        <span className="rte-sep" />
        <select className="rte-select" title="Block style" defaultValue="<p>"
                onChange={(e) => exec('formatBlock', e.target.value)}>
          {BLOCKS.map(([tag, label]) => <option key={tag} value={tag}>{label}</option>)}
        </select>
        <select className="rte-select" title="Text size" defaultValue="3"
                onChange={(e) => exec('fontSize', e.target.value)}>
          {SIZES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <span className="rte-colours">
          {COLOURS.map((c) => (
            <button type="button" key={c} className="rte-swatch" title={`Colour ${c}`}
                    style={{ background: c }}
                    onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c); }} />
          ))}
        </span>
        <span className="rte-sep" />
        {btn('•', 'Bulleted list', () => exec('insertUnorderedList'))}
        {btn('1.', 'Numbered list', () => exec('insertOrderedList'))}
        {btn('◐', 'Align left', () => exec('justifyLeft'))}
        {btn('≡', 'Align centre', () => exec('justifyCenter'))}
        {btn('¬', 'Align right', () => exec('justifyRight'))}
        <span className="rte-sep" />
        {btn('🔗', 'Insert link', link)}
        {btn('⛓', 'Remove link', () => exec('unlink'))}
        {btn('▦', 'Insert table', table)}
        <span className="rte-sep" />
        {btn(busy === 'image' ? '…' : '🖼', 'Insert image', () => imageRef.current?.click())}
        {btn(busy === 'file' ? '…' : '📎', 'Attach a file', () => fileRef.current?.click())}
        {recording
          ? btn('⏹ stop', 'Stop recording', stopRecording, true)
          : <>
              {btn('🎙', 'Record audio', () => startRecording('audio'))}
              {btn('🎥', 'Record video', () => startRecording('video'))}
            </>}
        <span className="rte-sep" />
        {btn('↶', 'Undo', () => exec('undo'))}
        {btn('↷', 'Redo', () => exec('redo'))}
        {btn('✕', 'Remove formatting', () => exec('removeFormat'))}
      </div>

      {recording && <div className="rte-recording">Recording {recording}… press stop to insert it.</div>}
      {busy === 'recording' && <div className="rte-recording">Uploading recording…</div>}
      {error && <p className="err" style={{ margin: '.3rem .6rem' }}>{error}</p>}

      <input ref={imageRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
             onChange={(e) => onImage(e.target.files)} />
      <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
             onChange={(e) => onAttachment(e.target.files)} />

      <div ref={ref} className="rte-body" contentEditable suppressContentEditableWarning
           data-placeholder={placeholder ?? 'Write a note…'}
           onFocus={() => setFocused(true)}
           onBlur={() => { setFocused(false); emit(); }}
           onInput={emit} />
    </div>
  );
}

/**
 * Strips anything that could execute. The server stores what it is given, so this is the only
 * barrier between a pasted payload and every later reader of the note.
 */
export function sanitise(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,form,link,meta').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(a.name);
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
  });
  return doc.body.innerHTML;
}
