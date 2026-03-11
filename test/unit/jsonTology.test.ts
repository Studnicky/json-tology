/**
 * JsonTology — integration tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';

const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  title: 'User',
  description: 'An application user',
  properties: {
    name:   { type: 'string', default: 'Anonymous' },
    email:  { type: 'string' },
    age:    { type: 'number' },
    active: { type: 'boolean', default: true },
  },
  required: ['name', 'email'],
} as const;

const RoleSchema = {
  $id: 'https://myapp.io/Role',
  type: 'object',
  title: 'Role',
  description: 'A user role',
  properties: {
    name:  { type: 'string' },
    level: { type: 'number' },
  },
  required: ['name'],
} as const;

const DirectorySchema = {
  $id: 'https://myapp.io/Directory',
  type: 'object',
  properties: {
    employees: {
      type: 'array',
      items: { $ref: '#/$defs/Employee' },
    },
    primaryEmployee: { $ref: '#/$defs/Employee' },
  },
  $defs: {
    Employee: {
      $anchor: 'employee',
      type: 'object',
      title: 'Employee',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  required: ['primaryEmployee'],
} as const;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('JsonTology construction', () => {
  it('constructs with baseIRI and schemas', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    assert.ok(jt instanceof JsonTology);
  });

  it('constructs with no schemas', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    assert.ok(jt instanceof JsonTology);
  });

  it('exposes registry and materializer', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    assert.ok(jt.registry);
    assert.ok(jt.materializer);
  });

  it('pre-registers schemas passed in options', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    assert.ok(jt.get(UserSchema.$id));
  });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('JsonTology.register()', () => {
  it('registers a single schema', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    jt.register(UserSchema);
    assert.ok(jt.get(UserSchema.$id));
  });

  it('registers an array of schemas', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    jt.register([UserSchema, RoleSchema]);
    assert.ok(jt.get(UserSchema.$id));
    assert.ok(jt.get(RoleSchema.$id));
  });

  it('is fluent — returns this', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const result = jt.register(UserSchema);
    assert.strictEqual(result, jt);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('JsonTology.validate()', () => {
  it('returns empty array for valid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const errors = jt.validate(UserSchema.$id, { name: 'Alice', email: 'a@b.com' });
    assert.deepEqual(errors, []);
  });

  it('returns errors for invalid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const errors = jt.validate(UserSchema.$id, { name: 42, email: 'a@b.com' });
    assert.ok(errors.length > 0);
  });

  it('returns errors for missing required fields', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const errors = jt.validate(UserSchema.$id, { name: 'Alice' });
    assert.ok(errors.length > 0);
  });
});

describe('JsonTology.errors()', () => {
  it('returns ValidationErrors with items for invalid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const errors = jt.errors(UserSchema.$id, { name: 'Alice' });
    assert.ok(errors.length > 0);
    assert.ok(typeof errors.items[0].path === 'string');
    assert.ok(typeof errors.items[0].message === 'string');
  });

  it('returns empty ValidationErrors for valid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const errors = jt.errors(UserSchema.$id, { name: 'Alice', email: 'a@b.com' });
    assert.equal(errors.length, 0);
    assert.equal(errors.ok, true);
  });
});

describe('JsonTology.parse()', () => {
  it('returns data with defaults applied', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const user = jt.parse(UserSchema, { name: 'Alice', email: 'a@b.com' });
    assert.equal((user as { active: boolean }).active, true);
  });

  it('throws ParseError on invalid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    assert.throws(() => jt.parse(UserSchema, { name: 'Alice' }));
  });
});

describe('JsonTology.safeParse()', () => {
  it('returns success:true with data on valid input', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const result = jt.safeParse(UserSchema, { name: 'Alice', email: 'a@b.com' });
    assert.equal(result.success, true);
  });

  it('returns success:false with errors on invalid input', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const result = jt.safeParse(UserSchema, { name: 'Alice' });
    assert.equal(result.success, false);
    assert.ok(result.success === false && result.errors.length > 0);
  });
});

describe('JsonTology.is()', () => {
  it('returns true for valid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    assert.equal(jt.is(UserSchema, { name: 'Alice', email: 'a@b.com' }), true);
  });

  it('returns false for invalid data', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    assert.equal(jt.is(UserSchema, { name: 'Alice' }), false);
  });
});

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

describe('JsonTology.materialize()', () => {
  it('materializes an entity with defaults applied', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const user = jt.materialize(UserSchema, { email: 'a@b.com' });
    assert.equal((user as { name: string }).name, 'Anonymous');
    assert.equal((user as { active: boolean }).active, true);
  });

  it('merges provided values with defaults', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io' });
    const user = jt.materialize(UserSchema, { name: 'Alice', email: 'a@b.com' });
    assert.equal((user as { name: string }).name, 'Alice');
  });
});

// ---------------------------------------------------------------------------
// Ontology
// ---------------------------------------------------------------------------

describe('JsonTology.ontology()', () => {
  it('returns an OntologyBuilder', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const o = jt.ontology();
    assert.ok(typeof o.n3 === 'function');
    assert.ok(typeof o.jsonLd === 'function');
    assert.ok(typeof o.jsonLdObject === 'function');
  });

  it('n3() output includes OWL prefix declarations', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const n3 = jt.ontology().n3();
    assert.ok(n3.includes('@prefix owl:'));
    assert.ok(n3.includes('@prefix rdfs:'));
    assert.ok(n3.includes('@prefix xsd:'));
  });

  it('n3() output includes the schema class IRI', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const n3 = jt.ontology().n3();
    assert.ok(n3.includes(UserSchema.$id));
  });

  it('n3() output includes property entries for schema properties', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const n3 = jt.ontology().n3();
    assert.ok(n3.includes('owl:DatatypeProperty'));
  });

  it('jsonLdObject() includes @context with standard prefixes', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const obj = jt.ontology().jsonLdObject();
    const ctx = obj['@context'] as Record<string, string>;
    assert.ok('owl' in ctx);
    assert.ok('rdfs' in ctx);
    assert.ok('xsd' in ctx);
  });

  it('raw graph includes class node for each registered schema', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema, RoleSchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const classNodes = graph.filter((n) => n['@type'] === 'owl:Class');
    const ids = classNodes.map((n) => n['@id']);
    assert.ok(ids.includes(UserSchema.$id));
    assert.ok(ids.includes(RoleSchema.$id));
  });

  it('class node includes rdfs:label from title', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const userClass = graph.find((n) => n['@id'] === UserSchema.$id);
    assert.equal(userClass?.['rdfs:label'], 'User');
  });

  it('class node includes rdfs:comment from description', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const userClass = graph.find((n) => n['@id'] === UserSchema.$id);
    assert.equal(userClass?.['rdfs:comment'], 'An application user');
  });

  it('class node has owl:Restriction blank node for required fields', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const userClass = graph.find((n) => n['@id'] === UserSchema.$id);
    const subClassOf = userClass?.['rdfs:subClassOf'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(subClassOf));
    const emailRestriction = subClassOf.find(
      (r) => r['@type'] === 'owl:Restriction' &&
             (r['owl:onProperty'] as Record<string, unknown>)?.['@id'] === 'https://myapp.io/User#email',
    );
    assert.ok(emailRestriction, 'email restriction should exist');
    assert.equal(emailRestriction?.['owl:minCardinality'], 1);
  });

  it('property nodes use class-scoped IRIs', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const emailProp = graph.find((n) => n['@id'] === 'https://myapp.io/User#email');
    assert.ok(emailProp, 'email property should have scoped IRI');
    assert.equal(emailProp?.['@type'], 'owl:DatatypeProperty');
  });

  it('merges custom prefixes with defaults', () => {
    const jt = new JsonTology({
      baseIRI: 'https://myapp.io',
      schemas: [UserSchema],
      prefixes: { myns: 'https://myapp.io/ns#' },
    });
    const ctx = jt.ontology().jsonLdObject()['@context'] as Record<string, string>;
    assert.ok('myns' in ctx);
    assert.ok('owl' in ctx);
  });

  it('reflects newly registered schemas on each ontology() call', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    jt.register(RoleSchema);
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const ids = graph.filter((n) => n['@type'] === 'owl:Class').map((n) => n['@id']);
    assert.ok(ids.includes(RoleSchema.$id));
  });

  it('serializes local $defs object schemas as class nodes from the canonical graph', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [DirectorySchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const employeeClass = graph.find((n) => {
      return n['@id'] === 'https://myapp.io/Directory#/$defs/Employee' && n['@type'] === 'owl:Class';
    });

    assert.ok(employeeClass);
    assert.equal(employeeClass?.['rdfs:label'], 'Employee');
  });

  it('resolves local $ref ranges through the canonical graph', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [DirectorySchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const employeeProp = graph.find((n) => {
      return n['@id'] === 'https://myapp.io/Directory#primaryEmployee';
    });

    assert.deepEqual(employeeProp?.['rdfs:range'], { '@id': 'https://myapp.io/Directory#/$defs/Employee' });
  });

  it('resolves local array item refs through the canonical graph', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [DirectorySchema] });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const employeesProp = graph.find((n) => {
      return n['@id'] === 'https://myapp.io/Directory#employees';
    });

    assert.deepEqual(employeesProp?.['jt:itemType'], { '@id': 'https://myapp.io/Directory#/$defs/Employee' });
  });
});

describe('JsonTology.abox()', () => {
  it('projects validated instance data into ABox nodes typed by the schema graph', () => {
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
    const graph = jt.abox(UserSchema, {
      name: 'Alice',
      email: 'alice@example.com',
      active: true,
    }).raw() as Array<Record<string, unknown>>;
    const root = graph.find((node) => {
      return typeof node['@id'] === 'string' && String(node['@id']).includes('/instances/');
    });

    assert.ok(root);
    assert.deepEqual(root?.['@type'], { '@id': UserSchema.$id });
    assert.equal(root?.['https://myapp.io/User#name'], 'Alice');
    assert.equal(root?.['https://myapp.io/User#email'], 'alice@example.com');
  });

  it('reuses canonical property and class identifiers for nested object references', () => {
    const schema = {
      $id: 'https://myapp.io/Team',
      type: 'object',
      properties: {
        lead: { $ref: '#/$defs/Person' },
        name: { type: 'string' },
      },
      $defs: {
        Person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
      required: ['lead', 'name'],
    } as const;
    const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [schema] });
    const graph = jt.abox(schema, {
      lead: { name: 'Dana' },
      name: 'Platform',
    }).raw() as Array<Record<string, unknown>>;
    const team = graph.find((node) => {
      return (node['@type'] as Record<string, unknown>)?.['@id'] === schema.$id;
    });
    const leadRef = team['https://myapp.io/Team#lead'] as Record<string, unknown>;
    const lead = graph.find((node) => {
      return node['@id'] === leadRef?.['@id'];
    });

    assert.ok(team);
    assert.deepEqual(team['@type'], { '@id': schema.$id });
    assert.deepEqual(lead?.['@type'], { '@id': 'https://myapp.io/Team#/$defs/Person' });
    assert.equal(lead?.['https://myapp.io/Team#/$defs/Person#name'], 'Dana');
  });
});
