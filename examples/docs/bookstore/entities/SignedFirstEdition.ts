import { Compose } from '../../../../src/index.js';
import { AuthorNameSchema } from './AuthorName.js';
import { RareBookSchema } from './RareBook.js';

/**
 * SignedFirstEdition — a RareBook signed by its sole author.
 *
 * Single-parent `subClassOf(RareBook)`: structurally adds `signedBy` and
 * `provenance`. The "exactly one author" axiom is enforced by the
 * registered invariant `signedFirstEditionIsSoloAuthored` (in
 * `index.ts`), which fires on every `validate()` / `instantiate()` and
 * surfaces in `ValidationErrors` with `keyword: 'jt:invariant'` — same
 * collection shape as structural errors. This is how json-tology
 * augments TypeScript: cross-field rules ride alongside the schema and
 * are projected through type inference, rather than left to ad-hoc
 * runtime helpers.
 *
 * Demonstrates:
 *   - `Compose.subClassOf(parent, body)` — single-parent shape
 *   - `$ref` to `AuthorName` for the signature attribution
 *   - `$ref` to `Provenance` for the custody trail (strict-graph compliant)
 *   - Pairing an OWL subclass declaration with a registered invariant
 *     for the rule TypeScript / JSON Schema can't express structurally.
 */

export const SignedFirstEditionSchema = Compose.subClassOf(
  RareBookSchema,
  {
    '$id': 'urn:bookstore:SignedFirstEdition',
    'properties': {
      'provenance': { '$ref': 'urn:bookstore:Provenance' },
      'signedBy': { '$ref': AuthorNameSchema.$id }
    },
    'required': ['signedBy'],
    'type': 'object'
  } as const
);
