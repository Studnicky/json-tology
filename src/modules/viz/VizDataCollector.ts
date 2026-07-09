import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistryInterface.js';
import type {
  VizEdgeType, VizNodeType, VizPayloadType, VizSchemaDataType
} from '../../types/Viz.js';
import { GraphOntologySerializer } from '../ontology/GraphOntologySerializer.js';
import { GraphSchemaSerializer } from '../ontology/GraphSchemaSerializer.js';
import { GraphShaclSerializer } from '../ontology/GraphShaclSerializer.js';
import { RDFS } from '../../constants/IRI.js';
import { TypeStringEmitter } from './TypeStringEmitter.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';

/**
 * Collects visualization data — nodes, edges, and per-schema serializations — from a
 * registered schema set and projects them into a {@link VizPayloadType}.
 *
 * @remarks
 * Each registered graph becomes one node in the visualization. Cross-schema `$ref`
 * relations that resolve to another registered schema become directed edges.
 * Per-schema data includes the raw JSON Schema, OWL quads, SHACL quads, and a
 * TypeScript type-string representation.
 *
 * @example
 * ```ts
 * const collector = new VizDataCollector(registry);
 * const payload = collector.collect();
 * ```
 *
 * @category Viz
 * @since 0.16.0
 * @see {@link VizPayloadType}
 * @group Classes
 */
export class VizDataCollector {
  /**
   * Derive a human-readable edge label from a `$ref` relation's source pointer.
   * Array-container keywords (`items`, `prefixItems`, `additionalItems`) are
   * skipped in favour of the enclosing property name.
   */
  static resolveEdgeLabel(pointer: string): string {
    const parts = pointer.split('/');
    const last = parts.at(-1) ?? '';
    const isArrayKeyword = last === 'items' || last === 'prefixItems' || last === 'additionalItems';

    return isArrayKeyword ? (parts.at(-2) ?? last) : last;
  }

  private readonly registry: SchemaRegistryInterface;

  constructor(registry: SchemaRegistryInterface) {
    this.registry = registry;
  }

  public collect(): VizPayloadType {
    const graphs = this.registry.listGraphs();
    const registeredIds = new Set(this.registry.list().map((schema: Record<string, unknown>): string => {
      const result = schema.$id as string;

      return result;
    }));

    const nodes: VizNodeType[] = [];
    const edges: VizEdgeType[] = [];
    const schemas: VizSchemaDataType[] = [];

    const { curie } = this.registry;

    for (const graph of graphs) {
      const rootNode = graph.rootNode;
      const sem = graph.semantics(rootNode);
      const schemaId = sem.schemaId ?? '';
      const label = curie === undefined ? labelFromId(schemaId) : curie.compact(schemaId);

      nodes.push({
        'id': schemaId,
        'label': label,
        'propertyCount': sem.properties.size,
        'schemaTypes': sem.schemaTypes
      });

      for (const edge of collectEdges(graph, schemaId, registeredIds)) {
        edges.push(edge);
      }

      schemas.push(collectSchemaData(graph, schemaId));
    }

    return {
      edges,
      nodes,
      schemas
    };
  }
}

function collectEdges(
  graph: SchemaGraphInterface,
  schemaId: string,
  registeredIds: Set<string>
): VizEdgeType[] {
  const result: VizEdgeType[] = [];

  for (const rel of graph.allRelations()) {
    if (rel.predicate !== RDFS.range) {
      continue;
    }
    if (rel.metadata?.fromRef !== true) {
      continue;
    }
    if (typeof rel.target !== 'string') {
      continue;
    }
    if (!registeredIds.has(rel.target)) {
      continue;
    }

    result.push({
      'label': VizDataCollector.resolveEdgeLabel(rel.source.pointer),
      'source': schemaId,
      'target': rel.target
    });
  }

  return result;
}

function collectSchemaData(graph: SchemaGraphInterface, schemaId: string): VizSchemaDataType {
  const emitter = new TypeStringEmitter(graph);
  const schemaSerializer = new GraphSchemaSerializer();
  const owlSerializer = new GraphOntologySerializer();
  const shaclSerializer = new GraphShaclSerializer();

  return {
    'id': schemaId,
    'jsonSchema': schemaSerializer.serialize(graph),
    'owl': owlSerializer.serializeQuads([graph]),
    'shacl': shaclSerializer.serializeQuads([graph]),
    'typescript': emitter.emit()
  };
}

function labelFromId(schemaId: string): string {
  try {
    const url = new URL(schemaId);
    const segments = url.pathname.split('/').filter(Boolean);

    return segments.at(-1) ?? schemaId;
  } catch {
    const segments = schemaId.split('/').filter(Boolean);

    return segments.at(-1) ?? schemaId;
  }
}
