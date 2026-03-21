/**
 * JsonTology -- integration tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';

const UserSchema = {
  '$id': 'https://myapp.io/User',
  'description': 'An application user',
  'properties': {
    'active': {
      'default': true,
      'type': 'boolean'
    },
    'age': { 'type': 'number' },
    'email': { 'type': 'string' },
    'name': {
      'default': 'Anonymous',
      'type': 'string'
    }
  },
  'required': [
    'name',
    'email'
  ],
  'title': 'User',
  'type': 'object'
} as const;

const RoleSchema = {
  '$id': 'https://myapp.io/Role',
  'description': 'A user role',
  'properties': {
    'level': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'title': 'Role',
  'type': 'object'
} as const;

const DirectorySchema = {
  '$defs': {
    'Employee': {
      '$anchor': 'employee',
      'properties': { 'id': { 'type': 'string' } },
      'required': ['id'],
      'title': 'Employee',
      'type': 'object'
    }
  },
  '$id': 'https://myapp.io/Directory',
  'properties': {
    'employees': {
      'items': { '$ref': '#/$defs/Employee' },
      'type': 'array'
    },
    'primaryEmployee': { '$ref': '#/$defs/Employee' }
  },
  'required': ['primaryEmployee'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Construction + Registration
// ---------------------------------------------------------------------------

void describe('JsonTology construction and registration', () => {
  void it('constructs with/without schemas, registers single and array, is fluent', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

    assert.ok(jt instanceof JsonTology);
    assert.ok(typeof jt.registry === 'object');
    assert.ok(typeof jt.materializer === 'object');
    assert.ok(jt.get(UserSchema.$id) !== undefined);

    const empty = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

    assert.ok(empty instanceof JsonTology);

    // register single schema (fluent)
    const jt2 = JsonTology.create({ 'baseIRI': 'https://myapp.io' });
    const result = jt2.register(UserSchema);

    assert.strictEqual(result, jt2);
    assert.ok(jt2.get(UserSchema.$id) !== undefined);

    // register array of schemas
    jt2.register([RoleSchema]);
    assert.ok(jt2.get(RoleSchema.$id) !== undefined);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

void describe('JsonTology.validate(), errors(), coerce(), is()', () => {
  void it('validate, errors, coerce, and is all operate correctly on valid and invalid data', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

    // validate returns empty for valid, errors for invalid/missing required
    assert.deepEqual(jt.validate(UserSchema.$id, {
      'email': 'a@b.com',
      'name': 'Alice'
    }), []);
    assert.ok(jt.validate(UserSchema.$id, {
      'email': 'a@b.com',
      'name': 42
    }).length > 0);
    assert.ok(jt.validate(UserSchema.$id, { 'name': 'Alice' }).length > 0);

    // errors() returns ValidationErrors with items or empty
    const errs = jt.errors(UserSchema.$id, { 'name': 'Alice' });

    assert.ok(errs.length > 0);
    assert.ok(typeof errs.items[0].path === 'string');
    assert.ok(typeof errs.items[0].message === 'string');

    const ok = jt.errors(UserSchema.$id, {
      'email': 'a@b.com',
      'name': 'Alice'
    });

    assert.equal(ok.length, 0);
    assert.equal(ok.ok, true);

    // coerce() returns data with defaults, throws on invalid
    const user = jt.coerce(UserSchema, {
      'email': 'a@b.com',
      'name': 'Alice'
    });

    assert.equal((user as { 'active': boolean }).active, true);
    assert.throws(() => {
      return jt.coerce(UserSchema, { 'name': 'Alice' });
    });

    // is() returns true/false for valid/invalid
    assert.equal(jt.is(UserSchema, {
      'email': 'a@b.com',
      'name': 'Alice'
    }), true);
    assert.equal(jt.is(UserSchema, { 'name': 'Alice' }), false);
  });
});

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

void describe('JsonTology.materialize()', () => {
  void it('materializes with defaults and merges provided values', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

    const user1 = jt.materialize(UserSchema, { 'email': 'a@b.com' });

    assert.equal((user1 as { 'name': string }).name, 'Anonymous');
    assert.equal((user1 as { 'active': boolean }).active, true);

    const user2 = jt.materialize(UserSchema, {
      'email': 'a@b.com',
      'name': 'Alice'
    });

    assert.equal((user2 as { 'name': string }).name, 'Alice');
  });
});

// ---------------------------------------------------------------------------
// Ontology
// ---------------------------------------------------------------------------

void describe('JsonTology.ontology()', () => {
  void it('returns OntologyBuilder with methods, standard/custom prefixes, and reflects new registrations', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });
    const onto = jt.ontology();

    assert.ok(typeof onto.jsonLd === 'function');
    assert.ok(typeof onto.jsonLdObject === 'function');
    assert.ok(typeof onto.raw === 'function');

    // jsonLdObject includes standard prefixes in context, merges custom prefixes
    const jt2 = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'prefixes': { 'myns': 'https://myapp.io/ns#' },
      'schemas': [UserSchema]
    });
    const ctx = jt2.ontology().jsonLdObject()['@context'] as Record<string, string>;

    assert.ok('owl' in ctx);
    assert.ok('rdfs' in ctx);
    assert.ok('xsd' in ctx);
    assert.ok('myns' in ctx);

    // reflects newly registered schemas on each ontology() call
    jt.register(RoleSchema);
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const ids = graph.filter((node) => {
      return node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    }).map((node) => {
      return node['@id'];
    });

    assert.ok(ids.includes(RoleSchema.$id));
  });

  void it('raw graph includes class nodes with rdfs:label, rdfs:comment, restrictions, and property IRIs', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [
        UserSchema,
        RoleSchema
      ]
    });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;

    // Class nodes for each schema
    const classNodes = graph.filter((node) => {
      return node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    });
    const ids = new Set(classNodes.map((node) => {
      return node['@id'];
    }));

    assert.ok(ids.has(UserSchema.$id));
    assert.ok(ids.has(RoleSchema.$id));

    // rdfs:label and rdfs:comment from title/description
    const userClass = graph.find((node) => {
      return node['@id'] === UserSchema.$id;
    });

    assert.ok(userClass !== undefined, 'userClass should exist');
    assert.equal(userClass['http://www.w3.org/2000/01/rdf-schema#label'], 'User');
    assert.equal(userClass['http://www.w3.org/2000/01/rdf-schema#comment'], 'An application user');

    // owl:Restriction for required fields
    const subClassOf = userClass['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as Array<Record<string, unknown>>;

    assert.ok(Array.isArray(subClassOf));
    const emailRestriction = subClassOf.find((restriction) => {
      return restriction['@type'] === 'http://www.w3.org/2002/07/owl#Restriction'
             && (restriction['http://www.w3.org/2002/07/owl#onProperty'] as Record<string, unknown>)['@id'] === 'https://myapp.io/User#email';
    });

    assert.ok(emailRestriction !== undefined, 'email restriction should exist');
    assert.equal(emailRestriction['http://www.w3.org/2002/07/owl#minCardinality'], 1);

    // Property nodes with class-scoped IRIs
    const emailProp = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/User#email';
    });

    assert.ok(emailProp !== undefined, 'emailProp should exist');
    assert.equal(emailProp['@type'], 'http://www.w3.org/2002/07/owl#DatatypeProperty');
  });

  void it('serializes $defs as class nodes, resolves $ref ranges and array item refs', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [DirectorySchema]
    });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;

    // $defs Employee class
    const employeeClass = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/Directory#/$defs/Employee' && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    });

    assert.ok(employeeClass !== undefined, 'employeeClass should exist');
    assert.equal(employeeClass['http://www.w3.org/2000/01/rdf-schema#label'], 'Employee');

    // $ref range on primaryEmployee property
    const employeeProp = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/Directory#primaryEmployee';
    });

    assert.ok(employeeProp !== undefined, 'employeeProp should exist');
    assert.deepEqual(employeeProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'https://myapp.io/Directory#/$defs/Employee' });

    // owl:allValuesFrom restriction for array item refs
    const classNode = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/Directory' && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    });

    assert.ok(classNode !== undefined, 'classNode should exist');
    const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as Array<Record<string, unknown>>;

    assert.ok(Array.isArray(subs));
    const avf = subs.find((restriction: Record<string, unknown>) => {
      return restriction['@type'] === 'http://www.w3.org/2002/07/owl#Restriction'
      && (restriction['http://www.w3.org/2002/07/owl#onProperty'] as Record<string, unknown>)['@id'] === 'https://myapp.io/Directory#employees'
      && restriction['http://www.w3.org/2002/07/owl#allValuesFrom'] !== undefined;
    });

    assert.ok(avf !== undefined, 'allValuesFrom restriction should exist');
    assert.deepEqual(avf['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'https://myapp.io/Directory#/$defs/Employee' });
  });
});

void describe('JsonTology.toQuads()', () => {
  void it('projects validated instance data into ABox nodes and reuses canonical identifiers for nested refs', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });
    const graph = jt.toQuads(UserSchema, {
      'active': true,
      'email': 'alice@example.com',
      'name': 'Alice'
    }).raw() as Array<Record<string, unknown>>;
    const root = graph.find((node) => {
      return typeof node['@id'] === 'string' && String(node['@id']).includes('/instances/');
    });

    assert.ok(root !== undefined, 'root ABox node should exist');
    assert.deepEqual(root['@type'], { '@id': UserSchema.$id });
    assert.equal(root['https://myapp.io/User#name'], 'Alice');
    assert.equal(root['https://myapp.io/User#email'], 'alice@example.com');

    // nested object references reuse canonical property and class identifiers
    const schema = {
      '$defs': {
        'Person': {
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name'],
          'type': 'object'
        }
      },
      '$id': 'https://myapp.io/Team',
      'properties': {
        'lead': { '$ref': '#/$defs/Person' },
        'name': { 'type': 'string' }
      },
      'required': [
        'lead',
        'name'
      ],
      'type': 'object'
    } as const;
    const jt2 = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [schema]
    });
    const teamGraph = jt2.toQuads(schema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }).raw() as Array<Record<string, unknown>>;
    const team = teamGraph.find((node) => {
      return (node['@type'] as Record<string, unknown>)['@id'] === schema.$id;
    });

    assert.ok(team !== undefined, 'team ABox node should exist');
    const leadRef = team['https://myapp.io/Team#lead'] as Record<string, unknown>;
    const lead = teamGraph.find((node) => {
      return node['@id'] === leadRef['@id'];
    });

    assert.deepEqual(team['@type'], { '@id': schema.$id });
    assert.ok(lead !== undefined, 'lead ABox node should exist');
    assert.deepEqual(lead['@type'], { '@id': 'https://myapp.io/Team#/$defs/Person' });
    assert.equal(lead['https://myapp.io/Team#/$defs/Person#name'], 'Dana');
  });
});

// ---------------------------------------------------------------------------
// Utility methods
// ---------------------------------------------------------------------------

void describe('JsonTology utility methods', () => {
  void it('list() returns registered schema ids, has() checks presence, toSchema() returns undefined for missing', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [
        UserSchema,
        DirectorySchema
      ] as const
    });

    // list()
    const ids = jt.list();

    assert.ok(ids.includes(UserSchema.$id));
    assert.ok(ids.includes(DirectorySchema.$id));
    assert.ok(ids.length >= 2);

    // has()
    assert.equal(jt.has(UserSchema.$id), true);
    assert.equal(jt.has('https://nonexistent.io/Missing'), false);

    // toSchema() returns undefined for unregistered
    assert.equal(jt.toSchema('https://nonexistent.io/Missing'), undefined);

    // toSchema() returns a schema for registered
    const schema = jt.toSchema(UserSchema.$id);

    assert.ok(schema !== undefined);
    assert.equal(schema.$id, UserSchema.$id);
  });

  void it('registerAnonymous() assigns synthetic id to schemas without $id', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });
    const anonSchema = {
      'properties': { 'x': { 'type': 'number' } },
      'type': 'object'
    };
    const id = jt.registerAnonymous(anonSchema);

    assert.ok(id.startsWith('urn:json-tology:hash:'));
    assert.equal(jt.has(id), true);
    assert.equal(jt.validate(id, { 'x': 1 }).length, 0);

    // Schema with $id delegates to register()
    const namedSchema = {
      '$id': 'https://myapp.io/Named',
      'type': 'string'
    };
    const namedId = jt.registerAnonymous(namedSchema);

    assert.equal(namedId, 'https://myapp.io/Named');
    assert.equal(jt.has('https://myapp.io/Named'), true);
  });

  void it('validateAt() validates data against a sub-schema pointer', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema] as const
    });

    // Valid name at /properties/name
    const errs1 = jt.validateAt(UserSchema.$id, '/properties/name', 'Alice');

    assert.equal(errs1.length, 0);

    // Invalid name (wrong type)
    const errs2 = jt.validateAt(UserSchema.$id, '/properties/name', 123);

    assert.ok(errs2.length > 0);
  });

  void it('fromQuads() lifts ABox quads back to typed JS objects', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema] as const
    });

    // Project to quads then lift back
    const quads = jt.materializer.projectAbox(
      UserSchema as unknown as Record<string, unknown> & { '$id': string },
      {
        'email': 'a@b.com',
        'name': 'Alice'
      },
      'https://myapp.io'
    );
    const lifted = jt.fromQuads(UserSchema.$id, quads);

    assert.ok(lifted.length > 0);
    const first = lifted[0] as Record<string, unknown>;

    assert.equal(first.name, 'Alice');
    assert.equal(first.email, 'a@b.com');
  });
});
