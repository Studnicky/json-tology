import type {
  NormIRInterface,
  SchemaGraphNodeInterface, SchemaGraphRelationInterface,
  SchemaGraphSemanticsInterface, StructureWarningInterface
} from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import {
  isRecord as isObject, propertyIri, resolveSingleXsdType, resolveXsdType
} from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';


const KNOWN_KEYWORDS = new Set([
  '$anchor',
  '$comment',
  '$defs',
  '$dynamicAnchor',
  '$dynamicRef',
  '$id',
  '$recursiveAnchor',
  '$recursiveRef',
  '$ref',
  '$schema',
  '$vocabulary',
  'additionalItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'const',
  'contains',
  'contentEncoding',
  'contentMediaType',
  'default',
  'definitions',
  'dependentRequired',
  'dependentSchemas',
  'deprecated',
  'description',
  'discriminator',
  'disjointWith',
  'else',
  'enum',
  'equivalentTo',
  'examples',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'if',
  'inverseOf',
  'items',
  'maxContains',
  'maximum',
  'maxItems',
  'maxLength',
  'maxProperties',
  'minContains',
  'minimum',
  'minItems',
  'minLength',
  'minProperties',
  'multipleOf',
  'not',
  'oneOf',
  'pattern',
  'patternProperties',
  'prefixItems',
  'properties',
  'propertyNames',
  'rdfs:domain',
  'rdfs:range',
  'readOnly',
  'required',
  'symmetric',
  'then',
  'title',
  'transitive',
  'type',
  'unevaluatedItems',
  'unevaluatedProperties',
  'uniqueItems',
  'writeOnly'
]);


type JsonSchemaType = boolean | Record<string, unknown>;

function escapeJsonPointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function unescapeJsonPointer(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

export class SchemaGraph implements SchemaGraphInterface {
  public static buildNormIR(rootSchema: JsonSchemaType): NormIRInterface {
    const graph = new SchemaGraph(rootSchema);

    return graph.getNormIR();
  }
  public static fromNormIR(normIR: NormIRInterface): SchemaGraph {
    const graph = Object.create(SchemaGraph.prototype) as SchemaGraph;

    // Initialize private maps via reflection (bypass constructor)
    const g = graph as unknown as Record<string, unknown>;

    g.anchorMap = new Map<string, SchemaGraphNodeInterface>();
    g.childMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface>>();
    g.entryMap = new WeakMap<SchemaGraphNodeInterface, Map<string, Array<[string, SchemaGraphNodeInterface]>>>();
    g.identityMap = new WeakMap<object, SchemaGraphNodeInterface>();
    g.indexedChildMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface[]>>();
    g.nodeMap = new Map<string, SchemaGraphNodeInterface>();
    g.relationMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphRelationInterface[]>();
    g.semanticMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphSemanticsInterface>();
    g.rootSchema = normIR.rootSchema;

    // Rebuild nodes from NormIR
    for (const normNode of normIR.nodes) {
      const schema = SchemaGraph.resolvePointer(normIR.rootSchema, normNode.pointer);
      const node: SchemaGraphNodeInterface = {
        'id': normNode.id,
        'pointer': normNode.pointer,
        schema
      };

      graph.nodeMap.set(normNode.pointer, node);
      if (isObject(schema)) {
        graph.identityMap.set(schema, node);
      }
      graph.childMap.set(node, new Map());
      graph.entryMap.set(node, new Map());
      graph.indexedChildMap.set(node, new Map());
    }

    // Rebuild children
    for (const [
      pointer,
      childRecord
    ] of Object.entries(normIR.children)) {
      const parentNode = graph.nodeMap.get(pointer);

      if (parentNode === undefined) {
        continue;
      }
      const childMap = graph.childMap.get(parentNode)!;

      for (const [
        key,
        childPointer
      ] of Object.entries(childRecord)) {
        const childNode = graph.nodeMap.get(childPointer);

        if (childNode !== undefined) {
          childMap.set(key, childNode);
        }
      }
    }

    // Rebuild entries
    for (const [
      pointer,
      entryRecord
    ] of Object.entries(normIR.entries)) {
      const parentNode = graph.nodeMap.get(pointer);

      if (parentNode === undefined) {
        continue;
      }
      const entryMap = graph.entryMap.get(parentNode)!;

      for (const [
        key,
        entryList
      ] of Object.entries(entryRecord)) {
        const resolved: Array<[string, SchemaGraphNodeInterface]> = [];

        for (const [
          name,
          entryPointer
        ] of entryList) {
          const entryNode = graph.nodeMap.get(entryPointer);

          if (entryNode !== undefined) {
            resolved.push([
              name,
              entryNode
            ]);
          }
        }
        entryMap.set(key, resolved);
      }
    }

    // Rebuild indexedChildren
    for (const [
      pointer,
      indexedRecord
    ] of Object.entries(normIR.indexedChildren)) {
      const parentNode = graph.nodeMap.get(pointer);

      if (parentNode === undefined) {
        continue;
      }
      const indexedMap = graph.indexedChildMap.get(parentNode)!;

      for (const [
        key,
        pointers
      ] of Object.entries(indexedRecord)) {
        const resolved: SchemaGraphNodeInterface[] = [];

        for (const childPointer of pointers) {
          const childNode = graph.nodeMap.get(childPointer);

          if (childNode !== undefined) {
            resolved.push(childNode);
          }
        }
        indexedMap.set(key, resolved);
      }
    }

    // Rebuild anchors
    for (const [
      anchor,
      anchorPointer
    ] of Object.entries(normIR.anchors)) {
      const anchorNode = graph.nodeMap.get(anchorPointer);

      if (anchorNode !== undefined) {
        graph.anchorMap.set(anchor, anchorNode);
      }
    }

    return graph;
  }
  static resolvePointer(rootSchema: JsonSchemaType, pointer: string): JsonSchemaType {
    if (pointer === '') {
      return rootSchema;
    }
    if (!pointer.startsWith('/')) {
      throw new GraphError('POINTER_INVALID', `Invalid JSON Pointer: ${pointer}`, pointer);
    }

    let current: unknown = rootSchema;

    for (const segment of pointer.slice(1).split('/')
      .map(unescapeJsonPointer)) {
      if (!isObject(current) && !Array.isArray(current)) {
        throw new GraphError('POINTER_NOT_FOUND', `Pointer not found: ${pointer}`, pointer);
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current !== 'boolean' && !isObject(current)) {
      throw new GraphError('POINTER_NOT_SCHEMA', `Pointer does not resolve to a schema: ${pointer}`, pointer);
    }

    return current;
  }
  private readonly anchorMap = new Map<string, SchemaGraphNodeInterface>();
  private readonly childMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface>>();
  private readonly entryMap = new WeakMap<SchemaGraphNodeInterface, Map<string, Array<[string, SchemaGraphNodeInterface]>>>();
  private readonly identityMap = new WeakMap<object, SchemaGraphNodeInterface>();
  private readonly indexedChildMap = new WeakMap<SchemaGraphNodeInterface, Map<string, SchemaGraphNodeInterface[]>>();

  private readonly nodeMap = new Map<string, SchemaGraphNodeInterface>();

  private readonly relationMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphRelationInterface[]>();

  private readonly semanticMap = new WeakMap<SchemaGraphNodeInterface, SchemaGraphSemanticsInterface>();

  public constructor(public readonly rootSchema: JsonSchemaType) {
    this.lower(rootSchema, '');
  }

  public allRelations(): SchemaGraphRelationInterface[] {
    const result: SchemaGraphRelationInterface[] = [];

    for (const node of this.nodeMap.values()) {
      result.push(...this.relations(node));
    }

    return result;
  }

  public child(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface | undefined {
    return this.childMap.get(node)?.get(key);
  }

  public entries(node: SchemaGraphNodeInterface, key: string): Array<[string, SchemaGraphNodeInterface]> {
    return this.entryMap.get(node)?.get(key) ?? [];
  }

  /**
   * if/then/else → conditional structure as a material conditional.
   * Represents (A ∧ B) ∨ (¬A ∧ C) where A=if, B=then, C=else.
   */
  private extractConditionalRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (sem.ifNode === undefined) {
      return;
    }

    const ifRef = this.resolveNodeRef(sem.ifNode);
    const conditionalStructure: { 'elseRef'?: string
      'ifRef': string;
      'kind': 'conditional';
      'thenRef'?: string; } = {
      ifRef,
      'kind': 'conditional'
    };

    if (sem.thenNode !== undefined) {
      conditionalStructure.thenRef = this.resolveNodeRef(sem.thenNode);
    }
    if (sem.elseNode !== undefined) {
      conditionalStructure.elseRef = this.resolveNodeRef(sem.elseNode);
    }

    relations.push({
      'metadata': { 'conditional': true },
      'predicate': 'owl:unionOf',
      'source': node,
      'structure': conditionalStructure,
      'target': node.id
    });
  }

  /**
   * contains → owl:someValuesFrom restriction.
   * The array must contain at least one item matching the contained type.
   */
  private extractContainsRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (sem.containsNode === undefined) {
      return;
    }

    const containsRef = this.resolveNodeRef(sem.containsNode);

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

    // minContains/maxContains → qualified cardinality restrictions
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

  /**
   * dependentRequired → jt:dependentRequired relations.
   * Each entry carries trigger and required property names as metadata.
   */
  private extractDependentRequiredRelations(
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

  /**
   * dependentSchemas → conditional schema application.
   * Each entry says: if property X is present, apply schema Y.
   */
  private extractDependentSchemaRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    for (const [
      propName,
      schemaNode
    ] of sem.dependentSchemaEntries) {
      const schemaRef = this.resolveNodeRef(schemaNode);

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

  /**
   * format → sh:pattern for formats that map to SHACL patterns.
   * Only emitted for formats that don't produce a specific XSD type
   * (i.e., the format maps to base xsd:string).
   */
  private extractFormatPatternRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (sem.format === undefined) {
      return;
    }

    // Only emit for formats that resolve to xsd:string (no specific XSD type)
    const xsd = resolveXsdType(sem);

    if (xsd !== null && xsd !== 'xsd:string') {
      return;
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

    const pattern = FORMAT_PATTERNS[sem.format];

    if (pattern !== undefined) {
      relations.push({
        'metadata': { 'fromFormat': true },
        'predicate': 'sh:pattern',
        'source': node,
        'target': pattern
      });
    }
  }

  /**
   * patternProperties → property relations with pattern metadata.
   * Each pattern maps to a property relation carrying the regex pattern.
   */
  private extractPatternPropertyRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    for (const [
      pattern,
      schemaNode
    ] of sem.patternPropertyEntries) {
      const schemaRef = this.resolveNodeRef(schemaNode);

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

  /**
   * prefixItems → rdfs:member with positional metadata.
   * Each positional item maps to rdf:_N member relation.
   */
  private extractPrefixItemRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    for (const [
      index,
      itemNode
    ] of sem.prefixItems.entries()) {
      const itemRef = this.resolveNodeRef(itemNode);

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

  /**
   * For property nodes, emit sh:minCount (if required) and sh:maxCount (if non-array).
   * Looks up the parent node to check the required array.
   */
  private extractPropertyCardinalityRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (!this.isPropertyNode(node)) {
      return;
    }

    // Non-array → sh:maxCount 1
    if (!sem.schemaTypes.includes('array')) {
      relations.push({
        'predicate': 'sh:maxCount',
        'source': node,
        'target': '1'
      });
    }

    // Required → sh:minCount 1 (need to check parent's required array)
    const parentPointer = this.parentPropertiesPointer(node.pointer);

    if (parentPointer !== undefined) {
      const parentNode = this.nodeMap.get(parentPointer);

      if (parentNode !== undefined) {
        const parentSem = this.semantics(parentNode);
        const propName = this.propertyNameFromPointer(node.pointer);

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

  /**
   * Classify property nodes as owl:ObjectProperty or owl:DatatypeProperty.
   * A property is an ObjectProperty if its type is object, array, or it has a $ref.
   * Otherwise it is a DatatypeProperty.
   * Only applies to nodes that are children of a properties keyword.
   */
  private extractPropertyTypeRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (!this.isPropertyNode(node)) {
      return;
    }

    const nonNullTypes = sem.schemaTypes.filter((t) => {
      return t !== 'null';
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

  private extractRelations(node: SchemaGraphNodeInterface): SchemaGraphRelationInterface[] {
    const sem = this.semantics(node);
    const relations: SchemaGraphRelationInterface[] = [];

    // Class declaration: named schemas become owl:Class
    if (sem.schemaId !== undefined) {
      relations.push({
        'predicate': 'rdf:type',
        'source': node,
        'target': 'owl:Class'
      });
    }

    // $defs entries with type 'object' are also class declarations
    if (sem.schemaId === undefined && this.isDefsEntry(node) && sem.schemaTypes.includes('object')) {
      relations.push({
        'predicate': 'rdf:type',
        'source': node,
        'target': 'owl:Class'
      });
    }

    // Implicit rdfs:domain from tree position (property → parent class)
    if (this.isPropertyNode(node) && sem.rdfsDomain === undefined) {
      const parentPointer = this.parentPropertiesPointer(node.pointer);

      if (parentPointer !== undefined) {
        const parentNode = this.nodeMap.get(parentPointer);

        if (parentNode !== undefined) {
          relations.push({
            'predicate': 'rdfs:domain',
            'source': node,
            'target': parentNode
          });
        }
      }
    }

    // Explicit annotation keys
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

    // Structural: title → rdfs:label
    if (sem.title !== undefined) {
      relations.push({
        'predicate': 'rdfs:label',
        'source': node,
        'target': sem.title
      });
    }
    // Structural: description → rdfs:comment
    if (sem.description !== undefined) {
      relations.push({
        'predicate': 'rdfs:comment',
        'source': node,
        'target': sem.description
      });
    }
    // Structural: deprecated → owl:deprecated
    if (sem.deprecated) {
      relations.push({
        'predicate': 'owl:deprecated',
        'source': node,
        'target': 'true'
      });
    }

    // Structural: readOnly / writeOnly as direct predicates
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

    // Structural: contentMediaType → dct:format
    if (sem.contentMediaType !== undefined) {
      relations.push({
        'predicate': 'dct:format',
        'source': node,
        'target': sem.contentMediaType
      });
    }

    // Structural: allOf → rdfs:subClassOf
    for (const parent of sem.allOf) {
      const parentSem = this.semantics(parent);

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
          'target': this.resolveRefId(parentSem.ref)
        });
      }
    }

    // Structural: anyOf/oneOf → owl:equivalentClass (union members)
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

    // Structural: not → owl:complementOf
    if (sem.notNode !== undefined) {
      relations.push({
        'predicate': 'owl:complementOf',
        'source': node,
        'target': sem.notNode
      });
    }

    // Structural: required → owl:Restriction (minCardinality)
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
        'target': propNode === undefined ? propIRI : propNode
      });
    }

    // Structural: enum → owl:oneOf
    if (sem.enumValues !== undefined) {
      for (const value of sem.enumValues) {
        relations.push({
          'predicate': 'owl:oneOf',
          'source': node,
          'target': typeof value === 'string' ? value : JSON.stringify(value)
        });
      }
    }

    // Structural: const → owl:hasValue
    if (sem.hasConst) {
      relations.push({
        'predicate': 'owl:hasValue',
        'source': node,
        'target': typeof sem.constValue === 'string' ? sem.constValue : JSON.stringify(sem.constValue)
      });
    }

    // Structural: additionalProperties false → sh:closed
    if (sem.additionalPropertiesNode === false) {
      relations.push({
        'predicate': 'sh:closed',
        'source': node,
        'target': 'true'
      });
    }

    // Structural: string/numeric constraints as SHACL constraint relations
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

    // Structural: XSD datatype resolution → sh:datatype
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

    // Structural: $ref → rdfs:range on the property node (node reference)
    if (sem.ref !== undefined) {
      relations.push({
        'metadata': { 'fromRef': true },
        'predicate': 'rdfs:range',
        'source': node,
        'target': this.resolveRefId(sem.ref)
      });
    }

    // Property classification: rdf:type for ObjectProperty vs DatatypeProperty
    this.extractPropertyTypeRelations(node, sem, relations);

    // Property-level SHACL cardinality from parent context
    this.extractPropertyCardinalityRelations(node, sem, relations);

    // if/then/else → conditional structure
    this.extractConditionalRelations(node, sem, relations);

    // dependentSchemas → conditional schema application
    this.extractDependentSchemaRelations(node, sem, relations);

    // contains → owl:someValuesFrom restriction
    this.extractContainsRelations(node, sem, relations);

    // prefixItems → rdfs:member positional restrictions
    this.extractPrefixItemRelations(node, sem, relations);

    // patternProperties → property relations with pattern metadata
    this.extractPatternPropertyRelations(node, sem, relations);

    // Multi-type properties → owl:unionOf
    this.extractUnionTypeRelations(node, sem, relations);

    // dependentRequired → implication relations
    this.extractDependentRequiredRelations(node, sem, relations);

    // format → format-derived SHACL pattern
    this.extractFormatPatternRelations(node, sem, relations);

    return relations;
  }

  private extractSemantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface {
    const empty: SchemaGraphSemanticsInterface = {
      'additionalItemsNode': undefined,
      'additionalPropertiesNode': undefined,
      'allOf': [],
      'anyOf': [],
      'comment': undefined,
      'constValue': undefined,
      'containsNode': undefined,
      'contentEncoding': undefined,
      'contentMediaType': undefined,
      'defaultValue': undefined,
      'definitions': [],
      'dependentRequired': {},
      'dependentSchemaEntries': [],
      'deprecated': false,
      'description': undefined,
      'discriminatorMapping': undefined,
      'discriminatorPropertyName': undefined,
      'disjointWith': undefined,
      'dynamicAnchor': undefined,
      'dynamicRef': undefined,
      'elseNode': undefined,
      'enumValues': undefined,
      'equivalentTo': undefined,
      'examples': undefined,
      'exclusiveMaximum': undefined,
      'exclusiveMinimum': undefined,
      'extensions': {},
      'format': undefined,
      'hasConst': false,
      'hasDefault': false,
      'ifNode': undefined,
      'inverseOf': undefined,
      'itemsNode': undefined,
      'maxContains': undefined,
      'maximum': undefined,
      'maxItems': undefined,
      'maxLength': undefined,
      'maxProperties': undefined,
      'minContains': undefined,
      'minimum': undefined,
      'minItems': undefined,
      'minLength': undefined,
      'minProperties': undefined,
      'multipleOf': undefined,
      'notNode': undefined,
      'oneOf': [],
      'pattern': undefined,
      'patternPropertyEntries': [],
      'prefixItems': [],
      'properties': new Map(),
      'propertyNamesNode': undefined,
      'rdfsDomain': undefined,
      'rdfsRange': undefined,
      'readOnly': false,
      'recursiveAnchor': false,
      'recursiveRef': undefined,
      'ref': undefined,
      'refTargetNode': undefined,
      'required': [],
      'schemaAnchor': undefined,
      'schemaDialect': undefined,
      'schemaId': undefined,
      'schemaTypes': [],
      'schemaVocabulary': undefined,
      'symmetric': false,
      'thenNode': undefined,
      'title': undefined,
      'transitive': false,
      'unevaluatedItemsNode': undefined,
      'unevaluatedPropertiesNode': undefined,
      'uniqueItems': false,
      'writeOnly': false
    };

    if (!isObject(node.schema)) {
      return empty;
    }

    const rawType = node.schema.type;
    const schemaTypes = typeof rawType === 'string'
      ? [rawType]
      : Array.isArray(rawType)
        ? rawType.filter((entry): entry is string => {
          return typeof entry === 'string';
        })
        : [];
    const dynamicAnchor = typeof node.schema.$dynamicAnchor === 'string'
      ? node.schema.$dynamicAnchor
      : node.schema.$recursiveAnchor === true
        ? ''
        : undefined;
    const dependentRequired = isObject(node.schema.dependentRequired)
      ? Object.fromEntries(Object.entries(node.schema.dependentRequired).flatMap(([
        key,
        value
      ]) => {
        if (!Array.isArray(value)) {
          return [];
        }

        const entries = value.filter((entry): entry is string => {
          return typeof entry === 'string';
        });

        return [[
          key,
          entries
        ] as [string, string[]]];
      }))
      : {};

    const ref = typeof node.schema.$ref === 'string' ? node.schema.$ref : undefined;

    const discriminator = isObject(node.schema.discriminator) ? node.schema.discriminator : undefined;

    // Collect extension keywords (any key not in KNOWN_KEYWORDS)
    const extensions: Record<string, unknown> = {};

    for (const key of Object.keys(node.schema)) {
      if (!KNOWN_KEYWORDS.has(key)) {
        extensions[key] = node.schema[key];
      }
    }

    return {
      'additionalItemsNode': this.resolveAdditionalItems(node),
      'additionalPropertiesNode': this.resolveAdditionalProperties(node),
      'allOf': this.indexedChildren(node, 'allOf'),
      'anyOf': this.indexedChildren(node, 'anyOf'),
      'comment': typeof node.schema.$comment === 'string' ? node.schema.$comment : undefined,
      'constValue': 'const' in node.schema ? node.schema.const : undefined,
      'containsNode': this.child(node, 'contains'),
      'contentEncoding': typeof node.schema.contentEncoding === 'string' ? node.schema.contentEncoding : undefined,
      'contentMediaType': typeof node.schema.contentMediaType === 'string' ? node.schema.contentMediaType : undefined,
      'defaultValue': 'default' in node.schema ? node.schema.default : undefined,
      'definitions': this.entries(node, 'definitions'),
      dependentRequired,
      'dependentSchemaEntries': this.entries(node, 'dependentSchemas'),
      'deprecated': node.schema.deprecated === true,
      'description': typeof node.schema.description === 'string' ? node.schema.description : undefined,
      'discriminatorMapping': discriminator !== undefined && isObject(discriminator.mapping) ? discriminator.mapping as Record<string, string> : undefined,
      'discriminatorPropertyName': discriminator !== undefined && typeof discriminator.propertyName === 'string' ? discriminator.propertyName : undefined,
      'disjointWith': typeof node.schema.disjointWith === 'string' ? node.schema.disjointWith : undefined,
      dynamicAnchor,
      'dynamicRef': typeof node.schema.$dynamicRef === 'string' ? node.schema.$dynamicRef : undefined,
      'elseNode': this.child(node, 'else'),
      'enumValues': Array.isArray(node.schema.enum) ? node.schema.enum as unknown[] : undefined,
      'equivalentTo': typeof node.schema.equivalentTo === 'string' ? node.schema.equivalentTo : undefined,
      'examples': Array.isArray(node.schema.examples) ? node.schema.examples as unknown[] : undefined,
      'exclusiveMaximum': typeof node.schema.exclusiveMaximum === 'number' ? node.schema.exclusiveMaximum : undefined,
      'exclusiveMinimum': typeof node.schema.exclusiveMinimum === 'number' ? node.schema.exclusiveMinimum : undefined,
      extensions,
      'format': typeof node.schema.format === 'string' ? node.schema.format : undefined,
      'hasConst': 'const' in node.schema,
      'hasDefault': 'default' in node.schema,
      'ifNode': this.child(node, 'if'),
      'inverseOf': typeof node.schema.inverseOf === 'string' ? node.schema.inverseOf : undefined,
      'itemsNode': this.child(node, 'items'),
      'maxContains': typeof node.schema.maxContains === 'number' ? node.schema.maxContains : undefined,
      'maximum': typeof node.schema.maximum === 'number' ? node.schema.maximum : undefined,
      'maxItems': typeof node.schema.maxItems === 'number' ? node.schema.maxItems : undefined,
      'maxLength': typeof node.schema.maxLength === 'number' ? node.schema.maxLength : undefined,
      'maxProperties': typeof node.schema.maxProperties === 'number' ? node.schema.maxProperties : undefined,
      'minContains': typeof node.schema.minContains === 'number' ? node.schema.minContains : undefined,
      'minimum': typeof node.schema.minimum === 'number' ? node.schema.minimum : undefined,
      'minItems': typeof node.schema.minItems === 'number' ? node.schema.minItems : undefined,
      'minLength': typeof node.schema.minLength === 'number' ? node.schema.minLength : undefined,
      'minProperties': typeof node.schema.minProperties === 'number' ? node.schema.minProperties : undefined,
      'multipleOf': typeof node.schema.multipleOf === 'number' ? node.schema.multipleOf : undefined,
      'notNode': this.child(node, 'not'),
      'oneOf': this.indexedChildren(node, 'oneOf'),
      'pattern': typeof node.schema.pattern === 'string' ? node.schema.pattern : undefined,
      'patternPropertyEntries': this.entries(node, 'patternProperties'),
      'prefixItems': this.indexedChildren(node, 'prefixItems'),
      'properties': new Map(this.entries(node, 'properties')),
      'propertyNamesNode': this.child(node, 'propertyNames'),
      'rdfsDomain': typeof node.schema['rdfs:domain'] === 'string' ? node.schema['rdfs:domain'] : undefined,
      'rdfsRange': typeof node.schema['rdfs:range'] === 'string' ? node.schema['rdfs:range'] : undefined,
      'readOnly': node.schema.readOnly === true,
      'recursiveAnchor': node.schema.$recursiveAnchor === true,
      'recursiveRef': typeof node.schema.$recursiveRef === 'string' ? node.schema.$recursiveRef : undefined,
      ref,
      'refTargetNode': ref?.startsWith('#') ? this.resolveLocalRef(ref) : undefined,
      'required': Array.isArray(node.schema.required)
        ? node.schema.required.filter((entry): entry is string => {
          return typeof entry === 'string';
        })
        : [],
      'schemaAnchor': typeof node.schema.$anchor === 'string' ? node.schema.$anchor : undefined,
      'schemaDialect': typeof node.schema.$schema === 'string' ? node.schema.$schema : undefined,
      'schemaId': typeof node.schema.$id === 'string' ? node.schema.$id : undefined,
      schemaTypes,
      'schemaVocabulary': node.schema.$vocabulary,
      'symmetric': node.schema.symmetric === true,
      'thenNode': this.child(node, 'then'),
      'title': typeof node.schema.title === 'string' ? node.schema.title : undefined,
      'transitive': node.schema.transitive === true,
      'unevaluatedItemsNode': this.child(node, 'unevaluatedItems'),
      'unevaluatedPropertiesNode': this.child(node, 'unevaluatedProperties'),
      'uniqueItems': node.schema.uniqueItems === true,
      'writeOnly': node.schema.writeOnly === true
    };
  }

  /**
   * Multi-type properties → owl:unionOf with list structure.
   * When a property has multiple non-null types, produce a union relation.
   */
  private extractUnionTypeRelations(
    node: SchemaGraphNodeInterface,
    sem: SchemaGraphSemanticsInterface,
    relations: SchemaGraphRelationInterface[]
  ): void {
    if (!this.isPropertyNode(node)) {
      return;
    }

    const nonNullTypes = sem.schemaTypes.filter((t) => {
      return t !== 'null';
    });

    if (nonNullTypes.length <= 1) {
      return;
    }

    const resolved: string[] = [];

    for (const t of nonNullTypes) {
      const xsd = this.resolveSingleType(t, sem.format);

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

  public getNormIR(): NormIRInterface {
    const nodes: Array<{ 'id': string;
      'pointer': string }> = [];
    const children: Record<string, Record<string, string>> = {};
    const entries: Record<string, Record<string, Array<[string, string]>>> = {};
    const indexedChildren: Record<string, Record<string, string[]>> = {};
    const anchors: Record<string, string> = {};

    for (const node of this.nodeMap.values()) {
      nodes.push({
        'id': node.id,
        'pointer': node.pointer
      });

      const nodeChildren = this.childMap.get(node);

      if (nodeChildren !== undefined && nodeChildren.size > 0) {
        const childRecord: Record<string, string> = {};

        for (const [
          key,
          childNode
        ] of nodeChildren) {
          childRecord[key] = childNode.pointer;
        }
        children[node.pointer] = childRecord;
      }

      const nodeEntries = this.entryMap.get(node);

      if (nodeEntries !== undefined && nodeEntries.size > 0) {
        const entryRecord: Record<string, Array<[string, string]>> = {};

        for (const [
          key,
          entryList
        ] of nodeEntries) {
          entryRecord[key] = entryList.map(([
            name,
            entryNode
          ]) => {
            return [
              name,
              entryNode.pointer
            ];
          });
        }
        entries[node.pointer] = entryRecord;
      }

      const nodeIndexed = this.indexedChildMap.get(node);

      if (nodeIndexed !== undefined && nodeIndexed.size > 0) {
        const indexedRecord: Record<string, string[]> = {};

        for (const [
          key,
          indexedList
        ] of nodeIndexed) {
          indexedRecord[key] = indexedList.map((n) => {
            return n.pointer;
          });
        }
        indexedChildren[node.pointer] = indexedRecord;
      }
    }

    for (const [
      anchor,
      anchorNode
    ] of this.anchorMap) {
      anchors[anchor] = anchorNode.pointer;
    }

    return {
      anchors,
      children,
      entries,
      indexedChildren,
      nodes,
      'rootSchema': this.rootSchema
    };
  }

  public indexedChildren(node: SchemaGraphNodeInterface, key: string): SchemaGraphNodeInterface[] {
    return this.indexedChildMap.get(node)?.get(key) ?? [];
  }

  /**
   * Check whether the node is a direct $defs entry (e.g. /$defs/Foo).
   */
  private isDefsEntry(node: SchemaGraphNodeInterface): boolean {
    const parts = node.pointer.split('/');

    return parts.length === 3 && parts[1] === '$defs';
  }

  /**
   * Check whether a node sits under a /properties/ path — i.e. it is a property schema.
   */
  private isPropertyNode(node: SchemaGraphNodeInterface): boolean {
    const parts = node.pointer.split('/');

    return parts.length >= 3 && parts.at(-2) === 'properties';
  }

  public keywordValue(node: SchemaGraphNodeInterface, key: string): unknown {
    if (!isObject(node.schema)) {
      return undefined;
    }

    return node.schema[key];
  }

  private lower(schema: JsonSchemaType, pointer: string): void {
    const id = this.nodeId(pointer, schema);
    const node = {
      id,
      pointer,
      schema
    };

    this.nodeMap.set(pointer, node);
    if (isObject(schema)) {
      this.identityMap.set(schema, node);
    }
    this.childMap.set(node, new Map());
    this.entryMap.set(node, new Map());
    this.indexedChildMap.set(node, new Map());

    if (!isObject(schema)) {
      return;
    }

    if (typeof schema.$anchor === 'string') {
      this.anchorMap.set(schema.$anchor, this.nodeMap.get(pointer) as SchemaGraphNodeInterface);
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      this.anchorMap.set(schema.$dynamicAnchor, this.nodeMap.get(pointer) as SchemaGraphNodeInterface);
    }

    for (const [
      key,
      value
    ] of Object.entries(schema)) {
      if (typeof value === 'boolean' || isObject(value)) {
        const childPointer = `${pointer}/${escapeJsonPointer(key)}`;

        this.lower(value as JsonSchemaType, childPointer);
        this.childMap.get(node)?.set(key, this.nodeMap.get(childPointer) as SchemaGraphNodeInterface);

        if (isObject(value)) {
          const entries: Array<[string, SchemaGraphNodeInterface]> = [];

          for (const entryKey of Object.keys(value)) {
            const entryValue = value[entryKey];

            if (!isObject(entryValue) && typeof entryValue !== 'boolean') {
              continue;
            }

            const entryPointer = `${childPointer}/${escapeJsonPointer(entryKey)}`;

            entries.push([
              entryKey,
              this.nodeMap.get(entryPointer) as SchemaGraphNodeInterface
            ]);
          }

          if (entries.length > 0) {
            this.entryMap.get(node)?.set(key, entries);
          }
        }
        continue;
      }
      if (!Array.isArray(value)) {
        continue;
      }

      const indexedChildren: SchemaGraphNodeInterface[] = [];

      for (const [
        index,
        element
      ] of value.entries()) {
        if (typeof element === 'boolean' || isObject(element)) {
          const elementPointer = `${pointer}/${escapeJsonPointer(key)}/${index}`;

          this.lower(element as JsonSchemaType, elementPointer);
          indexedChildren.push(this.nodeMap.get(elementPointer) as SchemaGraphNodeInterface);
        }
      }

      if (indexedChildren.length > 0) {
        this.indexedChildMap.get(node)?.set(key, indexedChildren);
      }
    }
  }

  public node(schema: Record<string, unknown>): SchemaGraphNodeInterface | undefined {
    return this.identityMap.get(schema);
  }

  private nodeId(pointer: string, schema: JsonSchemaType): string {
    if (!isObject(schema)) {
      return this.pointerId(pointer);
    }

    if (typeof schema.$id === 'string') {
      return schema.$id;
    }

    return this.pointerId(pointer);
  }

  public nodes(): SchemaGraphNodeInterface[] {
    return [...this.nodeMap.values()];
  }

  /**
   * Extract the parent pointer from a /properties/X path.
   * Returns the pointer of the object that owns this property.
   */
  private parentPropertiesPointer(pointer: string): string | undefined {
    const idx = pointer.lastIndexOf('/properties/');

    if (idx === -1) {
      return undefined;
    }

    return pointer.slice(0, idx) || '';
  }

  private pointerId(pointer: string): string {
    if (pointer === '') {
      return typeof this.rootSchema === 'object'
        && this.rootSchema !== null
        && !Array.isArray(this.rootSchema)
        && typeof this.rootSchema.$id === 'string'
        ? this.rootSchema.$id
        : '#root';
    }

    if (typeof this.rootSchema === 'object'
      && this.rootSchema !== null
      && !Array.isArray(this.rootSchema)
      && typeof this.rootSchema.$id === 'string') {
      return `${this.rootSchema.$id}#${pointer}`;
    }

    return `#${pointer}`;
  }

  /**
   * Extract the property name from a /properties/X pointer.
   */
  private propertyNameFromPointer(pointer: string): string | undefined {
    const parts = pointer.split('/');

    if (parts.length < 3 || parts.at(-2) !== 'properties') {
      return undefined;
    }

    return parts.at(-1);
  }

  public relations(node: SchemaGraphNodeInterface): SchemaGraphRelationInterface[] {
    const cached = this.relationMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const relations = this.extractRelations(node);

    this.relationMap.set(node, relations);

    return relations;
  }

  private resolveAdditionalItems(node: SchemaGraphNodeInterface): boolean | SchemaGraphNodeInterface | undefined {
    if (!isObject(node.schema) || !('additionalItems' in node.schema)) {
      return undefined;
    }
    if (typeof node.schema.additionalItems === 'boolean') {
      return node.schema.additionalItems;
    }

    return this.child(node, 'additionalItems');
  }

  private resolveAdditionalProperties(node: SchemaGraphNodeInterface): boolean | SchemaGraphNodeInterface | undefined {
    if (!isObject(node.schema) || !('additionalProperties' in node.schema)) {
      return undefined;
    }
    if (typeof node.schema.additionalProperties === 'boolean') {
      return node.schema.additionalProperties;
    }

    return this.child(node, 'additionalProperties');
  }

  public resolveFragment(fragment: string): SchemaGraphNodeInterface {
    if (fragment === '') {
      return this.rootNode;
    }
    if (fragment.startsWith('/')) {
      return this.resolvePointer(fragment);
    }

    const anchored = this.anchorMap.get(fragment);

    if (anchored === undefined) {
      throw new GraphError('ANCHOR_NOT_FOUND', `Unknown schema anchor: #${fragment}`, fragment);
    }

    return anchored;
  }

  private resolveLocalRef(ref: string): SchemaGraphNodeInterface {
    if (ref === '#') {
      return this.rootNode;
    }
    if (ref.startsWith('#/')) {
      return this.resolvePointer(ref.slice(1));
    }

    return this.resolveFragment(ref.slice(1));
  }

  /**
   * Resolve a node to its IRI, following $ref if present.
   */
  private resolveNodeRef(node: SchemaGraphNodeInterface): string {
    const nodeSem = this.semantics(node);

    if (typeof nodeSem.ref === 'string') {
      return this.resolveRefId(nodeSem.ref);
    }

    const xsd = resolveXsdType(nodeSem);

    if (xsd !== null) {
      return xsd;
    }

    return node.id;
  }

  public resolvePointer(pointer: string): SchemaGraphNodeInterface {
    if (pointer === '') {
      return this.rootNode;
    }
    if (!pointer.startsWith('/')) {
      throw new GraphError('POINTER_INVALID', `Invalid JSON Pointer: ${pointer}`, pointer);
    }

    const resolved = this.nodeMap.get(pointer);

    if (resolved === undefined) {
      throw new GraphError('POINTER_NOT_FOUND', `Pointer not found: ${pointer}`, pointer);
    }

    return resolved;
  }

  public resolveRefId(ref: string): string {
    if (!ref.startsWith('#')) {
      return ref;
    }

    return this.resolveLocalRef(ref).id;
  }

  /**
   * Resolve a single JSON Schema type string to its XSD equivalent.
   */
  private resolveSingleType(type: string, format: string | undefined): null | string {
    return resolveSingleXsdType(type, format);
  }

  public get rootNode(): SchemaGraphNodeInterface {
    return this.nodeMap.get('') as SchemaGraphNodeInterface;
  }

  public semantics(node: SchemaGraphNodeInterface): SchemaGraphSemanticsInterface {
    const cached = this.semanticMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const semantics = this.extractSemantics(node);

    this.semanticMap.set(node, semantics);

    return semantics;
  }

  public validateStructure(): StructureWarningInterface[] {
    const warnings: StructureWarningInterface[] = [];

    for (const node of this.nodeMap.values()) {
      if (node.pointer === '') {
        continue;
      }
      if (!isObject(node.schema)) {
        continue;
      }
      const schema = node.schema;

      if (!('properties' in schema)) {
        continue;
      }
      const rawType = schema.type;
      const hasObjectType = rawType === 'object'
        || (Array.isArray(rawType) && rawType.includes('object'));

      if (!hasObjectType) {
        continue;
      }
      if (typeof schema.$id === 'string') {
        continue;
      }
      if (node.pointer.includes('/$defs/')) {
        continue;
      }

      warnings.push({
        'message': `Inline nested object at "${node.pointer}" must be extracted to its own schema with a $id and referenced via $ref.`,
        'path': node.pointer,
        'rule': 'inline-object'
      });
    }

    return warnings;
  }
}
