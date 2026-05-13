import { BookSchema } from './Book.js';

/**
 * Sequel — demonstrates the `asymmetric` property axiom.
 *
 * The "sequel of" relation is strictly asymmetric: if book B is a sequel of
 * book A, then A cannot simultaneously be a sequel of B. The direction is
 * one-way by definition (publication order is irreversible).
 *
 *   asymmetric: true — if (B sequel-of A) then NOT (A sequel-of B).
 *     OWL 2: owl:AsymmetricProperty on `predecessor`.
 */
export const SequelSchema = {
  '$id': 'urn:bookstore:Sequel',
  'properties': {
    // `book` is the sequel (the later-published work).
    'book': { '$ref': BookSchema.$id },
    // `predecessor` is the work that `book` follows. The relation from `book`
    // to `predecessor` is asymmetric — the predecessor cannot itself be a
    // sequel of the book it precedes.
    'predecessor': {
      '$ref': BookSchema.$id,
      'asymmetric': true
    }
  },
  'required': [
    'book',
    'predecessor'
  ],
  'type': 'object'
} as const;
