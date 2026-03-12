/**
 * BaseSerializer — shared graph serialization helpers
 *
 * Common logic for resolving relation targets, building type refs,
 * and checking node candidacy shared by OWL and SHACL serializers.
 */

import type { SchemaGraphNodeInterface, SchemaGraphRelationInterface, SchemaGraphSemanticsInterface } from '../../interfaces/schema-graph.js';
import { propertyIri, resolveXsdType } from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';

export abstract class BaseSerializer {
  public abstract serialize(graphs: ReadonlyArray<SchemaGraph>): unknown[];

  /**
   * Extract the target ID from a relation, resolving node targets to their id.
   */
  protected relationTargetId(rel: SchemaGraphRelationInterface): string {
    return typeof rel.target === 'string' ? rel.target : rel.target.id;
  }

  /**
   * Resolve a relation target to an {@id} ref, following $ref if present.
   */
  protected relationTargetRef(graph: SchemaGraph, rel: SchemaGraphRelationInterface): Record<string, unknown> {
    if (typeof rel.target === 'string') {
      return { '@id': rel.target };
    }

    const semantics = graph.semantics(rel.target);

    if (typeof semantics.ref === 'string') {
      return { '@id': graph.resolveRefId(semantics.ref) };
    }

    return { '@id': rel.target.id };
  }

  /**
   * Build a property IRI from class ID and property name.
   */
  protected propertyIri(classId: string, propName: string): string {
    return propertyIri(classId, propName);
  }

  /**
   * Resolve a named node ID: follow $ref if present, else use node.id.
   */
  protected namedNodeId(graph: SchemaGraph, node: SchemaGraphNodeInterface): string | undefined {
    const semantics = graph.semantics(node);

    if (typeof semantics.ref === 'string') {
      return graph.resolveRefId(semantics.ref);
    }

    return node.id;
  }

  /**
   * Resolve a target node to an {@id} ref using $ref, XSD type, or node.id.
   */
  protected resolveTypeRef(graph: SchemaGraph, targetNode: SchemaGraphNodeInterface): { '@id': string } {
    const targetSemantics = graph.semantics(targetNode);

    if (typeof targetSemantics.ref === 'string') {
      return { '@id': graph.resolveRefId(targetSemantics.ref) };
    }

    const xsd = resolveXsdType(targetSemantics);

    if (xsd !== null) {
      return { '@id': xsd };
    }

    return { '@id': targetNode.id };
  }

  /**
   * Check whether a node is a candidate for class/shape serialization.
   */
  protected isSerializationCandidate(node: SchemaGraphNodeInterface, semantics: SchemaGraphSemanticsInterface): boolean {
    return node.pointer === ''
      || semantics.schemaTypes.includes('object')
      || semantics.properties.length > 0
      || semantics.allOf.length > 0
      || semantics.anyOf.length > 0
      || semantics.oneOf.length > 0
      || semantics.notNode !== undefined
      || semantics.enumValues !== undefined
      || semantics.hasConst
      || semantics.ifNode !== undefined
      || semantics.containsNode !== undefined
      || semantics.prefixItems.length > 0
      || semantics.patternPropertyEntries.length > 0
      || semantics.dependentSchemaEntries.length > 0;
  }
}
