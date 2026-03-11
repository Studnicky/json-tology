/**
 * Schema Ontology Deriver
 *
 * Derives OWL/RDFS ontology graph nodes automatically from registered JSON Schemas.
 *
 * ── Class mapping ──────────────────────────────────────────────────────────
 *   $id                    → owl:Class
 *   title                  → rdfs:label
 *   description            → rdfs:comment
 *   allOf[$id, ...]        → rdfs:subClassOf each named constituent
 *   anyOf[$id, ...]        → owl:equivalentClass { owl:unionOf: @list }
 *   oneOf[$id, ...]        → owl:equivalentClass { owl:unionOf: @list }
 *   not { $id }            → owl:complementOf named class
 *   enum [...]             → owl:oneOf { @list: typed literals }
 *   const value            → owl:oneOf { @list: [single typed literal] }
 *   required fields        → rdfs:subClassOf owl:Restriction nodes (blank nodes)
 *
 * ── Property mapping ───────────────────────────────────────────────────────
 *   Properties are scoped to their declaring class: <classId>#propName
 *   This avoids IRI collisions and invalid range conflicts across classes.
 *
 *   scalar type property   → owl:DatatypeProperty + rdfs:range XSD type
 *   object / $ref property → owl:ObjectProperty
 *   array property         → owl:ObjectProperty, rdfs:range rdf:List
 *   null type property     → owl:DatatypeProperty, rdfs:range owl:Nothing
 *   array items $id        → jt:itemType (named class of list items)
 *   array items scalar     → jt:itemType XSD type
 *   nullable ["T","null"]  → XSD range of T + jt:nullable true
 *   property description   → rdfs:comment
 *
 * ── XSD type derivation ────────────────────────────────────────────────────
 *   string                 → xsd:string
 *   string + date-time     → xsd:dateTime
 *   string + date          → xsd:date
 *   string + time          → xsd:time
 *   string + duration      → xsd:duration
 *   string + uri/iri       → xsd:anyURI
 *   string + uri-reference → xsd:anyURI
 *   string + iri-reference → xsd:anyURI
 *   string + uri-template  → xsd:anyURI
 *   string + byte          → xsd:base64Binary
 *   string + binary        → xsd:hexBinary
 *   string + (others)      → xsd:string
 *   number                 → xsd:decimal
 *   number + float         → xsd:float
 *   number + double        → xsd:double
 *   integer                → xsd:integer
 *   integer + int32        → xsd:int
 *   integer + int64        → xsd:long
 *   boolean                → xsd:boolean
 *   null                   → owl:Nothing
 */

// ---------------------------------------------------------------------------
// XSD type resolution
// ---------------------------------------------------------------------------

const BASE_TYPE_MAP: Record<string, string> = {
  string:  'xsd:string',
  number:  'xsd:decimal',
  integer: 'xsd:integer',
  boolean: 'xsd:boolean',
  null:    'owl:Nothing',
};

const STRING_FORMAT_MAP: Record<string, string> = {
  'date-time':             'xsd:dateTime',
  'date':                  'xsd:date',
  'time':                  'xsd:time',
  'duration':              'xsd:duration',
  'uri':                   'xsd:anyURI',
  'iri':                   'xsd:anyURI',
  'uri-reference':         'xsd:anyURI',
  'iri-reference':         'xsd:anyURI',
  'uri-template':          'xsd:anyURI',
  'byte':                  'xsd:base64Binary',
  'binary':                'xsd:hexBinary',
  // No XSD equivalents — fall back to xsd:string
  'email':                 'xsd:string',
  'idn-email':             'xsd:string',
  'hostname':              'xsd:string',
  'idn-hostname':          'xsd:string',
  'ipv4':                  'xsd:string',
  'ipv6':                  'xsd:string',
  'uuid':                  'xsd:string',
  'password':              'xsd:string',
  'regex':                 'xsd:string',
  'json-pointer':          'xsd:string',
  'relative-json-pointer': 'xsd:string',
};

const NUMBER_FORMAT_MAP: Record<string, string> = {
  'float':  'xsd:float',
  'double': 'xsd:double',
  'int32':  'xsd:int',
  'int64':  'xsd:long',
};

function resolveXsdType(propSchema: Record<string, unknown>): string | null {
  const rawType = propSchema['type'];
  const format = typeof propSchema['format'] === 'string' ? propSchema['format'] : undefined;

  let types: string[];
  if (typeof rawType === 'string') {
    types = [rawType];
  } else if (Array.isArray(rawType)) {
    types = rawType.filter((t): t is string => typeof t === 'string');
  } else {
    return null;
  }

  const nonNull = types.filter((t) => t !== 'null');
  if (nonNull.length === 0) return 'owl:Nothing';
  if (nonNull.length === 1) return resolveSingleType(nonNull[0], format);
  return null; // multiple non-null types — caller handles via owl:unionOf
}

function resolveSingleType(type: string, format: string | undefined): string | null {
  if (type === 'object' || type === 'array') return null;
  if (type === 'string') {
    if (format && format in STRING_FORMAT_MAP) return STRING_FORMAT_MAP[format];
    return 'xsd:string';
  }
  if (type === 'number' || type === 'integer') {
    if (format && format in NUMBER_FORMAT_MAP) return NUMBER_FORMAT_MAP[format];
    return BASE_TYPE_MAP[type] ?? null;
  }
  return BASE_TYPE_MAP[type] ?? null;
}

/**
 * Produce a typed JSON-LD literal for an enum or const value.
 * Only scalar values (string, number, boolean) are valid OWL typed literals.
 * Complex objects are rejected — they cannot be expressed as atomic literals.
 */
function typedLiteral(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') return { '@value': value, '@type': 'xsd:string' };
  if (typeof value === 'boolean') return { '@value': value, '@type': 'xsd:boolean' };
  if (typeof value === 'number') {
    return { '@value': value, '@type': Number.isInteger(value) ? 'xsd:integer' : 'xsd:decimal' };
  }
  // null and objects cannot be expressed as OWL atomic literals — skip them
  return null;
}

/** Wrap a value as an RDF list for JSON-LD serialization. */
function rdfList(items: unknown[]): { '@list': unknown[] } {
  return { '@list': items };
}

// ---------------------------------------------------------------------------
// Deriver
// ---------------------------------------------------------------------------

export class SchemaOntologyDeriver {
  public constructor(_baseIRI: string) {
    // baseIRI reserved for future use; property IRIs are scoped to schema $id
  }

  /**
   * Derive graph nodes from an array of JSON Schema objects.
   * Only schemas with a $id are processed.
   */
  public derive(schemas: ReadonlyArray<Record<string, unknown>>): unknown[] {
    const graph: unknown[] = [];
    for (const schema of schemas) {
      this.deriveSchema(schema, graph);
    }
    return graph;
  }

  // ---------------------------------------------------------------------------
  // Class-level derivation
  // ---------------------------------------------------------------------------

  private deriveSchema(schema: Record<string, unknown>, graph: unknown[]): void {
    const id = schema['$id'];
    if (typeof id !== 'string') return;

    const classNode: Record<string, unknown> = {
      '@id': id,
      '@type': 'owl:Class',
    };

    if (typeof schema['title'] === 'string') {
      classNode['rdfs:label'] = schema['title'];
    }
    if (typeof schema['description'] === 'string') {
      classNode['rdfs:comment'] = schema['description'];
    }

    // Accumulate rdfs:subClassOf entries (named parents + restriction blank nodes)
    const subClassOf: unknown[] = [];

    // allOf → rdfs:subClassOf each named constituent
    const allOf = schema['allOf'];
    if (Array.isArray(allOf)) {
      for (const parent of this.namedClassRefs(allOf)) {
        subClassOf.push({ '@id': parent });
      }
    }

    // anyOf / oneOf → owl:equivalentClass { owl:unionOf: @list of named members }
    // OWL has no exclusive-union primitive; both map to owl:unionOf.
    for (const key of ['anyOf', 'oneOf'] as const) {
      const members = schema[key];
      if (Array.isArray(members)) {
        const refs = this.namedClassRefs(members);
        if (refs.length > 0) {
          classNode['owl:equivalentClass'] = {
            '@type': 'owl:Class',
            'owl:unionOf': rdfList(refs.map((r) => ({ '@id': r }))),
          };
        }
      }
    }

    // not → owl:complementOf named class
    const not = schema['not'];
    if (typeof not === 'object' && not !== null) {
      const notId = (not as Record<string, unknown>)['$id'];
      if (typeof notId === 'string') {
        classNode['owl:complementOf'] = { '@id': notId };
      }
    }

    // enum → owl:oneOf @list of typed literals
    const enumValues = schema['enum'];
    if (Array.isArray(enumValues)) {
      const literals = enumValues.map(typedLiteral).filter((v): v is Record<string, unknown> => v !== null);
      if (literals.length > 0) {
        classNode['owl:oneOf'] = rdfList(literals);
      }
    }

    // const → owl:oneOf @list with single typed literal
    // (const is semantically equivalent to a single-value enum)
    if ('const' in schema) {
      const literal = typedLiteral(schema['const']);
      if (literal) {
        classNode['owl:oneOf'] = rdfList([literal]);
      }
    }

    // Required properties → owl:Restriction blank nodes on the class
    const required = Array.isArray(schema['required'])
      ? (schema['required'] as string[])
      : [];

    const properties = schema['properties'];
    if (typeof properties === 'object' && properties !== null && !Array.isArray(properties)) {
      for (const propName of required) {
        const propIRI = this.propIRI(id, propName);
        // owl:Restriction blank node: no @id — becomes a blank node in RDF
        subClassOf.push({
          '@type': 'owl:Restriction',
          'owl:onProperty': { '@id': propIRI },
          'owl:minCardinality': 1,
        });
      }
    }

    if (subClassOf.length > 0) {
      classNode['rdfs:subClassOf'] = subClassOf;
    }

    graph.push(classNode);

    // Properties → DatatypeProperty or ObjectProperty nodes
    if (typeof properties === 'object' && properties !== null && !Array.isArray(properties)) {
      for (const [propName, propSchema] of Object.entries(
        properties as Record<string, unknown>,
      )) {
        if (typeof propSchema !== 'object' || propSchema === null) continue;
        this.deriveProperty(id, propName, propSchema as Record<string, unknown>, graph);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Property-level derivation
  // ---------------------------------------------------------------------------

  private deriveProperty(
    domainId: string,
    propName: string,
    propSchema: Record<string, unknown>,
    graph: unknown[],
  ): void {
    const propIRI = this.propIRI(domainId, propName);
    const rawType = propSchema['type'];
    const isRef = '$ref' in propSchema;

    const primaryType = typeof rawType === 'string'
      ? rawType
      : Array.isArray(rawType)
        ? (rawType as string[]).find((typeName) => typeName !== 'null') ?? null
        : null;

    const isArray  = primaryType === 'array';
    const isObject = primaryType === 'object' || isRef || primaryType === null;

    const propNode: Record<string, unknown> = {
      '@id': propIRI,
      '@type': (isObject || isArray) ? 'owl:ObjectProperty' : 'owl:DatatypeProperty',
      'rdfs:domain': { '@id': domainId },
    };

    if (isArray) {
      propNode['rdfs:range'] = { '@id': 'rdf:List' };
      const items = propSchema['items'];
      if (typeof items === 'object' && items !== null) {
        const itemsId = (items as Record<string, unknown>)['$id'];
        if (typeof itemsId === 'string') {
          propNode['jt:itemType'] = { '@id': itemsId };
        } else {
          const itemXsd = resolveXsdType(items as Record<string, unknown>);
          if (itemXsd) propNode['jt:itemType'] = { '@id': itemXsd };
        }
      }
    } else if (isRef) {
      const ref = propSchema['$ref'];
      if (typeof ref === 'string') {
        // '#' is a self-reference; resolve against the declaring class IRI
        const resolvedRef = ref === '#' ? domainId : ref;
        propNode['rdfs:range'] = { '@id': resolvedRef };
      }
    } else if (isObject) {
      // object type — no range assertion (range would be another named class)
    } else {
      // Datatype property — resolve XSD range
      const xsdType = resolveXsdType(propSchema);
      if (xsdType) {
        propNode['rdfs:range'] = { '@id': xsdType };
      } else if (Array.isArray(rawType)) {
        // Multiple non-null types — owl:unionOf XSD types as @list
        const nonNull = (rawType as string[]).filter((t) => t !== 'null');
        const resolved = nonNull
          .map((t) => resolveSingleType(t, undefined))
          .filter((r): r is string => r !== null);
        if (resolved.length > 1) {
          propNode['owl:unionOf'] = rdfList(resolved.map((r) => ({ '@id': r })));
        }
      }
    }

    // Note nullability for ["T","null"] multi-type properties
    if (Array.isArray(rawType) && (rawType as string[]).includes('null')) {
      propNode['jt:nullable'] = true;
    }

    if (typeof propSchema['description'] === 'string') {
      propNode['rdfs:comment'] = propSchema['description'];
    }

    graph.push(propNode);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a class-scoped property IRI using the schema $id as namespace.
   * Uses fragment (#) convention: <classId>#propName
   * This avoids cross-class IRI collisions and invalid global range conflicts.
   */
  private propIRI(classId: string, propName: string): string {
    return `${classId}#${propName}`;
  }

  private namedClassRefs(schemas: unknown[]): string[] {
    return schemas
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => s['$id'])
      .filter((id): id is string => typeof id === 'string');
  }
}
