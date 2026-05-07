import { Compose } from '../../../../src/index.js';
import { BookSchema } from './Book.js';

/**
 * EBook — taxonomic subclass of Book via Compose.subClassOf.
 *
 * Demonstrates:
 *   - Compose.subClassOf with a single parent (rdfs:subClassOf in TBox)
 *   - Format-specific properties layered onto the parent
 *
 * Wire shape: { $id, allOf: [{ $ref: 'urn:bookstore:Book' }, { type: 'object', properties: {...} }] }
 */

export const EBookSchema = Compose.subClassOf(BookSchema, {
  '$id': 'urn:bookstore:EBook',
  'properties': {
    'downloadUrl': {
      'format': 'uri',
      'type': 'string'
    },
    'fileFormat': {
      'enum': [
        'epub',
        'pdf',
        'mobi'
      ],
      'type': 'string'
    },
    'fileSizeBytes': {
      'minimum': 0,
      'type': 'integer'
    }
  },
  'required': [
    'fileFormat',
    'downloadUrl'
  ],
  'type': 'object'
} as const);
