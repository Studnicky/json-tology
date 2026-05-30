/**
 * Compose.equivalent — Example 3: OWL equivalence in the emitted TBox
 *
 * `Compose.equivalent` emits `owl:equivalentClass` between the source
 * and alias `$id`. The TBox carries both classes; a reasoner can fold
 * facts from one onto the other.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  IsbnSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, { '$id': 'https://bookstore.example/PrimaryIsbn' } as const);

jt.set(PrimaryIsbnSchema);

const tbox = JSON.parse(jt.toTbox().jsonLd()) as {
  '@graph'?: ReadonlyArray<Record<string, unknown>>;
};

// The PrimaryIsbn node appears in the TBox graph, linked to Isbn via
// owl:equivalentClass.
const graph = tbox['@graph'] ?? [];
const primaryNode = graph.find((node) => {
  return node['@id'] === 'https://bookstore.example/PrimaryIsbn';
});

console.assert(primaryNode !== undefined);
console.log('PrimaryIsbn node in TBox:', primaryNode?.['@id']);
console.log('equivalentClass:', primaryNode?.['owl:equivalentClass']);
