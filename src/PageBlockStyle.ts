/**
 * Declarative per-block-type style schema — ported from SafeSpaces'
 * UnifiedBlockEditor/blockStyleSchema.ts pattern verbatim (verified live 2026-08-20,
 * see docs/_platform/claudia-shared-library-alignment-design.md §7 in the SafeSpaces
 * repo). Additive: any block whose type isn't given its own StyleField[] falls back
 * to UNIVERSAL_STYLE_FIELDS, so every PageBlock has at least colour/font/spacing
 * controls without bespoke wiring per type. This is the "which style to use" config
 * surface — persisted alongside a block's own data, consumed by whatever renders it.
 */

export type StyleField =
  | { key: string; label: string; kind: 'color' }
  | { key: string; label: string; kind: 'font' }
  | { key: string; label: string; kind: 'px'; min?: number; max?: number; step?: number }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: 'bool'; help?: string };

export const UNIVERSAL_STYLE_FIELDS: StyleField[] = [
  { key: 'bgColor', label: 'Background colour', kind: 'color' },
  { key: 'textColor', label: 'Text colour', kind: 'color' },
  { key: 'paddingY', label: 'Vertical padding', kind: 'px', min: 0, max: 160, step: 4 },
  { key: 'paddingX', label: 'Horizontal padding', kind: 'px', min: 0, max: 160, step: 4 },
];

/** Per-type overrides/additions. Host apps extend by merging their own map in —
 * never by editing this one — same composition-over-modification rule as the
 * block registry. */
export const BLOCK_STYLE_FIELDS: Record<string, StyleField[]> = {
  chart: [
    { key: 'theme', label: 'Theme', kind: 'select', options: [
      { value: 'default', label: 'Default' },
      { value: 'dark', label: 'Dark' },
    ] },
  ],
};

export function styleFieldsForType(
  type: string,
  overrides: Record<string, StyleField[]> = BLOCK_STYLE_FIELDS
): StyleField[] {
  return [...UNIVERSAL_STYLE_FIELDS, ...(overrides[type] ?? [])];
}
