import type { ResolvedReferenceTargetNoGraphInterface } from '../interfaces/ResolvedReferenceTargetNoGraphInterface.js';
import type { ResolvedReferenceTargetWithGraphInterface } from '../interfaces/ResolvedReferenceTargetWithGraphInterface.js';

/**
 * Discriminated union of resolved `$ref` target states.
 *
 * Stored in a `WeakMap` keyed on the source node so the resolution work
 * (parseReference → resolveSchemaId → getSchema → getGraph → resolveFragment)
 * executes at most once per source node per graph instance.
 *
 * `null` is the sentinel for an unresolvable ref — stored explicitly so
 * a missing schema is not re-probed on every value walk.
 *
 * A TypeScript `interface` cannot express a union, so the two resolved-target
 * shapes are declared as interfaces (`ResolvedReferenceTargetWithGraphInterface`,
 * `ResolvedReferenceTargetNoGraphInterface`) and combined here as a plain
 * reference union — no inline object shape of its own.
 */
export type ResolvedReferenceTargetType = ResolvedReferenceTargetNoGraphInterface | ResolvedReferenceTargetWithGraphInterface;
