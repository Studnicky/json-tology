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
  const constructionScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [UserSchema]
        });

        assert.ok(jt instanceof JsonTology);
        assert.ok(typeof jt.registry === 'object');
        assert.ok(typeof jt.materializer === 'object');
        assert.ok(jt.get(UserSchema.$id) !== undefined);
      },
      'name': 'constructs with schemas provided and exposes registry + materializer'
    },
    {
      'check': () => {
        const empty = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

        assert.ok(empty instanceof JsonTology);
      },
      'name': 'constructs without schemas'
    },
    {
      'check': () => {
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });
        const result = jt.register(UserSchema);

        assert.strictEqual(result, jt);
        assert.ok(jt.get(UserSchema.$id) !== undefined);
      },
      'name': 'register() is fluent and registers a single schema'
    },
    {
      'check': () => {
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

        jt.register(UserSchema);
        jt.register([RoleSchema]);
        assert.ok(jt.get(RoleSchema.$id) !== undefined);
      },
      'name': 'register() accepts an array of schemas'
    },
    {
      'check': () => {
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

        jt.register(UserSchema);
        jt.register(UserSchema);
        assert.ok(jt.get(UserSchema.$id) !== undefined);
        assert.equal(jt.list().filter((id) => {
          return id === UserSchema.$id;
        }).length, 1);
      },
      'name': 'registering the same schema twice is idempotent'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of constructionScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

void describe('JsonTology.validate(), coerce(), is()', () => {
  const validateScenarios: Array<{
    'check': (jt: JsonTology) => void;
    'data': unknown;
    'method': 'coerce' | 'is' | 'validate';
    'name': string;
  }> = [
    {
      'check': (jt) => {
        assert.ok(jt.validate(UserSchema.$id, {
          'email': 'a@b.com',
          'name': 'Alice'
        }).ok);
      },
      'data': {
        'email': 'a@b.com',
        'name': 'Alice'
      },
      'method': 'validate',
      'name': 'validate returns empty for valid data'
    },
    {
      'check': (jt) => {
        assert.ok(jt.validate(UserSchema.$id, {
          'email': 'a@b.com',
          'name': 42
        }).length > 0);
      },
      'data': {
        'email': 'a@b.com',
        'name': 42
      },
      'method': 'validate',
      'name': 'validate returns errors for wrong type'
    },
    {
      'check': (jt) => {
        assert.ok(jt.validate(UserSchema.$id, { 'name': 'Alice' }).length > 0);
      },
      'data': { 'name': 'Alice' },
      'method': 'validate',
      'name': 'validate returns errors for missing required field'
    },
    {
      'check': (jt) => {
        const errs = jt.validate(UserSchema.$id, { 'name': 'Alice' });

        assert.ok(errs.length > 0);
        assert.ok(typeof errs.items[0].path === 'string');
        assert.ok(typeof errs.items[0].message === 'string');
      },
      'data': { 'name': 'Alice' },
      'method': 'validate',
      'name': 'validate() returns ValidationErrors with items for invalid data'
    },
    {
      'check': (jt) => {
        const ok = jt.validate(UserSchema.$id, {
          'email': 'a@b.com',
          'name': 'Alice'
        });

        assert.equal(ok.length, 0);
        assert.equal(ok.ok, true);
      },
      'data': {
        'email': 'a@b.com',
        'name': 'Alice'
      },
      'method': 'validate',
      'name': 'validate() returns ok=true and length=0 for valid data'
    },
    {
      'check': (jt) => {
        const user = jt.instantiate(UserSchema, {
          'email': 'a@b.com',
          'name': 'Alice'
        });

        assert.equal((user as { 'active': boolean }).active, true);
      },
      'data': {
        'email': 'a@b.com',
        'name': 'Alice'
      },
      'method': 'coerce',
      'name': 'coerce() returns data with defaults applied'
    },
    {
      'check': (jt) => {
        assert.throws(() => {
          return jt.instantiate(UserSchema, { 'name': 'Alice' });
        });
      },
      'data': { 'name': 'Alice' },
      'method': 'coerce',
      'name': 'coerce() throws on invalid data'
    },
    {
      'check': (jt) => {
        assert.equal(jt.is(UserSchema, {
          'email': 'a@b.com',
          'name': 'Alice'
        }), true);
      },
      'data': {
        'email': 'a@b.com',
        'name': 'Alice'
      },
      'method': 'is',
      'name': 'is() returns true for valid data'
    },
    {
      'check': (jt) => {
        assert.equal(jt.is(UserSchema, { 'name': 'Alice' }), false);
      },
      'data': { 'name': 'Alice' },
      'method': 'is',
      'name': 'is() returns false for invalid data'
    },
    {
      'check': (jt) => {
        assert.ok(jt.validate(UserSchema.$id, 'not-an-object').length > 0);
      },
      'data': 'not-an-object',
      'method': 'validate',
      'name': 'validate returns errors for completely wrong data type'
    },
    {
      'check': (jt) => {
        assert.equal(jt.is(UserSchema, null), false);
      },
      'data': null,
      'method': 'is',
      'name': 'is() returns false for null input'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of validateScenarios) {
    void it(scenarioName, () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://myapp.io',
        'schemas': [UserSchema]
      });

      check(jt);
    });
  }
});

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

void describe('JsonTology.materialize()', () => {
  const materializeScenarios: Array<{
    'check': (result: unknown) => void;
    'data': Record<string, unknown>;
    'name': string;
  }> = [
    {
      'check': (result) => {
        assert.equal((result as { 'name': string }).name, 'Anonymous');
        assert.equal((result as { 'active': boolean }).active, true);
      },
      'data': { 'email': 'a@b.com' },
      'name': 'materializes with defaults when values are omitted'
    },
    {
      'check': (result) => {
        assert.equal((result as { 'name': string }).name, 'Alice');
      },
      'data': {
        'email': 'a@b.com',
        'name': 'Alice'
      },
      'name': 'materializes with provided values overriding defaults'
    },
    {
      'check': (result) => {
        assert.equal((result as { 'name': string }).name, 'Anonymous');
        assert.equal((result as { 'active': boolean }).active, true);
        assert.equal((result as { 'email': string }).email, 'test@example.com');
      },
      'data': { 'email': 'test@example.com' },
      'name': 'materializes object with required fields and fills optional defaults'
    }
  ];

  for (const {
    check, data, 'name': scenarioName
  } of materializeScenarios) {
    void it(scenarioName, () => {
      const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });
      const result = jt.materialize(UserSchema, data);

      check(result);
    });
  }
});

// ---------------------------------------------------------------------------
// Ontology
// ---------------------------------------------------------------------------

void describe('JsonTology.ontology()', () => {
  const ontologyScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [UserSchema]
        });
        const onto = jt.ontology();

        assert.ok(typeof onto.jsonLd === 'function');
        assert.ok(typeof onto.jsonLdObject === 'function');
        assert.ok(typeof onto.raw === 'function');
      },
      'name': 'returns OntologyBuilder with jsonLd, jsonLdObject, and raw methods'
    },
    {
      'check': () => {
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
      },
      'name': 'jsonLdObject includes standard and custom prefixes in context'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [UserSchema]
        });

        jt.register(RoleSchema);
        const graph = jt.ontology().raw() as Array<Record<string, unknown>>;
        const ids = graph.filter((node) => {
          return node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
        }).map((node) => {
          return node['@id'];
        });

        assert.ok(ids.includes(RoleSchema.$id));
      },
      'name': 'reflects newly registered schemas on each ontology() call'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [
            UserSchema,
            RoleSchema
          ]
        });
        const graph = jt.ontology().raw() as Array<Record<string, unknown>>;

        const classNodes = graph.filter((node) => {
          return node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
        });
        const ids = new Set(classNodes.map((node) => {
          return node['@id'];
        }));

        assert.ok(ids.has(UserSchema.$id));
        assert.ok(ids.has(RoleSchema.$id));

        const userClass = graph.find((node) => {
          return node['@id'] === UserSchema.$id;
        });

        assert.ok(userClass !== undefined, 'userClass should exist');
        assert.equal(userClass['http://www.w3.org/2000/01/rdf-schema#label'], 'User');
        assert.equal(userClass['http://www.w3.org/2000/01/rdf-schema#comment'], 'An application user');
      },
      'name': 'raw graph includes class nodes with rdfs:label and rdfs:comment from title/description'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [
            UserSchema,
            RoleSchema
          ]
        });
        const graph = jt.ontology().raw() as Array<Record<string, unknown>>;

        const userClass = graph.find((node) => {
          return node['@id'] === UserSchema.$id;
        });

        assert.ok(userClass !== undefined);
        const subClassOf = userClass['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as Array<Record<string, unknown>>;

        assert.ok(Array.isArray(subClassOf));
        const emailRestriction = subClassOf.find((restriction) => {
          return restriction['@type'] === 'http://www.w3.org/2002/07/owl#Restriction'
                 && (restriction['http://www.w3.org/2002/07/owl#onProperty'] as Record<string, unknown>)['@id'] === 'https://myapp.io/User#email';
        });

        assert.ok(emailRestriction !== undefined, 'email restriction should exist');
        assert.equal(emailRestriction['http://www.w3.org/2002/07/owl#minCardinality'], 1);

        const emailProp = graph.find((node) => {
          return node['@id'] === 'https://myapp.io/User#email';
        });

        assert.ok(emailProp !== undefined, 'emailProp should exist');
        assert.equal(emailProp['@type'], 'http://www.w3.org/2002/07/owl#DatatypeProperty');
      },
      'name': 'owl:Restriction for required fields and property nodes with class-scoped IRIs'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [DirectorySchema]
        });
        const graph = jt.ontology().raw() as Array<Record<string, unknown>>;

        const employeeClass = graph.find((node) => {
          return node['@id'] === 'https://myapp.io/Directory#/$defs/Employee' && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
        });

        assert.ok(employeeClass !== undefined, 'employeeClass should exist');
        assert.equal(employeeClass['http://www.w3.org/2000/01/rdf-schema#label'], 'Employee');

        const employeeProp = graph.find((node) => {
          return node['@id'] === 'https://myapp.io/Directory#primaryEmployee';
        });

        assert.ok(employeeProp !== undefined, 'employeeProp should exist');
        assert.deepEqual(employeeProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'https://myapp.io/Directory#/$defs/Employee' });

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
      },
      'name': 'serializes $defs as class nodes, resolves $ref ranges and array item refs'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of ontologyScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});

// ---------------------------------------------------------------------------
// toQuads
// ---------------------------------------------------------------------------

void describe('JsonTology.toQuads()', () => {
  const toQuadsScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [UserSchema]
        });
        const graph = jt.ontology().addQuads(jt.toQuads(UserSchema, {
          'active': true,
          'email': 'alice@example.com',
          'name': 'Alice'
        })).raw() as Array<Record<string, unknown>>;
        const root = graph.find((node) => {
          return typeof node['@id'] === 'string' && String(node['@id']).includes('/instances/');
        });

        assert.ok(root !== undefined, 'root ABox node should exist');
        assert.deepEqual(root['@type'], { '@id': UserSchema.$id });
        assert.equal(root['https://myapp.io/User#name'], 'Alice');
        assert.equal(root['https://myapp.io/User#email'], 'alice@example.com');
      },
      'name': 'projects validated instance data into ABox nodes'
    },
    {
      'check': () => {
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
        const teamGraph = jt.ontology().addQuads(jt.toQuads(schema, {
          'lead': { 'name': 'Dana' },
          'name': 'Platform'
        })).raw() as Array<Record<string, unknown>>;
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
      },
      'name': 'nested object references reuse canonical property and class identifiers'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of toQuadsScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});

// ---------------------------------------------------------------------------
// Utility methods
// ---------------------------------------------------------------------------

void describe('JsonTology utility methods', () => {
  const utilityScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [
            UserSchema,
            DirectorySchema
          ] as const
        });
        const ids = jt.list();

        assert.ok(ids.includes(UserSchema.$id));
        assert.ok(ids.includes(DirectorySchema.$id));
        assert.ok(ids.length >= 2);
      },
      'name': 'list() returns registered schema ids'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [
            UserSchema,
            DirectorySchema
          ] as const
        });

        assert.equal(jt.has(UserSchema.$id), true);
        assert.equal(jt.has('https://nonexistent.io/Missing'), false);
      },
      'name': 'has() checks presence of registered and unregistered schemas'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [
            UserSchema,
            DirectorySchema
          ] as const
        });

        assert.equal(jt.toSchema('https://nonexistent.io/Missing'), undefined);

        const schema = jt.toSchema(UserSchema.$id);

        assert.ok(schema !== undefined);
        assert.equal(schema.$id, UserSchema.$id);
      },
      'name': 'toSchema() returns undefined for unregistered, schema for registered'
    },
    {
      'check': () => {
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });
        const anonSchema = {
          'properties': { 'x': { 'type': 'number' } },
          'type': 'object'
        };
        const id = jt.registerAnonymous(anonSchema);

        assert.ok(id.startsWith('urn:json-tology:hash:'));
        assert.equal(jt.has(id), true);
        assert.equal(jt.validate(id, { 'x': 1 }).length, 0);
      },
      'name': 'registerAnonymous() assigns synthetic id to schemas without $id'
    },
    {
      'check': () => {
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });
        const namedSchema = {
          '$id': 'https://myapp.io/Named',
          'type': 'string'
        };
        const namedId = jt.registerAnonymous(namedSchema);

        assert.equal(namedId, 'https://myapp.io/Named');
        assert.equal(jt.has('https://myapp.io/Named'), true);
      },
      'name': 'registerAnonymous() with $id delegates to register()'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [UserSchema] as const
        });
        const sub = jt.subschemaAt(UserSchema.$id, '/properties/name');
        const errs = jt.validate(sub, 'Alice');

        assert.equal(errs.items.length, 0);
      },
      'name': 'subschemaAt() validates data against a sub-schema pointer (valid)'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [UserSchema] as const
        });
        const sub = jt.subschemaAt(UserSchema.$id, '/properties/name');
        const errs = jt.validate(sub, 123);

        assert.ok(errs.items.length > 0);
      },
      'name': 'subschemaAt() returns errors for wrong type at sub-schema pointer'
    },
    {
      'check': () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://myapp.io',
          'schemas': [UserSchema] as const
        });
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
      },
      'name': 'fromQuads() lifts ABox quads back to typed JS objects'
    },
    {
      'check': () => {
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

        assert.deepEqual(jt.list(), []);
      },
      'name': 'list() returns empty array for fresh instance with no schemas'
    },
    {
      'check': () => {
        const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

        assert.equal(jt.has('https://anything.io/Foo'), false);
      },
      'name': 'has() returns false for empty instance'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of utilityScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});
