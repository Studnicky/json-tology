import type { JsonSchemaType } from '../types/Schema.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * A single node in the canonical schema graph.
 *
 * @remarks
 * Represents any addressable subschema — the root schema, a named `$defs`
 * entry, an inline `properties` value, a composition branch, or any other
 * reachable JSON Schema object. The `id` is the absolute IRI computed during
 * traversal; `pointer` is the JSON Pointer relative to the root document;
 * `schema` is the raw JSON Schema object at that location.
 *
 * Graph operations (validation, semantics extraction, relation indexing) all
 * accept and return `SchemaGraphNodeInterface` to ensure traversal stays
 * within the canonical node set.
 *
 * @example
 * ```ts
 * const node = graph.node(schema);
 * if (node) {
 *   const semantics = graph.semantics(node);
 * }
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link SchemaGraphSemanticsInterface}
 * @group SchemaGraph
 */
export interface SchemaGraphNodeInterface {
  'id': StringValueEntity.Type;
  'pointer': StringValueEntity.Type;
  'schema': JsonSchemaType;
}
