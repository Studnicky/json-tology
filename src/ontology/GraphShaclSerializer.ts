import { SchemaGraph, type SchemaGraphNode, type SchemaGraphSemantics } from '../schema/SchemaGraph.js';

const XSD_TYPE_MAP: Record<string, string> = {
  'boolean': 'xsd:boolean',
  'integer': 'xsd:integer',
  'number': 'xsd:decimal',
  'string': 'xsd:string'
};

const STRING_FORMAT_MAP: Record<string, string> = {
  'binary': 'xsd:hexBinary',
  'byte': 'xsd:base64Binary',
  'date': 'xsd:date',
  'date-time': 'xsd:dateTime',
  'duration': 'xsd:duration',
  'time': 'xsd:time',
  'uri': 'xsd:anyURI',
  'uri-reference': 'xsd:anyURI',
  'iri': 'xsd:anyURI',
  'iri-reference': 'xsd:anyURI',
  'uri-template': 'xsd:anyURI',
  'email': 'xsd:string',
  'idn-email': 'xsd:string',
  'hostname': 'xsd:string',
  'idn-hostname': 'xsd:string',
  'ipv4': 'xsd:string',
  'ipv6': 'xsd:string',
  'json-pointer': 'xsd:string',
  'relative-json-pointer': 'xsd:string',
  'regex': 'xsd:string',
  'password': 'xsd:string',
  'uuid': 'xsd:string'
};

const NUMBER_FORMAT_MAP: Record<string, string> = {
  'double': 'xsd:double',
  'float': 'xsd:float',
  'int32': 'xsd:int',
  'int64': 'xsd:long'
};

function resolveXsdType(semantics: SchemaGraphSemantics): string | undefined {
  const types = semantics.schemaTypes.filter((t) => t !== 'null');

  if (types.length !== 1) {
    return undefined;
  }

  const type = types[0];
  const format = semantics.format;

  if (type === 'string') {
    return (format !== undefined && format in STRING_FORMAT_MAP)
      ? STRING_FORMAT_MAP[format]
      : 'xsd:string';
  }

  if (type === 'number' || type === 'integer') {
    return (format !== undefined && format in NUMBER_FORMAT_MAP)
      ? NUMBER_FORMAT_MAP[format]
      : XSD_TYPE_MAP[type];
  }

  return XSD_TYPE_MAP[type];
}

function propIri(classId: string, propName: string): string {
  return `${classId}#${propName}`;
}

export class GraphShaclSerializer {
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

      if (!this.isShapeCandidate(node, semantics)) {
        continue;
      }

      shapes.push(this.emitNodeShape(graph, node, semantics));
    }
  }

  private isShapeCandidate(node: SchemaGraphNode, semantics: SchemaGraphSemantics): boolean {
    return node.pointer === ''
      || semantics.schemaTypes.includes('object')
      || semantics.properties.length > 0
      || semantics.allOf.length > 0
      || semantics.anyOf.length > 0
      || semantics.oneOf.length > 0;
  }

  private emitNodeShape(
    graph: SchemaGraph,
    node: SchemaGraphNode,
    semantics: SchemaGraphSemantics
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
        '@list': subClassRels.map((r) => {
          const targetId = typeof r.target === 'string' ? r.target : r.target.id;

          return { '@id': targetId };
        })
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
      const targetId = typeof disjointRel.target === 'string'
        ? disjointRel.target
        : disjointRel.target.id;

      shape['sh:not'] = shape['sh:not'] ?? { '@id': targetId };
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
    node: SchemaGraphNode,
    semantics: SchemaGraphSemantics
  ): Record<string, unknown>[] {
    const requiredSet = new Set(semantics.required);
    const shapes: Record<string, unknown>[] = [];

    for (const [propName, propNode] of semantics.properties) {
      const propSemantics = graph.semantics(propNode);
      const propRelations = graph.relations(propNode);

      // Domain from relations, fallback to parent node
      const domainRel = propRelations.find((r) => r.predicate === 'rdfs:domain');
      const domainId = domainRel !== undefined
        ? (typeof domainRel.target === 'string' ? domainRel.target : domainRel.target.id)
        : node.id;

      const ps: Record<string, unknown> = {
        '@type': 'sh:PropertyShape',
        'sh:path': { '@id': propIri(domainId, propName) }
      };

      // datatype
      const xsd = resolveXsdType(propSemantics);

      if (xsd !== undefined && propSemantics.ref === undefined) {
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
        const rangeId = typeof rangeRel.target === 'string' ? rangeRel.target : rangeRel.target.id;

        ps['sh:class'] = { '@id': rangeId };
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

  private relationTargetRef(graph: SchemaGraph, rel: import('../schema/SchemaGraph.js').SchemaGraphRelation): Record<string, unknown> {
    if (typeof rel.target === 'string') {
      return { '@id': rel.target };
    }

    const semantics = graph.semantics(rel.target);

    if (typeof semantics.ref === 'string') {
      return { '@id': graph.resolveRefId(semantics.ref) };
    }

    return { '@id': rel.target.id };
  }
}
