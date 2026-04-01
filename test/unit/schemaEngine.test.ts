import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { GraphEngine } from '../../src/modules/graph/graphEngine.js';

void describe('Graph engine advanced keywords', () => {
  void describe('propertyNames with pattern and length constraints', () => {
    const scenarios: Array<{
      'data': Record<string, unknown>;
      'expected': boolean;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'data': { 'good': 1 },
        'expected': true,
        'name': 'lowercase property name matches pattern',
        'schema': {
          '$id': 'urn:test:pn-1',
          'propertyNames': {
            'pattern': '^[a-z]+$',
            'type': 'string'
          },
          'type': 'object'
        }
      },
      {
        'data': { 'Bad-Key': 1 },
        'expected': false,
        'name': 'mixed-case property name fails pattern',
        'schema': {
          '$id': 'urn:test:pn-2',
          'propertyNames': {
            'pattern': '^[a-z]+$',
            'type': 'string'
          },
          'type': 'object'
        }
      },
      {
        'data': {
          'barbaz': 2,
          'foo': 1
        },
        'expected': true,
        'name': 'property names within length bounds pass',
        'schema': {
          '$id': 'urn:test:pn-3',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        }
      },
      {
        'data': { 'ab': 1 },
        'expected': false,
        'name': 'property name below minLength fails',
        'schema': {
          '$id': 'urn:test:pn-4',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        }
      },
      {
        'data': { 'thisnameiswaytoolong': 1 },
        'expected': false,
        'name': 'property name above maxLength fails',
        'schema': {
          '$id': 'urn:test:pn-5',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        }
      },
      {
        'data': {},
        'expected': true,
        'name': 'empty object passes propertyNames length check',
        'schema': {
          '$id': 'urn:test:pn-6',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        }
      }
    ];

    const registry = new SchemaRegistry();

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schema': sch
    } of scenarios) {
      void it(n, () => {
        registry.register(sch);
        assert.equal(registry.is(sch.$id as string, d), exp);
      });
    }
  });

  void describe('dependentSchemas with $ref', () => {
    const scenarios: Array<{
      'data': Record<string, unknown>;
      'expected': boolean;
      'name': string;
    }> = [
      {
        'data': {
          'kind': 'business',
          'taxId': '123'
        },
        'expected': true,
        'name': 'dependent schema satisfied passes'
      },
      {
        'data': { 'kind': 'business' },
        'expected': false,
        'name': 'dependent schema unsatisfied fails'
      }
    ];

    const registry = new SchemaRegistry();
    const kindDepSchema = {
      '$id': 'urn:test:dependent-schemas-kind-dep',
      'properties': {
        'kind': { 'const': 'business' },
        'taxId': { 'type': 'string' }
      },
      'required': ['taxId'],
      'type': 'object'
    } as const;
    const schema = {
      '$id': 'urn:test:dependent-schemas',
      'dependentSchemas': { 'kind': { '$ref': 'urn:test:dependent-schemas-kind-dep' } },
      'type': 'object'
    } as const;

    registry.register([
      kindDepSchema,
      schema
    ]);

    for (const {
      'data': d, 'expected': exp, 'name': n
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(schema.$id, d), exp);
      });
    }
  });

  void describe('prefixItems with items:false tail constraint', () => {
    const scenarios: Array<{
      'data': unknown[];
      'expected': boolean;
      'name': string;
    }> = [
      {
        'data': [
          'x',
          1
        ],
        'expected': true,
        'name': 'exact prefix items pass'
      },
      {
        'data': [
          'x',
          1,
          true
        ],
        'expected': false,
        'name': 'extra tail item fails with items:false'
      }
    ];

    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:prefix-items',
      'items': false,
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    } as const;

    registry.register(schema);

    for (const {
      'data': d, 'expected': exp, 'name': n
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(schema.$id, d), exp);
      });
    }
  });

  void describe('contains with minContains/maxContains', () => {
    const scenarios: Array<{
      'data': unknown[];
      'expected': boolean;
      'name': string;
      'schemaId': string;
    }> = [
      {
        'data': [
          1,
          2,
          'x'
        ],
        'expected': true,
        'name': 'two numbers satisfy minContains:2',
        'schemaId': 'urn:test:contains-min-max'
      },
      {
        'data': [
          1,
          'x'
        ],
        'expected': false,
        'name': 'one number fails minContains:2',
        'schemaId': 'urn:test:contains-min-max'
      },
      {
        'data': [
          1,
          2,
          3,
          4
        ],
        'expected': false,
        'name': 'four numbers exceeds maxContains:3',
        'schemaId': 'urn:test:contains-min-max'
      },
      {
        'data': [],
        'expected': true,
        'name': 'empty array passes with minContains:0',
        'schemaId': 'urn:test:contains-min-zero'
      },
      {
        'data': [
          1,
          2,
          3
        ],
        'expected': true,
        'name': 'non-matching items pass with minContains:0',
        'schemaId': 'urn:test:contains-min-zero'
      }
    ];

    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:test:contains-min-max',
      'contains': { 'type': 'number' },
      'maxContains': 3,
      'minContains': 2,
      'type': 'array'
    });
    registry.register({
      '$id': 'urn:test:contains-min-zero',
      'contains': { 'type': 'string' },
      'minContains': 0,
      'type': 'array'
    });

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schemaId': sid
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(sid, d), exp);
      });
    }
  });

  void describe('uniqueItems with semantic object equality', () => {
    const scenarios: Array<{
      'data': unknown[];
      'expected': boolean;
      'name': string;
    }> = [
      {
        'data': [
          1,
          2,
          3
        ],
        'expected': true,
        'name': 'unique primitives pass'
      },
      {
        'data': [
          1,
          2,
          1
        ],
        'expected': false,
        'name': 'duplicate primitives fail'
      },
      {
        'data': [
          {
            'a': 1,
            'b': 2
          },
          {
            'a': 1,
            'b': 2
          }
        ],
        'expected': false,
        'name': 'duplicate objects fail via deep equality'
      }
    ];

    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unique-items',
      'type': 'array',
      'uniqueItems': true
    } as const;

    registry.register(schema);

    for (const {
      'data': d, 'expected': exp, 'name': n
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(schema.$id, d), exp);
      });
    }
  });

  void describe('if/then/else with $ref and unevaluatedProperties interaction', () => {
    const scenarios: Array<{
      'data': Record<string, unknown>;
      'expected': boolean;
      'name': string;
      'schemaId': string;
    }> = [
      {
        'data': {
          'kind': 'business',
          'taxId': '123'
        },
        'expected': true,
        'name': '$ref if/then: matching if + then satisfied passes',
        'schemaId': 'urn:test:if-then-else'
      },
      {
        'data': { 'kind': 'business' },
        'expected': false,
        'name': '$ref if/then: matching if + then unsatisfied fails',
        'schemaId': 'urn:test:if-then-else'
      },
      {
        'data': {
          'kind': 'person',
          'ssn': '999'
        },
        'expected': true,
        'name': '$ref if/else: non-matching if + else satisfied passes',
        'schemaId': 'urn:test:if-then-else'
      },
      {
        'data': { 'kind': 'person' },
        'expected': false,
        'name': '$ref if/else: non-matching if + else unsatisfied fails',
        'schemaId': 'urn:test:if-then-else'
      },
      {
        'data': {
          'level': 5,
          'type': 'admin'
        },
        'expected': true,
        'name': 'unevaluated + if/then: admin with level passes',
        'schemaId': 'urn:test:if-then-unevaluated'
      },
      {
        'data': { 'type': 'user' },
        'expected': true,
        'name': 'unevaluated + if/else: non-admin passes',
        'schemaId': 'urn:test:if-then-unevaluated'
      },
      {
        'data': {
          'extra': 1,
          'level': 5,
          'type': 'admin'
        },
        'expected': false,
        'name': 'unevaluated + if/then: extra property fails',
        'schemaId': 'urn:test:if-then-unevaluated'
      }
    ];

    const registry = new SchemaRegistry();

    const ifSchema = {
      '$id': 'urn:test:ite-if',
      'properties': { 'kind': { 'const': 'business' } },
      'type': 'object'
    } as const;
    const thenSchema = {
      '$id': 'urn:test:ite-then',
      'properties': { 'taxId': { 'type': 'string' } },
      'required': ['taxId'],
      'type': 'object'
    } as const;
    const elseSchema = {
      '$id': 'urn:test:ite-else',
      'properties': { 'ssn': { 'type': 'string' } },
      'required': ['ssn'],
      'type': 'object'
    } as const;
    const schema = {
      '$id': 'urn:test:if-then-else',
      'else': { '$ref': 'urn:test:ite-else' },
      'if': { '$ref': 'urn:test:ite-if' },
      // eslint-disable-next-line unicorn/no-thenable
      'then': { '$ref': 'urn:test:ite-then' },
      'type': 'object'
    } as const;

    const unevalSchema = {
      '$id': 'urn:test:if-then-unevaluated',
      'if': { 'properties': { 'type': { 'const': 'admin' } } },
      'properties': { 'type': { 'type': 'string' } },
      'required': ['type'],
      // eslint-disable-next-line unicorn/no-thenable
      'then': {
        'properties': { 'level': { 'type': 'number' } },
        'required': ['level']
      },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register([
      ifSchema,
      thenSchema,
      elseSchema,
      schema
    ]);
    registry.register(unevalSchema);

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schemaId': sid
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(sid, d), exp);
      });
    }
  });

  void describe('extended format assertions (string and numeric)', () => {
    const scenarios: Array<{
      'data': unknown;
      'expected': boolean;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'data': 'P3DT4H',
        'expected': true,
        'name': 'valid ISO 8601 duration passes',
        'schema': {
          '$id': 'urn:test:fmt-dur',
          'format': 'duration',
          'type': 'string'
        }
      },
      {
        'data': 'three days',
        'expected': false,
        'name': 'invalid duration string fails',
        'schema': {
          '$id': 'urn:test:fmt-dur2',
          'format': 'duration',
          'type': 'string'
        }
      },
      {
        'data': '2001:db8::1',
        'expected': true,
        'name': 'valid IPv6 address passes',
        'schema': {
          '$id': 'urn:test:fmt-ipv6',
          'format': 'ipv6',
          'type': 'string'
        }
      },
      {
        'data': '999.1.1.1',
        'expected': false,
        'name': 'IPv4 address fails ipv6 format',
        'schema': {
          '$id': 'urn:test:fmt-ipv6-2',
          'format': 'ipv6',
          'type': 'string'
        }
      },
      {
        'data': '/users/123?draft=true',
        'expected': true,
        'name': 'valid uri-reference passes',
        'schema': {
          '$id': 'urn:test:fmt-uriref',
          'format': 'uri-reference',
          'type': 'string'
        }
      },
      {
        'data': '/users/{id}',
        'expected': true,
        'name': 'valid uri-template passes',
        'schema': {
          '$id': 'urn:test:fmt-uritpl',
          'format': 'uri-template',
          'type': 'string'
        }
      },
      {
        'data': '/users/{id',
        'expected': false,
        'name': 'unclosed brace fails uri-template',
        'schema': {
          '$id': 'urn:test:fmt-uritpl2',
          'format': 'uri-template',
          'type': 'string'
        }
      },
      {
        'data': '/items/0/name',
        'expected': true,
        'name': 'valid json-pointer passes',
        'schema': {
          '$id': 'urn:test:fmt-jptr',
          'format': 'json-pointer',
          'type': 'string'
        }
      },
      {
        'data': 'items/0/name',
        'expected': false,
        'name': 'missing leading slash fails json-pointer',
        'schema': {
          '$id': 'urn:test:fmt-jptr2',
          'format': 'json-pointer',
          'type': 'string'
        }
      },
      {
        'data': '^[a-z]+$',
        'expected': true,
        'name': 'valid regex passes',
        'schema': {
          '$id': 'urn:test:fmt-regex',
          'format': 'regex',
          'type': 'string'
        }
      },
      {
        'data': '[',
        'expected': false,
        'name': 'invalid regex fails',
        'schema': {
          '$id': 'urn:test:fmt-regex2',
          'format': 'regex',
          'type': 'string'
        }
      },
      {
        'data': 'SGVsbG8=',
        'expected': true,
        'name': 'valid base64 byte format passes',
        'schema': {
          '$id': 'urn:test:fmt-byte',
          'format': 'byte',
          'type': 'string'
        }
      },
      {
        'data': '0aff',
        'expected': true,
        'name': 'valid hex binary format passes',
        'schema': {
          '$id': 'urn:test:fmt-bin',
          'format': 'binary',
          'type': 'string'
        }
      },
      {
        'data': 'xyz',
        'expected': false,
        'name': 'invalid hex binary format fails',
        'schema': {
          '$id': 'urn:test:fmt-bin2',
          'format': 'binary',
          'type': 'string'
        }
      },
      {
        'data': 2_147_483_647,
        'expected': true,
        'name': 'max int32 value passes',
        'schema': {
          '$id': 'urn:test:fmt-i32',
          'format': 'int32',
          'type': 'integer'
        }
      },
      {
        'data': 2_147_483_648,
        'expected': false,
        'name': 'overflow int32 value fails',
        'schema': {
          '$id': 'urn:test:fmt-i32-2',
          'format': 'int32',
          'type': 'integer'
        }
      },
      {
        'data': Number.MAX_SAFE_INTEGER,
        'expected': true,
        'name': 'MAX_SAFE_INTEGER passes int64',
        'schema': {
          '$id': 'urn:test:fmt-i64',
          'format': 'int64',
          'type': 'integer'
        }
      },
      {
        'data': Number.MAX_SAFE_INTEGER + 1,
        'expected': false,
        'name': 'beyond MAX_SAFE_INTEGER fails int64',
        'schema': {
          '$id': 'urn:test:fmt-i64-2',
          'format': 'int64',
          'type': 'integer'
        }
      },
      {
        'data': Math.fround(1.5),
        'expected': true,
        'name': 'float-representable value passes float format',
        'schema': {
          '$id': 'urn:test:fmt-f',
          'format': 'float',
          'type': 'number'
        }
      },
      {
        'data': 1e40,
        'expected': false,
        'name': 'value exceeding float range fails',
        'schema': {
          '$id': 'urn:test:fmt-f2',
          'format': 'float',
          'type': 'number'
        }
      }
    ];

    const registry = new SchemaRegistry();

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schema': sch
    } of scenarios) {
      void it(n, () => {
        registry.register(sch);
        assert.equal(registry.is(sch.$id as string, d), exp);
      });
    }
  });

  void describe('dialect and vocabulary rejection', () => {
    const scenarios: Array<{
      'name': string;
      'pattern': RegExp;
      'schema': Record<string, unknown>;
    }> = [
      {
        'name': 'rejects unsupported dialect (draft-07)',
        'pattern': /Unsupported JSON Schema dialect/u,
        'schema': {
          '$schema': 'http://json-schema.org/draft-07/schema#',
          'type': 'string'
        }
      },
      {
        'name': 'rejects unknown required vocabulary',
        'pattern': /Unsupported required JSON Schema vocabulary/u,
        'schema': {
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$vocabulary': { 'https://example.io/vocab/custom-required': true },
          'type': 'string'
        }
      }
    ];

    for (const {
      'name': n, 'pattern': pat, 'schema': sch
    } of scenarios) {
      void it(n, () => {
        assert.throws(() => {
          new GraphEngine(sch);
        }, pat);
      });
    }
  });

  void describe('format annotation vs assertion and content annotations per 2020-12 vocabulary', () => {
    const scenarios: Array<{
      'data': unknown;
      'expected': boolean;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'data': 'not-an-email',
        'expected': true,
        'name': 'format as annotation-only allows invalid format',
        'schema': {
          '$id': 'urn:test:format-annotation',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'format': 'email',
          'type': 'string'
        }
      },
      {
        'data': 'alice@example.io',
        'expected': true,
        'name': 'format-assertion vocabulary: valid email passes',
        'schema': {
          '$id': 'urn:test:format-assertion-vocab',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$vocabulary': {
            'https://json-schema.org/draft/2020-12/vocab/applicator': true,
            'https://json-schema.org/draft/2020-12/vocab/content': true,
            'https://json-schema.org/draft/2020-12/vocab/core': true,
            'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
            'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
            'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
            'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
            'https://json-schema.org/draft/2020-12/vocab/validation': true
          },
          'format': 'email',
          'type': 'string'
        }
      },
      {
        'data': 'not-an-email',
        'expected': false,
        'name': 'format-assertion vocabulary: invalid email fails',
        'schema': {
          '$id': 'urn:test:format-assertion-vocab-2',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$vocabulary': {
            'https://json-schema.org/draft/2020-12/vocab/applicator': true,
            'https://json-schema.org/draft/2020-12/vocab/content': true,
            'https://json-schema.org/draft/2020-12/vocab/core': true,
            'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
            'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
            'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
            'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
            'https://json-schema.org/draft/2020-12/vocab/validation': true
          },
          'format': 'email',
          'type': 'string'
        }
      },
      {
        'data': 'definitely not base64 or json',
        'expected': true,
        'name': 'content keywords are annotation-only, not assertions',
        'schema': {
          '$id': 'urn:test:content-annotations',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'contentEncoding': 'base64',
          'contentMediaType': 'application/json',
          'contentSchema': { '$ref': 'urn:test:content-inner' },
          'type': 'string'
        }
      }
    ];

    const registry = new SchemaRegistry();

    // Pre-register the content-inner schema needed by the content annotation test
    registry.register({
      '$id': 'urn:test:content-inner',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    });

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schema': sch
    } of scenarios) {
      void it(n, () => {
        registry.register(sch);
        assert.equal(registry.is(sch.$id as string, d), exp);
      });
    }
  });

  void describe('unevaluatedProperties/Items with allOf, anyOf, and conditional tracking', () => {
    const scenarios: Array<{
      'data': unknown;
      'expected': boolean;
      'name': string;
      'schemaId': string;
    }> = [
      {
        'data': { 'name': 'Alice' },
        'expected': true,
        'name': 'unevaluatedProperties: known property passes',
        'schemaId': 'urn:test:unevaluated-props'
      },
      {
        'data': {
          'extra': true,
          'name': 'Alice'
        },
        'expected': false,
        'name': 'unevaluatedProperties: extra property fails',
        'schemaId': 'urn:test:unevaluated-props'
      },
      {
        'data': [1],
        'expected': true,
        'name': 'unevaluatedItems: matching contains item passes',
        'schemaId': 'urn:test:unevaluated-items'
      },
      {
        'data': [
          1,
          'x'
        ],
        'expected': false,
        'name': 'unevaluatedItems: non-matching extra item fails',
        'schemaId': 'urn:test:unevaluated-items'
      },
      {
        'data': { 'name': 'Alice' },
        'expected': true,
        'name': 'allOf tracking: property from allOf branch passes',
        'schemaId': 'urn:test:unevaluated-allof'
      },
      {
        'data': {
          'extra': 1,
          'name': 'Alice'
        },
        'expected': false,
        'name': 'allOf tracking: extra property outside allOf fails',
        'schemaId': 'urn:test:unevaluated-allof'
      },
      {
        'data': { 'a': 'hello' },
        'expected': true,
        'name': 'anyOf tracking: first branch match passes',
        'schemaId': 'urn:test:unevaluated-anyof'
      },
      {
        'data': { 'b': 42 },
        'expected': true,
        'name': 'anyOf tracking: second branch match passes',
        'schemaId': 'urn:test:unevaluated-anyof'
      },
      {
        'data': {
          'a': 'hello',
          'extra': 1
        },
        'expected': false,
        'name': 'anyOf tracking: extra property fails',
        'schemaId': 'urn:test:unevaluated-anyof'
      },
      {
        'data': {
          'a': 'hi',
          'b': 1
        },
        'expected': true,
        'name': 'anyOf multi-branch: both branches matched passes',
        'schemaId': 'urn:test:unevaluated-anyof-multi'
      },
      {
        'data': {
          'a': 'hi',
          'b': 1,
          'c': true
        },
        'expected': false,
        'name': 'anyOf multi-branch: extra property fails',
        'schemaId': 'urn:test:unevaluated-anyof-multi'
      },
      {
        'data': ['hello'],
        'expected': true,
        'name': 'allOf items tracking: prefixItem passes',
        'schemaId': 'urn:test:unevaluated-items-allof'
      },
      {
        'data': [
          'hello',
          42
        ],
        'expected': false,
        'name': 'allOf items tracking: extra item fails',
        'schemaId': 'urn:test:unevaluated-items-allof'
      },
      {
        'data': {
          'aValue': 1,
          'kind': 'a'
        },
        'expected': true,
        'name': 'conditional tracking: if-then branch passes',
        'schemaId': 'urn:test:unevaluated-conditional'
      },
      {
        'data': {
          'bValue': 'x',
          'kind': 'b'
        },
        'expected': true,
        'name': 'conditional tracking: if-else branch passes',
        'schemaId': 'urn:test:unevaluated-conditional'
      },
      {
        'data': {
          'aValue': 1,
          'extra': true,
          'kind': 'a'
        },
        'expected': false,
        'name': 'conditional tracking: extra property on if-then fails',
        'schemaId': 'urn:test:unevaluated-conditional'
      },
      {
        'data': {},
        'expected': true,
        'name': 'empty object for object schema with unevaluatedProperties passes',
        'schemaId': 'urn:test:unevaluated-props'
      }
    ];

    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:test:unevaluated-props',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object',
      'unevaluatedProperties': false
    });
    registry.register({
      '$id': 'urn:test:unevaluated-items',
      'contains': { 'type': 'number' },
      'type': 'array',
      'unevaluatedItems': false
    });
    registry.register({
      '$id': 'urn:test:unevaluated-allof',
      'allOf': [{
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name']
      }],
      'type': 'object',
      'unevaluatedProperties': false
    });
    registry.register({
      '$id': 'urn:test:unevaluated-anyof',
      'anyOf': [
        {
          'properties': { 'a': { 'type': 'string' } },
          'required': ['a']
        },
        {
          'properties': { 'b': { 'type': 'number' } },
          'required': ['b']
        }
      ],
      'type': 'object',
      'unevaluatedProperties': false
    });
    registry.register({
      '$id': 'urn:test:unevaluated-anyof-multi',
      'anyOf': [
        { 'properties': { 'a': { 'type': 'string' } } },
        { 'properties': { 'b': { 'type': 'number' } } }
      ],
      'type': 'object',
      'unevaluatedProperties': false
    });
    registry.register({
      '$id': 'urn:test:unevaluated-items-allof',
      'allOf': [{ 'prefixItems': [{ 'type': 'string' }] }],
      'type': 'array',
      'unevaluatedItems': false
    });
    registry.register({
      '$id': 'urn:test:unevaluated-conditional',
      'else': { 'properties': { 'bValue': { 'type': 'string' } } },
      'if': { 'properties': { 'kind': { 'const': 'a' } } },
      'properties': { 'kind': { 'type': 'string' } },
      'required': ['kind'],
      // eslint-disable-next-line unicorn/no-thenable
      'then': { 'properties': { 'aValue': { 'type': 'number' } } },
      'type': 'object',
      'unevaluatedProperties': false
    });

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schemaId': sid
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(sid, d), exp);
      });
    }
  });

  void describe('local/external anchor and dynamic refs with scope override', () => {
    const scenarios: Array<{
      'data': unknown;
      'name': string;
      'schemaId': string;
      'valid': boolean;
    }> = [
      {
        'data': { 'address': { 'street': '1 Main' } },
        'name': 'local anchor: valid address passes',
        'schemaId': 'urn:test:local-anchor-refs',
        'valid': true
      },
      {
        'data': { 'address': {} },
        'name': 'local anchor: missing required street fails',
        'schemaId': 'urn:test:local-anchor-refs',
        'valid': false
      },
      {
        'data': { 'address': { 'street': '1 Main' } },
        'name': 'external anchor: valid address passes',
        'schemaId': 'https://example.io/UserWithAnchoredAddress',
        'valid': true
      },
      {
        'data': { 'address': {} },
        'name': 'external anchor: missing required street fails',
        'schemaId': 'https://example.io/UserWithAnchoredAddress',
        'valid': false
      },
      {
        'data': {
          'child': { 'value': 2 },
          'value': 1
        },
        'name': 'local dynamic ref: recursive child passes',
        'schemaId': 'urn:test:local-dynamic-refs',
        'valid': true
      },
      {
        'data': {
          'child': {},
          'value': 1
        },
        'name': 'local dynamic ref: child missing required fails',
        'schemaId': 'urn:test:local-dynamic-refs',
        'valid': false
      },
      {
        'data': { 'address': { 'street': '1 Main' } },
        'name': 'external dynamic ref: valid address passes',
        'schemaId': 'https://example.io/dynamic-user',
        'valid': true
      },
      {
        'data': { 'address': {} },
        'name': 'external dynamic ref: missing required street fails',
        'schemaId': 'https://example.io/dynamic-user',
        'valid': false
      }
    ];

    const registry = new SchemaRegistry();

    // Local anchor
    registry.register({
      '$defs': {
        'named': {
          '$anchor': 'namedAddress',
          'properties': { 'street': { 'type': 'string' } },
          'required': ['street'],
          'type': 'object'
        }
      },
      '$id': 'urn:test:local-anchor-refs',
      'properties': { 'address': { '$ref': '#namedAddress' } },
      'required': ['address'],
      'type': 'object'
    });

    // External anchor
    registry.register([
      {
        '$anchor': 'sharedAddress',
        '$id': 'https://example.io/AddressAnchored',
        'properties': { 'street': { 'type': 'string' } },
        'required': ['street'],
        'type': 'object'
      },
      {
        '$id': 'https://example.io/UserWithAnchoredAddress',
        'properties': { 'address': { '$ref': 'https://example.io/AddressAnchored#sharedAddress' } },
        'required': ['address'],
        'type': 'object'
      }
    ]);

    // Local dynamic ref
    registry.register({
      '$dynamicAnchor': 'node',
      '$id': 'urn:test:local-dynamic-refs',
      'properties': {
        'child': { '$dynamicRef': '#node' },
        'value': { 'type': 'number' }
      },
      'required': ['value'],
      'type': 'object'
    });

    // External dynamic ref
    registry.register([
      {
        '$dynamicAnchor': 'addressNode',
        '$id': 'https://example.io/dynamic-address',
        'properties': { 'street': { 'type': 'string' } },
        'required': ['street'],
        'type': 'object'
      },
      {
        '$id': 'https://example.io/dynamic-user',
        'properties': { 'address': { '$dynamicRef': 'https://example.io/dynamic-address#addressNode' } },
        'required': ['address'],
        'type': 'object'
      }
    ]);

    for (const {
      'data': d, 'name': n, 'schemaId': sid, 'valid': v
    } of scenarios) {
      void it(n, () => {
        const errors = registry.validate(sid, d);

        if (v) {
          assert.deepEqual(errors, []);
        } else {
          assert.ok(errors.length > 0);
        }
      });
    }

    void describe('dynamic scope override (strict tree)', () => {
      const treeScenarios: Array<{
        'data': unknown;
        'name': string;
        'valid': boolean;
      }> = [
        {
          'data': {
            'children': [{
              'tag': 'child',
              'value': 2
            }],
            'tag': 'root',
            'value': 1
          },
          'name': 'strict tree with tagged children passes',
          'valid': true
        },
        {
          'data': {
            'children': [{ 'value': 2 }],
            'tag': 'root',
            'value': 1
          },
          'name': 'strict tree with untagged child fails',
          'valid': false
        }
      ];

      const innerRegistry = new SchemaRegistry();

      innerRegistry.register([
        {
          '$dynamicAnchor': 'node',
          '$id': 'https://example.io/tree',
          'properties': {
            'children': {
              'items': { '$dynamicRef': '#node' },
              'type': 'array'
            },
            'value': { 'type': 'number' }
          },
          'required': ['value'],
          'type': 'object'
        },
        {
          '$id': 'https://example.io/tag-mixin',
          'properties': { 'tag': { 'type': 'string' } },
          'required': ['tag'],
          'type': 'object'
        },
        {
          '$dynamicAnchor': 'node',
          '$id': 'https://example.io/strict-tree',
          'allOf': [
            { '$ref': 'https://example.io/tree' },
            { '$ref': 'https://example.io/tag-mixin' }
          ],
          'type': 'object'
        }
      ]);

      for (const {
        'data': d, 'name': n, 'valid': v
      } of treeScenarios) {
        void it(n, () => {
          const errors = innerRegistry.validate('https://example.io/strict-tree', d);

          if (v) {
            assert.deepEqual(errors, []);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });
  });

  void describe('boolean schemas, Unicode code-point length, and composition boundaries', () => {
    const scenarios: Array<{
      'data': unknown;
      'expected': boolean;
      'name': string;
      'schemaId': string;
    }> = [
      {
        'data': { 'anything': true },
        'expected': true,
        'name': 'boolean true schema accepts any value',
        'schemaId': 'urn:test:bool-true'
      },
      {
        'data': { 'anything': true },
        'expected': false,
        'name': 'boolean false schema (not:{}) rejects any value',
        'schemaId': 'urn:test:bool-false'
      },
      {
        'data': '\u{1F600}',
        'expected': true,
        'name': 'single emoji counts as 1 code point for maxLength:1',
        'schemaId': 'urn:test:unicode-length'
      },
      {
        'data': '\u{1F600}a',
        'expected': false,
        'name': 'emoji + char exceeds maxLength:1',
        'schemaId': 'urn:test:unicode-length'
      },
      {
        'data': 'hello',
        'expected': true,
        'name': 'allOf [true] accepts any value',
        'schemaId': 'urn:test:allof-true'
      },
      {
        'data': null,
        'expected': true,
        'name': 'allOf [true] accepts null',
        'schemaId': 'urn:test:allof-true'
      },
      {
        'data': 'hello',
        'expected': false,
        'name': 'allOf [false] rejects any value',
        'schemaId': 'urn:test:allof-false'
      },
      {
        'data': 'hello',
        'expected': false,
        'name': 'allOf [true, false] rejects (false wins)',
        'schemaId': 'urn:test:allof-true-false'
      },
      {
        'data': true,
        'expected': true,
        'name': 'boolean true schema accepts boolean true',
        'schemaId': 'urn:test:bool-true'
      },
      {
        'data': false,
        'expected': false,
        'name': 'boolean false schema rejects boolean false',
        'schemaId': 'urn:test:bool-false'
      }
    ];

    const registry = new SchemaRegistry();

    registry.register([
      { '$id': 'urn:test:bool-true' },
      {
        '$id': 'urn:test:bool-false',
        'not': {}
      }
    ]);
    registry.register({
      '$id': 'urn:test:unicode-length',
      'maxLength': 1,
      'type': 'string'
    });
    registry.register([
      {
        '$id': 'urn:test:allof-true',
        'allOf': [true]
      },
      {
        '$id': 'urn:test:allof-false',
        'allOf': [false]
      },
      {
        '$id': 'urn:test:allof-true-false',
        'allOf': [
          true,
          false
        ]
      }
    ]);

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schemaId': sid
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(sid, d), exp);
      });
    }
  });

  void describe('nested $ref chains and additionalProperties with allOf', () => {
    const scenarios: Array<{
      'data': unknown;
      'name': string;
      'schemaId': string;
      'valid': boolean;
    }> = [
      {
        'data': { 'inner': { 'nested': { 'value': 42 } } },
        'name': 'A -> B -> C chain: valid deep data passes',
        'schemaId': 'https://example.io/A',
        'valid': true
      },
      {
        'data': { 'inner': { 'nested': { 'value': 'not a number' } } },
        'name': 'A -> B -> C chain: wrong type at deepest level fails',
        'schemaId': 'https://example.io/A',
        'valid': false
      },
      {
        'data': { 'inner': {} },
        'name': 'A -> B -> C chain: missing nested required fails',
        'schemaId': 'https://example.io/A',
        'valid': false
      },
      {
        'data': { 'a': 'hello' },
        'name': 'additionalProperties:false with allOf: local property passes',
        'schemaId': 'urn:test:additional-allof',
        'valid': true
      },
      {
        'data': {
          'a': 'hello',
          'b': 1
        },
        'name': 'additionalProperties:false with allOf: allOf property rejected',
        'schemaId': 'urn:test:additional-allof',
        'valid': false
      },
      {
        'data': {},
        'name': 'empty object for object schema with additionalProperties:false passes',
        'schemaId': 'urn:test:additional-allof',
        'valid': true
      }
    ];

    const registry = new SchemaRegistry();

    registry.register([
      {
        '$id': 'https://example.io/C',
        'properties': { 'value': { 'type': 'number' } },
        'required': ['value'],
        'type': 'object'
      },
      {
        '$id': 'https://example.io/B',
        'properties': { 'nested': { '$ref': 'https://example.io/C' } },
        'required': ['nested'],
        'type': 'object'
      },
      {
        '$id': 'https://example.io/A',
        'properties': { 'inner': { '$ref': 'https://example.io/B' } },
        'required': ['inner'],
        'type': 'object'
      }
    ]);
    registry.register({
      '$id': 'urn:test:additional-allof',
      'additionalProperties': false,
      'allOf': [{ 'properties': { 'b': { 'type': 'number' } } }],
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    });

    for (const {
      'data': d, 'name': n, 'schemaId': sid, 'valid': v
    } of scenarios) {
      void it(n, () => {
        const errors = registry.validate(sid, d);

        if (v) {
          assert.deepEqual(errors, []);
        } else {
          assert.ok(errors.length > 0);
        }
      });
    }
  });
});

void describe('Discriminator-based oneOf optimization', () => {
  const CircleSchema = {
    '$id': 'urn:test:circle',
    'properties': {
      'kind': {
        'const': 'circle',
        'type': 'string'
      },
      'radius': { 'type': 'number' }
    },
    'required': [
      'kind',
      'radius'
    ],
    'type': 'object'
  } as const;

  const RectSchema = {
    '$id': 'urn:test:rect',
    'properties': {
      'height': { 'type': 'number' },
      'kind': {
        'const': 'rect',
        'type': 'string'
      },
      'width': { 'type': 'number' }
    },
    'required': [
      'kind',
      'width',
      'height'
    ],
    'type': 'object'
  } as const;

  const discriminatedSchema = {
    '$id': 'urn:test:discriminated-oneof',
    'discriminator': { 'propertyName': 'kind' },
    'oneOf': [
      { '$ref': 'urn:test:circle' },
      { '$ref': 'urn:test:rect' }
    ]
  } as const;

  const plainOneOfSchema = {
    '$id': 'urn:test:plain-oneof',
    'oneOf': [
      { '$ref': 'urn:test:circle' },
      { '$ref': 'urn:test:rect' }
    ]
  } as const;

  function registerAll(registry: SchemaRegistry) {
    registry.register([
      CircleSchema,
      RectSchema,
      discriminatedSchema,
      plainOneOfSchema
    ]);
  }

  void describe('discriminated oneOf validation', () => {
    const scenarios: Array<{
      'data': unknown;
      'expected': boolean;
      'name': string;
      'schemaId': string;
    }> = [
      {
        'data': {
          'kind': 'circle',
          'radius': 5
        },
        'expected': true,
        'name': 'discriminated: valid circle passes',
        'schemaId': 'urn:test:discriminated-oneof'
      },
      {
        'data': {
          'height': 20,
          'kind': 'rect',
          'width': 10
        },
        'expected': true,
        'name': 'discriminated: valid rect passes',
        'schemaId': 'urn:test:discriminated-oneof'
      },
      {
        'data': { 'kind': 'circle' },
        'expected': false,
        'name': 'discriminated: missing required radius fails',
        'schemaId': 'urn:test:discriminated-oneof'
      },
      {
        'data': {
          'kind': 'triangle',
          'sides': 3
        },
        'expected': false,
        'name': 'discriminated: unknown discriminator value fails',
        'schemaId': 'urn:test:discriminated-oneof'
      },
      {
        'data': { 'radius': 5 },
        'expected': false,
        'name': 'discriminated: missing discriminator property fails',
        'schemaId': 'urn:test:discriminated-oneof'
      },
      {
        'data': 'hello',
        'expected': false,
        'name': 'discriminated: non-object data fails',
        'schemaId': 'urn:test:discriminated-oneof'
      },
      {
        'data': {
          'kind': 'circle',
          'radius': 5
        },
        'expected': true,
        'name': 'plain oneOf: valid circle passes',
        'schemaId': 'urn:test:plain-oneof'
      },
      {
        'data': {
          'height': 20,
          'kind': 'rect',
          'width': 10
        },
        'expected': true,
        'name': 'plain oneOf: valid rect passes',
        'schemaId': 'urn:test:plain-oneof'
      },
      {
        'data': { 'kind': 'circle' },
        'expected': false,
        'name': 'plain oneOf: missing required radius fails',
        'schemaId': 'urn:test:plain-oneof'
      }
    ];

    const registry = new SchemaRegistry();

    registerAll(registry);

    for (const {
      'data': d, 'expected': exp, 'name': n, 'schemaId': sid
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(sid, d), exp);
      });
    }
  });

  void describe('discriminator.mapping dispatches by mapped $ref target', () => {
    const scenarios: Array<{
      'data': unknown;
      'expected': boolean;
      'name': string;
    }> = [
      {
        'data': {
          'breed': 'poodle',
          'petType': 'dog'
        },
        'expected': true,
        'name': 'mapped dog with breed passes'
      },
      {
        'data': {
          'color': 'black',
          'petType': 'cat'
        },
        'expected': true,
        'name': 'mapped cat with color passes'
      },
      {
        'data': { 'petType': 'dog' },
        'expected': false,
        'name': 'mapped dog missing required breed fails'
      },
      {
        'data': {
          'fins': 2,
          'petType': 'fish'
        },
        'expected': false,
        'name': 'unmapped discriminator value fails'
      }
    ];

    const registry = new SchemaRegistry();
    const DogSchema = {
      '$id': 'urn:test:dog',
      'properties': {
        'breed': { 'type': 'string' },
        'petType': { 'type': 'string' }
      },
      'required': [
        'petType',
        'breed'
      ],
      'type': 'object'
    };
    const CatSchema = {
      '$id': 'urn:test:cat',
      'properties': {
        'color': { 'type': 'string' },
        'petType': { 'type': 'string' }
      },
      'required': [
        'petType',
        'color'
      ],
      'type': 'object'
    };
    const PetSchema = {
      '$id': 'urn:test:pet-mapped',
      'discriminator': {
        'mapping': {
          'cat': 'urn:test:cat',
          'dog': 'urn:test:dog'
        },
        'propertyName': 'petType'
      },
      'oneOf': [
        { '$ref': 'urn:test:dog' },
        { '$ref': 'urn:test:cat' }
      ]
    };

    registry.register([
      DogSchema,
      CatSchema,
      PetSchema
    ]);

    for (const {
      'data': d, 'expected': exp, 'name': n
    } of scenarios) {
      void it(n, () => {
        assert.equal(registry.is(PetSchema.$id, d), exp);
      });
    }
  });
});
