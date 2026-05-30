// Merged from: jsonTology-orig.ts, apiUnification.test.ts, staticCounterparts.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  JsonTology, OntologyBuilder, Path, Resolver, ValidationErrors
} from '../../src/index.js';

// ===========================================================================
// Source: jsonTology-orig.ts
// ===========================================================================
{
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
          assert.ok(jt.registry.get(UserSchema.$id) !== undefined);
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
          const result = jt.set(UserSchema);

          assert.strictEqual(result, jt);
          assert.ok(jt.registry.get(UserSchema.$id) !== undefined);
        },
        'name': 'register() is fluent and registers a single schema'
      },
      {
        'check': () => {
          const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

          jt.set(UserSchema);
          jt.set([RoleSchema]);
          assert.ok(jt.registry.get(RoleSchema.$id) !== undefined);
        },
        'name': 'register() accepts an array of schemas'
      },
      {
        'check': () => {
          const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

          jt.set(UserSchema);
          jt.set(UserSchema);
          assert.ok(jt.registry.get(UserSchema.$id) !== undefined);
          assert.equal([...jt.registry.keys()].filter((id) => {
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
          assert.ok(jt.validate(UserSchema, {
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
          assert.ok(jt.validate(UserSchema, {
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
          assert.ok(jt.validate(UserSchema, { 'name': 'Alice' }).length > 0);
        },
        'data': { 'name': 'Alice' },
        'method': 'validate',
        'name': 'validate returns errors for missing required field'
      },
      {
        'check': (jt) => {
          const errs = jt.validate(UserSchema, { 'name': 'Alice' });

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
          const ok = jt.validate(UserSchema, {
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
          assert.ok(jt.validate(UserSchema, 'not-an-object').length > 0);
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

    const jt = JsonTology.create({
      'baseIRI': 'https://myapp.io',
      'schemas': [UserSchema]
    });

    for (const {
      check, 'name': scenarioName
    } of validateScenarios) {
      void it(scenarioName, () => {
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

    const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

    for (const {
      check, data, 'name': scenarioName
    } of materializeScenarios) {
      void it(scenarioName, () => {
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
          assert.ok(typeof onto.quads === 'function');
        },
        'name': 'returns OntologyBuilder with jsonLd, jsonLdObject, and quads methods'
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

          jt.set(RoleSchema);
          const graph = (jt.ontology().jsonLdObject()['@graph']) as Array<Record<string, unknown>>;
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
          const graph = (jt.ontology().jsonLdObject()['@graph']) as Array<Record<string, unknown>>;

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
          const graph = (jt.ontology().jsonLdObject()['@graph']) as Array<Record<string, unknown>>;

          const userClass = graph.find((node) => {
            return node['@id'] === UserSchema.$id;
          });

          assert.ok(userClass !== undefined);
          const subClassOf = userClass['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as Array<Record<string, unknown>>;

          assert.ok(Array.isArray(subClassOf));
          const emailRestriction = subClassOf.find((restriction) => {
            return restriction['@type'] === 'http://www.w3.org/2002/07/owl#Restriction'
                 && (restriction['http://www.w3.org/2002/07/owl#onProperty'] as Record<string, unknown>)['@id'] === 'https://myapp.io/email';
          });

          assert.ok(emailRestriction !== undefined, 'email restriction should exist');
          assert.equal(emailRestriction['http://www.w3.org/2002/07/owl#minCardinality'], 1);

          const emailProp = graph.find((node) => {
            return node['@id'] === 'https://myapp.io/email';
          });

          assert.ok(emailProp !== undefined, 'emailProp should exist');
          assert.equal(emailProp['@type'], 'http://www.w3.org/2002/07/owl#DatatypeProperty');
        },
        'name': 'owl:Restriction for required fields and property nodes with flat predicate IRIs'
      },
      {
        'check': () => {
          const jt = JsonTology.create({
            'baseIRI': 'https://myapp.io',
            'schemas': [DirectorySchema]
          });
          const graph = (jt.ontology().jsonLdObject()['@graph']) as Array<Record<string, unknown>>;

          const employeeClass = graph.find((node) => {
            return node['@id'] === 'https://myapp.io/Directory#/$defs/Employee' && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
          });

          assert.ok(employeeClass !== undefined, 'employeeClass should exist');
          assert.equal(employeeClass['http://www.w3.org/2000/01/rdf-schema#label'], 'Employee');

          const employeeProp = graph.find((node) => {
            return node['@id'] === 'https://myapp.io/primaryEmployee';
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
          && (restriction['http://www.w3.org/2002/07/owl#onProperty'] as Record<string, unknown>)['@id'] === 'https://myapp.io/employees'
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
          const graph = (jt.ontology().addFromQuads(jt.toQuads(UserSchema, {
            'active': true,
            'email': 'alice@example.com',
            'name': 'Alice'
          }))
            .jsonLdObject()['@graph']) as Array<Record<string, unknown>>;
          const root = graph.find((node) => {
            return typeof node['@id'] === 'string' && String(node['@id']).includes('/instances/');
          });

          assert.ok(root !== undefined, 'root ABox node should exist');
          const rootType = root['@type'];
          const rootTypeId = typeof rootType === 'object' && rootType !== null
            ? (rootType as Record<string, unknown>)['@id']
            : rootType;

          assert.equal(rootTypeId, UserSchema.$id);
          assert.equal(root['https://myapp.io/name'], 'Alice');
          assert.equal(root['https://myapp.io/email'], 'alice@example.com');
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
          const teamGraph = (jt.ontology().addFromQuads(jt.toQuads(schema, {
            'lead': { 'name': 'Dana' },
            'name': 'Platform'
          }))
            .jsonLdObject()['@graph']) as Array<Record<string, unknown>>;
          const team = teamGraph.find((node) => {
            const typeValue = node['@type'];
            const typeId = typeof typeValue === 'object' && typeValue !== null ? (typeValue as Record<string, unknown>)['@id'] : typeValue;

            return typeId === schema.$id;
          });

          assert.ok(team !== undefined, 'team ABox node should exist');
          const leadRef = team['https://myapp.io/lead'] as Record<string, unknown>;
          const lead = teamGraph.find((node) => {
            return node['@id'] === leadRef['@id'];
          });

          const teamType = team['@type'];
          const teamTypeId = typeof teamType === 'object' && teamType !== null
            ? (teamType as Record<string, unknown>)['@id']
            : teamType;

          assert.equal(teamTypeId, schema.$id);
          assert.ok(lead !== undefined, 'lead ABox node should exist');

          const leadType = lead['@type'];
          const leadTypeId = typeof leadType === 'object' && leadType !== null
            ? (leadType as Record<string, unknown>)['@id']
            : leadType;

          assert.equal(leadTypeId, 'https://myapp.io/Team#/$defs/Person');
          assert.equal(lead['https://myapp.io/name'], 'Dana');
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
          const ids = [...jt.registry.keys()];

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

          assert.equal(jt.registry.has(UserSchema.$id), true);
          assert.equal(jt.registry.has('https://nonexistent.io/Missing'), false);
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

          // An unregistered $id has no canonical graph, so toSchema yields undefined.
          assert.equal(jt.registry.graph('https://nonexistent.io/Missing'), undefined);

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
          assert.equal(jt.registry.has(id), true);
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
          assert.equal(jt.registry.has('https://myapp.io/Named'), true);
        },
        'name': 'registerAnonymous() with $id delegates to register()'
      },
      {
        'check': () => {
          // enableStrictGraph: false — subschemaAt registers extracted sub-schema
          // which triggers duplicate detection against the parent schema's shapes.
          const jt = JsonTology.create({
            'baseIRI': 'https://myapp.io',
            'enableStrictGraph': false,
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
          // enableStrictGraph: false — subschemaAt registers extracted sub-schema
          // which triggers duplicate detection against the parent schema's shapes.
          const jt = JsonTology.create({
            'baseIRI': 'https://myapp.io',
            'enableStrictGraph': false,
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
            UserSchema,
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

          assert.deepEqual([...jt.registry.keys()], []);
        },
        'name': 'list() returns empty array for fresh instance with no schemas'
      },
      {
        'check': () => {
          const jt = JsonTology.create({ 'baseIRI': 'https://myapp.io' });

          assert.equal(jt.registry.has('https://anything.io/Foo'), false);
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
}

// ===========================================================================
// Source: apiUnification.test.ts
// ===========================================================================
{
  const UserSchema = {
    '$id': 'https://api-unification.test/User',
    'properties': {
      'email': { 'type': 'string' },
      'name': { 'type': 'string' }
    },
    'required': [
      'email',
      'name'
    ],
    'type': 'object'
  } as const;

  // ---------------------------------------------------------------------------
  // Item 1: validate() returns ValidationErrors
  // ---------------------------------------------------------------------------

  void describe('Item 1: validate() returns ValidationErrors', () => {
    const entities = JsonTology.create({
      'baseIRI': 'https://api-unification.test',
      'schemas': [UserSchema]
    });

    void it('returns ValidationErrors instance (not string[])', () => {
      const result = entities.validate(UserSchema.$id, {
        'email': 'a@b.com',
        'name': 'Alice'
      });

      assert.ok(result instanceof ValidationErrors, 'result is ValidationErrors');
    });

    void it('returns ok=true for valid data', () => {
      const result = entities.validate(UserSchema.$id, {
        'email': 'a@b.com',
        'name': 'Alice'
      });

      assert.equal(result.ok, true);
      assert.equal(result.length, 0);
    });

    void it('returns ok=false with items for invalid data', () => {
      const result = entities.validate(UserSchema.$id, { 'name': 'Alice' });

      assert.equal(result.ok, false);
      assert.ok(result.length > 0);
      assert.ok(typeof result.items[0].path === 'string');
      assert.ok(typeof result.items[0].keyword === 'string');
      assert.ok(typeof result.items[0].message === 'string');
    });

    void it('is iterable over ValidationErrorType items', () => {
      const result = entities.validate(UserSchema.$id, { 'name': 'Alice' });
      const collected = [];

      for (const err of result) {
        collected.push(err);
      }

      assert.equal(collected.length, result.length);
      assert.ok(typeof collected[0].keyword === 'string');
    });
  });

  // ---------------------------------------------------------------------------
  // Item 2: ValidationErrors trimmed API — removed methods
  // ---------------------------------------------------------------------------

  void describe('Item 2: ValidationErrors trimmed API', () => {
    const errs = new ValidationErrors([
      {
        'keyword': 'type',
        'message': 'must be string',
        'params': {},
        'path': '/name'
      },
      {
        'keyword': 'required',
        'message': "must have required property 'email'",
        'params': { 'missingProperty': 'email' },
        'path': ''
      }
    ]);

    void it('messages() is not a function', () => {
      assert.equal(typeof (errs as unknown as Record<string, unknown>).messages, 'undefined');
    });

    void it('format() is not a function', () => {
      assert.equal(typeof (errs as unknown as Record<string, unknown>).format, 'undefined');
    });

    void it('flatten() is not a function on ValidationErrors', () => {
    // Note: InstantiationError/BaseError still have flatten() — this tests ValidationErrors only
      assert.equal(typeof (errs as unknown as Record<string, unknown>).flatten, 'undefined');
    });

    void it('aggregate() and report() still exist', () => {
      assert.equal(typeof errs.aggregate, 'function');
      assert.equal(typeof errs.report, 'function');
    });

    void it('items + map recipe replaces messages()', () => {
      const messages = errs.items.map((err) => {
        return `${err.path || 'root'}: ${err.message}`;
      });

      assert.ok(messages.some((msg) => {
        return msg.includes('/name');
      }));
      assert.ok(messages.some((msg) => {
        return msg.includes('root');
      }));
    });

    void it('aggregate() paths are in access form (not JSON Pointer)', () => {
      const rollup = errs.aggregate();

      // /name → 'name' (access form, no leading /)
      assert.ok(!rollup.paths.some((path) => {
        return path.startsWith('/');
      }), 'aggregate paths should not start with /');
      assert.ok(rollup.paths.some((path) => {
        return path === 'name';
      }), 'aggregate paths should include "name"');
    });

    void it('items still carry JSON Pointer paths', () => {
      assert.ok(errs.items.some((err) => {
        return err.path === '/name';
      }), 'items paths should be JSON Pointer format');
    });
  });

  // ---------------------------------------------------------------------------
  // Item 3 (Resolver.merge): per-call option merging
  // ---------------------------------------------------------------------------

  void describe('Item 3: Resolver.merge', () => {
    void it('returns base when override is undefined', () => {
      const base = {
        'enableDefaults': true,
        'enableValidation': false
      };
      const noOverride: Partial<typeof base> | undefined = undefined;
      const result = Resolver.merge(base, noOverride);

      assert.equal(result, base);
    });

    void it('merges defined override keys over base', () => {
      const base = {
        'enableDefaults': true,
        'enableValidation': false
      };
      const result = Resolver.merge(base, { 'enableDefaults': false });

      assert.equal(result.enableDefaults, false);
      assert.equal(result.enableValidation, false);
    });

    void it('does not apply undefined override keys', () => {
      const base: { 'enableDefaults': boolean | undefined;
        'enableValidation': boolean | undefined } = {
        'enableDefaults': true,
        'enableValidation': false
      };
      const result = Resolver.merge(base, { 'enableDefaults': undefined });

      assert.equal(result.enableDefaults, true, 'undefined key does not override base');
    });

    void it('returns a new object (does not mutate base)', () => {
      const base = { 'enableDefaults': true };
      const result = Resolver.merge(base, { 'enableDefaults': false });

      assert.equal(base.enableDefaults, true, 'base not mutated');
      assert.equal(result.enableDefaults, false);
    });
  });

  // ---------------------------------------------------------------------------
  // Item 10 (Path.toAccess): JSON Pointer → access form
  // ---------------------------------------------------------------------------

  void describe('Path.toAccess', () => {
    void it('converts simple string segment', () => {
      assert.equal(Path.toAccess('/name'), 'name');
    });

    void it('converts numeric segment to bracket notation', () => {
      assert.equal(Path.toAccess('/items/0'), 'items[0]');
    });

    void it('converts nested path', () => {
      assert.equal(Path.toAccess('/items/0/quantity'), 'items[0].quantity');
    });

    void it('returns empty string for root pointer', () => {
      assert.equal(Path.toAccess(''), '');
      assert.equal(Path.toAccess('/'), '');
    });

    void it('handles keys requiring bracket notation', () => {
      assert.equal(Path.toAccess('/weird-key'), '["weird-key"]');
    });

    void it('decodes JSON Pointer escapes', () => {
      assert.equal(Path.toAccess('/a~1b'), '["a/b"]');
      assert.equal(Path.toAccess('/a~0b'), '["a~b"]');
    });
  });
}

// ===========================================================================
// Source: staticCounterparts.test.ts
// ===========================================================================
{
  const PersonSchema = {
    '$id': 'https://static-counterparts.test/Person',
    'properties': {
      'age': {
        'minimum': 0,
        'type': 'integer'
      },
      'name': { 'type': 'string' }
    },
    'required': [
      'age',
      'name'
    ],
    'type': 'object'
  } as const;

  void describe('JsonTology.validate (static)', () => {
    void it('returns empty ValidationErrors for valid data', () => {
      const result = JsonTology.validate(PersonSchema, {
        'age': 30,
        'name': 'Alice'
      });

      assert.ok(result instanceof ValidationErrors, 'result is ValidationErrors');
      assert.ok(result.ok, 'no errors for valid data');
      assert.equal(result.length, 0);
    });

    void it('returns non-empty ValidationErrors for invalid data', () => {
      const result = JsonTology.validate(PersonSchema, { 'age': 'not-a-number' });

      assert.ok(result instanceof ValidationErrors, 'result is ValidationErrors');
      assert.equal(result.ok, false, 'errors present for invalid data');
      assert.ok(result.length > 0);
    });

    void it('does not mutate the caller-passed schema object', () => {
      const schemaCopy = structuredClone(PersonSchema);
      const keysBefore = JSON.stringify(schemaCopy);

      JsonTology.validate(schemaCopy, {
        'age': 25,
        'name': 'Bob'
      });

      assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
    });

    void it('return shape matches instance method return shape', () => {
      // enableStrictGraph: false — PersonSchema has inline minimum constraint
      const jt = JsonTology.create({
        'baseIRI': 'https://static-counterparts.test',
        'enableStrictGraph': false,
        'schemas': [PersonSchema] as const
      });
      const instanceResult = jt.validate(PersonSchema, {
        'age': 30,
        'name': 'Alice'
      });
      const staticResult = JsonTology.validate(PersonSchema, {
        'age': 30,
        'name': 'Alice'
      });

      assert.ok(instanceResult instanceof ValidationErrors);
      assert.ok(staticResult instanceof ValidationErrors);
      assert.equal(instanceResult.ok, staticResult.ok, 'both have same ok status');
      assert.equal(instanceResult.length, staticResult.length, 'both have same error count');
    });
  });

  void describe('JsonTology.toShacl (static)', () => {
    void it('returns an OntologyBuilder for a single schema', () => {
      const result = JsonTology.toShacl([PersonSchema]);

      assert.ok(result instanceof OntologyBuilder, 'result is OntologyBuilder');
    });

    void it('produced SHACL contains NodeShape for the schema', () => {
      const result = JsonTology.toShacl([PersonSchema]);
      const jsonLd = result.jsonLd();
      const serialized = JSON.stringify(jsonLd);

      assert.ok(
        serialized.includes('NodeShape') || serialized.includes('shacl'),
        'SHACL output references NodeShape or shacl vocabulary'
      );
    });

    void it('does not mutate the caller-passed schema object', () => {
      const schemaCopy = structuredClone(PersonSchema);
      const keysBefore = JSON.stringify(schemaCopy);

      JsonTology.toShacl([schemaCopy]);

      assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
    });

    void it('return shape matches instance method return shape', () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://static-counterparts.test',
        'enableStrictGraph': false,
        'schemas': [PersonSchema] as const
      });
      const instanceResult = jt.toShacl();
      const staticResult = JsonTology.toShacl([PersonSchema]);

      assert.ok(instanceResult instanceof OntologyBuilder);
      assert.ok(staticResult instanceof OntologyBuilder);
    });
  });

  void describe('JsonTology.toTbox (static)', () => {
    void it('returns an OntologyBuilder for a single schema', () => {
      const result = JsonTology.toTbox([PersonSchema]);

      assert.ok(result instanceof OntologyBuilder, 'result is OntologyBuilder');
    });

    void it('produced TBox contains OWL class or property declaration', () => {
      const result = JsonTology.toTbox([PersonSchema]);
      const jsonLd = result.jsonLd();
      const serialized = JSON.stringify(jsonLd);

      assert.ok(
        serialized.includes('Class') || serialized.includes('owl') || serialized.includes('DatatypeProperty'),
        'TBox output references OWL class or property vocabulary'
      );
    });

    void it('does not mutate the caller-passed schema object', () => {
      const schemaCopy = structuredClone(PersonSchema);
      const keysBefore = JSON.stringify(schemaCopy);

      JsonTology.toTbox([schemaCopy]);

      assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
    });

    void it('return shape matches instance method return shape', () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://static-counterparts.test',
        'enableStrictGraph': false,
        'schemas': [PersonSchema] as const
      });
      const instanceResult = jt.toTbox();
      const staticResult = JsonTology.toTbox([PersonSchema]);

      assert.ok(instanceResult instanceof OntologyBuilder);
      assert.ok(staticResult instanceof OntologyBuilder);
    });
  });

  void describe('JsonTology.toSchema (static)', () => {
    void it('returns a record for a registered schema', () => {
      const result = JsonTology.toSchema(PersonSchema);

      assert.ok(result !== undefined, 'result is defined');
    });

    void it('reconstructed schema contains type property', () => {
      const result = JsonTology.toSchema(PersonSchema);

      assert.ok(result !== undefined);
      assert.equal(result.type, 'object', 'reconstructed schema has type: object');
    });

    void it('does not mutate the caller-passed schema object', () => {
      const schemaCopy = structuredClone(PersonSchema);
      const keysBefore = JSON.stringify(schemaCopy);

      JsonTology.toSchema(schemaCopy);

      assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
    });

    void it('return shape matches instance method return shape', () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://static-counterparts.test',
        'enableStrictGraph': false,
        'schemas': [PersonSchema] as const
      });
      const instanceResult = jt.toSchema(PersonSchema);
      const staticResult = JsonTology.toSchema(PersonSchema);

      assert.equal(typeof instanceResult, typeof staticResult, 'both have same type');
    });
  });
}

