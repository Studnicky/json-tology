import type { QuadInterface } from '../interfaces/QuadInterface.js';

/**
 * Index of annotation quads (RDF 1.2 triple-term subjects), keyed by the
 * quoted inner triple `s p o`. Each entry holds the annotation quads
 * whose subject is that triple term.
 */
export type TripleTermIndexType = Map<string, QuadInterface[]>;
