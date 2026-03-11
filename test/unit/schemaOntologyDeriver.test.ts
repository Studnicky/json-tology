/**
 * SchemaOntologyDeriver tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaOntologyDeriver } from '../../src/ontology/SchemaOntologyDeriver.js';

const BASE = 'https://myapp.io';

function deriver() {
  return new SchemaOntologyDeriver(BASE);
}

function deriveOne(schema: Record<string, unknown>) {
  return deriver().derive([schema]) as Array<Record<string, unknown>>;
}

function classNode(graph: Array<Record<string, unknown>>, id: string) {
  return graph.find((n) => n['@id'] === id && n['@type'] === 'owl:Class');
}

function propNode(graph: Array<Record<string, unknown>>, schemaId: string, propName: string) {
  return graph.find((n) => n['@id'] === `${schemaId}#${propName}`);
}

// ---------------------------------------------------------------------------
// Class-level derivation
// ---------------------------------------------------------------------------

describe('class nodes', () => {
  const Schema = {
    $id: 'https://myapp.io/Person',
    type: 'object',
    title: 'Person',
    description: 'A human being',
    properties: {},
    required: [],
  } as const;

  it('produces owl:Class for schema with $id', () => {
    const graph = deriveOne(Schema);
    assert.ok(classNode(graph, Schema.$id));
  });

  it('skips schemas without $id', () => {
    const graph = deriver().derive([{ type: 'object', properties: {} }]);
    assert.equal(graph.length, 0);
  });

  it('sets rdfs:label from title', () => {
    const graph = deriveOne(Schema);
    assert.equal(classNode(graph, Schema.$id)?.['rdfs:label'], 'Person');
  });

  it('sets rdfs:comment from description', () => {
    const graph = deriveOne(Schema);
    assert.equal(classNode(graph, Schema.$id)?.['rdfs:comment'], 'A human being');
  });

  it('handles multiple schemas', () => {
    const A = { $id: 'https://myapp.io/A', type: 'object', properties: {}, required: [] } as const;
    const B = { $id: 'https://myapp.io/B', type: 'object', properties: {}, required: [] } as const;
    const graph = deriver().derive([A, B]) as Array<Record<string, unknown>>;
    const ids = graph.filter((n) => n['@type'] === 'owl:Class').map((n) => n['@id']);
    assert.ok(ids.includes(A.$id));
    assert.ok(ids.includes(B.$id));
  });
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

describe('allOf → rdfs:subClassOf', () => {
  it('derives rdfs:subClassOf for each named constituent', () => {
    const Parent = { $id: 'https://myapp.io/Animal', type: 'object' } as const;
    const Child = {
      $id: 'https://myapp.io/Dog',
      type: 'object',
      allOf: [Parent],
      properties: {},
      required: [],
    } as const;
    const graph = deriveOne(Child as unknown as Record<string, unknown>);
    const cls = classNode(graph, Child.$id) as Record<string, unknown>;
    const subClassOf = cls['rdfs:subClassOf'] as Array<Record<string, unknown>>;
    assert.ok(subClassOf.some((e) => e['@id'] === Parent.$id));
  });

  it('ignores allOf members without $id', () => {
    const schema = {
      $id: 'https://myapp.io/X',
      type: 'object',
      allOf: [{ type: 'object', properties: {} }],
      properties: {},
      required: [],
    };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    // Should have no rdfs:subClassOf (no named parents, no required)
    assert.equal(cls['rdfs:subClassOf'], undefined);
  });
});

describe('anyOf / oneOf → owl:equivalentClass { owl:unionOf: @list }', () => {
  it('anyOf derives owl:equivalentClass with owl:unionOf list', () => {
    const A = { $id: 'https://myapp.io/A' } as const;
    const B = { $id: 'https://myapp.io/B' } as const;
    const schema = { $id: 'https://myapp.io/AorB', anyOf: [A, B], properties: {} };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const equiv = cls['owl:equivalentClass'] as Record<string, unknown>;
    assert.ok(equiv, 'owl:equivalentClass should exist');
    const union = equiv['owl:unionOf'] as { '@list': Array<{ '@id': string }> };
    assert.deepEqual(union['@list'], [{ '@id': A.$id }, { '@id': B.$id }]);
  });

  it('oneOf derives owl:equivalentClass with owl:unionOf list', () => {
    const Cat = { $id: 'https://myapp.io/Cat' } as const;
    const Dog = { $id: 'https://myapp.io/Dog2' } as const;
    const schema = { $id: 'https://myapp.io/Pet', oneOf: [Cat, Dog], properties: {} };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const equiv = cls['owl:equivalentClass'] as Record<string, unknown>;
    const union = equiv['owl:unionOf'] as { '@list': Array<{ '@id': string }> };
    assert.deepEqual(union['@list'], [{ '@id': Cat.$id }, { '@id': Dog.$id }]);
  });
});

describe('not → owl:complementOf', () => {
  it('derives owl:complementOf for named class', () => {
    const Excluded = { $id: 'https://myapp.io/Excluded' } as const;
    const schema = { $id: 'https://myapp.io/NotExcluded', not: Excluded, properties: {} };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id);
    assert.deepEqual(cls?.['owl:complementOf'], { '@id': Excluded.$id });
  });

  it('ignores not without $id', () => {
    const schema = { $id: 'https://myapp.io/X', not: { type: 'string' }, properties: {} };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id);
    assert.equal(cls?.['owl:complementOf'], undefined);
  });
});

describe('enum → owl:oneOf @list of typed literals', () => {
  it('produces @list of typed string literals', () => {
    const schema = { $id: 'https://myapp.io/Status', type: 'string', enum: ['active', 'inactive'] };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const oneOf = cls['owl:oneOf'] as { '@list': unknown[] };
    assert.deepEqual(oneOf['@list'], [
      { '@value': 'active', '@type': 'xsd:string' },
      { '@value': 'inactive', '@type': 'xsd:string' },
    ]);
  });

  it('produces typed integer literals', () => {
    const schema = { $id: 'https://myapp.io/Level', enum: [1, 2, 3] };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const oneOf = cls['owl:oneOf'] as { '@list': unknown[] };
    assert.deepEqual(oneOf['@list'], [
      { '@value': 1, '@type': 'xsd:integer' },
      { '@value': 2, '@type': 'xsd:integer' },
      { '@value': 3, '@type': 'xsd:integer' },
    ]);
  });

  it('produces typed decimal literals for floats', () => {
    const schema = { $id: 'https://myapp.io/Price', enum: [1.5, 2.5] };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const oneOf = cls['owl:oneOf'] as { '@list': unknown[] };
    assert.deepEqual(oneOf['@list'], [
      { '@value': 1.5, '@type': 'xsd:decimal' },
      { '@value': 2.5, '@type': 'xsd:decimal' },
    ]);
  });

  it('produces typed boolean literals', () => {
    const schema = { $id: 'https://myapp.io/Flag', enum: [true, false] };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const oneOf = cls['owl:oneOf'] as { '@list': unknown[] };
    assert.deepEqual(oneOf['@list'], [
      { '@value': true, '@type': 'xsd:boolean' },
      { '@value': false, '@type': 'xsd:boolean' },
    ]);
  });

  it('skips null values from enum (not representable as typed literals)', () => {
    const schema = { $id: 'https://myapp.io/MaybeStr', enum: ['a', null] };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const oneOf = cls['owl:oneOf'] as { '@list': unknown[] };
    // null filtered out — only 'a' survives
    assert.deepEqual(oneOf['@list'], [{ '@value': 'a', '@type': 'xsd:string' }]);
  });
});

describe('const → owl:oneOf @list with single typed literal', () => {
  it('produces single-item list for string const', () => {
    const schema = { $id: 'https://myapp.io/Circle', const: 'circle' };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const oneOf = cls['owl:oneOf'] as { '@list': unknown[] };
    assert.deepEqual(oneOf['@list'], [{ '@value': 'circle', '@type': 'xsd:string' }]);
  });

  it('produces single-item list for numeric const', () => {
    const schema = { $id: 'https://myapp.io/One', const: 1 };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id) as Record<string, unknown>;
    const oneOf = cls['owl:oneOf'] as { '@list': unknown[] };
    assert.deepEqual(oneOf['@list'], [{ '@value': 1, '@type': 'xsd:integer' }]);
  });

  it('omits owl:oneOf for object const (not a valid OWL atomic literal)', () => {
    const schema = { $id: 'https://myapp.io/X', const: { version: 1 } };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id);
    assert.equal(cls?.['owl:oneOf'], undefined);
  });
});

// ---------------------------------------------------------------------------
// Required → owl:Restriction blank nodes on the class
// ---------------------------------------------------------------------------

describe('required → owl:Restriction in rdfs:subClassOf', () => {
  const Schema = {
    $id: 'https://myapp.io/User',
    type: 'object',
    properties: {
      name:  { type: 'string' },
      email: { type: 'string' },
      age:   { type: 'number' },
    },
    required: ['name', 'email'],
  };

  it('adds owl:Restriction blank nodes in rdfs:subClassOf for required properties', () => {
    const graph = deriveOne(Schema);
    const cls = classNode(graph, Schema.$id) as Record<string, unknown>;
    const subClassOf = cls['rdfs:subClassOf'] as Array<Record<string, unknown>>;
    const restrictions = subClassOf.filter((e) => e['@type'] === 'owl:Restriction');
    assert.equal(restrictions.length, 2);
  });

  it('restriction nodes reference the correct property IRI', () => {
    const graph = deriveOne(Schema);
    const cls = classNode(graph, Schema.$id) as Record<string, unknown>;
    const subClassOf = cls['rdfs:subClassOf'] as Array<Record<string, unknown>>;
    const nameRestriction = subClassOf.find(
      (e) => e['@type'] === 'owl:Restriction' &&
        (e['owl:onProperty'] as Record<string, string>)?.['@id'] === `${Schema.$id}#name`,
    );
    assert.ok(nameRestriction, 'restriction for name should exist');
    assert.equal(nameRestriction['owl:minCardinality'], 1);
  });

  it('no restriction for optional properties', () => {
    const graph = deriveOne(Schema);
    const cls = classNode(graph, Schema.$id) as Record<string, unknown>;
    const subClassOf = cls['rdfs:subClassOf'] as Array<Record<string, unknown>>;
    const ageRestriction = subClassOf.find(
      (e) => e['@type'] === 'owl:Restriction' &&
        (e['owl:onProperty'] as Record<string, string>)?.['@id'] === `${Schema.$id}#age`,
    );
    assert.equal(ageRestriction, undefined);
  });

  it('no rdfs:subClassOf when no required and no named parents', () => {
    const schema = {
      $id: 'https://myapp.io/Simple',
      type: 'object',
      properties: { x: { type: 'string' } },
      required: [],
    };
    const graph = deriveOne(schema);
    const cls = classNode(graph, schema.$id);
    assert.equal(cls?.['rdfs:subClassOf'], undefined);
  });
});

// ---------------------------------------------------------------------------
// Property IRI scoping
// ---------------------------------------------------------------------------

describe('property IRI scoping', () => {
  it('property IRIs are scoped to the declaring schema $id using fragment #', () => {
    const schema = {
      $id: 'https://myapp.io/User',
      type: 'object',
      properties: { name: { type: 'string' } },
      required: [],
    };
    const graph = deriveOne(schema);
    const p = propNode(graph, schema.$id, 'name');
    assert.ok(p, 'property node should exist at scoped IRI');
    assert.equal(p['@id'], 'https://myapp.io/User#name');
  });

  it('same property name on two schemas gets distinct IRIs', () => {
    const A = {
      $id: 'https://myapp.io/A',
      type: 'object',
      properties: { name: { type: 'string' } },
      required: [],
    };
    const B = {
      $id: 'https://myapp.io/B',
      type: 'object',
      properties: { name: { type: 'number' } },
      required: [],
    };
    const graph = deriver().derive([A, B]) as Array<Record<string, unknown>>;
    const pA = propNode(graph, A.$id, 'name');
    const pB = propNode(graph, B.$id, 'name');
    assert.ok(pA && pB);
    assert.notEqual(pA['@id'], pB['@id']);
    assert.deepEqual(pA['rdfs:range'], { '@id': 'xsd:string' });
    assert.deepEqual(pB['rdfs:range'], { '@id': 'xsd:decimal' });
  });
});

// ---------------------------------------------------------------------------
// Property — kind and XSD range
// ---------------------------------------------------------------------------

describe('property kind', () => {
  function schemaProp(propSchema: Record<string, unknown>) {
    return { $id: 'https://myapp.io/X', type: 'object', properties: { p: propSchema }, required: [] };
  }

  it('DatatypeProperty for string', () => {
    const graph = deriveOne(schemaProp({ type: 'string' }));
    assert.equal(propNode(graph, 'https://myapp.io/X', 'p')?.['@type'], 'owl:DatatypeProperty');
  });

  it('DatatypeProperty for number', () => {
    const graph = deriveOne(schemaProp({ type: 'number' }));
    assert.equal(propNode(graph, 'https://myapp.io/X', 'p')?.['@type'], 'owl:DatatypeProperty');
  });

  it('DatatypeProperty for boolean', () => {
    const graph = deriveOne(schemaProp({ type: 'boolean' }));
    assert.equal(propNode(graph, 'https://myapp.io/X', 'p')?.['@type'], 'owl:DatatypeProperty');
  });

  it('ObjectProperty for object type', () => {
    const graph = deriveOne(schemaProp({ type: 'object' }));
    assert.equal(propNode(graph, 'https://myapp.io/X', 'p')?.['@type'], 'owl:ObjectProperty');
  });

  it('ObjectProperty for $ref', () => {
    const graph = deriveOne(schemaProp({ $ref: 'https://myapp.io/Addr' }));
    assert.equal(propNode(graph, 'https://myapp.io/X', 'p')?.['@type'], 'owl:ObjectProperty');
  });

  it('ObjectProperty for array', () => {
    const graph = deriveOne(schemaProp({ type: 'array' }));
    assert.equal(propNode(graph, 'https://myapp.io/X', 'p')?.['@type'], 'owl:ObjectProperty');
  });

  it('array property has rdfs:range rdf:List', () => {
    const graph = deriveOne(schemaProp({ type: 'array' }));
    assert.deepEqual(propNode(graph, 'https://myapp.io/X', 'p')?.['rdfs:range'], { '@id': 'rdf:List' });
  });
});

describe('XSD base type mapping', () => {
  function schemaProp(propSchema: Record<string, unknown>) {
    return { $id: 'https://myapp.io/X', type: 'object', properties: { p: propSchema }, required: [] };
  }

  it('string → xsd:string', () => {
    assert.deepEqual(propNode(deriveOne(schemaProp({ type: 'string' })), 'https://myapp.io/X', 'p')?.['rdfs:range'], { '@id': 'xsd:string' });
  });
  it('number → xsd:decimal', () => {
    assert.deepEqual(propNode(deriveOne(schemaProp({ type: 'number' })), 'https://myapp.io/X', 'p')?.['rdfs:range'], { '@id': 'xsd:decimal' });
  });
  it('integer → xsd:integer', () => {
    assert.deepEqual(propNode(deriveOne(schemaProp({ type: 'integer' })), 'https://myapp.io/X', 'p')?.['rdfs:range'], { '@id': 'xsd:integer' });
  });
  it('boolean → xsd:boolean', () => {
    assert.deepEqual(propNode(deriveOne(schemaProp({ type: 'boolean' })), 'https://myapp.io/X', 'p')?.['rdfs:range'], { '@id': 'xsd:boolean' });
  });
  it('null → owl:Nothing', () => {
    assert.deepEqual(propNode(deriveOne(schemaProp({ type: 'null' })), 'https://myapp.io/X', 'p')?.['rdfs:range'], { '@id': 'owl:Nothing' });
  });
});

describe('string format XSD mapping', () => {
  function schemaProp(format: string) {
    return { $id: 'https://myapp.io/X', type: 'object', properties: { p: { type: 'string', format } }, required: [] };
  }
  function range(format: string) {
    return propNode(deriveOne(schemaProp(format)), 'https://myapp.io/X', 'p')?.['rdfs:range'];
  }

  it('date-time → xsd:dateTime', () => { assert.deepEqual(range('date-time'), { '@id': 'xsd:dateTime' }); });
  it('date → xsd:date',           () => { assert.deepEqual(range('date'),      { '@id': 'xsd:date' }); });
  it('time → xsd:time',           () => { assert.deepEqual(range('time'),      { '@id': 'xsd:time' }); });
  it('duration → xsd:duration',   () => { assert.deepEqual(range('duration'),  { '@id': 'xsd:duration' }); });
  it('uri → xsd:anyURI',          () => { assert.deepEqual(range('uri'),       { '@id': 'xsd:anyURI' }); });
  it('iri → xsd:anyURI',          () => { assert.deepEqual(range('iri'),       { '@id': 'xsd:anyURI' }); });
  it('uri-reference → xsd:anyURI',() => { assert.deepEqual(range('uri-reference'), { '@id': 'xsd:anyURI' }); });
  it('iri-reference → xsd:anyURI',() => { assert.deepEqual(range('iri-reference'), { '@id': 'xsd:anyURI' }); });
  it('uri-template → xsd:anyURI', () => { assert.deepEqual(range('uri-template'),  { '@id': 'xsd:anyURI' }); });
  it('byte → xsd:base64Binary',   () => { assert.deepEqual(range('byte'),      { '@id': 'xsd:base64Binary' }); });
  it('binary → xsd:hexBinary',    () => { assert.deepEqual(range('binary'),    { '@id': 'xsd:hexBinary' }); });
  it('email → xsd:string',        () => { assert.deepEqual(range('email'),     { '@id': 'xsd:string' }); });
  it('uuid → xsd:string',         () => { assert.deepEqual(range('uuid'),      { '@id': 'xsd:string' }); });
  it('ipv4 → xsd:string',         () => { assert.deepEqual(range('ipv4'),      { '@id': 'xsd:string' }); });
});

describe('number/integer format XSD mapping', () => {
  function schemaProp(type: string, format: string) {
    return { $id: 'https://myapp.io/X', type: 'object', properties: { p: { type, format } }, required: [] };
  }
  function range(type: string, format: string) {
    return propNode(deriveOne(schemaProp(type, format)), 'https://myapp.io/X', 'p')?.['rdfs:range'];
  }

  it('number + float → xsd:float',    () => { assert.deepEqual(range('number',  'float'),  { '@id': 'xsd:float' }); });
  it('number + double → xsd:double',  () => { assert.deepEqual(range('number',  'double'), { '@id': 'xsd:double' }); });
  it('integer + int32 → xsd:int',     () => { assert.deepEqual(range('integer', 'int32'),  { '@id': 'xsd:int' }); });
  it('integer + int64 → xsd:long',    () => { assert.deepEqual(range('integer', 'int64'),  { '@id': 'xsd:long' }); });
});

describe('nullable / multiple types', () => {
  function schemaProp(rawType: unknown) {
    return { $id: 'https://myapp.io/X', type: 'object', properties: { p: { type: rawType } }, required: [] };
  }

  it('["string","null"] → xsd:string + jt:nullable', () => {
    const graph = deriveOne(schemaProp(['string', 'null']));
    const p = propNode(graph, 'https://myapp.io/X', 'p') as Record<string, unknown>;
    assert.deepEqual(p['rdfs:range'], { '@id': 'xsd:string' });
    assert.equal(p['jt:nullable'], true);
  });

  it('["number","null"] → xsd:decimal + jt:nullable', () => {
    const graph = deriveOne(schemaProp(['number', 'null']));
    const p = propNode(graph, 'https://myapp.io/X', 'p') as Record<string, unknown>;
    assert.deepEqual(p['rdfs:range'], { '@id': 'xsd:decimal' });
    assert.equal(p['jt:nullable'], true);
  });

  it('["string","number"] → owl:unionOf @list of XSD types', () => {
    const graph = deriveOne(schemaProp(['string', 'number']));
    const p = propNode(graph, 'https://myapp.io/X', 'p') as Record<string, unknown>;
    const union = p['owl:unionOf'] as { '@list': unknown[] };
    assert.deepEqual(union['@list'], [{ '@id': 'xsd:string' }, { '@id': 'xsd:decimal' }]);
  });
});

describe('$ref and array items', () => {
  it('$ref → rdfs:range pointing to referenced IRI', () => {
    const schema = { $id: 'https://myapp.io/X', type: 'object', properties: { addr: { $ref: 'https://myapp.io/Address' } }, required: [] };
    assert.deepEqual(propNode(deriveOne(schema), 'https://myapp.io/X', 'addr')?.['rdfs:range'], { '@id': 'https://myapp.io/Address' });
  });

  it('array with named items class → jt:itemType pointing to class', () => {
    const schema = {
      $id: 'https://myapp.io/X', type: 'object',
      properties: { tags: { type: 'array', items: { $id: 'https://myapp.io/Tag', type: 'object' } } },
      required: [],
    };
    assert.deepEqual(propNode(deriveOne(schema), 'https://myapp.io/X', 'tags')?.['jt:itemType'], { '@id': 'https://myapp.io/Tag' });
  });

  it('array with scalar items → jt:itemType XSD type', () => {
    const schema = {
      $id: 'https://myapp.io/X', type: 'object',
      properties: { scores: { type: 'array', items: { type: 'number' } } },
      required: [],
    };
    assert.deepEqual(propNode(deriveOne(schema), 'https://myapp.io/X', 'scores')?.['jt:itemType'], { '@id': 'xsd:decimal' });
  });
});

describe('property metadata', () => {
  it('sets rdfs:domain to the schema $id', () => {
    const schema = { $id: 'https://myapp.io/X', type: 'object', properties: { name: { type: 'string' } }, required: [] };
    assert.deepEqual(propNode(deriveOne(schema), 'https://myapp.io/X', 'name')?.['rdfs:domain'], { '@id': 'https://myapp.io/X' });
  });

  it('sets rdfs:comment from property description', () => {
    const schema = { $id: 'https://myapp.io/X', type: 'object', properties: { name: { type: 'string', description: 'Full name' } }, required: [] };
    assert.equal(propNode(deriveOne(schema), 'https://myapp.io/X', 'name')?.['rdfs:comment'], 'Full name');
  });
});
