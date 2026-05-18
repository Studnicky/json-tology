import { Compose } from '../../../../src/index.js';
import { BookSchema } from './Book.js';

/**
 * EBook — taxonomic subclass of Book via Compose.subClassOf.
 *
 * Demonstrates:
 *   - Compose.subClassOf with a single parent (rdfs:subClassOf in TBox)
 *   - Format-specific properties layered onto the parent, all via named $refs
 *   - Generalised if/then/else inference: when fileFormat === 'epub' the then
 *     branch narrows to require epubVersion; when not-epub (else) pdfVersion is required.
 *
 * The if clause uses a single const-discriminated property (fileFormat) so
 * IfNarrowingObjectType fires and the inferred type is a discriminated union:
 *   | (EBook base & { fileFormat: 'epub'; epubVersion: string })
 *   | (EBook base & { pdfVersion: string })
 *
 * Wire shape: { $id, allOf: [{ $ref: 'urn:bookstore:Book' }, { type: 'object', ... }] }
 *
 * All properties reference named primitives (strict-graph compliant):
 *   - downloadUrl → DownloadUrl (format: uri string)
 *   - fileFormat  → EBookFormat (enum: epub | pdf | mobi)
 *   - fileSizeBytes → FileSizeBytes (non-negative integer)
 */

export const EBookSchema = Compose.subClassOf(BookSchema, {
  '$id': 'urn:bookstore:EBook',
  'else': {
    'properties': { 'pdfVersion': { 'type': 'string' } },
    'required': ['pdfVersion'],
    'type': 'object'
  },
  'if': {
    'properties': { 'fileFormat': { 'const': 'epub' } },
    'required': ['fileFormat'],
    'type': 'object'
  },
  'properties': {
    'downloadUrl': { '$ref': 'urn:bookstore:DownloadUrl' },
    'fileFormat': { '$ref': 'urn:bookstore:EBookFormat' },
    'fileSizeBytes': { '$ref': 'urn:bookstore:FileSizeBytes' }
  },
  'required': [
    'fileFormat',
    'downloadUrl'
  ],
  // eslint-disable-next-line unicorn/no-thenable -- JSON Schema 'then' keyword
  'then': {
    'properties': { 'epubVersion': { 'type': 'string' } },
    'required': ['epubVersion'],
    'type': 'object'
  },
  'type': 'object'
} as const);
