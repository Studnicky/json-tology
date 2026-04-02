/** Collects visualization data from a schema registry. */
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import type {
  VizEdgeInterface, VizNodeInterface, VizPayloadInterface, VizSchemaDataInterface
} from '../../interfaces/Viz.js';
import { GraphOntologySerializer } from '../ontology/GraphOntologySerializer.js';
import { GraphSchemaSerializer } from '../ontology/graphSchemaSerializer.js';
import { GraphShaclSerializer } from '../ontology/GraphShaclSerializer.js';
import { TypeStringEmitter } from './typeStringEmitter.js';

export class VizDataCollector {
  private readonly registry: SchemaRegistryInterface;

  constructor(registry: SchemaRegistryInterface) {
    this.registry = registry;
  }

  public collect(): VizPayloadInterface {
    const graphs = this.registry.listGraphs();
    const registeredIds = new Set(this.registry.list().map((schema) => {
      return schema.$id as string;
    }));

    const nodes: VizNodeInterface[] = [];
    const edges: VizEdgeInterface[] = [];
    const schemas: VizSchemaDataInterface[] = [];

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

      for (const rel of graph.allRelations()) {
        if (rel.predicate === 'rdfs:range'
          && rel.metadata?.fromRef === true
          && typeof rel.target === 'string'
          && registeredIds.has(rel.target)) {
          const parts = rel.source.pointer.split('/');
          let propName = parts.at(-1) ?? '';

          if (propName === 'items' || propName === 'prefixItems' || propName === 'additionalItems') {
            propName = parts.at(-2) ?? propName;
          }

          edges.push({
            'label': propName,
            'source': schemaId,
            'target': rel.target
          });
        }
      }

      const emitter = new TypeStringEmitter(graph);
      const schemaSerializer = new GraphSchemaSerializer();
      const owlSerializer = new GraphOntologySerializer();
      const shaclSerializer = new GraphShaclSerializer();

      schemas.push({
        'id': schemaId,
        'jsonSchema': schemaSerializer.serialize(graph),
        'owl': owlSerializer.serialize([graph]),
        'shacl': shaclSerializer.serialize([graph]),
        'typescript': emitter.emit()
      });
    }

    return {
      edges,
      nodes,
      schemas
    };
  }
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
