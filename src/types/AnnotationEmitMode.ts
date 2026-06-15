/**
 * Controls how annotation quads are emitted when projecting annotated edges
 * to RDF.
 *
 * - `'star-only'` (default): annotations are emitted as RDF 1.2 triple-term
 *   (RDF-star) quads whose subject is the quoted base triple `<< s p o >>`.
 *   Round-trips losslessly via `fromQuads`.
 * - `'flat-only'`: annotations are emitted as plain flat triples
 *   `<subject> <annotationPredicate> <value>`. Suitable for SPARQL/SHACL
 *   consumers that do not support RDF-star. **Round-trip note:** `fromQuads`
 *   reconstructs annotations only when the star form (triple-term subjects)
 *   is present in the quad set; with `flat-only` output the annotation
 *   structure is not recoverable via `fromQuads` — lifted instances carry
 *   an empty `annotations` object.
 * - `'both'`: emits both the flat triples and the RDF-star annotation quads.
 *   Round-trips losslessly via `fromQuads` (the star form is present).
 */
export type AnnotationEmitModeType = 'both' | 'flat-only' | 'star-only';
