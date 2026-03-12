import type { SchemaGraphNodeInterface, SchemaGraphSemanticsInterface } from '../../interfaces/schema-graph.js';
import { resolveXsdType } from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { BaseSerializer } from './BaseSerializer.js';

export class GraphShaclSerializer extends BaseSerializer {
  public serialize(graphs: ReadonlyArray<SchemaGraph>): unknown[] {
    const shapes: unknown[] = [];

    for (const graph of graphs) {
      this.serializeGraph(graph, shapes);
    }

    return shapes;
  }

  private serializeGraph(graph: SchemaGraph, shapes: unknown[]): void {
    for (const node of graph.nodes()) {
      const semantics = graph.semantics(node);

      if (!this.isSerializationCandidate(node, semantics)) {
        continue;
      }

      shapes.push(this.emitNodeShape(graph, node, semantics));
    }
  }

  private emitNodeShape(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    semantics: SchemaGraphSemanticsInterface
  ): Record<string, unknown> {
    const relations = graph.relations(node);

    const shape: Record<string, unknown> = {
      '@id': node.id,
      '@type': 'sh:NodeShape'
    };

    if (semantics.description !== undefined) {
      shape['sh:description'] = semantics.description;
    }

    // sh:closed
    if (semantics.additionalPropertiesNode === false) {
      shape['sh:closed'] = true;
    }

    // sh:property
    const propertyShapes = this.emitPropertyShapes(graph, node, semantics);

    if (propertyShapes.length > 0) {
      shape['sh:property'] = propertyShapes;
    }

    // sh:and from rdfs:subClassOf relations
    const subClassRels = relations.filter((r) => r.predicate === 'rdfs:subClassOf');

    if (subClassRels.length > 0) {
      shape['sh:and'] = {
        '@list': subClassRels.map((r) => ({ '@id': this.relationTargetId(r) }))
      };
    }

    // sh:or from owl:equivalentClass relations (union members)
    const equivRels = relations.filter((r) => r.predicate === 'owl:equivalentClass');

    if (equivRels.length > 0) {
      shape['sh:or'] = {
        '@list': equivRels.map((r) => this.relationTargetRef(graph, r))
      };
    }

    // sh:not from owl:complementOf
    const complementRel = relations.find((r) => r.predicate === 'owl:complementOf');

    if (complementRel !== undefined) {
      shape['sh:not'] = this.relationTargetRef(graph, complementRel);
    }

    // sh:disjoint (SHACL-AF) from owl:disjointWith
    const disjointRel = relations.find((r) => r.predicate === 'owl:disjointWith');

    if (disjointRel !== undefined) {
      shape['sh:not'] = shape['sh:not'] ?? { '@id': this.relationTargetId(disjointRel) };
    }

    // sh:in from enum
    if (semantics.enumValues !== undefined) {
      shape['sh:in'] = {
        '@list': semantics.enumValues
      };
    }

    return shape;
  }

  private emitPropertyShapes(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    semantics: SchemaGraphSemanticsInterface
  ): Record<string, unknown>[] {
    const requiredSet = new Set(semantics.required);
    const shapes: Record<string, unknown>[] = [];

    for (const [propName, propNode] of semantics.properties) {
      const propSemantics = graph.semantics(propNode);
      const propRelations = graph.relations(propNode);

      // Domain from relations, fallback to parent node
      const domainRel = propRelations.find((r) => r.predicate === 'rdfs:domain');
      const domainId = domainRel !== undefined
        ? this.relationTargetId(domainRel)
        : node.id;

      const ps: Record<string, unknown> = {
        '@type': 'sh:PropertyShape',
        'sh:path': { '@id': this.propertyIri(domainId, propName) }
      };

      // datatype
      const xsd = resolveXsdType(propSemantics);

      if (xsd !== null && propSemantics.ref === undefined) {
        ps['sh:datatype'] = { '@id': xsd };
      }

      // required
      if (requiredSet.has(propName)) {
        ps['sh:minCount'] = 1;
      }

      // non-array → maxCount 1
      const isArray = propSemantics.schemaTypes.includes('array');

      if (!isArray) {
        ps['sh:maxCount'] = 1;
      }

      // rdfs:range → sh:class (from relations)
      const rangeRel = propRelations.find((r) => r.predicate === 'rdfs:range');

      if (rangeRel !== undefined) {
        ps['sh:class'] = { '@id': this.relationTargetId(rangeRel) };
      } else if (propSemantics.ref !== undefined) {
        // $ref → sh:node
        ps['sh:node'] = { '@id': graph.resolveRefId(propSemantics.ref) };
      }

      // string constraints
      if (propSemantics.pattern !== undefined) {
        ps['sh:pattern'] = propSemantics.pattern;
      }
      if (propSemantics.minLength !== undefined) {
        ps['sh:minLength'] = propSemantics.minLength;
      }
      if (propSemantics.maxLength !== undefined) {
        ps['sh:maxLength'] = propSemantics.maxLength;
      }

      // numeric constraints
      if (propSemantics.minimum !== undefined) {
        ps['sh:minInclusive'] = propSemantics.minimum;
      }
      if (propSemantics.maximum !== undefined) {
        ps['sh:maxInclusive'] = propSemantics.maximum;
      }
      if (propSemantics.exclusiveMinimum !== undefined) {
        ps['sh:minExclusive'] = propSemantics.exclusiveMinimum;
      }
      if (propSemantics.exclusiveMaximum !== undefined) {
        ps['sh:maxExclusive'] = propSemantics.exclusiveMaximum;
      }

      // description
      if (propSemantics.description !== undefined) {
        ps['sh:description'] = propSemantics.description;
      }

      shapes.push(ps);
    }

    return shapes;
  }
}
