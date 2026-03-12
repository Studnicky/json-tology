type JsonSchema = boolean | Record<string, unknown>;

export interface SchemaGraphNode {
  'id': string;
  'pointer': string;
  'schema': JsonSchema;
}

export interface SchemaGraphSemantics {
  'allOf': SchemaGraphNode[];
  'anyOf': SchemaGraphNode[];
  'containsNode': SchemaGraphNode | undefined;
  'dependentRequired': Record<string, string[]>;
  'dependentSchemaEntries': Array<[string, SchemaGraphNode]>;
  'dynamicAnchor': string | undefined;
  'dynamicRef': string | undefined;
  'elseNode': SchemaGraphNode | undefined;
  'ifNode': SchemaGraphNode | undefined;
  'itemsNode': SchemaGraphNode | undefined;
  'oneOf': SchemaGraphNode[];
  'patternPropertyEntries': Array<[string, SchemaGraphNode]>;
  'prefixItems': SchemaGraphNode[];
  'properties': Array<[string, SchemaGraphNode]>;
  'propertyNamesNode': SchemaGraphNode | undefined;
  'ref': string | undefined;
  'refTargetNode': SchemaGraphNode | undefined;
  'required': string[];
  'schemaTypes': string[];
  'thenNode': SchemaGraphNode | undefined;
  'unevaluatedItemsNode': SchemaGraphNode | undefined;
  'unevaluatedPropertiesNode': SchemaGraphNode | undefined;
  'title': string | undefined;
  'description': string | undefined;
  'format': string | undefined;
  'defaultValue': unknown;
  'hasDefault': boolean;
  'constValue': unknown;
  'hasConst': boolean;
  'enumValues': unknown[] | undefined;
  'minimum': number | undefined;
  'maximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'exclusiveMaximum': number | undefined;
  'multipleOf': number | undefined;
  'minLength': number | undefined;
  'maxLength': number | undefined;
  'pattern': string | undefined;
  'minItems': number | undefined;
  'maxItems': number | undefined;
  'uniqueItems': boolean;
  'minProperties': number | undefined;
  'maxProperties': number | undefined;
  'additionalPropertiesNode': SchemaGraphNode | boolean | undefined;
  'notNode': SchemaGraphNode | undefined;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'readOnly': boolean;
  'writeOnly': boolean;
  'deprecated': boolean;
  'rdfsDomain': string | undefined;
  'rdfsRange': string | undefined;
  'disjointWith': string | undefined;
  'equivalentTo': string | undefined;
  'inverseOf': string | undefined;
  'transitive': boolean;
  'symmetric': boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeJsonPointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function unescapeJsonPointer(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

export type RelationPredicate =
  | 'rdfs:domain'
  | 'rdfs:range'
  | 'rdfs:subClassOf'
  | 'rdfs:label'
  | 'rdfs:comment'
  | 'owl:equivalentClass'
  | 'owl:complementOf'
  | 'owl:disjointWith'
  | 'owl:inverseOf'
  | 'owl:TransitiveProperty'
  | 'owl:SymmetricProperty'
  | 'owl:deprecated'
  | 'owl:Restriction'
  | 'owl:oneOf';

export interface SchemaGraphRelation {
  predicate: RelationPredicate;
  source: SchemaGraphNode;
  target: SchemaGraphNode | string;
  metadata?: Record<string, unknown>;
}

export interface StructureWarning {
  path: string;
  rule: string;
  message: string;
}

export class SchemaGraph {
  private readonly anchorMap = new Map<string, SchemaGraphNode>();
  private readonly childMap = new WeakMap<SchemaGraphNode, Map<string, SchemaGraphNode>>();
  private readonly entryMap = new WeakMap<SchemaGraphNode, Map<string, Array<[string, SchemaGraphNode]>>>();
  private readonly identityMap = new WeakMap<object, SchemaGraphNode>();
  private readonly indexedChildMap = new WeakMap<SchemaGraphNode, Map<string, SchemaGraphNode[]>>();
  private readonly nodeMap = new Map<string, SchemaGraphNode>();
  private readonly relationMap = new WeakMap<SchemaGraphNode, SchemaGraphRelation[]>();
  private readonly semanticMap = new WeakMap<SchemaGraphNode, SchemaGraphSemantics>();

  public constructor(public readonly rootSchema: JsonSchema) {
    this.lower(rootSchema, '');
  }

  public resolveFragment(fragment: string): SchemaGraphNode {
    if (fragment === '') {
      return this.rootNode;
    }
    if (fragment.startsWith('/')) {
      return this.resolvePointer(fragment);
    }

    const anchored = this.anchorMap.get(fragment);

    if (anchored === undefined) {
      throw new Error(`Unknown schema anchor: #${fragment}`);
    }

    return anchored;
  }

  public resolvePointer(pointer: string): SchemaGraphNode {
    if (pointer === '') {
      return this.rootNode;
    }
    if (!pointer.startsWith('/')) {
      throw new Error(`Invalid JSON Pointer: ${pointer}`);
    }

    const resolved = this.nodeMap.get(pointer);

    if (resolved === undefined) {
      throw new Error(`Pointer not found: ${pointer}`);
    }

    return resolved;
  }

  public resolveRefId(ref: string): string {
    if (!ref.startsWith('#')) {
      return ref;
    }

    return this.resolveLocalRef(ref).id;
  }

  public child(node: SchemaGraphNode, key: string): SchemaGraphNode | undefined {
    return this.childMap.get(node)?.get(key);
  }

  public keywordValue(node: SchemaGraphNode, key: string): unknown {
    if (!isObject(node.schema)) {
      return undefined;
    }

    return node.schema[key];
  }

  public entries(node: SchemaGraphNode, key: string): Array<[string, SchemaGraphNode]> {
    return this.entryMap.get(node)?.get(key) ?? [];
  }

  public node(schema: Record<string, unknown>): SchemaGraphNode | undefined {
    return this.identityMap.get(schema);
  }

  public indexedChildren(node: SchemaGraphNode, key: string): SchemaGraphNode[] {
    return this.indexedChildMap.get(node)?.get(key) ?? [];
  }

  public get rootNode(): SchemaGraphNode {
    return this.nodeMap.get('') as SchemaGraphNode;
  }

  public nodes(): SchemaGraphNode[] {
    return [...this.nodeMap.values()];
  }

  public validateStructure(): StructureWarning[] {
    const warnings: StructureWarning[] = [];

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
        path: node.pointer,
        rule: 'inline-object',
        message: `Inline nested object at "${node.pointer}" must be extracted to its own schema with a $id and referenced via $ref.`
      });
    }

    return warnings;
  }

  public semantics(node: SchemaGraphNode): SchemaGraphSemantics {
    const cached = this.semanticMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const semantics = this.extractSemantics(node);

    this.semanticMap.set(node, semantics);

    return semantics;
  }

  public relations(node: SchemaGraphNode): SchemaGraphRelation[] {
    const cached = this.relationMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const relations = this.extractRelations(node);

    this.relationMap.set(node, relations);

    return relations;
  }

  public allRelations(): SchemaGraphRelation[] {
    const result: SchemaGraphRelation[] = [];

    for (const node of this.nodeMap.values()) {
      result.push(...this.relations(node));
    }

    return result;
  }

  private extractRelations(node: SchemaGraphNode): SchemaGraphRelation[] {
    const sem = this.semantics(node);
    const relations: SchemaGraphRelation[] = [];

    // Explicit annotation keys
    if (sem.rdfsDomain !== undefined) {
      relations.push({ predicate: 'rdfs:domain', source: node, target: sem.rdfsDomain });
    }
    if (sem.rdfsRange !== undefined) {
      relations.push({ predicate: 'rdfs:range', source: node, target: sem.rdfsRange });
    }
    if (sem.disjointWith !== undefined) {
      relations.push({ predicate: 'owl:disjointWith', source: node, target: sem.disjointWith });
    }
    if (sem.equivalentTo !== undefined) {
      relations.push({ predicate: 'owl:equivalentClass', source: node, target: sem.equivalentTo });
    }
    if (sem.inverseOf !== undefined) {
      relations.push({ predicate: 'owl:inverseOf', source: node, target: sem.inverseOf });
    }
    if (sem.transitive) {
      relations.push({ predicate: 'owl:TransitiveProperty', source: node, target: node.id });
    }
    if (sem.symmetric) {
      relations.push({ predicate: 'owl:SymmetricProperty', source: node, target: node.id });
    }

    // Structural: title → rdfs:label
    if (sem.title !== undefined) {
      relations.push({ predicate: 'rdfs:label', source: node, target: sem.title });
    }
    // Structural: description → rdfs:comment
    if (sem.description !== undefined) {
      relations.push({ predicate: 'rdfs:comment', source: node, target: sem.description });
    }
    // Structural: deprecated → owl:deprecated
    if (sem.deprecated) {
      relations.push({ predicate: 'owl:deprecated', source: node, target: 'true' });
    }

    // Structural: allOf → rdfs:subClassOf
    for (const parent of sem.allOf) {
      const parentSem = this.semantics(parent);

      if (parentSem.ref !== undefined) {
        relations.push({ predicate: 'rdfs:subClassOf', source: node, target: this.resolveRefId(parentSem.ref) });
      } else {
        relations.push({ predicate: 'rdfs:subClassOf', source: node, target: parent });
      }
    }

    // Structural: anyOf/oneOf → owl:equivalentClass (union members)
    for (const branch of [...sem.anyOf, ...sem.oneOf]) {
      relations.push({ predicate: 'owl:equivalentClass', source: node, target: branch });
    }

    // Structural: not → owl:complementOf
    if (sem.notNode !== undefined) {
      relations.push({ predicate: 'owl:complementOf', source: node, target: sem.notNode });
    }

    // Structural: required → owl:Restriction (minCardinality)
    for (const propertyName of sem.required) {
      const propEntry = sem.properties.find(([key]) => key === propertyName);
      const propIRI = `${node.id}#${propertyName}`;

      relations.push({
        predicate: 'owl:Restriction',
        source: node,
        target: propEntry !== undefined ? propEntry[1] : propIRI,
        metadata: { minCardinality: 1, onProperty: propIRI }
      });
    }

    // Structural: enum → owl:oneOf
    if (sem.enumValues !== undefined) {
      for (const value of sem.enumValues) {
        relations.push({
          predicate: 'owl:oneOf',
          source: node,
          target: typeof value === 'string' ? value : JSON.stringify(value)
        });
      }
    }

    return relations;
  }

  private extractSemantics(node: SchemaGraphNode): SchemaGraphSemantics {
    if (!isObject(node.schema)) {
      return {
        'allOf': [],
        'anyOf': [],
        'containsNode': undefined,
        'dependentRequired': {},
        'dependentSchemaEntries': [],
        'dynamicAnchor': undefined,
        'dynamicRef': undefined,
        'elseNode': undefined,
        'ifNode': undefined,
        'itemsNode': undefined,
        'oneOf': [],
        'patternPropertyEntries': [],
        'prefixItems': [],
        'properties': [],
        'propertyNamesNode': undefined,
        'ref': undefined,
        'refTargetNode': undefined,
        'required': [],
        'schemaTypes': [],
        'thenNode': undefined,
        'unevaluatedItemsNode': undefined,
        'unevaluatedPropertiesNode': undefined,
        'title': undefined,
        'description': undefined,
        'format': undefined,
        'defaultValue': undefined,
        'hasDefault': false,
        'constValue': undefined,
        'hasConst': false,
        'enumValues': undefined,
        'minimum': undefined,
        'maximum': undefined,
        'exclusiveMinimum': undefined,
        'exclusiveMaximum': undefined,
        'multipleOf': undefined,
        'minLength': undefined,
        'maxLength': undefined,
        'pattern': undefined,
        'minItems': undefined,
        'maxItems': undefined,
        'uniqueItems': false,
        'minProperties': undefined,
        'maxProperties': undefined,
        'additionalPropertiesNode': undefined,
        'notNode': undefined,
        'contentEncoding': undefined,
        'contentMediaType': undefined,
        'readOnly': false,
        'writeOnly': false,
        'deprecated': false,
        'rdfsDomain': undefined,
        'rdfsRange': undefined,
        'disjointWith': undefined,
        'equivalentTo': undefined,
        'inverseOf': undefined,
        'transitive': false,
        'symmetric': false
      };
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
      ? Object.fromEntries(Object.entries(node.schema.dependentRequired).flatMap(([key, value]) => {
        if (!Array.isArray(value)) {
          return [];
        }

        const entries = value.filter((entry): entry is string => {
          return typeof entry === 'string';
        });

        return [[key, entries] as [string, string[]]];
      }))
      : {};

    const ref = typeof node.schema.$ref === 'string' ? node.schema.$ref : undefined;

    return {
      'allOf': this.indexedChildren(node, 'allOf'),
      'anyOf': this.indexedChildren(node, 'anyOf'),
      'containsNode': this.child(node, 'contains'),
      dependentRequired,
      'dependentSchemaEntries': this.entries(node, 'dependentSchemas'),
      dynamicAnchor,
      'dynamicRef': typeof node.schema.$dynamicRef === 'string' ? node.schema.$dynamicRef : undefined,
      'elseNode': this.child(node, 'else'),
      'ifNode': this.child(node, 'if'),
      'itemsNode': this.child(node, 'items'),
      'oneOf': this.indexedChildren(node, 'oneOf'),
      'patternPropertyEntries': this.entries(node, 'patternProperties'),
      'prefixItems': this.indexedChildren(node, 'prefixItems'),
      'properties': this.entries(node, 'properties'),
      'propertyNamesNode': this.child(node, 'propertyNames'),
      ref,
      'refTargetNode': ref?.startsWith('#') ? this.resolveLocalRef(ref) : undefined,
      'required': Array.isArray(node.schema.required)
        ? node.schema.required.filter((entry): entry is string => {
          return typeof entry === 'string';
        })
        : [],
      schemaTypes,
      'thenNode': this.child(node, 'then'),
      'unevaluatedItemsNode': this.child(node, 'unevaluatedItems'),
      'unevaluatedPropertiesNode': this.child(node, 'unevaluatedProperties'),
      'title': typeof node.schema.title === 'string' ? node.schema.title : undefined,
      'description': typeof node.schema.description === 'string' ? node.schema.description : undefined,
      'format': typeof node.schema.format === 'string' ? node.schema.format : undefined,
      'defaultValue': 'default' in node.schema ? node.schema.default : undefined,
      'hasDefault': 'default' in node.schema,
      'constValue': 'const' in node.schema ? node.schema.const : undefined,
      'hasConst': 'const' in node.schema,
      'enumValues': Array.isArray(node.schema.enum) ? node.schema.enum as unknown[] : undefined,
      'minimum': typeof node.schema.minimum === 'number' ? node.schema.minimum : undefined,
      'maximum': typeof node.schema.maximum === 'number' ? node.schema.maximum : undefined,
      'exclusiveMinimum': typeof node.schema.exclusiveMinimum === 'number' ? node.schema.exclusiveMinimum : undefined,
      'exclusiveMaximum': typeof node.schema.exclusiveMaximum === 'number' ? node.schema.exclusiveMaximum : undefined,
      'multipleOf': typeof node.schema.multipleOf === 'number' ? node.schema.multipleOf : undefined,
      'minLength': typeof node.schema.minLength === 'number' ? node.schema.minLength : undefined,
      'maxLength': typeof node.schema.maxLength === 'number' ? node.schema.maxLength : undefined,
      'pattern': typeof node.schema.pattern === 'string' ? node.schema.pattern : undefined,
      'minItems': typeof node.schema.minItems === 'number' ? node.schema.minItems : undefined,
      'maxItems': typeof node.schema.maxItems === 'number' ? node.schema.maxItems : undefined,
      'uniqueItems': node.schema.uniqueItems === true,
      'minProperties': typeof node.schema.minProperties === 'number' ? node.schema.minProperties : undefined,
      'maxProperties': typeof node.schema.maxProperties === 'number' ? node.schema.maxProperties : undefined,
      'additionalPropertiesNode': this.resolveAdditionalProperties(node),
      'notNode': this.child(node, 'not'),
      'contentEncoding': typeof node.schema.contentEncoding === 'string' ? node.schema.contentEncoding : undefined,
      'contentMediaType': typeof node.schema.contentMediaType === 'string' ? node.schema.contentMediaType : undefined,
      'readOnly': node.schema.readOnly === true,
      'writeOnly': node.schema.writeOnly === true,
      'deprecated': node.schema.deprecated === true,
      'rdfsDomain': typeof node.schema['rdfs:domain'] === 'string' ? node.schema['rdfs:domain'] : undefined,
      'rdfsRange': typeof node.schema['rdfs:range'] === 'string' ? node.schema['rdfs:range'] : undefined,
      'disjointWith': typeof node.schema.disjointWith === 'string' ? node.schema.disjointWith : undefined,
      'equivalentTo': typeof node.schema.equivalentTo === 'string' ? node.schema.equivalentTo : undefined,
      'inverseOf': typeof node.schema.inverseOf === 'string' ? node.schema.inverseOf : undefined,
      'transitive': node.schema.transitive === true,
      'symmetric': node.schema.symmetric === true
    };
  }

  private resolveAdditionalProperties(node: SchemaGraphNode): SchemaGraphNode | boolean | undefined {
    if (!isObject(node.schema) || !('additionalProperties' in node.schema)) {
      return undefined;
    }
    if (typeof node.schema.additionalProperties === 'boolean') {
      return node.schema.additionalProperties;
    }
    return this.child(node, 'additionalProperties');
  }

  private resolveLocalRef(ref: string): SchemaGraphNode {
    if (ref === '#') {
      return this.rootNode;
    }
    if (ref.startsWith('#/')) {
      return this.resolvePointer(ref.slice(1));
    }

    return this.resolveFragment(ref.slice(1));
  }

  private lower(schema: JsonSchema, pointer: string): void {
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
      this.anchorMap.set(schema.$anchor, this.nodeMap.get(pointer) as SchemaGraphNode);
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      this.anchorMap.set(schema.$dynamicAnchor, this.nodeMap.get(pointer) as SchemaGraphNode);
    }

    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'boolean' || isObject(value)) {
        const childPointer = `${pointer}/${escapeJsonPointer(key)}`;

        this.lower(value as JsonSchema, childPointer);
        this.childMap.get(node)?.set(key, this.nodeMap.get(childPointer) as SchemaGraphNode);

        if (isObject(value)) {
          const entries: Array<[string, SchemaGraphNode]> = [];

          for (const entryKey of Object.keys(value)) {
            const entryValue = value[entryKey];

            if (!isObject(entryValue) && typeof entryValue !== 'boolean') {
              continue;
            }

            const entryPointer = `${childPointer}/${escapeJsonPointer(entryKey)}`;

            entries.push([entryKey, this.nodeMap.get(entryPointer) as SchemaGraphNode]);
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

      const indexedChildren: SchemaGraphNode[] = [];

      for (const [index, element] of value.entries()) {
        if (typeof element === 'boolean' || isObject(element)) {
          const elementPointer = `${pointer}/${escapeJsonPointer(key)}/${index}`;

          this.lower(element as JsonSchema, elementPointer);
          indexedChildren.push(this.nodeMap.get(elementPointer) as SchemaGraphNode);
        }
      }

      if (indexedChildren.length > 0) {
        this.indexedChildMap.get(node)?.set(key, indexedChildren);
      }
    }
  }

  private nodeId(pointer: string, schema: JsonSchema): string {
    if (!isObject(schema)) {
      return this.pointerId(pointer);
    }

    if (typeof schema.$id === 'string') {
      return schema.$id;
    }

    return this.pointerId(pointer);
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
}

export function resolvePointerValue(rootSchema: JsonSchema, pointer: string): JsonSchema {
  if (pointer === '') {
    return rootSchema;
  }
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON Pointer: ${pointer}`);
  }

  let current: unknown = rootSchema;

  for (const segment of pointer.slice(1).split('/').map(unescapeJsonPointer)) {
    if (!isObject(current) && !Array.isArray(current)) {
      throw new Error(`Pointer not found: ${pointer}`);
    }
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current !== 'boolean' && !isObject(current)) {
    throw new Error(`Pointer does not resolve to a schema: ${pointer}`);
  }

  return current;
}
