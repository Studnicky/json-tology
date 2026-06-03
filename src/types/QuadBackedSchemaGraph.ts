/**
 * Return types for the QuadBackedSchemaGraph implementation.
 *
 * Every helper in QuadBackedSchemaGraph that returns a structured value
 * uses a named type declared here so the return-type naming rule is satisfied.
 *
 * @category Graph
 * @since 0.18.0
 * @group Graph
 */

import type {
  ListItemType,
  SchemaGraphNodeInterface,
  SchemaGraphRelationInterface
} from '../interfaces/SchemaGraph.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { SubjectIndexType } from '../interfaces/OwlImport.js';


/**
 * Named return type for {@link buildExpansionMap}.
 *
 * Maps full-IRI prefixes to their `prefix:` compact form, used for IRI
 * compaction throughout the quad-backed graph.
 *
 * @remarks
 * Built once from `STANDARD_PREFIXES` merged with caller-supplied prefixes.
 *
 * @example
 * ```ts
 * const map: ExpansionMapType = buildExpansionMap(prefixes);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type ExpansionMapType = Map<string, string>;

/**
 * Named return type for {@link buildPredicateIndex}.
 *
 * Groups quads by subject IRI then by predicate IRI.
 *
 * @remarks
 * Used by `buildNodeMap` and `buildRelations` for O(1) predicate lookup
 * within a given subject's quad set.
 *
 * @example
 * ```ts
 * const idx: PredicateIndexType = buildPredicateIndex(subjectIndex);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type PredicateIndexType = Map<string, Map<string, QuadInterface[]>>;

/**
 * Named return type for {@link buildNodeMap}.
 *
 * Maps subject IRIs to their corresponding stub `SchemaGraphNodeInterface`
 * objects for all recognised OWL-typed subjects.
 *
 * @remarks
 * Only subjects with a recognised OWL type assertion appear as entries.
 * Blank nodes and ontology-declaration-only subjects are indexed but not
 * exposed as primary nodes.
 *
 * @example
 * ```ts
 * const nodes: NodeMapType = buildNodeMap(subjectIndex, predicateIndex, expansionMap);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type NodeMapType = Map<string, SchemaGraphNodeInterface>;

/**
 * Named return type for {@link literalTagsForQuad}.
 *
 * The optional `termType`, `language`, and `datatype` annotations that travel
 * alongside a relation when its source quad's object is a Literal, BlankNode,
 * or NamedNode.
 *
 * @remarks
 * All three fields are optional: `Quad` and `Variable` objects produce an
 * empty object; `NamedNode` produces only `termType`; `Literal` produces all
 * three.
 *
 * @example
 * ```ts
 * const tags: LiteralTagsType = literalTagsForQuad(quad);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface LiteralTagsType {
  readonly 'datatype'?: string;
  readonly 'language'?: string;
  readonly 'termType'?: 'BlankNode' | 'Literal' | 'NamedNode';
}

/**
 * Named return type for the optional result of {@link resolveRestrictionBnode}.
 *
 * Either a resolved `RestrictionResultType` when the blank node is a valid
 * OWL restriction, or undefined when it is not.
 *
 * @remarks
 * Undefined is returned when the bnode has no predicate map, is not typed
 * as `owl:Restriction`, has no `owl:onProperty`, or has no recognised
 * constraint predicate.
 *
 * @example
 * ```ts
 * const result: OptionalRestrictionType = resolveRestrictionBnode(opts);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type OptionalRestrictionType = RestrictionResultType | undefined;

/**
 * Named return type for the `child` method and similar optional-node lookups.
 *
 * Either a resolved `SchemaGraphNodeInterface` or undefined when no such
 * child exists.
 *
 * @remarks
 * For quad-backed graphs, `child` always returns undefined since child
 * resolution is done via `allRelations()`.
 *
 * @example
 * ```ts
 * const c: OptionalChildNodeType = graph.child(node, 'not');
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type OptionalChildNodeType = SchemaGraphNodeInterface | undefined;

/**
 * Named return type for {@link resolveRestrictionBnode}.
 *
 * The resolved restriction structure, target IRI, and metadata for a blank
 * node that carries an OWL restriction shape.
 *
 * @remarks
 * Returned when a blank node is typed as `owl:Restriction` and has both
 * `owl:onProperty` and a recognised constraint predicate.
 *
 * @example
 * ```ts
 * const result: RestrictionResultType = resolveRestrictionBnode(opts);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface RestrictionResultType {
  readonly 'metadata': Record<string, unknown>;
  readonly 'structure': {
    readonly 'constraint': string;
    readonly 'kind': 'restriction';
    readonly 'onProperty': string;
    readonly 'value': unknown;
  };
  readonly 'targetIri': string;
}

/**
 * Named return type for {@link collectList} (the public class method).
 *
 * An immutable list of typed term descriptors for each item in an RDF list
 * starting at the given head IRI or blank-node ID.
 *
 * @remarks
 * Each item carries its `termType` and any associated `datatype`/`language`
 * annotations for Literal terms.
 *
 * @example
 * ```ts
 * const items: CollectedListType = graph.collectList(headIri);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type CollectedListType = readonly ListItemType[];

/**
 * Named return type for {@link entries} (the public class method).
 *
 * An ordered array of `[key, SchemaGraphNodeInterface]` pairs for a given
 * schema node and keyword.
 *
 * @remarks
 * Returns an empty array for quad-backed graphs since entry traversal is
 * done via `allRelations()` by dispatchers, not via keyword look-up.
 *
 * @example
 * ```ts
 * const pairs: NodeEntriesType = graph.entries(node, 'properties');
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type NodeEntriesType = Array<[string, SchemaGraphNodeInterface]>;

/**
 * Named return type for {@link node} (the public class method).
 *
 * The `SchemaGraphNodeInterface` whose schema carries the given `$id`, or
 * undefined when no such node exists in the graph.
 *
 * @remarks
 * Looks up by `schema.$id` in the internal node map.
 *
 * @example
 * ```ts
 * const n: OptionalNodeType = graph.node({ $id: 'https://example.com/Foo' });
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type OptionalNodeType = SchemaGraphNodeInterface | undefined;

/**
 * Named return type for {@link relationsForSubject}.
 *
 * An immutable ordered list of all outgoing relations from a given subject IRI.
 *
 * @remarks
 * The first call builds a lazy index; subsequent calls return from that cache.
 *
 * @example
 * ```ts
 * const rels: SubjectRelationsType = graph.relationsForSubject(subjectIri);
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type SubjectRelationsType = readonly SchemaGraphRelationInterface[];

/**
 * Named return type for {@link rootSchema} (the getter).
 *
 * The root schema stub record carried by the graph.
 *
 * @remarks
 * Contains `{ $id: baseIRI }` so callers can inspect the base IRI without
 * needing a full schema object.
 *
 * @example
 * ```ts
 * const root: RootSchemaRecordType = graph.rootSchema;
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export type RootSchemaRecordType = Record<string, unknown>;

/**
 * Options for {@link buildRelations}.
 *
 * @remarks
 * Bundles the parameters needed to build the full relation list from a
 * predicate index, satisfying the 3-parameter limit.
 *
 * @example
 * ```ts
 * buildRelations({ nodeMap, predicateIndex, subjectIndex, expansionMap, stubMap });
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface BuildRelationsOptionsInterface {
  readonly 'expansionMap': ExpansionMapType;
  readonly 'nodeMap': Map<string, SchemaGraphNodeInterface>;
  readonly 'predicateIndex': PredicateIndexType;
  readonly 'stubMap': Map<string, SchemaGraphNodeInterface>;
  readonly 'subjectIndex': SubjectIndexType;
}

/**
 * Options for {@link resolveRestrictionBnode}.
 *
 * @remarks
 * Bundles the parameters needed to resolve a restriction blank node, satisfying
 * the 3-parameter limit.
 *
 * @example
 * ```ts
 * resolveRestrictionBnode({ bnodeId, bnodePredicateMap, expansionMap });
 * ```
 *
 * @category Graph
 * @since 0.18.0
 * @see {@link QuadBackedSchemaGraph}
 * @group Graph
 */
export interface ResolveRestrictionOptionsInterface {
  readonly 'bnodeId': string;
  readonly 'bnodePredicateMap': Map<string, QuadInterface[]> | undefined;
  readonly 'expansionMap': ExpansionMapType;
}

export { type SubjectIndexType } from '../interfaces/OwlImport.js';
