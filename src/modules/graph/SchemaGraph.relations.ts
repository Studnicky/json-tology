import type {
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface
} from '../../interfaces/schema-graph.js';
import {
  propertyIri, resolveSingleXsdType, resolveXsdType
} from '../data/DataTypes.js';
import type { GraphAccessor } from './SchemaGraph.support.js';
import {
  isDefsEntryPointer, isPropertyPointer,
  parentPropertiesPointer, propertyNameFromPointer
} from './SchemaGraph.support.js';

function resolveNodeRef(
  graph: GraphAccessor,
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

const FORMAT_PATTERNS: Record<string, string> = {
  'email': '^\\S+@\\S+\\.\\S+$',
  'hostname': '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$',
  'idn-email': '^\\S+@\\S+\\.\\S+$',
  'ipv4': '^(\\d{1,3}\\.){3}\\d{1,3}$',
  'ipv6': '^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$',
  'json-pointer': '^(/[^/]*)*$',
  'relative-json-pointer': '^[0-9]+(#|(/[^/]*)*)$',
  'uuid': '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
};

function pushConditionalRelations(
  graph: GraphAccessor,
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
    'predicate': 'owl:unionOf',
    'source': node,
    'structure': conditionalStructure,
    'target': node.id
  });
}

function pushContainsRelations(
  graph: GraphAccessor,
  node: SchemaGraphNodeInterface,
  sem: SchemaGraphSemanticsInterface,
  relations: SchemaGraphRelationInterface[]
): void {
  if (sem.containsNode === undefined) {
    return;
  }

  const containsRef = resolveNodeRef(graph, sem.containsNode);

  relations.push({
    'predicate': 'owl:someValuesFrom',
    'source': node,
    'structure': {
      'constraint': 'owl:someValuesFrom',
      'kind': 'restriction',
      'onProperty': 'rdfs:member',
      'value': containsRef
    },
    'target': containsRef
  });

  if (sem.minContains !== undefined) {
    relations.push({
      'metadata': { 'onClass': containsRef },
      'predicate': 'owl:minQualifiedCardinality',
      'source': node,
      'target': String(sem.minContains)
    });
  }
  if (sem.maxContains !== undefined) {
    relations.push({
      'metadata': { 'onClass': containsRef },
      'predicate': 'owl:maxQualifiedCardinality',
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
      'predicate': 'jt:dependentRequired',
      'source': node,
      'target': node.id
    });
  }
}

function pushDependentSchemaRelations(
  graph: GraphAccessor,
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
      'predicate': 'owl:unionOf',
      'source': node,
      'structure': {
        'ifRef': propertyIri(node.id, propName),
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

  if (xsd !== null && xsd !== 'xsd:string') {
    return;
  }

  const pattern = FORMAT_PATTERNS[sem.format] as string | undefined;

  if (pattern !== undefined) {
    relations.push({
      'metadata': { 'fromFormat': true },
      'predicate': 'sh:pattern',
      'source': node,
      'target': pattern
    });
  }
}

function pushPatternPropertyRelations(
  graph: GraphAccessor,
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
      'predicate': 'sh:pattern',
      'source': node,
      'target': schemaRef
    });
  }
}

function pushPrefixItemRelations(
  graph: GraphAccessor,
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
      'predicate': 'rdfs:member',
      'source': node,
      'target': itemRef
    });
  }
}

function pushPropertyCardinalityRelations(
  graph: GraphAccessor,
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
      'predicate': 'sh:maxCount',
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
          'predicate': 'sh:minCount',
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
    'predicate': 'rdf:type',
    'source': node,
    'target': isObjectProperty ? 'owl:ObjectProperty' : 'owl:DatatypeProperty'
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
    const xsd = resolveSingleXsdType(typeName, sem.format);

    if (xsd !== null) {
      resolved.push(xsd);
    }
  }

  if (resolved.length > 1) {
    relations.push({
      'predicate': 'owl:unionOf',
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
  graph: GraphAccessor,
  node: SchemaGraphNodeInterface,
  nodeMap: Map<string, SchemaGraphNodeInterface>
): SchemaGraphRelationInterface[] {
  const sem = graph.semantics(node);
  const relations: SchemaGraphRelationInterface[] = [];

  if (sem.schemaId !== undefined) {
    relations.push({
      'predicate': 'rdf:type',
      'source': node,
      'target': 'owl:Class'
    });
  }

  if (sem.schemaId === undefined && isDefsEntryPointer(node.pointer) && sem.schemaTypes.includes('object')) {
    relations.push({
      'predicate': 'rdf:type',
      'source': node,
      'target': 'owl:Class'
    });
  }

  if (isPropertyPointer(node.pointer) && sem.rdfsDomain === undefined) {
    const parentPtr = parentPropertiesPointer(node.pointer);

    if (parentPtr !== undefined) {
      const parentNode = nodeMap.get(parentPtr);

      if (parentNode !== undefined) {
        relations.push({
          'predicate': 'rdfs:domain',
          'source': node,
          'target': parentNode
        });
      }
    }
  }

  if (sem.rdfsDomain !== undefined) {
    relations.push({
      'predicate': 'rdfs:domain',
      'source': node,
      'target': sem.rdfsDomain
    });
  }
  if (sem.rdfsRange !== undefined) {
    relations.push({
      'predicate': 'rdfs:range',
      'source': node,
      'target': sem.rdfsRange
    });
  }
  if (sem.disjointWith !== undefined) {
    relations.push({
      'predicate': 'owl:disjointWith',
      'source': node,
      'target': sem.disjointWith
    });
  }
  if (sem.equivalentTo !== undefined) {
    relations.push({
      'predicate': 'owl:equivalentClass',
      'source': node,
      'target': sem.equivalentTo
    });
  }
  if (sem.inverseOf !== undefined) {
    relations.push({
      'predicate': 'owl:inverseOf',
      'source': node,
      'target': sem.inverseOf
    });
  }
  if (sem.transitive) {
    relations.push({
      'predicate': 'owl:TransitiveProperty',
      'source': node,
      'target': node.id
    });
  }
  if (sem.symmetric) {
    relations.push({
      'predicate': 'owl:SymmetricProperty',
      'source': node,
      'target': node.id
    });
  }

  if (sem.title !== undefined) {
    relations.push({
      'predicate': 'rdfs:label',
      'source': node,
      'target': sem.title
    });
  }
  if (sem.description !== undefined) {
    relations.push({
      'predicate': 'rdfs:comment',
      'source': node,
      'target': sem.description
    });
  }
  if (sem.deprecated) {
    relations.push({
      'predicate': 'owl:deprecated',
      'source': node,
      'target': 'true'
    });
  }

  if (sem.readOnly) {
    relations.push({
      'predicate': 'dash:readOnly',
      'source': node,
      'target': 'true'
    });
  }
  if (sem.writeOnly) {
    relations.push({
      'predicate': 'dash:writeOnly',
      'source': node,
      'target': 'true'
    });
  }

  if (sem.contentMediaType !== undefined) {
    relations.push({
      'predicate': 'dct:format',
      'source': node,
      'target': sem.contentMediaType
    });
  }

  for (const parent of sem.allOf) {
    const parentSem = graph.semantics(parent);

    if (parentSem.ref === undefined) {
      relations.push({
        'predicate': 'rdfs:subClassOf',
        'source': node,
        'target': parent
      });
    } else {
      relations.push({
        'predicate': 'rdfs:subClassOf',
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
      'predicate': 'owl:equivalentClass',
      'source': node,
      'target': branch
    });
  }

  if (sem.complementNode !== undefined) {
    relations.push({
      'predicate': 'owl:complementOf',
      'source': node,
      'target': sem.complementNode
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
      'predicate': 'owl:Restriction',
      'source': node,
      'target': propNode ?? propIRI
    });
  }

  if (sem.enumValues !== undefined) {
    for (const value of sem.enumValues) {
      relations.push({
        'predicate': 'owl:oneOf',
        'source': node,
        'target': typeof value === 'string' ? value : JSON.stringify(value)
      });
    }
  }

  if (sem.hasConst) {
    relations.push({
      'predicate': 'owl:hasValue',
      'source': node,
      'target': typeof sem.constValue === 'string' ? sem.constValue : JSON.stringify(sem.constValue)
    });
  }

  if (sem.additionalPropertiesNode === false) {
    relations.push({
      'predicate': 'sh:closed',
      'source': node,
      'target': 'true'
    });
  }

  if (sem.pattern !== undefined) {
    relations.push({
      'predicate': 'sh:pattern',
      'source': node,
      'target': sem.pattern
    });
  }
  if (sem.minLength !== undefined) {
    relations.push({
      'predicate': 'sh:minLength',
      'source': node,
      'target': String(sem.minLength)
    });
  }
  if (sem.maxLength !== undefined) {
    relations.push({
      'predicate': 'sh:maxLength',
      'source': node,
      'target': String(sem.maxLength)
    });
  }
  if (sem.minimum !== undefined) {
    relations.push({
      'predicate': 'sh:minInclusive',
      'source': node,
      'target': String(sem.minimum)
    });
  }
  if (sem.maximum !== undefined) {
    relations.push({
      'predicate': 'sh:maxInclusive',
      'source': node,
      'target': String(sem.maximum)
    });
  }
  if (sem.exclusiveMinimum !== undefined) {
    relations.push({
      'predicate': 'sh:minExclusive',
      'source': node,
      'target': String(sem.exclusiveMinimum)
    });
  }
  if (sem.exclusiveMaximum !== undefined) {
    relations.push({
      'predicate': 'sh:maxExclusive',
      'source': node,
      'target': String(sem.exclusiveMaximum)
    });
  }
  if (sem.multipleOf !== undefined) {
    relations.push({
      'predicate': 'jt:multipleOf',
      'source': node,
      'target': String(sem.multipleOf)
    });
  }
  if (sem.minItems !== undefined) {
    relations.push({
      'predicate': 'sh:minCount',
      'source': node,
      'target': String(sem.minItems)
    });
  }
  if (sem.maxItems !== undefined) {
    relations.push({
      'predicate': 'sh:maxCount',
      'source': node,
      'target': String(sem.maxItems)
    });
  }

  if (sem.ref === undefined) {
    const xsd = resolveXsdType(sem);

    if (xsd !== null) {
      relations.push({
        'predicate': 'sh:datatype',
        'source': node,
        'target': xsd
      });
    }
  }

  if (sem.ref !== undefined) {
    relations.push({
      'metadata': { 'fromRef': true },
      'predicate': 'rdfs:range',
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
