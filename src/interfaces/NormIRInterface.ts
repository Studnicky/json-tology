import type { JsonSchemaType } from '../types/Schema.js';
import type { NormIRNodeEntity } from '../entities/NormIRNodeEntity.js';

/**
 * Normalized intermediate representation of a fully traversed schema document.
 *
 * @remarks
 * Produced during the graph-build phase by walking all reachable subschemas in
 * a registered schema document. Captures the complete structural index used
 * to construct the canonical graph:
 * - `nodes` — all reachable subschema nodes.
 * - `children` — direct child nodes keyed by parent IRI and child keyword.
 * - `indexedChildren` — array-valued children (e.g. `allOf`, `oneOf` members).
 * - `entries` — tuple-valued children (e.g. `properties` entries as `[key, nodeId]` pairs).
 * - `anchors` — `$anchor` / `$recursiveAnchor` map from anchor name to node IRI.
 * - `rootSchema` — the original schema document that was traversed.
 *
 * @example
 * ```ts
 * const ir = graph.getNormIR();
 * const childId = ir.children['https://example.com/User']?.['properties/name'];
 * ```
 *
 * @category SchemaGraph
 * @since 0.1.0
 * @see {@link NormIRNodeEntity}
 * @group SchemaGraph
 */
export interface NormIRInterface {
  'anchors': Record<string, string>;
  'children': Record<string, Record<string, string>>;
  'entries': Record<string, Record<string, Array<[string, string]>>>;
  'indexedChildren': Record<string, Record<string, string[]>>;
  'nodes': NormIRNodeEntity.Type[];
  'rootSchema': JsonSchemaType;
}
