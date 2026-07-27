/**
 * DifferentFromStore — per-registry store recording `owl:differentFrom` assertions
 * between individuals (ABox-level distinctness).
 *
 * Records pairs of instance IRIs declared as distinct. Used by
 * `SchemaRegistry.assertIdentityConsistency()` to detect contradictions
 * with transitive owl:sameAs closures.
 *
 * `add(a, b)` is idempotent (canonical-order dedup) and self-drops self-pairs.
 */

import type { DifferentFromStoreInterface } from '../../interfaces/DifferentFromStoreInterface.js';
import { SymmetricPairStore } from '../data/SymmetricPairStore.js';

export class DifferentFromStore extends SymmetricPairStore implements DifferentFromStoreInterface {}
