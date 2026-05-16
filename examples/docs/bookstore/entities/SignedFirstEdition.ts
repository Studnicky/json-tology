import { Compose } from '../../../../src/index.js';
import { AuthorNameSchema } from './AuthorName.js';
import { RareBookSchema } from './RareBook.js';
import { SoloAuthoredBookSchema } from './SoloAuthoredBook.js';

/**
 * SignedFirstEdition — demonstrates multi-parent `Compose.subClassOf`.
 *
 * A book signed by its sole author is BOTH a `RareBook` (OWL restrictions
 * on edition year and authorship cardinality from RareBook's parents) AND
 * a `SoloAuthoredBook` (Compose.cardinality(authors, 1)). Multi-parent
 * `subClassOf` records both class memberships in a single declaration; the
 * emitted `allOf` carries one `$ref` per parent followed by the body
 * block, and the OWL TBox emits two `rdfs:subClassOf` triples.
 *
 * Demonstrates:
 *   - `Compose.subClassOf([parentA, parentB], body)` — multi-parent shape
 *   - Class membership in two sibling restriction chains
 *   - $ref to an authoring-context primitive (`AuthorName`) for the
 *     signature attribution.
 */

export const SignedFirstEditionSchema = Compose.subClassOf(
  [
    RareBookSchema,
    SoloAuthoredBookSchema
  ],
  {
    '$id': 'urn:bookstore:SignedFirstEdition',
    'properties': {
      'provenance': {
        'minLength': 1,
        'type': 'string'
      },
      'signedBy': { '$ref': AuthorNameSchema.$id }
    },
    'required': ['signedBy'],
    'type': 'object'
  } as const
);
