import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * The resolved restriction structure, target IRI, and metadata for a blank
 * node that carries an OWL restriction shape.
 *
 * @remarks
 * Returned when a blank node is typed as `owl:Restriction` and has both
 * `owl:onProperty` and a recognised constraint predicate.
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface RestrictionResultInterface {
  'metadata': Record<string, unknown>;
  'structure': {
    'constraint': string;
    'kind': 'restriction';
    'onProperty': string;
    'value': unknown;
  };
  'targetIri': StringValueEntity.Type;
}
