/**
 * OWL and RDFS IRI constants used by the canonical graph.
 *
 * The constants in src/constants/IRI.ts carry full absolute IRIs in the
 * standard OWL and RDFS namespaces. Importing them directly lets consumers
 * reference the same property identifiers used by the TBox projection.
 */

import {
  OWL, RDFS
} from '../../../src/constants/IRI.js';

const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';

const iris: Record<string, string> = {
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
  iri
] of Object.entries(iris)) {
  const expectedNs = name.startsWith('subProperty') ? RDFS_NS : OWL_NS;

  console.assert(iri.startsWith(expectedNs), `${name} is in ${expectedNs} namespace: ${iri}`);
}

console.log('OWL.SymmetricProperty:', OWL.SymmetricProperty);
console.log('OWL.TransitiveProperty:', OWL.TransitiveProperty);
console.log('RDFS.subPropertyOf:', RDFS.subPropertyOf);
