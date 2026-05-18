/**
 * OWL and RDFS CURIE constants used by the canonical graph.
 *
 * The constants in src/constants/IRI.ts carry the prefixed (CURIE) form;
 * the prefix map declared on the OntologyBuilder expands them to full IRIs
 * at serialization time. Importing them directly lets consumers reference
 * the same property identifiers used by the TBox projection.
 */

import {
  OWL, RDFS
} from '../../../src/constants/IRI.js';

const curies: Record<string, string> = {
  'AsymmetricProperty': OWL.AsymmetricProperty,
  'FunctionalProperty': OWL.FunctionalProperty,
  'InverseFunctionalProperty': OWL.InverseFunctionalProperty,
  'IrreflexiveProperty': OWL.IrreflexiveProperty,
  'ReflexiveProperty': OWL.ReflexiveProperty,
  'subPropertyOf': RDFS.subPropertyOf,
  'SymmetricProperty': OWL.SymmetricProperty,
  'TransitiveProperty': OWL.TransitiveProperty
};

for (const [
  name,
  curie
] of Object.entries(curies)) {
  const expected = name.startsWith('subProperty') ? 'rdfs:' : 'owl:';

  console.assert(curie.startsWith(expected), `${name} carries ${expected} prefix: ${curie}`);
}
