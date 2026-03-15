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
  void it('constructs with and without schemas, exposes registry and materializer', () => {
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
  });

  void it('registers single schemas, arrays, and is fluent', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });
    const result = jt.register(UserSchema);

    assert.strictEqual(result, jt);
    assert.ok(jt.get(UserSchema.$id) !== undefined);

    jt.register([RoleSchema]);
    assert.ok(jt.get(RoleSchema.$id) !== undefined);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

void describe('JsonTology.validate(), errors(), parse(), is()', () => {
  void it('validate returns empty for valid, errors for invalid/missing required', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

    assert.deepEqual(jt.validate(UserSchema.$id, {
      'email': 'a@b.com',
      'name': 'Alice'
    }), []);
    assert.ok(jt.validate(UserSchema.$id, {
      'email': 'a@b.com',
      'name': 42
    }).length > 0);
    assert.ok(jt.validate(UserSchema.$id, { 'name': 'Alice' }).length > 0);
  });

  void it('errors() returns ValidationErrors with items or empty', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

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
  });

  void it('parse() returns data with defaults, throws on invalid', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

    const user = jt.parse(UserSchema, {
      'email': 'a@b.com',
      'name': 'Alice'
    });

    assert.equal((user as { 'active': boolean }).active, true);
    assert.throws(() => {
      return jt.parse(UserSchema, { 'name': 'Alice' });
    });
  });

  void it('is() returns true/false for valid/invalid', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

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
  void it('returns OntologyBuilder with jsonLd, jsonLdObject, and raw methods', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });
    const onto = jt.ontology();

    assert.ok(typeof onto.jsonLd === 'function');
    assert.ok(typeof onto.jsonLdObject === 'function');
    assert.ok(typeof onto.raw === 'function');
  });

  void it('jsonLdObject includes standard prefixes in context, merges custom prefixes', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'prefixes': { 'myns': 'https://myapp.io/ns#' },
      'schemas': [UserSchema]
    });
    const ctx = jt.ontology().jsonLdObject()['@context'] as Record<string, string>;

    assert.ok('owl' in ctx);
    assert.ok('rdfs' in ctx);
    assert.ok('xsd' in ctx);
    assert.ok('myns' in ctx);
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
      return node['@type'] === 'owl:Class';
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
    assert.equal(userClass['rdfs:label'], 'User');
    assert.equal(userClass['rdfs:comment'], 'An application user');

    // owl:Restriction for required fields
    const subClassOf = userClass['rdfs:subClassOf'] as Array<Record<string, unknown>>;

    assert.ok(Array.isArray(subClassOf));
    const emailRestriction = subClassOf.find((restriction) => {
      return restriction['@type'] === 'owl:Restriction'
             && (restriction['owl:onProperty'] as Record<string, unknown>)['@id'] === 'https://myapp.io/User#email';
    });

    assert.ok(emailRestriction !== undefined, 'email restriction should exist');
    assert.equal(emailRestriction['owl:minCardinality'], 1);

    // Property nodes with class-scoped IRIs
    const emailProp = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/User#email';
    });

    assert.ok(emailProp !== undefined, 'emailProp should exist');
    assert.equal(emailProp['@type'], 'owl:DatatypeProperty');
  });

  void it('reflects newly registered schemas on each ontology() call', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

    jt.register(RoleSchema);
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
    const ids = graph.filter((node) => {
      return node['@type'] === 'owl:Class';
    }).map((node) => {
      return node['@id'];
    });

    assert.ok(ids.includes(RoleSchema.$id));
  });

  void it('serializes $defs as class nodes, resolves $ref ranges and array item refs', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [DirectorySchema]
    });
    const graph = jt.ontology().raw() as Array<Record<string, unknown>>;

    // $defs Employee class
    const employeeClass = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/Directory#/$defs/Employee' && node['@type'] === 'owl:Class';
    });

    assert.ok(employeeClass !== undefined, 'employeeClass should exist');
    assert.equal(employeeClass['rdfs:label'], 'Employee');

    // $ref range on primaryEmployee property
    const employeeProp = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/Directory#primaryEmployee';
    });

    assert.ok(employeeProp !== undefined, 'employeeProp should exist');
    assert.deepEqual(employeeProp['rdfs:range'], { '@id': 'https://myapp.io/Directory#/$defs/Employee' });

    // owl:allValuesFrom restriction for array item refs
    const classNode = graph.find((node) => {
      return node['@id'] === 'https://myapp.io/Directory' && node['@type'] === 'owl:Class';
    });

    assert.ok(classNode !== undefined, 'classNode should exist');
    const subs = classNode['rdfs:subClassOf'] as Array<Record<string, unknown>>;

    assert.ok(Array.isArray(subs));
    const avf = subs.find((restriction: Record<string, unknown>) => {
      return restriction['@type'] === 'owl:Restriction'
      && (restriction['owl:onProperty'] as Record<string, unknown>)['@id'] === 'https://myapp.io/Directory#employees'
      && restriction['owl:allValuesFrom'] !== undefined;
    });

    assert.ok(avf !== undefined, 'allValuesFrom restriction should exist');
    assert.deepEqual(avf['owl:allValuesFrom'], { '@id': 'https://myapp.io/Directory#/$defs/Employee' });
  });
});

void describe('JsonTology.abox()', () => {
  void it('projects validated instance data into ABox nodes typed by the schema graph', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });
    const graph = jt.abox(UserSchema, {
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
  });

  void it('reuses canonical property and class identifiers for nested object references', () => {
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
    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [schema]
    });
    const graph = jt.abox(schema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }).raw() as Array<Record<string, unknown>>;
    const team = graph.find((node) => {
      return (node['@type'] as Record<string, unknown>)['@id'] === schema.$id;
    });

    assert.ok(team !== undefined, 'team ABox node should exist');
    const leadRef = team['https://myapp.io/Team#lead'] as Record<string, unknown>;
    const lead = graph.find((node) => {
      return node['@id'] === leadRef['@id'];
    });

    assert.deepEqual(team['@type'], { '@id': schema.$id });
    assert.ok(lead !== undefined, 'lead ABox node should exist');
    assert.deepEqual(lead['@type'], { '@id': 'https://myapp.io/Team#/$defs/Person' });
    assert.equal(lead['https://myapp.io/Team#/$defs/Person#name'], 'Dana');
  });
});
