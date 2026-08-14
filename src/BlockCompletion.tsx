import type { Block } from './BlockEditor';

// Matches Hierarchy.tsx's own RAG palette (red/amber/green -> --critical/--partial/--sound),
// so a RAG block inside a checklist reads consistently with the input's own RAG buttons.
const RAG_OPTIONS: [string, string][] = [
  ['red', 'var(--critical)'], ['amber', 'var(--partial)'], ['green', 'var(--sound)'],
];

/**
 * Renders each block as the right control for filling in - the completion-side counterpart to
 * BlockEditor. Read-only mode shows the stored answer as plain text, matching the same
 * philosophy already used elsewhere (RichTextView, View mode): a genuinely inert presentation,
 * not disabled controls someone could still fiddle with.
 *
 * A RAG or Score block here is a within-evidence judgement about just that one dimension - it
 * is NOT wired to the input's own overall RAG button. The assessor still sets the input's real
 * verdict separately after weighing every evidence object; auto-feeding a checklist block into
 * that would quietly turn "evidence-weighted, not opinion-averaged" into opinion-averaging.
 */
export default function BlockCompletion({
  blocks, responses, onAnswer, readOnly,
}: {
  blocks: Block[]; responses: Record<string, string>;
  onAnswer: (blockId: string, value: string) => void; readOnly: boolean;
}) {
  return (
    <div>
      {blocks.map((b) => (
        <div key={b.id} style={{ marginBottom: '.5rem' }}>
          {b.type === 'note' ? (
            <p className="dim" style={{ fontSize: '.82rem', whiteSpace: 'pre-wrap' }}>{b.body}</p>
          ) : (
            <>
              <div style={{ fontSize: '.85rem', marginBottom: '.2rem' }}>
                {b.prompt}{b.required && <span style={{ color: 'var(--critical, #b3261e)' }}> *</span>}
              </div>
              {readOnly ? (
                <span className="dim" style={{ fontSize: '.82rem' }}>{responses[b.id] || '(not answered)'}</span>
              ) : b.type === 'yes_no_na' ? (
                <span>
                  {['Yes', 'No', 'N/A'].map((opt) => (
                    <button key={opt} className="btn quiet sm"
                            style={{ marginRight: '.3rem', fontWeight: responses[b.id] === opt ? 600 : 400 }}
                            onClick={() => onAnswer(b.id, opt)}>{opt}</button>
                  ))}
                </span>
              ) : b.type === 'multiple_choice' ? (
                <select className="field" value={responses[b.id] ?? ''} onChange={(e) => onAnswer(b.id, e.target.value)}>
                  <option value="">—</option>
                  {(b.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : b.type === 'radio' ? (
                <span>
                  {(b.options ?? []).map((o) => (
                    <label key={o} style={{ marginRight: '.6rem', fontSize: '.85rem' }}>
                      <input type="radio" checked={responses[b.id] === o} onChange={() => onAnswer(b.id, o)} /> {o}
                    </label>
                  ))}
                </span>
              ) : b.type === 'multi_select' ? (
                <span>
                  {(b.options ?? []).map((o) => {
                    const selected = (responses[b.id] ?? '').split(',').filter(Boolean);
                    const checked = selected.includes(o);
                    return (
                      <label key={o} style={{ marginRight: '.6rem', fontSize: '.85rem' }}>
                        <input type="checkbox" checked={checked}
                               onChange={() => {
                                 const next = checked ? selected.filter((x) => x !== o) : [...selected, o];
                                 onAnswer(b.id, next.join(','));
                               }} /> {o}
                      </label>
                    );
                  })}
                </span>
              ) : b.type === 'rag' ? (
                <span>
                  {RAG_OPTIONS.map(([label, colour]) => (
                    <button key={label} className="btn quiet sm"
                            style={{
                              marginRight: '.3rem',
                              borderColor: responses[b.id] === label ? colour : undefined,
                              color: responses[b.id] === label ? colour : undefined,
                              fontWeight: responses[b.id] === label ? 600 : 400,
                            }}
                            onClick={() => onAnswer(b.id, label)}>{label}</button>
                  ))}
                </span>
              ) : b.type === 'score' ? (
                <span>
                  {Array.from(
                    { length: Math.max(0, Math.floor(((b.max ?? 5) - (b.min ?? 1)) / (b.step ?? 1)) + 1) },
                    (_, i) => (b.min ?? 1) + i * (b.step ?? 1),
                  ).map((n) => (
                    <button key={n} className="btn quiet sm"
                            style={{ marginRight: '.2rem', fontWeight: responses[b.id] === String(n) ? 600 : 400 }}
                            onClick={() => onAnswer(b.id, String(n))}>{n}</button>
                  ))}
                </span>
              ) : b.type === 'short_text' ? (
                <input className="field" value={responses[b.id] ?? ''} onChange={(e) => onAnswer(b.id, e.target.value)} />
              ) : b.type === 'long_text' ? (
                <textarea className="field" rows={3} style={{ width: '100%' }} value={responses[b.id] ?? ''}
                          onChange={(e) => onAnswer(b.id, e.target.value)} />
              ) : null}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
