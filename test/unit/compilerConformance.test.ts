/**
 * Compiler Conformance Tests
 *
 * Proves that compiled (closure-based) and interpreted (GraphEngine) validators
 * produce identical results for all supported features.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function id(): string {
  return `https://conformance.test/${++counter}`;
}

function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  Reflect.set(target, key, value);

  return target;
}

const thenKeyword: string = String.fromCodePoint(116, 104, 101, 110);

function setThenKeyword(target: Record<string, unknown>, value: unknown): Record<string, unknown> {
  setSchemaKey(target, thenKeyword, value);

  return target;
}

/**
 * Register schema(s) and validate data through both compiled and interpreted
 * paths, asserting identical validity and error presence.
 */
function assertConformance(
  schema: Record<string, unknown>,
  data: unknown,
  expectedValid: boolean,
  deps?: Array<Record<string, unknown>>
): void {
  const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

  if (deps) {
    for (const dep of deps) {
      registry.register(dep);
    }
  }

  registry.register(schema);
  const schemaId = schema.$id as string;

  // Compiled path (may fall back to engine internally)
  const compiledErrors = registry.validate(schemaId, data);

  // Interpreted (engine) path — direct execution
  const engine = registry.registry.engine(schema);
  const engineResult = engine.execute(data, { 'overrides': { 'collectErrors': true } });

  const compiledValid = compiledErrors.length === 0;
  const engineValid = engineResult.valid;

  assert.equal(
    compiledValid,
    engineValid,
    `Compiled valid=${compiledValid} but engine valid=${engineValid} for schema ${schemaId}`
  );

  assert.equal(
    compiledValid,
    expectedValid,
    `Expected valid=${expectedValid} but got valid=${compiledValid} for schema ${schemaId}`
  );
}

function requiredPropsSchema(): Record<string, unknown> {
  return {
    '$id': id(),
    'properties': {
      'age': { 'type': 'number' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  };
}

function ifThenElseSchema(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    '$id': id(),
    'else': {
      'properties': { 'value': { 'type': 'string' } },
      'required': ['value']
    },
    'if': {
      'properties': { 'kind': { 'const': 'number' } },
      'required': ['kind']
    },
    'properties': {
      'kind': { 'type': 'string' },
      'value': {}
    },
    'type': 'object'
  };

  setThenKeyword(base, {
    'properties': { 'value': { 'type': 'number' } },
    'required': ['value']
  });

  return base;
}

// ---------------------------------------------------------------------------
// Scenario type
// ---------------------------------------------------------------------------

interface Scenario {
  'data': unknown;
  'deps'?: Array<Record<string, unknown>>;
  'name': string;
  'schema': Record<string, unknown>;
  'valid': boolean;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

void describe('Compiler conformance: basic types and multiple type unions', () => {
  const basicTypeScenarios: Scenario[] = [
    // string
    {
      'data': 'hello',
      'name': 'valid: string type matches string value',
      'schema': {
        '$id': id(),
        'type': 'string'
      },
      'valid': true
    },
    {
      'data': 123,
      'name': 'invalid: string type rejects number',
      'schema': {
        '$id': id(),
        'type': 'string'
      },
      'valid': false
    },
    // number
    {
      'data': 3.14,
      'name': 'valid: number type matches float',
      'schema': {
        '$id': id(),
        'type': 'number'
      },
      'valid': true
    },
    {
      'data': 'not a number',
      'name': 'invalid: number type rejects string',
      'schema': {
        '$id': id(),
        'type': 'number'
      },
      'valid': false
    },
    // integer
    {
      'data': 42,
      'name': 'valid: integer type matches whole number',
      'schema': {
        '$id': id(),
        'type': 'integer'
      },
      'valid': true
    },
    {
      'data': 3.14,
      'name': 'invalid: integer type rejects float',
      'schema': {
        '$id': id(),
        'type': 'integer'
      },
      'valid': false
    },
    // boolean
    {
      'data': true,
      'name': 'valid: boolean type matches true',
      'schema': {
        '$id': id(),
        'type': 'boolean'
      },
      'valid': true
    },
    {
      'data': 'true',
      'name': 'invalid: boolean type rejects string "true"',
      'schema': {
        '$id': id(),
        'type': 'boolean'
      },
      'valid': false
    },
    // null
    {
      'data': null,
      'name': 'valid: null type matches null',
      'schema': {
        '$id': id(),
        'type': 'null'
      },
      'valid': true
    },
    {
      'data': 0,
      'name': 'invalid: null type rejects zero',
      'schema': {
        '$id': id(),
        'type': 'null'
      },
      'valid': false
    },
    // array
    {
      'data': [
        1,
        2
      ],
      'name': 'valid: array type matches array value',
      'schema': {
        '$id': id(),
        'type': 'array'
      },
      'valid': true
    },
    {
      'data': 'not an array',
      'name': 'invalid: array type rejects string',
      'schema': {
        '$id': id(),
        'type': 'array'
      },
      'valid': false
    },
    // object
    {
      'data': { 'a': 1 },
      'name': 'valid: object type matches plain object',
      'schema': {
        '$id': id(),
        'type': 'object'
      },
      'valid': true
    },
    {
      'data': 'not an object',
      'name': 'invalid: object type rejects string',
      'schema': {
        '$id': id(),
        'type': 'object'
      },
      'valid': false
    },
    // edge cases
    {
      'data': '',
      'name': 'valid: string type matches empty string',
      'schema': {
        '$id': id(),
        'type': 'string'
      },
      'valid': true
    },
    {
      'data': [],
      'name': 'valid: array type matches empty array',
      'schema': {
        '$id': id(),
        'type': 'array'
      },
      'valid': true
    },
    {
      'data': {},
      'name': 'valid: object type matches empty object',
      'schema': {
        '$id': id(),
        'type': 'object'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of basicTypeScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const unionScenarios: Scenario[] = [
    {
      'data': 'hello',
      'name': 'valid: [string, null] union accepts string',
      'schema': {
        '$id': id(),
        'type': [
          'string',
          'null'
        ]
      },
      'valid': true
    },
    {
      'data': null,
      'name': 'valid: [string, null] union accepts null',
      'schema': {
        '$id': id(),
        'type': [
          'string',
          'null'
        ]
      },
      'valid': true
    },
    {
      'data': 42,
      'name': 'invalid: [string, null] union rejects number',
      'schema': {
        '$id': id(),
        'type': [
          'string',
          'null'
        ]
      },
      'valid': false
    },
    // edge cases
    {
      'data': true,
      'name': 'invalid: [string, null] union rejects boolean',
      'schema': {
        '$id': id(),
        'type': [
          'string',
          'null'
        ]
      },
      'valid': false
    },
    {
      'data': undefined,
      'name': 'invalid: [string, null] union rejects undefined',
      'schema': {
        '$id': id(),
        'type': [
          'string',
          'null'
        ]
      },
      'valid': false
    }
  ];

  for (const {
    data, name, schema, valid
  } of unionScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }
});

void describe('Compiler conformance: object constraints', () => {
  const requiredPropsScenarios: Scenario[] = [
    {
      'data': { 'name': 'Alice' },
      'name': 'valid: object with required property present',
      'schema': requiredPropsSchema(),
      'valid': true
    },
    {
      'data': { 'age': 30 },
      'name': 'invalid: object missing required property',
      'schema': requiredPropsSchema(),
      'valid': false
    },
    // edge cases
    {
      'data': {
        'age': 30,
        'name': 'Alice'
      },
      'name': 'valid: object with required and optional properties',
      'schema': requiredPropsSchema(),
      'valid': true
    },
    {
      'data': {},
      'name': 'invalid: empty object missing required property',
      'schema': requiredPropsSchema(),
      'valid': false
    }
  ];

  for (const {
    data, name, schema, valid
  } of requiredPropsScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const additionalPropsScenarios: Scenario[] = [
    {
      'data': { 'a': 'hello' },
      'name': 'valid: no additional properties when additionalProperties false',
      'schema': {
        '$id': id(),
        'additionalProperties': false,
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      },
      'valid': true
    },
    {
      'data': {
        'a': 'hello',
        'b': 'extra'
      },
      'name': 'invalid: extra property when additionalProperties false',
      'schema': {
        '$id': id(),
        'additionalProperties': false,
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      },
      'valid': false
    },
    {
      'data': {
        'a': 'hello',
        'b': 42
      },
      'name': 'valid: additional property matches additionalProperties schema',
      'schema': {
        '$id': id(),
        'additionalProperties': { 'type': 'number' },
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      },
      'valid': true
    },
    {
      'data': {
        'a': 'hello',
        'b': 'not a number'
      },
      'name': 'invalid: additional property violates additionalProperties schema',
      'schema': {
        '$id': id(),
        'additionalProperties': { 'type': 'number' },
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      },
      'valid': false
    },
    // edge case
    {
      'data': {},
      'name': 'valid: empty object when additionalProperties false',
      'schema': {
        '$id': id(),
        'additionalProperties': false,
        'properties': { 'a': { 'type': 'string' } },
        'type': 'object'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of additionalPropsScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const propCountScenarios: Scenario[] = [
    {
      'data': {
        'a': 1,
        'b': 2
      },
      'name': 'valid: object meets minProperties',
      'schema': {
        '$id': id(),
        'minProperties': 2,
        'type': 'object'
      },
      'valid': true
    },
    {
      'data': { 'a': 1 },
      'name': 'invalid: object below minProperties',
      'schema': {
        '$id': id(),
        'minProperties': 2,
        'type': 'object'
      },
      'valid': false
    },
    {
      'data': {
        'a': 1,
        'b': 2
      },
      'name': 'valid: object within maxProperties',
      'schema': {
        '$id': id(),
        'maxProperties': 2,
        'type': 'object'
      },
      'valid': true
    },
    {
      'data': {
        'a': 1,
        'b': 2,
        'c': 3
      },
      'name': 'invalid: object exceeds maxProperties',
      'schema': {
        '$id': id(),
        'maxProperties': 2,
        'type': 'object'
      },
      'valid': false
    },
    // edge cases
    {
      'data': {},
      'name': 'invalid: empty object below minProperties',
      'schema': {
        '$id': id(),
        'minProperties': 1,
        'type': 'object'
      },
      'valid': false
    },
    {
      'data': {},
      'name': 'valid: empty object within maxProperties zero',
      'schema': {
        '$id': id(),
        'maxProperties': 0,
        'type': 'object'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of propCountScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const patternPropsScenarios: Scenario[] = [
    {
      'data': {
        'N_age': 30,
        'S_name': 'Alice'
      },
      'name': 'valid: patternProperties match correct types',
      'schema': {
        '$id': id(),
        'patternProperties': {
          '^N_': { 'type': 'number' },
          '^S_': { 'type': 'string' }
        },
        'type': 'object'
      },
      'valid': true
    },
    {
      'data': { 'S_name': 42 },
      'name': 'invalid: patternProperties type mismatch',
      'schema': {
        '$id': id(),
        'patternProperties': { '^S_': { 'type': 'string' } },
        'type': 'object'
      },
      'valid': false
    },
    // edge case
    {
      'data': {},
      'name': 'valid: empty object with patternProperties',
      'schema': {
        '$id': id(),
        'patternProperties': { '^S_': { 'type': 'string' } },
        'type': 'object'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of patternPropsScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }
});

void describe('Compiler conformance: string and numeric constraints', () => {
  const stringScenarios: Scenario[] = [
    {
      'data': 'hello',
      'name': 'valid: string matches pattern',
      'schema': {
        '$id': id(),
        'pattern': '^[a-z]+$',
        'type': 'string'
      },
      'valid': true
    },
    {
      'data': 'Hello',
      'name': 'invalid: string violates pattern',
      'schema': {
        '$id': id(),
        'pattern': '^[a-z]+$',
        'type': 'string'
      },
      'valid': false
    },
    {
      'data': 'abc',
      'name': 'valid: string within length bounds',
      'schema': {
        '$id': id(),
        'maxLength': 5,
        'minLength': 2,
        'type': 'string'
      },
      'valid': true
    },
    {
      'data': 'a',
      'name': 'invalid: string below minLength',
      'schema': {
        '$id': id(),
        'maxLength': 5,
        'minLength': 2,
        'type': 'string'
      },
      'valid': false
    },
    {
      'data': 'abcdef',
      'name': 'invalid: string exceeds maxLength',
      'schema': {
        '$id': id(),
        'maxLength': 5,
        'minLength': 2,
        'type': 'string'
      },
      'valid': false
    },
    // edge cases
    {
      'data': 'ab',
      'name': 'valid: string at exact minLength boundary',
      'schema': {
        '$id': id(),
        'maxLength': 5,
        'minLength': 2,
        'type': 'string'
      },
      'valid': true
    },
    {
      'data': 'abcde',
      'name': 'valid: string at exact maxLength boundary',
      'schema': {
        '$id': id(),
        'maxLength': 5,
        'minLength': 2,
        'type': 'string'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of stringScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const numericScenarios: Scenario[] = [
    {
      'data': 50,
      'name': 'valid: number within minimum/maximum range',
      'schema': {
        '$id': id(),
        'maximum': 100,
        'minimum': 0,
        'type': 'number'
      },
      'valid': true
    },
    {
      'data': -1,
      'name': 'invalid: number below minimum',
      'schema': {
        '$id': id(),
        'maximum': 100,
        'minimum': 0,
        'type': 'number'
      },
      'valid': false
    },
    {
      'data': 101,
      'name': 'invalid: number exceeds maximum',
      'schema': {
        '$id': id(),
        'maximum': 100,
        'minimum': 0,
        'type': 'number'
      },
      'valid': false
    },
    {
      'data': 1,
      'name': 'valid: number above exclusiveMinimum',
      'schema': {
        '$id': id(),
        'exclusiveMinimum': 0,
        'type': 'number'
      },
      'valid': true
    },
    {
      'data': 0,
      'name': 'invalid: number equal to exclusiveMinimum',
      'schema': {
        '$id': id(),
        'exclusiveMinimum': 0,
        'type': 'number'
      },
      'valid': false
    },
    {
      'data': 9,
      'name': 'valid: number is multipleOf',
      'schema': {
        '$id': id(),
        'multipleOf': 3,
        'type': 'number'
      },
      'valid': true
    },
    {
      'data': 10,
      'name': 'invalid: number is not multipleOf',
      'schema': {
        '$id': id(),
        'multipleOf': 3,
        'type': 'number'
      },
      'valid': false
    },
    // edge cases
    {
      'data': 0,
      'name': 'valid: number at exact minimum boundary',
      'schema': {
        '$id': id(),
        'maximum': 100,
        'minimum': 0,
        'type': 'number'
      },
      'valid': true
    },
    {
      'data': 100,
      'name': 'valid: number at exact maximum boundary',
      'schema': {
        '$id': id(),
        'maximum': 100,
        'minimum': 0,
        'type': 'number'
      },
      'valid': true
    },
    {
      'data': 0,
      'name': 'valid: zero is multipleOf any positive number',
      'schema': {
        '$id': id(),
        'multipleOf': 7,
        'type': 'number'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of numericScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }
});

void describe('Compiler conformance: enum, const, and composition keywords', () => {
  const enumConstScenarios: Scenario[] = [
    {
      'data': 'green',
      'name': 'valid: enum value matches allowed value',
      'schema': {
        '$id': id(),
        'enum': [
          'red',
          'green',
          'blue'
        ]
      },
      'valid': true
    },
    {
      'data': 'yellow',
      'name': 'invalid: enum value not in allowed set',
      'schema': {
        '$id': id(),
        'enum': [
          'red',
          'green',
          'blue'
        ]
      },
      'valid': false
    },
    {
      'data': 42,
      'name': 'valid: const value matches exactly',
      'schema': {
        '$id': id(),
        'const': 42
      },
      'valid': true
    },
    {
      'data': 43,
      'name': 'invalid: const value does not match',
      'schema': {
        '$id': id(),
        'const': 42
      },
      'valid': false
    },
    // edge cases
    {
      'data': null,
      'name': 'valid: enum accepts null in enum list',
      'schema': {
        '$id': id(),
        'enum': [
          null,
          'a'
        ]
      },
      'valid': true
    },
    {
      'data': null,
      'name': 'valid: const matches null exactly',
      'schema': {
        '$id': id(),
        'const': null
      },
      'valid': true
    },
    {
      'data': 0,
      'name': 'invalid: const null rejects zero',
      'schema': {
        '$id': id(),
        'const': null
      },
      'valid': false
    }
  ];

  for (const {
    data, name, schema, valid
  } of enumConstScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  // allOf requires deps, so each scenario builds its own refs
  void describe('allOf composition', () => {
    const allOfScenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'a': 'hello',
          'b': 42
        },
        'name': 'valid: allOf with both subschemas satisfied',
        'valid': true
      },
      {
        'data': { 'a': 'hello' },
        'name': 'invalid: allOf with second subschema missing required',
        'valid': false
      },
      // edge case
      {
        'data': {},
        'name': 'invalid: allOf with empty object missing both required',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of allOfScenarios) {
      void it(name, () => {
        const partAId = id();
        const partBId = id();
        const partA = {
          '$id': partAId,
          'properties': { 'a': { 'type': 'string' } },
          'required': ['a'],
          'type': 'object'
        };
        const partB = {
          '$id': partBId,
          'properties': { 'b': { 'type': 'number' } },
          'required': ['b'],
          'type': 'object'
        };

        assertConformance({
          '$id': id(),
          'allOf': [
            { '$ref': partAId },
            { '$ref': partBId }
          ]
        }, data, valid, [
          partA,
          partB
        ]);
      });
    }
  });

  const anyOfScenarios: Scenario[] = [
    {
      'data': 'hello',
      'name': 'valid: anyOf matches first subschema',
      'schema': {
        '$id': id(),
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      'valid': true
    },
    {
      'data': true,
      'name': 'invalid: anyOf matches no subschema',
      'schema': {
        '$id': id(),
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      'valid': false
    },
    // edge case
    {
      'data': 42,
      'name': 'valid: anyOf matches second subschema',
      'schema': {
        '$id': id(),
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of anyOfScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const oneOfScenarios: Scenario[] = [
    {
      'data': 42,
      'name': 'valid: oneOf matches exactly one subschema',
      'schema': {
        '$id': id(),
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      'valid': true
    },
    {
      'data': true,
      'name': 'invalid: oneOf matches no subschema',
      'schema': {
        '$id': id(),
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      'valid': false
    },
    {
      'data': 50,
      'name': 'invalid: oneOf matches more than one subschema',
      'schema': {
        '$id': id(),
        'oneOf': [
          {
            'minimum': 0,
            'type': 'number'
          },
          {
            'maximum': 100,
            'type': 'number'
          }
        ]
      },
      'valid': false
    },
    // edge case
    {
      'data': 'hello',
      'name': 'valid: oneOf string branch matches',
      'schema': {
        '$id': id(),
        'oneOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of oneOfScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const notScenarios: Scenario[] = [
    {
      'data': 42,
      'name': 'valid: not string accepts number',
      'schema': {
        '$id': id(),
        'not': { 'type': 'string' }
      },
      'valid': true
    },
    {
      'data': 'hello',
      'name': 'invalid: not string rejects string',
      'schema': {
        '$id': id(),
        'not': { 'type': 'string' }
      },
      'valid': false
    },
    // edge case
    {
      'data': null,
      'name': 'valid: not string accepts null',
      'schema': {
        '$id': id(),
        'not': { 'type': 'string' }
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of notScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }
});

void describe('Compiler conformance: array keywords and contains', () => {
  const arrayScenarios: Scenario[] = [
    // items schema
    {
      'data': [
        1,
        2,
        3
      ],
      'name': 'valid: array items all match items schema',
      'schema': {
        '$id': id(),
        'items': { 'type': 'number' },
        'type': 'array'
      },
      'valid': true
    },
    {
      'data': [
        1,
        'two',
        3
      ],
      'name': 'invalid: array item violates items schema',
      'schema': {
        '$id': id(),
        'items': { 'type': 'number' },
        'type': 'array'
      },
      'valid': false
    },
    // prefixItems
    {
      'data': [
        'hello',
        42
      ],
      'name': 'valid: array matches prefixItems positional types',
      'schema': {
        '$id': id(),
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' }
        ],
        'type': 'array'
      },
      'valid': true
    },
    {
      'data': [
        42,
        'hello'
      ],
      'name': 'invalid: array violates prefixItems positional types',
      'schema': {
        '$id': id(),
        'prefixItems': [
          { 'type': 'string' },
          { 'type': 'number' }
        ],
        'type': 'array'
      },
      'valid': false
    },
    // minItems / maxItems
    {
      'data': [
        1,
        2
      ],
      'name': 'valid: array within minItems/maxItems bounds',
      'schema': {
        '$id': id(),
        'maxItems': 3,
        'minItems': 1,
        'type': 'array'
      },
      'valid': true
    },
    {
      'data': [],
      'name': 'invalid: empty array below minItems',
      'schema': {
        '$id': id(),
        'maxItems': 3,
        'minItems': 1,
        'type': 'array'
      },
      'valid': false
    },
    {
      'data': [
        1,
        2,
        3,
        4
      ],
      'name': 'invalid: array exceeds maxItems',
      'schema': {
        '$id': id(),
        'maxItems': 3,
        'minItems': 1,
        'type': 'array'
      },
      'valid': false
    },
    // uniqueItems
    {
      'data': [
        1,
        2,
        3
      ],
      'name': 'valid: array with all unique items',
      'schema': {
        '$id': id(),
        'type': 'array',
        'uniqueItems': true
      },
      'valid': true
    },
    {
      'data': [
        1,
        2,
        2
      ],
      'name': 'invalid: array with duplicate items',
      'schema': {
        '$id': id(),
        'type': 'array',
        'uniqueItems': true
      },
      'valid': false
    },
    // edge cases
    {
      'data': [],
      'name': 'valid: empty array satisfies items schema',
      'schema': {
        '$id': id(),
        'items': { 'type': 'number' },
        'type': 'array'
      },
      'valid': true
    },
    {
      'data': [],
      'name': 'valid: empty array satisfies uniqueItems',
      'schema': {
        '$id': id(),
        'type': 'array',
        'uniqueItems': true
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of arrayScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  const containsScenarios: Scenario[] = [
    {
      'data': [
        1,
        2,
        15,
        3
      ],
      'name': 'valid: array contains item matching contains schema',
      'schema': {
        '$id': id(),
        'contains': {
          'minimum': 10,
          'type': 'number'
        },
        'type': 'array'
      },
      'valid': true
    },
    {
      'data': [
        1,
        2,
        3
      ],
      'name': 'invalid: array has no item matching contains schema',
      'schema': {
        '$id': id(),
        'contains': {
          'minimum': 10,
          'type': 'number'
        },
        'type': 'array'
      },
      'valid': false
    },
    // edge case
    {
      'data': [],
      'name': 'invalid: empty array never satisfies contains',
      'schema': {
        '$id': id(),
        'contains': { 'type': 'number' },
        'type': 'array'
      },
      'valid': false
    }
  ];

  for (const {
    data, name, schema, valid
  } of containsScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }
});

void describe('Compiler conformance: $ref, if/then/else, and dependentRequired', () => {
  // $ref with $defs (local)
  const localRefScenarios: Scenario[] = [
    {
      'data': 'Alice',
      'name': 'valid: $ref to local $defs accepts valid data',
      'schema': {
        '$defs': {
          'Name': {
            'minLength': 1,
            'type': 'string'
          }
        },
        '$id': id(),
        '$ref': '#/$defs/Name'
      },
      'valid': true
    },
    {
      'data': '',
      'name': 'invalid: $ref to local $defs rejects empty string',
      'schema': {
        '$defs': {
          'Name': {
            'minLength': 1,
            'type': 'string'
          }
        },
        '$id': id(),
        '$ref': '#/$defs/Name'
      },
      'valid': false
    }
  ];

  for (const {
    data, name, schema, valid
  } of localRefScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  // $ref cross-schema
  void it('valid: $ref to cross-schema dependency accepts valid data', () => {
    const depId = id();
    const dep = {
      '$id': depId,
      'minLength': 1,
      'type': 'string'
    };

    assertConformance({
      '$id': id(),
      '$ref': depId
    }, 'ok', true, [dep]);
  });

  // if/then/else
  const ifThenElseScenarios: Array<{ 'data': unknown;
    'name': string;
    'valid': boolean }> = [
    {
      'data': {
        'kind': 'number',
        'value': 42
      },
      'name': 'valid: if condition met and then branch satisfied',
      'valid': true
    },
    {
      'data': {
        'kind': 'number',
        'value': 'hello'
      },
      'name': 'invalid: if condition met but then branch violated',
      'valid': false
    },
    {
      'data': {
        'kind': 'text',
        'value': 'hello'
      },
      'name': 'valid: if condition not met and else branch satisfied',
      'valid': true
    },
    {
      'data': {
        'kind': 'text',
        'value': 42
      },
      'name': 'invalid: if condition not met and else branch violated',
      'valid': false
    },
    // edge case
    {
      'data': { 'kind': 'text' },
      'name': 'invalid: if condition not met and value missing for else branch',
      'valid': false
    }
  ];

  for (const {
    data, name, valid
  } of ifThenElseScenarios) {
    void it(name, () => {
      assertConformance(ifThenElseSchema(), data, valid);
    });
  }

  // dependentRequired
  const dependentRequiredScenarios: Scenario[] = [
    {
      'data': {
        'a': 'hello',
        'b': 'world'
      },
      'name': 'valid: dependentRequired property present when trigger present',
      'schema': {
        '$id': id(),
        'dependentRequired': { 'a': ['b'] },
        'properties': {
          'a': { 'type': 'string' },
          'b': { 'type': 'string' }
        },
        'type': 'object'
      },
      'valid': true
    },
    {
      'data': { 'a': 'hello' },
      'name': 'invalid: dependentRequired property missing when trigger present',
      'schema': {
        '$id': id(),
        'dependentRequired': { 'a': ['b'] },
        'properties': {
          'a': { 'type': 'string' },
          'b': { 'type': 'string' }
        },
        'type': 'object'
      },
      'valid': false
    },
    // edge case
    {
      'data': { 'b': 'world' },
      'name': 'valid: dependentRequired not triggered when trigger absent',
      'schema': {
        '$id': id(),
        'dependentRequired': { 'a': ['b'] },
        'properties': {
          'a': { 'type': 'string' },
          'b': { 'type': 'string' }
        },
        'type': 'object'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of dependentRequiredScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  // nested objects via $ref
  void describe('nested objects via $ref', () => {
    const nestedScenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'address': {
            'street': '123 Main St',
            'zip': '12345'
          }
        },
        'name': 'valid: nested object with all required properties',
        'valid': true
      },
      {
        'data': {
          'address': {
            'street': '123 Main St',
            'zip': 'bad'
          }
        },
        'name': 'invalid: nested object with invalid zip pattern',
        'valid': false
      },
      {
        'data': { 'address': { 'street': '123 Main St' } },
        'name': 'invalid: nested object missing required zip',
        'valid': false
      },
      // edge case
      {
        'data': { 'address': {} },
        'name': 'invalid: nested object is empty',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of nestedScenarios) {
      void it(name, () => {
        const addressId = id();
        const address = {
          '$id': addressId,
          'properties': {
            'street': { 'type': 'string' },
            'zip': {
              'pattern': '^\\d{5}$',
              'type': 'string'
            }
          },
          'required': [
            'street',
            'zip'
          ],
          'type': 'object'
        };

        assertConformance({
          '$id': id(),
          'properties': { 'address': { '$ref': addressId } },
          'required': ['address'],
          'type': 'object'
        }, data, valid, [address]);
      });
    }
  });
});

void describe('Compiler conformance: format and custom keywords', () => {
  const formatScenarios: Scenario[] = [
    {
      'data': 'user@example.com',
      'name': 'valid: email format accepts valid email',
      'schema': {
        '$id': id(),
        'format': 'email',
        'type': 'string'
      },
      'valid': true
    },
    {
      'data': 'https://example.com',
      'name': 'valid: uri format accepts valid URI',
      'schema': {
        '$id': id(),
        'format': 'uri',
        'type': 'string'
      },
      'valid': true
    }
  ];

  for (const {
    data, name, schema, valid
  } of formatScenarios) {
    void it(name, () => {
      assertConformance(schema, data, valid);
    });
  }

  // custom keywords: compiled and interpreted agree
  void describe('custom keyword evenNumber', () => {
    const evenKeyword = {
      'keyword': 'evenNumber',
      'type': 'number' as const,
      'validate': (schemaValue: unknown, data: unknown) => {
        if (schemaValue !== true) {
          return true;
        }

        return typeof data === 'number' && data % 2 === 0;
      }
    };

    const customKeywordScenarios: Array<{ 'data': number;
      'name': string;
      'valid': boolean }> = [
      {
        'data': 4,
        'name': 'valid: even number accepted by evenNumber keyword',
        'valid': true
      },
      {
        'data': 3,
        'name': 'invalid: odd number rejected by evenNumber keyword',
        'valid': false
      },
      // edge cases
      {
        'data': 0,
        'name': 'valid: zero is even',
        'valid': true
      },
      {
        'data': -1,
        'name': 'invalid: negative odd number rejected',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of customKeywordScenarios) {
      void it(name, () => {
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'keywords': [evenKeyword]
        });
        const schema = {
          '$id': id(),
          'evenNumber': true,
          'type': 'integer'
        };

        registry.register(schema);
        const schemaId = schema.$id;

        const compiledErrors = registry.validate(schemaId, data);

        if (valid) {
          assert.equal(compiledErrors.length, 0, `compiled should accept ${data}`);
        } else {
          assert.ok(compiledErrors.length > 0, `compiled should reject ${data}`);
        }

        const engine = registry.registry.engine(schema);
        const engineResult = engine.execute(data, { 'overrides': { 'collectErrors': true } });

        assert.equal(engineResult.valid, valid, `engine should ${valid ? 'accept' : 'reject'} ${data}`);
      });
    }

    // custom keyword produces compiled validator, not engine fallback
    void it('custom keyword schema compiles without engine fallback', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'keywords': [evenKeyword]
      });
      const schema = {
        '$id': id(),
        'evenNumber': true,
        'type': 'integer'
      };

      registry.register(schema);

      const validator = registry.registry.validator(schema.$id);

      assert.equal(validator.compiled, true, 'custom keyword schema must be compiled, not engine fallback');
    });
  });

  // discriminator mapping
  void describe('discriminator mapping', () => {
    const discriminatorScenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'breed': 'poodle',
          'petType': 'dog'
        },
        'name': 'valid: discriminator routes to correct subschema with required props',
        'valid': true
      },
      {
        'data': { 'petType': 'dog' },
        'name': 'invalid: discriminator subschema missing required property',
        'valid': false
      },
      {
        'data': {
          'fins': 2,
          'petType': 'fish'
        },
        'name': 'invalid: discriminator value not in mapping',
        'valid': false
      },
      // edge case
      {
        'data': { 'breed': 'poodle' },
        'name': 'invalid: discriminator property missing entirely',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of discriminatorScenarios) {
      void it(name, () => {
        const dogSchema = {
          '$id': id(),
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

        const catSchema = {
          '$id': id(),
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

        const petSchema = {
          '$id': id(),
          'discriminator': {
            'mapping': {
              'cat': catSchema.$id,
              'dog': dogSchema.$id
            },
            'propertyName': 'petType'
          },
          'oneOf': [
            { '$ref': dogSchema.$id },
            { '$ref': catSchema.$id }
          ]
        };

        assertConformance(petSchema, data, valid, [
          dogSchema,
          catSchema
        ]);
      });
    }
  });
});
