import { AuthorNameSchema } from './AuthorName.js';
import { IsbnSchema } from './Isbn.js';
import { PublicationDateSchema } from './PublicationDate.js';
import { TitleSchema } from './Title.js';

/**
 * BibliographicRecord — the catalogue identity of a work: what it is, who
 * wrote it, when it was published. The retail {@link BookSchema} is a natural
 * extension that layers commercial state (price, print status, inventory) on
 * top of this bibliographic core via `Compose.subClassOf`.
 *
 * Splitting the bibliographic identity from the retail listing models the real
 * domain: book-data sources (library catalogues, search APIs) carry the
 * bibliographic fields but never a price or stock level, so an ingestion
 * pipeline targets this record, not the for-sale Book.
 *
 * OWL 2: `owl:InverseFunctionalProperty` on `isbn` — an ISBN uniquely
 * identifies a bibliographic record, so foreign keys resolve to the record
 * they reference via the identity index. The subclass Book inherits the
 * identity.
 */

export const BibliographicRecordSchema = {
  '$id': 'urn:bookstore:BibliographicRecord',
  'properties': {
    'authors': {
      'items': { '$ref': AuthorNameSchema.$id },
      'minItems': 1,
      'type': 'array',
      'uniqueItems': true
    },
    'isbn': {
      '$ref': IsbnSchema.$id,
      'inverseFunctional': true
    },
    'publishedOn': { '$ref': PublicationDateSchema.$id },
    'title': { '$ref': TitleSchema.$id }
  },
  'required': [
    'isbn',
    'title',
    'authors'
  ],
  'type': 'object'
} as const;
