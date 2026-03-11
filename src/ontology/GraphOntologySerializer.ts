import { SchemaGraph, type SchemaGraphNode } from '../schema/SchemaGraph.js';

const BASE_TYPE_MAP: Record<string, string> = {
  'boolean': 'xsd:boolean',
  'integer': 'xsd:integer',
  'null': 'owl:Nothing',
  'number': 'xsd:decimal',
  'string': 'xsd:string'
};

const STRING_FORMAT_MAP: Record<string, string> = {
  'binary': 'xsd:hexBinary',
  'byte': 'xsd:base64Binary',
  'date': 'xsd:date',
  'date-time': 'xsd:dateTime',
  'duration': 'xsd:duration',
  'email': 'xsd:string',
  'hostname': 'xsd:string',
  'idn-email': 'xsd:string',
  'idn-hostname': 'xsd:string',
  'ipv4': 'xsd:string',
  'ipv6': 'xsd:string',
  'iri': 'xsd:anyURI',
  'iri-reference': 'xsd:anyURI',
  'json-pointer': 'xsd:string',
  'password': 'xsd:string',
  'regex': 'xsd:string',
  'relative-json-pointer': 'xsd:string',
  'time': 'xsd:time',
  'uri': 'xsd:anyURI',
  'uri-reference': 'xsd:anyURI',
  'uri-template': 'xsd:anyURI',
  'uuid': 'xsd:string'
};

const NUMBER_FORMAT_MAP: Record<string, string> = {
  'double': 'xsd:double',
  'float': 'xsd:float',
  'int32': 'xsd:int',
  'int64': 'xsd:long'
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rdfList(items: unknown[]): Record<string, unknown[]> {
  return { '@list': items };
}

function resolveSingleType(type: string, format?: string): null | string {
  if (type === 'object' || type === 'array') {
    return null;
  }
  if (type === 'string') {
    return format !== undefined && format in STRING_FORMAT_MAP
      ? STRING_FORMAT_MAP[format]
      : 'xsd:string';
  }
  if (type === 'number' || type === 'integer') {
    return format !== undefined && format in NUMBER_FORMAT_MAP
      ? NUMBER_FORMAT_MAP[format]
      : (BASE_TYPE_MAP[type] ?? null);
  }

  return BASE_TYPE_MAP[type] ?? null;
}

function resolveXsdType(propSchema: Record<string, unknown>): null | string {
  const rawType = propSchema.type;
  const format = typeof propSchema.format === 'string' ? propSchema.format : undefined;

  const types = typeof rawType === 'string'
    ? [rawType]
    : Array.isArray(rawType)
      ? rawType.filter((entry): entry is string => {
        return typeof entry === 'string';
      })
      : [];

  const nonNull = types.filter((entry) => {
    return entry !== 'null';
  });

  if (nonNull.length === 0) {
    return types.length > 0 ? 'owl:Nothing' : null;
  }
  if (nonNull.length === 1) {
    return resolveSingleType(nonNull[0], format);
  }

  return null;
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

export class GraphOntologySerializer {
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

  private classCandidate(node: SchemaGraphNode): boolean {
    if (!isObject(node.schema)) {
      return false;
    }

    return node.pointer === ''
      || node.schema.type === 'object'
      || isObject(node.schema.properties)
      || 'allOf' in node.schema
      || 'anyOf' in node.schema
      || 'oneOf' in node.schema
      || 'not' in node.schema
      || 'enum' in node.schema
      || 'const' in node.schema;
  }

  private namedNodeId(graph: SchemaGraph, node: SchemaGraphNode): string | undefined {
    if (!isObject(node.schema)) {
      return undefined;
    }
    const semantics = graph.semantics(node);

    if (typeof semantics.ref === 'string') {
      return graph.resolveRefId(semantics.ref);
    }

    return node.id;
  }

  private propIri(classId: string, propName: string): string {
    return `${classId}#${propName}`;
  }

  private resolvePropertyRange(graph: SchemaGraph, propSchema: Record<string, unknown>): null | unknown {
    if (typeof propSchema.$ref === 'string') {
      return { '@id': graph.resolveRefId(propSchema.$ref) };
    }

    const xsdType = resolveXsdType(propSchema);

    if (xsdType !== null) {
      return { '@id': xsdType };
    }

    return null;
  }

  private serializeClassNode(
    graph: SchemaGraph,
    node: SchemaGraphNode,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    if (!this.classCandidate(node) || !isObject(node.schema)) {
      return;
    }

    const classNode: Record<string, unknown> = {
      '@id': node.id,
      '@type': 'owl:Class'
    };

    if (typeof node.schema.title === 'string') {
      classNode['rdfs:label'] = node.schema.title;
    }
    if (typeof node.schema.description === 'string') {
      classNode['rdfs:comment'] = node.schema.description;
    }

    const subClassOf: unknown[] = [];

    for (const parent of graph.indexedChildren(node, 'allOf')) {
      const parentId = this.namedNodeId(graph, parent);

      if (typeof parentId === 'string') {
        subClassOf.push({ '@id': parentId });
      }
    }

    for (const branchKey of [
      'anyOf',
      'oneOf'
    ] as const) {
      const branchIds = graph.indexedChildren(node, branchKey)
        .map((branchNode) => {
          return this.namedNodeId(graph, branchNode);
        })
        .filter((id): id is string => {
          return typeof id === 'string';
        });

      if (branchIds.length > 0) {
        classNode['owl:equivalentClass'] = {
          '@type': 'owl:Class',
          'owl:unionOf': rdfList(branchIds.map((id) => {
            return { '@id': id };
          }))
        };
      }
    }

    const notNode = graph.child(node, 'not');

    if (notNode !== undefined) {
      const notId = this.namedNodeId(graph, notNode);

      if (typeof notId === 'string') {
        classNode['owl:complementOf'] = { '@id': notId };
      }
    }

    if (Array.isArray(node.schema.enum)) {
      const literals = node.schema.enum.map((value) => {
        return typedLiteral(value);
      }).filter((value): value is Record<string, unknown> => {
        return value !== null;
      });

      if (literals.length > 0) {
        classNode['owl:oneOf'] = rdfList(literals);
      }
    }

    if ('const' in node.schema) {
      const literal = typedLiteral(node.schema.const);

      if (literal !== null) {
        classNode['owl:oneOf'] = rdfList([literal]);
      }
    }

    const required = Array.isArray(node.schema.required)
      ? node.schema.required.filter((value): value is string => {
        return typeof value === 'string';
      })
      : [];

    for (const propertyName of required) {
      subClassOf.push({
        '@type': 'owl:Restriction',
        'owl:minCardinality': 1,
        'owl:onProperty': { '@id': this.propIri(node.id, propertyName) }
      });
    }

    if (subClassOf.length > 0) {
      classNode['rdfs:subClassOf'] = subClassOf;
    }

    this.addNode(nodeMap, classNode);
  }

  private serializePropertyNodes(
    graph: SchemaGraph,
    node: SchemaGraphNode,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    if (!isObject(node.schema)) {
      return;
    }

    for (const [propertyName, propertyNode] of graph.entries(node, 'properties')) {
      if (!isObject(propertyNode.schema)) {
        continue;
      }

      const rawType = propertyNode.schema.type;
      const primaryType = typeof rawType === 'string'
        ? rawType
        : Array.isArray(rawType)
          ? rawType.find((entry): entry is string => {
            return typeof entry === 'string' && entry !== 'null';
          }) ?? null
          : null;
      const isArray = primaryType === 'array';
      const isObjectProperty = isArray || primaryType === 'object' || '$ref' in propertyNode.schema || primaryType === null;

      const propertyGraphNode: Record<string, unknown> = {
        '@id': this.propIri(node.id, propertyName),
        '@type': isObjectProperty ? 'owl:ObjectProperty' : 'owl:DatatypeProperty',
        'rdfs:domain': { '@id': node.id }
      };

      if (isArray) {
        propertyGraphNode['rdfs:range'] = { '@id': 'rdf:List' };

        const itemsNode = graph.child(propertyNode, 'items');

        if (itemsNode !== undefined && isObject(itemsNode.schema)) {
          const itemSemantics = graph.semantics(itemsNode);

          if (typeof itemSemantics.ref === 'string') {
            propertyGraphNode['jt:itemType'] = { '@id': graph.resolveRefId(itemSemantics.ref) };
          } else if (typeof itemsNode.schema.$id === 'string' || itemsNode.pointer !== '') {
            propertyGraphNode['jt:itemType'] = { '@id': itemsNode.id };
          } else {
            const itemXsd = resolveXsdType(itemsNode.schema);

            if (itemXsd !== null) {
              propertyGraphNode['jt:itemType'] = { '@id': itemXsd };
            }
          }
        }
      } else {
        const range = this.resolvePropertyRange(graph, propertyNode.schema);

        if (range !== null) {
          propertyGraphNode['rdfs:range'] = range;
        } else if (Array.isArray(rawType)) {
          const resolved = rawType
            .filter((entry): entry is string => {
              return typeof entry === 'string' && entry !== 'null';
            })
            .map((entry) => {
              return resolveSingleType(entry);
            })
            .filter((entry): entry is string => {
              return entry !== null;
            });

          if (resolved.length > 1) {
            propertyGraphNode['owl:unionOf'] = rdfList(resolved.map((entry) => {
              return { '@id': entry };
            }));
          }
        }
      }

      if (Array.isArray(rawType) && rawType.includes('null')) {
        propertyGraphNode['jt:nullable'] = true;
      }
      if (typeof propertyNode.schema.description === 'string') {
        propertyGraphNode['rdfs:comment'] = propertyNode.schema.description;
      }

      this.addNode(nodeMap, propertyGraphNode);
    }
  }

  private serializeSchemaNode(
    graph: SchemaGraph,
    node: SchemaGraphNode,
    nodeMap: Map<string, Record<string, unknown>>
  ): void {
    this.serializeClassNode(graph, node, nodeMap);
    this.serializePropertyNodes(graph, node, nodeMap);
  }
}
