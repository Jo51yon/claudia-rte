import { useState } from 'react';

// 'multiple_choice' is kept as the literal type key (not renamed to 'dropdown') specifically so
// every existing template and evidence object - which all already use 'yes_no_na' and
// 'multiple_choice' - needs zero migration to work with this editor on day one.
export type BlockType =
  | 'note' | 'short_text' | 'long_text' | 'radio' | 'multiple_choice' | 'multi_select'
  | 'yes_no_na' | 'rag' | 'score';

export interface Block {
  id: string; type: BlockType;
  prompt?: string;        // question text; used as a heading for everything except 'note'
  body?: string;          // guidance text, 'note' blocks only
  options?: string[];     // radio / multiple_choice / multi_select
  min?: number; max?: number; step?: number;  // 'score' only
  required?: boolean;
}
export interface BlockSchema { blocks: Block[] }

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  note: 'Note (guidance text)', short_text: 'Short text', long_text: 'Long text',
  radio: 'Radio (single choice)', multiple_choice: 'Dropdown (single choice)',
  multi_select: 'Multi-select (checkboxes)', yes_no_na: 'Yes / No / N/A',
  rag: 'RAG (red / amber / green)', score: 'Score (numeric)',
};
const HAS_OPTIONS: BlockType[] = ['radio', 'multiple_choice', 'multi_select'];

function newBlock(type: BlockType): Block {
  const id = `b${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  if (type === 'note') return { id, type, body: '' };
  if (HAS_OPTIONS.includes(type)) return { id, type, prompt: '', options: ['Option 1', 'Option 2'] };
  if (type === 'score') return { id, type, prompt: '', min: 1, max: 5, step: 1 };
  return { id, type, prompt: '' };
}

/**
 * Add/reorder/delete/configure blocks. Used both for tailoring an assigned evidence object
 * (EvidenceDialog's ChecklistBody, Edit mode only - see the canEdit/mode fix that made this
 * genuinely editor-only) and, going forward, the superadmin template CRUD UI - a template only
 * needs this editor built once, not twice.
 */
export default function BlockEditor({ schema, onChange }: { schema: BlockSchema; onChange: (s: BlockSchema) => void }) {
  const [addType, setAddType] = useState<BlockType>('short_text');

  function updateBlock(id: string, patch: Partial<Block>) {
    onChange({ blocks: schema.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }
  function removeBlock(id: string) {
    onChange({ blocks: schema.blocks.filter((b) => b.id !== id) });
  }
  function moveBlock(id: string, dir: -1 | 1) {
    const idx = schema.blocks.findIndex((b) => b.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= schema.blocks.length) return;
    const next = [...schema.blocks];
    const tmp = next[idx]; next[idx] = next[swap]; next[swap] = tmp;
    onChange({ blocks: next });
  }
  function addBlock() {
    onChange({ blocks: [...schema.blocks, newBlock(addType)] });
  }
  function updateOption(blockId: string, idx: number, value: string) {
    const b = schema.blocks.find((x) => x.id === blockId);
    if (!b) return;
    const options = [...(b.options ?? [])];
    options[idx] = value;
    updateBlock(blockId, { options });
  }
  function addOption(blockId: string) {
    const b = schema.blocks.find((x) => x.id === blockId);
    if (!b) return;
    updateBlock(blockId, { options: [...(b.options ?? []), `Option ${(b.options?.length ?? 0) + 1}`] });
  }
  function removeOption(blockId: string, idx: number) {
    const b = schema.blocks.find((x) => x.id === blockId);
    if (!b) return;
    updateBlock(blockId, { options: (b.options ?? []).filter((_, i) => i !== idx) });
  }

  return (
    <div>
      {schema.blocks.map((b, i) => (
        <div className="card" key={b.id} style={{ marginBottom: '.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="dim" style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {BLOCK_TYPE_LABEL[b.type]}
            </span>
            <span>
              <button className="btn quiet sm" disabled={i === 0} onClick={() => moveBlock(b.id, -1)}>↑</button>
              <button className="btn quiet sm" disabled={i === schema.blocks.length - 1} onClick={() => moveBlock(b.id, 1)}>↓</button>
              <button className="btn quiet sm danger" onClick={() => removeBlock(b.id)}>Delete</button>
            </span>
          </div>

          {b.type === 'note' ? (
            <textarea className="field" placeholder="Guidance text shown to whoever completes this…"
                      value={b.body ?? ''} onChange={(e) => updateBlock(b.id, { body: e.target.value })}
                      rows={2} style={{ width: '100%', marginTop: '.3rem' }} />
          ) : (
            <input className="field" placeholder="Question / prompt…" value={b.prompt ?? ''}
                   onChange={(e) => updateBlock(b.id, { prompt: e.target.value })} style={{ marginTop: '.3rem' }} />
          )}

          {HAS_OPTIONS.includes(b.type) && (
            <div style={{ marginTop: '.4rem' }}>
              {(b.options ?? []).map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '.3rem', marginBottom: '.2rem' }}>
                  <input className="field" value={opt} onChange={(e) => updateOption(b.id, idx, e.target.value)} />
                  <button className="btn quiet sm danger" onClick={() => removeOption(b.id, idx)}>×</button>
                </div>
              ))}
              <button className="btn quiet sm" onClick={() => addOption(b.id)}>+ Option</button>
            </div>
          )}

          {b.type === 'score' && (
            <div style={{ marginTop: '.4rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <span className="dim" style={{ fontSize: '.78rem' }}>Min</span>
              <input className="field" type="number" style={{ width: 60 }} value={b.min ?? 1}
                     onChange={(e) => updateBlock(b.id, { min: Number(e.target.value) })} />
              <span className="dim" style={{ fontSize: '.78rem' }}>Max</span>
              <input className="field" type="number" style={{ width: 60 }} value={b.max ?? 5}
                     onChange={(e) => updateBlock(b.id, { max: Number(e.target.value) })} />
            </div>
          )}

          {b.type !== 'note' && (
            <label style={{ display: 'block', marginTop: '.4rem', fontSize: '.78rem' }}>
              <input type="checkbox" checked={!!b.required}
                     onChange={(e) => updateBlock(b.id, { required: e.target.checked })} />
              {' '}Required to mark complete
            </label>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
        <select className="field" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)}>
          {(Object.keys(BLOCK_TYPE_LABEL) as BlockType[]).map((t) => (
            <option key={t} value={t}>{BLOCK_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <button className="btn quiet sm" onClick={addBlock}>+ Add block</button>
      </div>
    </div>
  );
}
