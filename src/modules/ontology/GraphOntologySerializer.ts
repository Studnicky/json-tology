import type { SchemaGraphNodeInterface, SchemaGraphSemanticsInterface } from '../../interfaces/schema-graph.js';
import { resolveXsdType, resolveSingleXsdType } from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';
import { BaseSerializer } from './BaseSerializer.js';

function rdfList(items: unknown[]): Record<string, unknown[]> {
  return { '@list': items };
}

function typedLiteral(value: unknown): null | Record<string, unknown> {
  if (typeof value === 'string') {
    return {
      '@type': 'xsd:string',
      '@value': value
    };
  }
  if (typeof value === 'boolean') {
    return {
      '@type': 'xsd:boolean',
      '@value': value
    };
  }
  if (typeof value === 'number') {
    return {
      '@type': Number.isInteger(value) ? 'xsd:integer' : 'xsd:decimal',
      '@value': value
    };
  }

  return null;
}

export class GraphOntologySerializer extends BaseSerializer {
  public serialize(graphs: ReadonlyArray<SchemaGraph>): unknown[] {
    const nodes = new Map<string, Record<string, unknown>>();

    for (const graph of graphs) {
      for (const node of graph.nodes()) {
        this.serializeSchemaNode(graph, node, nodes);
      }
    }

    return [...nodes.values()];
  }

  private addNode(
    nodeMap: Map<string, Record<string, unknown>>,
    nextNode: Record<string, unknown>
  ): void {
    const id = nextNode['@id'];

    if (typeof id !== 'string') {
      return;
    }

    nodeMap.set(id, nextNode);
  }

  private classCandidate(graph: SchemaGraph, node: SchemaGraphNodeInterface): boolean {
    const semantics = graph.semantics(node);

    if (semantics.schemaTypes.length === 0
      && semantics.properties.length === 0
      && semantics.allOf.length === 0
      && semantics.anyOf.length === 0
      && semantics.oneOf.length === 0
      && semantics.notNode === undefined
      && semantics.enumValues === undefined
      && !semantics.hasConst
      && semantics.ref === undefined
      && semantics.ifNode === undefined
      && semantics.containsNode === undefined
      && semantics.prefixItems.length === 0
      && semantics.patternPropertyEntries.length === 0
      && semantics.dependentSchemaEntries.length === 0
      && node.pointer !== '') {
      return false;
    }

    return this.isSerializationCandidate(node, semantics)
      || semantics.ref !== undefined;
  }

  private resolvePropertyRange(graph: SchemaGraph, propSemantics: SchemaGraphSemanticsInterface): null | unknown {
    if (typeof propSemantics.ref === 'string') {
      return { '@id': graph.resolveRefId(propSemantics.ref) };
    }

    const xsdType = resolveXsdType(propSemantics);

    if (xsdType !== null) {
      return { '@id': xsdType };
    }

    return null;
  }

  private serializeClassNode(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    if (!this.classCandidate(graph, node)) {
      return;
    }

    const semantics = graph.semantics(node);
    const relations = graph.relations(node);

    const classNode: Record<string, unknown> = {
      '@id': node.id,
      '@type': 'owl:Class'
    };

    // rdfs:label from relations
    const labelRel = relations.find((r) => r.predicate === 'rdfs:label');

    if (labelRel !== undefined) {
      classNode['rdfs:label'] = labelRel.target;
    }

    // rdfs:comment from relations
    const commentRel = relations.find((r) => r.predicate === 'rdfs:comment');

    if (commentRel !== undefined) {
      classNode['rdfs:comment'] = commentRel.target;
    }

    // owl:deprecated from relations
    if (relations.some((r) => r.predicate === 'owl:deprecated')) {
      classNode['owl:deprecated'] = true;
    }

    const subClassOf: unknown[] = [];

    // rdfs:subClassOf from relations
    for (const rel of relations.filter((r) => r.predicate === 'rdfs:subClassOf')) {
      subClassOf.push({ '@id': this.relationTargetId(rel) });
    }

    // owl:equivalentClass from relations (union members)
    const equivRels = relations.filter((r) => r.predicate === 'owl:equivalentClass');

    if (equivRels.length > 0) {
      const branchIds = equivRels
        .map((r) => typeof r.target === 'string' ? r.target : this.namedNodeId(graph, r.target))
        .filter((id): id is string => typeof id === 'string');

      if (branchIds.length > 0) {
        classNode['owl:equivalentClass'] = {
          '@type': 'owl:Class',
          'owl:unionOf': rdfList(branchIds.map((id) => ({ '@id': id })))
        };
      }
    }

    // owl:complementOf from relations
    const complementRel = relations.find((r) => r.predicate === 'owl:complementOf');

    if (complementRel !== undefined) {
      const targetId = typeof complementRel.target === 'string'
        ? complementRel.target
        : this.namedNodeId(graph, complementRel.target);

      if (typeof targetId === 'string') {
        classNode['owl:complementOf'] = { '@id': targetId };
      }
    }

    // owl:disjointWith from relations
    const disjointRel = relations.find((r) => r.predicate === 'owl:disjointWith');

    if (disjointRel !== undefined) {
      classNode['owl:disjointWith'] = { '@id': this.relationTargetId(disjointRel) };
    }

    // owl:oneOf from enum values
    if (semantics.enumValues !== undefined) {
      const literals = semantics.enumValues.map((value) => {
        return typedLiteral(value);
      }).filter((value): value is Record<string, unknown> => {
        return value !== null;
      });

      if (literals.length > 0) {
        classNode['owl:oneOf'] = rdfList(literals);
      }
    }

    if (semantics.hasConst) {
      const literal = typedLiteral(semantics.constValue);

      if (literal !== null) {
        classNode['owl:oneOf'] = rdfList([literal]);
      }
    }

    // owl:Restriction from relations
    for (const rel of relations.filter((r) => r.predicate === 'owl:Restriction')) {
      subClassOf.push({
        '@type': 'owl:Restriction',
        'owl:minCardinality': rel.metadata?.minCardinality ?? 1,
        'owl:onProperty': { '@id': rel.metadata?.onProperty as string }
      });
    }

    if (subClassOf.length > 0) {
      classNode['rdfs:subClassOf'] = subClassOf;
    }

    this.addNode(nodeMap, classNode);
  }

  private serializePropertyNodes(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    const nodeSemantics = graph.semantics(node);

    if (nodeSemantics.properties.length === 0) {
      return;
    }

    for (const [propertyName, propertyNode] of graph.entries(node, 'properties')) {
      const propSemantics = graph.semantics(propertyNode);
      const propRelations = graph.relations(propertyNode);
      const schemaTypes = propSemantics.schemaTypes;

      const nonNullTypes = schemaTypes.filter((t) => t !== 'null');
      const primaryType = nonNullTypes.length > 0 ? nonNullTypes[0] : null;
      const isArray = primaryType === 'array';
      const isObjectProperty = isArray
        || primaryType === 'object'
        || typeof propSemantics.ref === 'string'
        || primaryType === null;

      // Domain from relations, fallback to parent node
      const domainRel = propRelations.find((r) => r.predicate === 'rdfs:domain');
      const domainId = domainRel !== undefined
        ? this.relationTargetId(domainRel)
        : node.id;

      const rdfTypes: string[] = [isObjectProperty ? 'owl:ObjectProperty' : 'owl:DatatypeProperty'];

      // Transitive/Symmetric from relations
      if (propRelations.some((r) => r.predicate === 'owl:TransitiveProperty')) {
        rdfTypes.push('owl:TransitiveProperty');
      }
      if (propRelations.some((r) => r.predicate === 'owl:SymmetricProperty')) {
        rdfTypes.push('owl:SymmetricProperty');
      }

      const propertyGraphNode: Record<string, unknown> = {
        '@id': this.propertyIri(node.id, propertyName),
        '@type': rdfTypes.length === 1 ? rdfTypes[0] : rdfTypes,
        'rdfs:domain': { '@id': domainId }
      };

      // Range from relations
      const rangeRel = propRelations.find((r) => r.predicate === 'rdfs:range');

      if (isArray) {
        propertyGraphNode['rdfs:range'] = { '@id': 'rdf:List' };

        if (rangeRel !== undefined) {
          propertyGraphNode['jt:itemType'] = { '@id': this.relationTargetId(rangeRel) };
        } else {
          const itemsNode = propSemantics.itemsNode;

          if (itemsNode !== undefined) {
            const itemSemantics = graph.semantics(itemsNode);

            if (typeof itemSemantics.ref === 'string') {
              propertyGraphNode['jt:itemType'] = { '@id': graph.resolveRefId(itemSemantics.ref) };
            } else if (itemsNode.id !== itemsNode.pointer || itemsNode.pointer !== '') {
              propertyGraphNode['jt:itemType'] = { '@id': itemsNode.id };
            } else {
              const itemXsd = resolveXsdType(itemSemantics);

              if (itemXsd !== null) {
                propertyGraphNode['jt:itemType'] = { '@id': itemXsd };
              }
            }
          }
        }
      } else if (rangeRel !== undefined) {
        propertyGraphNode['rdfs:range'] = { '@id': this.relationTargetId(rangeRel) };
      } else {
        const range = this.resolvePropertyRange(graph, propSemantics);

        if (range !== null) {
          propertyGraphNode['rdfs:range'] = range;
        } else if (schemaTypes.length > 1) {
          const resolved = nonNullTypes
            .map((entry) => resolveSingleXsdType(entry))
            .filter((entry): entry is string => entry !== null);

          if (resolved.length > 1) {
            propertyGraphNode['owl:unionOf'] = rdfList(resolved.map((entry) => ({ '@id': entry })));
          }
        }
      }

      // owl:inverseOf from relations
      const inverseRel = propRelations.find((r) => r.predicate === 'owl:inverseOf');

      if (inverseRel !== undefined) {
        propertyGraphNode['owl:inverseOf'] = { '@id': this.relationTargetId(inverseRel) };
      }

      if (schemaTypes.includes('null')) {
        propertyGraphNode['jt:nullable'] = true;
      }
      if (typeof propSemantics.description === 'string') {
        propertyGraphNode['rdfs:comment'] = propSemantics.description;
      }

      this.addNode(nodeMap, propertyGraphNode);
    }
  }

  private serializeSchemaNode(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    this.serializeClassNode(graph, node, nodeMap);
    this.serializePropertyNodes(graph, node, nodeMap);
    this.serializeConditional(graph, node, nodeMap);
    this.serializeDependentSchemas(graph, node, nodeMap);
    this.serializeContains(graph, node, nodeMap);
    this.serializePrefixItems(graph, node, nodeMap);
    this.serializePatternProperties(graph, node, nodeMap);
  }

  private serializeConditional(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    const semantics = graph.semantics(node);

    if (semantics.ifNode === undefined) {
      return;
    }

    const conditional: Record<string, unknown> = {
      'if': this.resolveTypeRef(graph, semantics.ifNode)
    };

    if (semantics.thenNode !== undefined) {
      conditional['then'] = this.resolveTypeRef(graph, semantics.thenNode);
    }

    if (semantics.elseNode !== undefined) {
      conditional['else'] = this.resolveTypeRef(graph, semantics.elseNode);
    }

    const existing = nodeMap.get(node.id);

    if (existing !== undefined) {
      existing['jt:conditional'] = conditional;
    }
  }

  private serializeDependentSchemas(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    const semantics = graph.semantics(node);

    if (semantics.dependentSchemaEntries.length === 0) {
      return;
    }

    const existing = nodeMap.get(node.id);

    if (existing === undefined) {
      return;
    }

    const annotations = semantics.dependentSchemaEntries.map(([propertyName, schemaNode]) => {
      return {
        'jt:propertyName': propertyName,
        'jt:schema': this.resolveTypeRef(graph, schemaNode)
      };
    });

    existing['jt:dependentSchema'] = annotations;
  }

  private serializeContains(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    const semantics = graph.semantics(node);

    if (semantics.containsNode === undefined) {
      return;
    }

    const existing = nodeMap.get(node.id);

    if (existing === undefined) {
      return;
    }

    existing['jt:contains'] = this.resolveTypeRef(graph, semantics.containsNode);
  }

  private serializePrefixItems(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    const semantics = graph.semantics(node);

    if (semantics.prefixItems.length === 0) {
      return;
    }

    const existing = nodeMap.get(node.id);

    if (existing === undefined) {
      return;
    }

    const tupleItems = semantics.prefixItems.map((itemNode, index) => {
      return {
        'jt:position': index,
        'jt:type': this.resolveTypeRef(graph, itemNode)
      };
    });

    existing['jt:tupleItem'] = tupleItems;
  }

  private serializePatternProperties(
    graph: SchemaGraph,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    const semantics = graph.semantics(node);

    if (semantics.patternPropertyEntries.length === 0) {
      return;
    }

    const existing = nodeMap.get(node.id);

    if (existing === undefined) {
      return;
    }

    const patterns = semantics.patternPropertyEntries.map(([pattern, schemaNode]) => {
      return {
        'jt:pattern': pattern,
        'jt:type': this.resolveTypeRef(graph, schemaNode)
      };
    });

    existing['jt:patternProperty'] = patterns;
  }
}
