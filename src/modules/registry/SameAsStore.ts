/**
 * SameAsStore — per-registry store recording `owl:sameAs` assertions
 * between individuals (ABox-level identity).
 *
 * Records pairs of instance IRIs declared as identical. Emitted at
 * `toQuads()` time as a pair of symmetric quads:
 *
 *   <A> owl:sameAs <B>
 *   <B> owl:sameAs <A>
 *
 * `owl:sameAs` is symmetric by definition, but emitting both directions
 * sidesteps reasoner divergence — every reasoner sees both edges directly
 * without relying on its own symmetry inference.
 *
 * **Blank-node trade-off:** blank-node subjects (e.g. `_:b0`) are transient
 * identifiers scoped to a single serialization call. Recording a blank-node
 * IRI here has no persistent meaning — the same blank node will get a
 * different identifier on the next `toQuads()` call. Only use `sameAs` with
 * stable named-node IRIs. Blank-node subjects silently produce quads that
 * are meaningless to any reasoner that sees them across serialization
 * boundaries.
 *
 * Distinct from `Compose.equivalent` (which is `owl:equivalentClass`,
 * a TBox/class-level construct).
 */

import type { SameAsStoreInterface } from '../../interfaces/SameAsStoreInterface.js';
import { SymmetricPairStore } from '../data/SymmetricPairStore.js';

export class SameAsStore extends SymmetricPairStore implements SameAsStoreInterface {}
