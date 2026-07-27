import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type {
  RelationPredicateType, RelationStructureType
} from '../types/SchemaGraph.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { RdfTermKindEntity } from '../entities/RdfTermKindEntity.js';

/**
 * A directed edge in the canonical schema graph connecting a source node to a
 * target via a named predicate.
 *
 * @remarks
 * Relations are the primary query surface for ontology serializers,
 * materialization logic, and graph traversal utilities. Each relation carries
 * the predicate IRI (e.g. `rdfs:subClassOf`, `rdf:type`, an annotation
 * property IRI), source and target nodes or literal IRIs, and optional metadata
 * such as RDF term-type, XSD datatype, and BCP47 language tag.
 *
 * The `structure` field records how the relation was derived (e.g. from an
 * `allOf` member, a `$ref`, a composition operator) to support downstream
 * consumers that need to distinguish structural from semantic edges.
 *
 * @example
 * ```ts
 * for (const rel of graph.allRelations()) {
 *   if (rel.predicate === 'rdfs:subClassOf') {
 *     console.log(rel.source.id, '->', rel.target);
 *   }
 * }
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link SchemaGraphNodeInterface}
 * @group SchemaGraph
 */
export interface SchemaGraphRelationInterface {
  /**
   * XSD datatype IRI when `target` is a Literal — empty / undefined for
   * NamedNode or BlankNode targets. Populated by the quad-backed graph from
   * the source quad's `object.datatype.value`; the forward-projection graph
   * leaves it undefined because datatype is computed at projection time.
   */
  'datatype'?: StringValueEntity.Type;
  /**
   * BCP47 language tag when `target` is a language-tagged Literal — empty /
   * undefined otherwise. Populated by the quad-backed graph from the source
   * quad's `object.language`.
   */
  'language'?: StringValueEntity.Type;
  'metadata'?: Record<string, unknown>;
  /**
   * `RelationPredicateType` carries a documented `@studnicky/type-alias-invariants`
   * exception (open `(string & {})` union with no schema-derived equivalent — see
   * its own declaration in `src/types/SchemaGraph.ts`), so referencing it here has
   * no named-entity remedy either: `@studnicky/interfaces-compose-named-types`
   * flags this member for the same underlying reason. Documented exception.
   */
  'predicate': RelationPredicateType;
  'source': SchemaGraphNodeInterface;
  'structure'?: RelationStructureType;
  'target': SchemaGraphNodeInterface | string;
  /**
   * rdf/js term-type discriminator for the relation's target. Populated by
   * the quad-backed graph during construction; left undefined by the
   * forward-projection graph (whose targets are always graph nodes or IRIs).
   */
  'termType'?: RdfTermKindEntity.Type;
}
