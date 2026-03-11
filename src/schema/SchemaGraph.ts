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

export class SchemaGraph {
  private readonly anchorMap = new Map<string, SchemaGraphNode>();
  private readonly childMap = new WeakMap<SchemaGraphNode, Map<string, SchemaGraphNode>>();
  private readonly entryMap = new WeakMap<SchemaGraphNode, Map<string, Array<[string, SchemaGraphNode]>>>();
  private readonly identityMap = new WeakMap<object, SchemaGraphNode>();
  private readonly indexedChildMap = new WeakMap<SchemaGraphNode, Map<string, SchemaGraphNode[]>>();
  private readonly nodeMap = new Map<string, SchemaGraphNode>();
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

  public getNode(schema: Record<string, unknown>): SchemaGraphNode | undefined {
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

  public semantics(node: SchemaGraphNode): SchemaGraphSemantics {
    const cached = this.semanticMap.get(node);

    if (cached !== undefined) {
      return cached;
    }

    const semantics = this.buildSemantics(node);

    this.semanticMap.set(node, semantics);

    return semantics;
  }

  private buildSemantics(node: SchemaGraphNode): SchemaGraphSemantics {
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
        'unevaluatedPropertiesNode': undefined
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
      'unevaluatedPropertiesNode': this.child(node, 'unevaluatedProperties')
    };
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
