/**
 * Config-driven page/CMS block registry for claudia-rte.
 *
 * ADDITIVE ONLY (v1.1.0) — nothing here touches BlockEditor/BlockType/BlockSchema
 * (the existing structured-evidence/assessment editor: note, short_text, radio, rag,
 * score, etc — a genuinely different concept that happens to share the word "block").
 * Deliberately namespaced as PageBlock* to avoid colliding with that export, which
 * petgi and lintel already consume pinned to v1.0.0 and must not need to change.
 *
 * The shape below is not a new invention — it ports the registry/config pattern
 * already proven in SafeSpaces' src/components/UnifiedBlockEditor (blockRegistry.ts,
 * blockStyleSchema.ts, types.ts) verbatim, per the reuse-first principle in
 * docs/_platform/claudia-shared-library-alignment-design.md (SafeSpaces repo) §7.
 * Icons are string keys, not component references, so this package stays free of a
 * hard lucide-react dependency — the host app supplies its own icon lookup.
 */

/**
 * Which editor surface a block type is available in. SafeSpaces' four
 * (cms | blog | event | message-board) plus the two claudia-rte needs on day one:
 * 'notes' (the existing structured-evidence use case, block-editor-free) and 'page'
 * (a full CMS-style page). A host app can extend this union for its own surfaces —
 * see PageBlockTypeConfig.contexts, which is just string[] for that reason.
 */
export type EditorContext = 'notes' | 'page' | 'cms' | 'blog' | 'event' | 'message-board' | (string & {});

export interface PageBlockTypeConfig {
  type: string;
  label: string;
  /** Icon key — host app resolves this to its own icon component/set. */
  icon: string;
  description: string;
  /** Which EditorContext values this block is offered in. */
  contexts: EditorContext[];
  /** When true, hidden from the block palette for non-admin authors. */
  adminOnly?: boolean;
  getDefaultData: () => Record<string, unknown>;
}

/**
 * Base registry. A host app extends this by concatenating its own
 * PageBlockTypeConfig[] — never by forking this file. Example:
 *   const registry = [...PAGE_BLOCK_REGISTRY, ...mySafeSpacesOnlyBlocks];
 * This is the "extensible by adding other content via toolbar icons" requirement:
 * extension is composition, not modification of the kernel component.
 */
export const PAGE_BLOCK_REGISTRY: PageBlockTypeConfig[] = [
  {
    type: 'section',
    label: 'Section',
    icon: 'rows',
    description: 'A cohesive group of blocks rendered as one editable section',
    contexts: ['page', 'cms'],
    getDefaultData: () => ({
      layout: 'stack',
      props: { bgColor: '', bgImage: '', paddingY: 48, paddingX: 24, maxWidth: 'wide' },
      blocks: [],
    }),
  },
  {
    type: 'richtext',
    label: 'Rich text',
    icon: 'type',
    description: 'Formatted text via this package\'s own RichText component',
    contexts: ['notes', 'page', 'cms'],
    getDefaultData: () => ({ html: '' }),
  },
  {
    type: 'image',
    label: 'Image',
    icon: 'image',
    description: 'A single image with optional caption',
    contexts: ['page', 'cms'],
    getDefaultData: () => ({ url: '', alt: '', caption: '' }),
  },
  {
    // Ported as-is from SafeSpaces UnifiedBlockEditor's chart block (blockRegistry.ts,
    // verified live 2026-08-20) — same defaultData shape, so a chart authored against
    // that registry deserialises unchanged against this one.
    type: 'chart',
    label: 'Chart',
    icon: 'bar-chart-3',
    description:
      'Diagrams (flowchart, sequence, …) or data charts (line, bar, radar/spider, pie, scatter, gauge) from static or bound data.',
    contexts: ['page', 'cms', 'notes'],
    getDefaultData: () => ({
      mode: 'diagram',
      chartType: 'flowchart',
      direction: 'TD',
      theme: 'default',
      title: '',
      code: '',
      displayAsImage: false,
      imageUrl: '',
    }),
  },
];

/** Filter the registry to what a given context should offer in its toolbar/palette. */
export function blocksForContext(
  ctx: EditorContext,
  registry: PageBlockTypeConfig[] = PAGE_BLOCK_REGISTRY
): PageBlockTypeConfig[] {
  return registry.filter((b) => b.contexts.includes(ctx));
}
