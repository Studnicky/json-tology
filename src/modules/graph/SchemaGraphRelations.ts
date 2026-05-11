import type {
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
import { SchemaIri } from './SchemaIri.js';
import {
  resolveSingleXsdType, resolveXsdType
} from '../../constants/XSD_MAPS.js';
import type { GraphAccessorInterface } from '../../interfaces/GraphAccessor.js';
import {
  isDefsEntryPointer, isPropertyPointer,
  parentPropertiesPointer, propertyNameFromPointer
} from './SchemaGraphSupport.js';
import { FORMAT_PATTERNS } from '../../constants/FORMAT_PATTERNS.js';
import {
  DASH, DCT, JT, OWL, RDF, RDFS, SH, XSD
} from '../../constants/IRI.js';

function resolveNodeRef(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeInterface
): string {
  const nodeSem = graph.semantics(node);

  if (typeof nodeSem.ref === 'string') {
    return graph.resolveRefId(nodeSem.ref);
  }

  const xsd = resolveXsdType(nodeSem);

  if (xsd !== null) {
    return xsd;
  }

  return node.id;
}

function pushConditionalRelations(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  if (sem.ifNode === undefined) {
    return;
  }

  const ifRef = resolveNodeRef(graph, sem.ifNode);
  const conditionalStructure: { 'elseRef'?: string
    'ifRef': string;
    'kind': 'conditional';
    'thenRef'?: string; } = {
    ifRef,
    'kind': 'conditional'
  };

  if (sem.thenNode !== undefined) {
    conditionalStructure.thenRef = resolveNodeRef(graph, sem.thenNode);
  }
  if (sem.elseNode !== undefined) {
    conditionalStructure.elseRef = resolveNodeRef(graph, sem.elseNode);
  }

  relations.push({
    'metadata': { 'conditional': true },
    'predicate': OWL.unionOf,
    'source': node,
    'structure': conditionalStructure,
    'target': node.id
  });
}

function pushContainsRelations(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  if (sem.containsNode === undefined) {
    return;
  }

  const containsRef = resolveNodeRef(graph, sem.containsNode);

  relations.push({
    'predicate': OWL.someValuesFrom,
    'source': node,
    'structure': {
      'constraint': OWL.someValuesFrom,
      'kind': 'restriction',
      'onProperty': RDFS.member,
      'value': containsRef
    },
    'target': containsRef
  });

  if (sem.minContains !== undefined) {
    relations.push({
      'metadata': { 'onClass': containsRef },
      'predicate': OWL.minQualifiedCardinality,
      'source': node,
      'target': String(sem.minContains)
    });
  }
  if (sem.maxContains !== undefined) {
    relations.push({
      'metadata': { 'onClass': containsRef },
      'predicate': OWL.maxQualifiedCardinality,
      'source': node,
      'target': String(sem.maxContains)
    });
  }
}

function pushDependentRequiredRelations(
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  const entries = Object.entries(sem.dependentRequired).filter(([
    , v
  ]) => {
    return v.length > 0;
  });

  for (const [
    trigger,
    required
  ] of entries) {
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

function pushDependentSchemaRelations(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  for (const [
    propName,
    schemaNode
  ] of sem.dependentSchemaEntries) {
    const schemaRef = resolveNodeRef(graph, schemaNode);

    relations.push({
      'metadata': {
        'dependentSchema': true,
        'propertyName': propName
      },
      'predicate': OWL.unionOf,
      'source': node,
      'structure': {
        'ifRef': SchemaIri.propertyIri(node.id, propName),
        'kind': 'conditional',
        'thenRef': schemaRef
      },
      'target': schemaRef
    });
  }
}

function pushFormatPatternRelations(
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  if (sem.format === undefined) {
    return;
  }

  const xsd = resolveXsdType(sem);

  if (xsd !== null && xsd !== XSD.string) {
    return;
  }

  const pattern = FORMAT_PATTERNS[sem.format] as string | undefined;

  if (pattern !== undefined) {
    relations.push({
      'metadata': { 'fromFormat': true },
      'predicate': SH.pattern,
      'source': node,
      'target': pattern
    });
  }
}

function pushPatternPropertyRelations(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  for (const [
    pattern,
    schemaNode
  ] of sem.patternPropertyEntries) {
    const schemaRef = resolveNodeRef(graph, schemaNode);

    relations.push({
      'metadata': {
        pattern,
        'patternProperty': true
      },
      'predicate': SH.pattern,
      'source': node,
      'target': schemaRef
    });
  }
}

function pushPrefixItemRelations(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  for (const [
    index,
    itemNode
  ] of sem.prefixItems.entries()) {
    const itemRef = resolveNodeRef(graph, itemNode);

    relations.push({
      'metadata': {
        'memberProperty': `rdf:_${index + 1}`,
        'position': index
      },
      'predicate': RDFS.member,
      'source': node,
      'target': itemRef
    });
  }
}

function pushPropertyCardinalityRelations(
  graph: GraphAccessorInterface,
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[],
  nodeMap: Map<string, SchemaGraphNodeInterface>
): void {
  if (!isPropertyPointer(node.pointer)) {
    return;
  }

  if (!sem.schemaTypes.includes('array')) {
    relations.push({
      'predicate': SH.maxCount,
      'source': node,
      'target': '1'
    });
  }

  const parentPtr = parentPropertiesPointer(node.pointer);

  if (parentPtr !== undefined) {
    const parentNode = nodeMap.get(parentPtr);

    if (parentNode !== undefined) {
      const parentSem = graph.semantics(parentNode);
      const propName = propertyNameFromPointer(node.pointer);

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

function pushPropertyTypeRelations(
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  if (!isPropertyPointer(node.pointer)) {
    return;
  }

  const nonNullTypes = sem.schemaTypes.filter((schemaType) => {
    return schemaType !== 'null';
  });
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

function pushUnionTypeRelations(
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  if (!isPropertyPointer(node.pointer)) {
    return;
  }

  const nonNullTypes = sem.schemaTypes.filter((schemaType) => {
    return schemaType !== 'null';
  });

  if (nonNullTypes.length <= 1) {
    return;
  }

  const resolved: string[] = [];

  for (const typeName of nonNullTypes) {
    const xsd = resolveSingleXsdType(typeName, sem.format === undefined ? undefined : { 'format': sem.format });

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

export function extractRelations(
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

  if (sem.schemaId === undefined && isDefsEntryPointer(node.pointer) && sem.schemaTypes.includes('object')) {
    relations.push({
      'predicate': RDF.type,
      'source': node,
      'target': OWL.Class
    });
  }

  if (isPropertyPointer(node.pointer) && sem.rdfsDomain === undefined) {
    const parentPtr = parentPropertiesPointer(node.pointer);

    if (parentPtr !== undefined) {
      const parentNode = nodeMap.get(parentPtr);

      if (parentNode !== undefined) {
        relations.push({
          'predicate': RDFS.domain,
          'source': node,
          'target': parentNode
        });
      }
    }
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
      'target': graph.resolveRefId(sem.ref)
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
        'target': graph.resolveRefId(parentSem.ref)
      });
    }
  }

  for (const branch of [
    ...sem.anyOf,
    ...sem.oneOf
  ]) {
    relations.push({
      'predicate': OWL.equivalentClass,
      'source': node,
      'target': branch
    });
  }

  if (sem.complementNode !== undefined) {
    const complementSem = graph.semantics(sem.complementNode);
    const complementTarget = complementSem.ref === undefined
      ? sem.complementNode
      : graph.resolveRefId(complementSem.ref);

    relations.push({
      'predicate': OWL.complementOf,
      'source': node,
      'target': complementTarget
    });
  }

  for (const propertyName of sem.required) {
    const propNode = sem.properties.get(propertyName);
    const propIRI = `${node.id}#${propertyName}`;

    relations.push({
      'metadata': {
        'minCardinality': 1,
        'onProperty': propIRI
      },
      'predicate': OWL.Restriction,
      'source': node,
      'target': propNode ?? propIRI
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
    const xsd = resolveXsdType(sem);

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
      'target': graph.resolveRefId(sem.ref)
    });
  }

  pushPropertyTypeRelations(node, sem, relations);
  pushPropertyCardinalityRelations(graph, node, sem, relations, nodeMap);
  pushConditionalRelations(graph, node, sem, relations);
  pushDependentSchemaRelations(graph, node, sem, relations);
  pushContainsRelations(graph, node, sem, relations);
  pushPrefixItemRelations(graph, node, sem, relations);
  pushPatternPropertyRelations(graph, node, sem, relations);
  pushUnionTypeRelations(node, sem, relations);
  pushDependentRequiredRelations(node, sem, relations);
  pushFormatPatternRelations(node, sem, relations);

  return relations;
}
