/**
 * AnnotationAccumulator — per-entity annotation accumulator populated during
 * the Annotations dispatcher graph traversal, before values are written into
 * schemaDeltas.
 */

export interface AnnotationAccumulator {
  /** Language-tagged alt labels: lang → string[]. */
  'altLabels': Map<string, string[]>;
  /** Language-tagged comments: lang → string[]. */
  'comments': Map<string, string[]>;
  /** `deprecated` flag, set when any owl:deprecated true literal is found. */
  'deprecated': boolean;
  /** rdfs:isDefinedBy IRI values. */
  'isDefinedBy': string[];
  /** Language-tagged labels: lang → string[]. */
  'labels': Map<string, string[]>;
  /** rdfs:seeAlso IRI values. */
  'seeAlso': string[];
  /** owl:versionInfo string values. */
  'versionInfo': string[];
}
