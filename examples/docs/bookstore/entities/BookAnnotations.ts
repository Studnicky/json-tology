/**
 * BookAnnotations — demonstrates patternProperties template-literal expansion.
 *
 * InferType resolves to:
 *   { readonly [`note_${string}`]?: string }
 *   & { readonly [`tag_${string}`]?: string }
 *
 * Keys matching `^note_` (e.g. `note_summary`, `note_errata`) are inferred as
 * template literal `note_${string}` with value type `string`. Keys matching
 * `^tag_` (e.g. `tag_genre`, `tag_audience`) are inferred as `tag_${string}`.
 *
 * Demonstrates:
 *   - patternProperties with `^prefix` anchors → template-literal keyed record intersection
 *   - Multiple patterns intersect into a single object type
 */

export const BookAnnotationsSchema = {
  '$id': 'urn:bookstore:BookAnnotations',
  'patternProperties': {
    '^note_': { 'type': 'string' },
    '^tag_': { 'type': 'string' }
  },
  'type': 'object'
} as const;
