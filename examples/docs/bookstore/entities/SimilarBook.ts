import { BookSchema } from './Book.js';

/**
 * SimilarBook — demonstrates `symmetric` and `reflexive` property axioms.
 *
 * The "similar" relation between two books has two natural characteristics:
 *
 *   symmetric: true — if book A is similar to book B, then B is similar to
 *     A. Similarity is undirected. OWL 2: owl:SymmetricProperty on `b`.
 *
 *   reflexive: true — every book is similar to itself (reflexive closure over
 *     the similarity relation). This is the identity base case required for
 *     OWL 2 reflexive property axioms to produce correct entailments.
 *     OWL 2: owl:ReflexiveProperty on `b`.
 */
export const SimilarBookSchema = {
  '$id': 'urn:bookstore:SimilarBook',
  'properties': {
    // `a` is the source book — the subject of the similarity claim.
    'a': { '$ref': BookSchema.$id },
    // `b` is the target book — symmetric (order of a/b does not matter) and
    // reflexive (a book can be declared similar to itself as identity base).
    'b': {
      '$ref': BookSchema.$id,
      'reflexive': true,
      'symmetric': true
    }
  },
  'required': [
    'a',
    'b'
  ],
  'type': 'object'
} as const;
