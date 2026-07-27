import type { SchemaGraphSemanticsInterface } from '../../interfaces/SchemaGraphSemanticsInterface.js';
import type { SchemaGraphRelationInterface } from '../../interfaces/SchemaGraphRelationInterface.js';
import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraphNodeInterface.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { GraphError } from '../../errors/GraphError.js';
import { SchemaIri } from './SchemaIri.js';
import { XsdTypes } from '../quads/XsdTypes.js';
import type { GraphAccessorInterface } from '../../interfaces/GraphAccessorInterface.js';
import { SchemaGraphSupport } from './SchemaGraphSupport.js';
import { DataType } from '../data/DataType.js';
import { FORMAT_PATTERNS } from '../../constants/FORMAT_PATTERNS.js';
import {
  ALLOF_PATH_ONLY_RE, ALLOF_PATH_PREFIX_RE
} from '../../constants/GRAPH_REGEXES.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';
import { RESTRICTION_PREDICATE_MAP } from '../../constants/ONTOLOGY_PREDICATES.js';
import type { JsonSchemaType } from '../../types/Schema.js';
import type { CardinalityContextInterface } from '../../interfaces/CardinalityContextInterface.js';
import type { RelationsPushContextInterface } from '../../interfaces/RelationsPushContextInterface.js';
import type { TypeRelationsContextInterface } from '../../interfaces/TypeRelationsContextInterface.js';

class NodeReference {
  static resolve(
    graph: GraphAccessorInterface,
    node: SchemaGraphNodeInterface
  ): string {
    const nodeSem = graph.semantics(node);

    if (typeof nodeSem.ref === 'string') {
      return graph.resolveReferenceId(nodeSem.ref);
    }

    const xsd = XsdTypes.resolve(nodeSem);

    if (xsd !== null) {
      return xsd;
    }

    return node.id;
  }
}

class RelationPush {
  static pushAnnotatedEdgeRelations(context: RelationsPushContextInterface): void {
    const {
      graph, node, relations, sem
    } = context;
    const descriptor = sem.annotatedEdge;

    if (descriptor === undefined) {
      return;
    }

    const edgeTarget = graph.resolveReferenceId(descriptor.targetRef);
    const edgeAnnotations: Array<{
      readonly 'propertyName': string;
      readonly 'propertySchema': JsonSchemaType;
      readonly 'rangeRef': string;
    }> = [];

    for (const [
      propName,
      propSchema
    ] of Object.entries(descriptor.annotations)) {
      // The descriptor extraction already validated a string `$ref`; narrow again
      // for the type system before reading it and carrying the full sub-schema.
      if (!DataType.isRecord(propSchema) || typeof propSchema.$ref !== 'string') {
        continue;
      }

      edgeAnnotations.push({
        'propertyName': propName,
        'propertySchema': propSchema,
        'rangeRef': graph.resolveReferenceId(propSchema.$ref)
      });
    }

    relations.push({
      'predicate': JT.annotatedEdge,
      'source': node,
      'structure': {
        edgeAnnotations,
        'edgePredicate': graph.resolveReferenceId(descriptor.predicate),
        edgeTarget,
        'kind': 'annotatedEdge'
      },
      'target': edgeTarget
    });
  }

  static pushConditionalRelations(context: RelationsPushContextInterface): void {
    const {
      graph, node, relations, sem
    } = context;

    if (sem.ifNode === undefined) {
      return;
    }

    const ifReference = NodeReference.resolve(graph, sem.ifNode);
    const conditionalStructure: { 'elseReference'?: string
      'ifReference': string;
      'kind': 'conditional';
      'thenReference'?: string; } = {
      'ifReference': ifReference,
      'kind': 'conditional'
    };

    if (sem.thenNode !== undefined) {
      conditionalStructure.thenReference = NodeReference.resolve(graph, sem.thenNode);
    }
    if (sem.elseNode !== undefined) {
      conditionalStructure.elseReference = NodeReference.resolve(graph, sem.elseNode);
    }

    relations.push({
      'metadata': { 'conditional': true },
      'predicate': OWL.unionOf,
      'source': node,
      'structure': conditionalStructure,
      'target': node.id
    });
  }

  static pushContainsRelations(context: RelationsPushContextInterface): void {
    const {
      graph, node, relations, sem
    } = context;

    if (sem.containsNode === undefined) {
      return;
    }

    const containsReference = NodeReference.resolve(graph, sem.containsNode);

    relations.push({
      'predicate': OWL.someValuesFrom,
      'source': node,
      'structure': {
        'constraint': OWL.someValuesFrom,
        'kind': 'restriction',
        'onProperty': RDFS.member,
        'value': containsReference
      },
      'target': containsReference
    });

    if (sem.minContains !== undefined) {
      relations.push({
        'metadata': { 'onClass': containsReference },
        'predicate': OWL.minQualifiedCardinality,
        'source': node,
        'target': String(sem.minContains)
      });
    }
    if (sem.maxContains !== undefined) {
      relations.push({
        'metadata': { 'onClass': containsReference },
        'predicate': OWL.maxQualifiedCardinality,
        'source': node,
        'target': String(sem.maxContains)
      });
    }
  }

  static pushDependentRequiredRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    for (const [
      trigger,
      required
    ] of Object.entries(sem.dependentRequired)) {
      if (required.length === 0) {
        continue;
      }
      relations.push({
        'metadata': {
          required,
          trigger
        },
        'predicate': JT.dependentRequired,
        'source': node,
        'target': node.id
      });
    }
  }

  static pushDependentSchemaRelations(context: RelationsPushContextInterface): void {
    const {
      graph, node, relations, sem
    } = context;

    for (const [
      propName,
      schemaNode
    ] of sem.dependentSchemaEntries) {
      const schemaReference = NodeReference.resolve(graph, schemaNode);

      relations.push({
        'metadata': {
          'dependentSchema': true,
          'propertyName': propName
        },
        'predicate': OWL.unionOf,
        'source': node,
        'structure': {
          'ifReference': SchemaIri.propertyIri(node.id, propName),
          'kind': 'conditional',
          'thenReference': schemaReference
        },
        'target': schemaReference
      });
    }
  }

  static pushFormatAnnotationRelation(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (sem.format === undefined) {
      return;
    }

    relations.push({
      'predicate': JT.format,
      'source': node,
      'target': sem.format
    });
  }

  static pushFormatPatternRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (sem.format === undefined) {
      return;
    }

    const xsd = XsdTypes.resolve(sem);

    if (xsd !== null && xsd !== XSD.string) {
      return;
    }

    const pattern = FORMAT_PATTERNS[sem.format];

    if (pattern !== undefined) {
      relations.push({
        'metadata': { 'fromFormat': true },
        'predicate': SH.pattern,
        'source': node,
        'target': pattern
      });
    }
  }

  static pushPatternPropertyRelations(context: RelationsPushContextInterface): void {
    const {
      graph, node, relations, sem
    } = context;

    for (const [
      pattern,
      schemaNode
    ] of sem.patternPropertyEntries) {
      const schemaReference = NodeReference.resolve(graph, schemaNode);

      relations.push({
        'metadata': {
          pattern,
          'patternProperty': true
        },
        'predicate': SH.pattern,
        'source': node,
        'target': schemaReference
      });
    }
  }

  static pushPrefixItemRelations(context: RelationsPushContextInterface): void {
    const {
      graph, node, relations, sem
    } = context;

    for (const [
      index,
      itemNode
    ] of sem.prefixItems.entries()) {
      const itemReference = NodeReference.resolve(graph, itemNode);

      relations.push({
        'metadata': {
          'memberProperty': `rdf:_${index + 1}`,
          'position': index
        },
        'predicate': RDFS.member,
        'source': node,
        'target': itemReference
      });
    }
  }

  static pushPropertyCardinalityRelations(context: CardinalityContextInterface): void {
    const {
      graph, node, nodeMap, relations, sem
    } = context;

    if (!SchemaGraphSupport.isPropertyPointer(node.pointer)) {
      return;
    }

    if (!sem.schemaTypes.includes('array')) {
      relations.push({
        'predicate': SH.maxCount,
        'source': node,
        'target': '1'
      });
    }

    const parentPointer = SchemaGraphSupport.parentPropertiesPointer(node.pointer);

    if (parentPointer !== undefined) {
      const parentNode = nodeMap.get(parentPointer);

      if (parentNode !== undefined) {
        const parentSem = graph.semantics(parentNode);
        const propName = SchemaGraphSupport.propertyNameFromPointer(node.pointer);

        if (propName !== undefined && parentSem.required.includes(propName)) {
          relations.push({
            'predicate': SH.minCount,
            'source': node,
            'target': '1'
          });
        }
      }
    }
  }

  static pushPropertyTypeRelations(context: TypeRelationsContextInterface): void {
    const {
      node, nonNullTypes, relations, sem
    } = context;

    if (!SchemaGraphSupport.isPropertyPointer(node.pointer)) {
      return;
    }

    const primaryType = nonNullTypes.length > 0 ? nonNullTypes[0] : null;
    const isObjectProperty = primaryType === 'array'
      || primaryType === 'object'
      || typeof sem.ref === 'string'
      || primaryType === null;

    relations.push({
      'predicate': RDF.type,
      'source': node,
      'target': isObjectProperty ? OWL.ObjectProperty : OWL.DatatypeProperty
    });
  }

  static pushUnionTypeRelations(context: TypeRelationsContextInterface): void {
    const {
      node, nonNullTypes, relations, sem
    } = context;

    if (!SchemaGraphSupport.isPropertyPointer(node.pointer)) {
      return;
    }

    if (nonNullTypes.length <= 1) {
      return;
    }

    const resolved: string[] = [];

    for (const typeName of nonNullTypes) {
      const xsd = XsdTypes.resolveSingle(typeName, sem.format === undefined ? undefined : { 'format': sem.format });

      if (xsd !== null) {
        resolved.push(xsd);
      }
    }

    if (resolved.length > 1) {
      relations.push({
        'predicate': OWL.unionOf,
        'source': node,
        'structure': {
          'kind': 'list',
          'members': resolved
        },
        'target': node.id
      });
    }
  }

  static pushUserRestrictionRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (sem.restrictions.length === 0) {
      return;
    }

    for (const desc of sem.restrictions) {
      const predicate = RESTRICTION_PREDICATE_MAP[desc.kind];

      if (predicate === undefined) {
        // Unreachable: RESTRICTION_PREDICATE_MAP keys exactly match the closed
        // RestrictionKindEntity.Type union ('allValuesFrom' | 'cardinality' | 'hasValue' |
        // 'maxCardinality' | 'minCardinality' | 'someValuesFrom'). The map type is
        // Partial<Record<string, string>> for index-signature compatibility, but all
        // six members are always present. A miss here indicates a future RestrictionKindEntity.Type
        // member was added without a corresponding map entry — throw to surface it
        // immediately rather than silently dropping a restriction relation.
        throw new GraphError(
          `restriction kind "${desc.kind}" has no entry in RESTRICTION_PREDICATE_MAP`,
          { 'code': GRAPH_ERROR_CODE.VOCABULARY_UNSUPPORTED }
        );
      }

      relations.push({
        'predicate': RDFS.subClassOf,
        'source': node,
        'structure': {
          'constraint': predicate,
          'kind': 'restriction',
          'onProperty': desc.onProperty,
          'value': desc.value
        },
        'target': node.id
      });
    }
  }
}

export const SchemaGraphRelations = {
  extractRelations(
    graph: GraphAccessorInterface,
    node: SchemaGraphNodeInterface,
    nodeMap: Map<string, SchemaGraphNodeInterface>
  ): SchemaGraphRelationInterface[] {
    const sem = graph.semantics(node);
    const relations: SchemaGraphRelationInterface[] = [];

    if (sem.schemaId !== undefined) {
      relations.push({
        'predicate': RDF.type,
        'source': node,
        'target': OWL.Class
      });
    }

    if (sem.schemaId === undefined && SchemaGraphSupport.isDefsEntryPointer(node.pointer) && sem.schemaTypes.includes('object')) {
      relations.push({
        'predicate': RDF.type,
        'source': node,
        'target': OWL.Class
      });
    }

    const rawDomainNode = graph.domainOf(node);

    if (rawDomainNode !== undefined && sem.rdfsDomain === undefined) {
      // Properties defined inside an `allOf/N` member belong to the parent
      // class, not to the anonymous intermediate node. When the direct domain
      // node's pointer is a pure allOf path (e.g. `/allOf/1`), climb up to
      // the nearest named ancestor so the emitted `rdfs:domain` carries the
      // class IRI (e.g. `urn:bookstore:Book`) rather than the internal
      // fragment (`urn:bookstore:Book#/allOf/1`). The domainOf() edge records
      // the DIRECT parent; this climb resolves composition to the canonical class.
      const directPointer = rawDomainNode.pointer;
      const domainPointer = ALLOF_PATH_ONLY_RE.test(directPointer)
        ? directPointer.replace(ALLOF_PATH_PREFIX_RE, '')
        : directPointer;
      const domainNode = domainPointer === directPointer
        ? rawDomainNode
        : nodeMap.get(domainPointer === '' ? '' : domainPointer);

      if (domainNode === undefined) {
        // The allOf-climb produced a pointer that is not present in the nodeMap.
        // Every pointer reachable by walking up from a real domain node must exist
        // in the graph's nodeMap — a miss here indicates a graph construction defect
        // (nodeMap was built without registering the ancestor node).
        throw new GraphError(
          `domain ancestor pointer "${domainPointer}" not found in nodeMap for node "${node.id}"`,
          { 'code': GRAPH_ERROR_CODE.POINTER_NOT_FOUND }
        );
      }

      relations.push({
        'predicate': RDFS.domain,
        'source': node,
        'target': domainNode
      });
    }

    if (sem.rdfsDomain !== undefined) {
      relations.push({
        'predicate': RDFS.domain,
        'source': node,
        'target': sem.rdfsDomain
      });
    }
    if (sem.rdfsRange !== undefined) {
      relations.push({
        'predicate': RDFS.range,
        'source': node,
        'target': sem.rdfsRange
      });
    }
    if (sem.disjointWith !== undefined) {
      relations.push({
        'predicate': OWL.disjointWith,
        'source': node,
        'target': sem.disjointWith
      });
    }
    if (sem.equivalentTo !== undefined) {
      relations.push({
        'predicate': OWL.equivalentClass,
        'source': node,
        'target': sem.equivalentTo
      });
    }

    // Compose.equivalent shape: root-level schema whose only structural content is a $ref
    if (sem.schemaId !== undefined && sem.ref !== undefined && node.pointer === '') {
      relations.push({
        'predicate': OWL.equivalentClass,
        'source': node,
        'target': graph.resolveReferenceId(sem.ref)
      });
    }
    if (sem.inverseOf !== undefined) {
      relations.push({
        'predicate': OWL.inverseOf,
        'source': node,
        'target': sem.inverseOf
      });
    }
    if (sem.transitive) {
      relations.push({
        'predicate': OWL.TransitiveProperty,
        'source': node,
        'target': node.id
      });
    }
    if (sem.symmetric) {
      relations.push({
        'predicate': OWL.SymmetricProperty,
        'source': node,
        'target': node.id
      });
    }
    if (sem.asymmetric) {
      relations.push({
        'predicate': OWL.AsymmetricProperty,
        'source': node,
        'target': node.id
      });
    }
    if (sem.functional) {
      relations.push({
        'predicate': OWL.FunctionalProperty,
        'source': node,
        'target': node.id
      });
    }
    if (sem.inverseFunctional) {
      relations.push({
        'predicate': OWL.InverseFunctionalProperty,
        'source': node,
        'target': node.id
      });
    }
    if (sem.reflexive) {
      relations.push({
        'predicate': OWL.ReflexiveProperty,
        'source': node,
        'target': node.id
      });
    }
    if (sem.irreflexive) {
      relations.push({
        'predicate': OWL.IrreflexiveProperty,
        'source': node,
        'target': node.id
      });
    }

    if (sem.title !== undefined) {
      relations.push({
        'predicate': RDFS.label,
        'source': node,
        'target': sem.title
      });
    }
    if (sem.description !== undefined) {
      relations.push({
        'predicate': RDFS.comment,
        'source': node,
        'target': sem.description
      });
    }
    if (sem.deprecated) {
      relations.push({
        'predicate': OWL.deprecated,
        'source': node,
        'target': 'true'
      });
    }

    if (sem.readOnly) {
      relations.push({
        'predicate': DASH.readOnly,
        'source': node,
        'target': 'true'
      });
    }
    if (sem.writeOnly) {
      relations.push({
        'predicate': DASH.writeOnly,
        'source': node,
        'target': 'true'
      });
    }

    if (sem.contentMediaType !== undefined) {
      relations.push({
        'predicate': DCT.format,
        'source': node,
        'target': sem.contentMediaType
      });
    }

    for (const parent of sem.allOf) {
      const parentSem = graph.semantics(parent);

      if (parentSem.ref === undefined) {
        relations.push({
          'predicate': RDFS.subClassOf,
          'source': node,
          'target': parent
        });
      } else {
        relations.push({
          'predicate': RDFS.subClassOf,
          'source': node,
          'target': graph.resolveReferenceId(parentSem.ref)
        });
      }
    }

    for (const branch of sem.anyOf) {
      const branchSem = graph.semantics(branch);
      const branchTarget = branchSem.ref === undefined
        ? branch
        : graph.resolveReferenceId(branchSem.ref);

      relations.push({
        'predicate': OWL.equivalentClass,
        'source': node,
        'target': branchTarget
      });
    }

    for (const branch of sem.oneOf) {
      const branchSem = graph.semantics(branch);
      const branchTarget = branchSem.ref === undefined
        ? branch
        : graph.resolveReferenceId(branchSem.ref);

      relations.push({
        'predicate': OWL.disjointUnionOf,
        'source': node,
        'target': branchTarget
      });
    }

    if (sem.complementNode !== undefined) {
      const complementSem = graph.semantics(sem.complementNode);
      const complementTarget = complementSem.ref === undefined
        ? sem.complementNode
        : graph.resolveReferenceId(complementSem.ref);

      relations.push({
        'predicate': OWL.complementOf,
        'source': node,
        'target': complementTarget
      });
    }

    for (const propertyName of sem.required) {
      const propNode = sem.properties.get(propertyName);
      const propIri = `${node.id}#${propertyName}`;

      relations.push({
        'metadata': {
          'minCardinality': 1,
          'onProperty': propIri,
          'propertyName': propertyName
        },
        'predicate': OWL.Restriction,
        'source': node,
        'target': propNode ?? propIri
      });
    }

    if (sem.enumValues !== undefined) {
      for (const value of sem.enumValues) {
        relations.push({
          'predicate': OWL.oneOf,
          'source': node,
          'target': typeof value === 'string' ? value : JSON.stringify(value)
        });
      }
    }

    if (sem.hasConst) {
      relations.push({
        'predicate': OWL.hasValue,
        'source': node,
        'target': typeof sem.constValue === 'string' ? sem.constValue : JSON.stringify(sem.constValue)
      });
    }

    if (sem.additionalPropertiesNode === false) {
      relations.push({
        'predicate': SH.closed,
        'source': node,
        'target': 'true'
      });
    }

    if (sem.pattern !== undefined) {
      relations.push({
        'predicate': SH.pattern,
        'source': node,
        'target': sem.pattern
      });
    }
    if (sem.minLength !== undefined) {
      relations.push({
        'predicate': SH.minLength,
        'source': node,
        'target': String(sem.minLength)
      });
    }
    if (sem.maxLength !== undefined) {
      relations.push({
        'predicate': SH.maxLength,
        'source': node,
        'target': String(sem.maxLength)
      });
    }
    if (sem.minimum !== undefined) {
      relations.push({
        'predicate': SH.minInclusive,
        'source': node,
        'target': String(sem.minimum)
      });
    }
    if (sem.maximum !== undefined) {
      relations.push({
        'predicate': SH.maxInclusive,
        'source': node,
        'target': String(sem.maximum)
      });
    }
    if (sem.exclusiveMinimum !== undefined) {
      relations.push({
        'predicate': SH.minExclusive,
        'source': node,
        'target': String(sem.exclusiveMinimum)
      });
    }
    if (sem.exclusiveMaximum !== undefined) {
      relations.push({
        'predicate': SH.maxExclusive,
        'source': node,
        'target': String(sem.exclusiveMaximum)
      });
    }
    if (sem.multipleOf !== undefined) {
      relations.push({
        'predicate': JT.multipleOf,
        'source': node,
        'target': String(sem.multipleOf)
      });
    }
    if (sem.minItems !== undefined) {
      relations.push({
        'predicate': SH.minCount,
        'source': node,
        'target': String(sem.minItems)
      });
    }
    if (sem.maxItems !== undefined) {
      relations.push({
        'predicate': SH.maxCount,
        'source': node,
        'target': String(sem.maxItems)
      });
    }

    if (sem.ref === undefined) {
      const xsd = XsdTypes.resolve(sem);

      if (xsd !== null) {
        relations.push({
          'predicate': SH.datatype,
          'source': node,
          'target': xsd
        });
      }
    }

    if (sem.ref !== undefined) {
      relations.push({
        'metadata': { 'fromRef': true },
        'predicate': RDFS.range,
        'source': node,
        'target': graph.resolveReferenceId(sem.ref)
      });
    }

    const nonNullTypes = sem.schemaTypes.filter((schemaType: string): boolean => {
      return schemaType !== 'null';
    });

    const context: RelationsPushContextInterface = {
      graph,
      node,
      relations,
      sem
    };
    const typeContext: TypeRelationsContextInterface = {
      graph,
      node,
      nonNullTypes,
      relations,
      sem
    };
    const cardinalityContext: CardinalityContextInterface = {
      graph,
      node,
      nodeMap,
      relations,
      sem
    };

    RelationPush.pushPropertyTypeRelations(typeContext);
    RelationPush.pushPropertyCardinalityRelations(cardinalityContext);
    RelationPush.pushConditionalRelations(context);
    RelationPush.pushDependentSchemaRelations(context);
    RelationPush.pushContainsRelations(context);
    RelationPush.pushPrefixItemRelations(context);
    RelationPush.pushPatternPropertyRelations(context);
    RelationPush.pushUnionTypeRelations(typeContext);
    RelationPush.pushDependentRequiredRelations(node, sem, relations);
    RelationPush.pushFormatPatternRelations(node, sem, relations);
    RelationPush.pushFormatAnnotationRelation(node, sem, relations);
    RelationPush.pushUserRestrictionRelations(node, sem, relations);
    RelationPush.pushAnnotatedEdgeRelations(context);

    return relations;
  }
} as const;
