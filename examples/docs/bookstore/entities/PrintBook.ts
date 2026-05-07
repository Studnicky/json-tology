import { Compose } from '../../../../src/index.js';
import { BookSchema } from './Book.js';
import { EBookSchema } from './EBook.js';

/**
 * PrintBook — physical-format subclass of Book.
 *
 * Demonstrates:
 *   - Compose.subClassOf for the taxonomic narrowing
 *   - Compose.disjointWith asserting PrintBook and EBook share no instances
 *
 * The disjointWith axiom emits `urn:bookstore:PrintBook owl:disjointWith
 * urn:bookstore:EBook` in the OWL TBox — a single book copy is either a
 * physical artefact or a digital download, never both at once.
 */

const PrintBookBase = Compose.subClassOf(BookSchema, {
  '$id': 'urn:bookstore:PrintBook',
  'properties': {
    'binding': {
      'enum': [
        'hardcover',
        'paperback'
      ],
      'type': 'string'
    },
    'pageCount': {
      'minimum': 1,
      'type': 'integer'
    },
    'weightGrams': {
      'minimum': 0,
      'type': 'number'
    }
  },
  'required': [
    'binding',
    'pageCount'
  ],
  'type': 'object'
} as const);

export const PrintBookSchema = Compose.disjointWith(EBookSchema, PrintBookBase);
