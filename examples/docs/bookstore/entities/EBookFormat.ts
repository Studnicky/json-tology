/**
 * EBookFormat — controlled vocabulary of electronic book file formats.
 *
 * Currently recognised formats:
 *   - 'epub'  — EPUB 3 (reflowable, accessible)
 *   - 'pdf'   — Portable Document Format (fixed-layout)
 *   - 'mobi'  — Mobipocket / Kindle legacy format
 *
 * Modelling as a named enum primitive centralises the allowed values so they
 * appear once in the canonical graph and in the OWL TBox vocabulary.
 */

export const EBookFormatSchema = {
  '$id': 'urn:bookstore:EBookFormat',
  'enum': [
    'epub',
    'pdf',
    'mobi'
  ],
  'type': 'string'
} as const;
