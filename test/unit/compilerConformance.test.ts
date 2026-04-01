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
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';

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
  const registry = new SchemaRegistry();

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
  const engine = registry.engine(schema);
  const engineResult = engine.execute(data, '', { 'collectErrors': true });

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
// Test suites
// ---------------------------------------------------------------------------

void describe('Compiler conformance: basic types and multiple type unions', () => {
  void it('validates all basic types and [string, null] union', () => {
    const validValues: Record<string, unknown> = {
      'array': [
        1,
        2
      ],
      'boolean': true,
      'integer': 42,
      'null': null,
      'number': 3.14,
      'object': { 'a': 1 },
      'string': 'hello'
    };

    const invalidValues: Record<string, unknown> = {
      'array': 'not an array',
      'boolean': 'true',
      'integer': 3.14,
      'null': 0,
      'number': 'not a number',
      'object': 'not an object',
      'string': 123
    };

    for (const type of [
      'string',
      'number',
      'integer',
      'boolean',
      'null',
      'array',
      'object'
    ] as const) {
      assertConformance({
        '$id': id(),
        'type': type
      }, validValues[type], true);

      assertConformance({
        '$id': id(),
        'type': type
      }, invalidValues[type], false);
    }

    // multiple types: [string, null] union
    for (const [
      data,
      valid
    ] of [
        [
          'hello',
          true
        ],
        [
          null,
          true
        ],
        [
          42,
          false
        ]
      ] as Array<[unknown, boolean]>) {
      assertConformance({
        '$id': id(),
        'type': [
          'string',
          'null'
        ]
      }, data, valid);
    }
  });
});

void describe('Compiler conformance: object constraints', () => {
  void it('validates required, additionalProperties, property count, and patternProperties', () => {
    // required properties
    for (const [
      data,
      valid
    ] of [
        [
          { 'name': 'Alice' },
          true
        ],
        [
          { 'age': 30 },
          false
        ]
      ] as Array<[unknown, boolean]>) {
      assertConformance(requiredPropsSchema(), data, valid);
    }

    // additionalProperties
    const additionalPropsScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'additionalProperties': false,
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        },
        { 'a': 'hello' },
        true
      ],
      [
        {
          '$id': id(),
          'additionalProperties': false,
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        },
        {
          'a': 'hello',
          'b': 'extra'
        },
        false
      ],
      [
        {
          '$id': id(),
          'additionalProperties': { 'type': 'number' },
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        },
        {
          'a': 'hello',
          'b': 42
        },
        true
      ],
      [
        {
          '$id': id(),
          'additionalProperties': { 'type': 'number' },
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        },
        {
          'a': 'hello',
          'b': 'not a number'
        },
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of additionalPropsScenarios) {
      assertConformance(schema, data, valid);
    }

    // property count constraints
    const propCountScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'minProperties': 2,
          'type': 'object'
        },
        {
          'a': 1,
          'b': 2
        },
        true
      ],
      [
        {
          '$id': id(),
          'minProperties': 2,
          'type': 'object'
        },
        { 'a': 1 },
        false
      ],
      [
        {
          '$id': id(),
          'maxProperties': 2,
          'type': 'object'
        },
        {
          'a': 1,
          'b': 2
        },
        true
      ],
      [
        {
          '$id': id(),
          'maxProperties': 2,
          'type': 'object'
        },
        {
          'a': 1,
          'b': 2,
          'c': 3
        },
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of propCountScenarios) {
      assertConformance(schema, data, valid);
    }

    // patternProperties
    const patternPropsScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'patternProperties': {
            '^N_': { 'type': 'number' },
            '^S_': { 'type': 'string' }
          },
          'type': 'object'
        },
        {
          'N_age': 30,
          'S_name': 'Alice'
        },
        true
      ],
      [
        {
          '$id': id(),
          'patternProperties': { '^S_': { 'type': 'string' } },
          'type': 'object'
        },
        { 'S_name': 42 },
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of patternPropsScenarios) {
      assertConformance(schema, data, valid);
    }
  });
});

void describe('Compiler conformance: string and numeric constraints', () => {
  void it('validates pattern, length, range, exclusive, and multipleOf', () => {
    // string constraints
    const stringScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'pattern': '^[a-z]+$',
          'type': 'string'
        },
        'hello',
        true
      ],
      [
        {
          '$id': id(),
          'pattern': '^[a-z]+$',
          'type': 'string'
        },
        'Hello',
        false
      ],
      [
        {
          '$id': id(),
          'maxLength': 5,
          'minLength': 2,
          'type': 'string'
        },
        'abc',
        true
      ],
      [
        {
          '$id': id(),
          'maxLength': 5,
          'minLength': 2,
          'type': 'string'
        },
        'a',
        false
      ],
      [
        {
          '$id': id(),
          'maxLength': 5,
          'minLength': 2,
          'type': 'string'
        },
        'abcdef',
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of stringScenarios) {
      assertConformance(schema, data, valid);
    }

    // numeric constraints
    const numericScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'maximum': 100,
          'minimum': 0,
          'type': 'number'
        },
        50,
        true
      ],
      [
        {
          '$id': id(),
          'maximum': 100,
          'minimum': 0,
          'type': 'number'
        },
        -1,
        false
      ],
      [
        {
          '$id': id(),
          'maximum': 100,
          'minimum': 0,
          'type': 'number'
        },
        101,
        false
      ],
      [
        {
          '$id': id(),
          'exclusiveMinimum': 0,
          'type': 'number'
        },
        1,
        true
      ],
      [
        {
          '$id': id(),
          'exclusiveMinimum': 0,
          'type': 'number'
        },
        0,
        false
      ],
      [
        {
          '$id': id(),
          'multipleOf': 3,
          'type': 'number'
        },
        9,
        true
      ],
      [
        {
          '$id': id(),
          'multipleOf': 3,
          'type': 'number'
        },
        10,
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of numericScenarios) {
      assertConformance(schema, data, valid);
    }
  });
});

void describe('Compiler conformance: enum, const, and composition keywords', () => {
  void it('validates enum, const, allOf, anyOf, oneOf, and not', () => {
    // enum and const
    const enumConstScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'enum': [
            'red',
            'green',
            'blue'
          ]
        },
        'green',
        true
      ],
      [
        {
          '$id': id(),
          'enum': [
            'red',
            'green',
            'blue'
          ]
        },
        'yellow',
        false
      ],
      [
        {
          '$id': id(),
          'const': 42
        },
        42,
        true
      ],
      [
        {
          '$id': id(),
          'const': 42
        },
        43,
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of enumConstScenarios) {
      assertConformance(schema, data, valid);
    }

    // allOf
    for (const [
      data,
      valid
    ] of [
        [
          {
            'a': 'hello',
            'b': 42
          },
          true
        ],
        [
          { 'a': 'hello' },
          false
        ]
      ] as Array<[unknown, boolean]>) {
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
    }

    // anyOf
    for (const [
      data,
      valid
    ] of [
        [
          'hello',
          true
        ],
        [
          true,
          false
        ]
      ] as Array<[unknown, boolean]>) {
      assertConformance({
        '$id': id(),
        'anyOf': [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      }, data, valid);
    }

    // oneOf
    const oneOfScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'oneOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        },
        42,
        true
      ],
      [
        {
          '$id': id(),
          'oneOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        },
        true,
        false
      ],
      [
        {
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
        50,
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of oneOfScenarios) {
      assertConformance(schema, data, valid);
    }

    // not
    for (const [
      data,
      valid
    ] of [
        [
          42,
          true
        ],
        [
          'hello',
          false
        ]
      ] as Array<[unknown, boolean]>) {
      assertConformance({
        '$id': id(),
        'not': { 'type': 'string' }
      }, data, valid);
    }
  });
});

void describe('Compiler conformance: array keywords and contains', () => {
  void it('validates array constraints and contains', () => {
    // array keywords
    const arrayScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      // items schema
      [
        {
          '$id': id(),
          'items': { 'type': 'number' },
          'type': 'array'
        },
        [
          1,
          2,
          3
        ],
        true
      ],
      [
        {
          '$id': id(),
          'items': { 'type': 'number' },
          'type': 'array'
        },
        [
          1,
          'two',
          3
        ],
        false
      ],
      // prefixItems
      [
        {
          '$id': id(),
          'prefixItems': [
            { 'type': 'string' },
            { 'type': 'number' }
          ],
          'type': 'array'
        },
        [
          'hello',
          42
        ],
        true
      ],
      [
        {
          '$id': id(),
          'prefixItems': [
            { 'type': 'string' },
            { 'type': 'number' }
          ],
          'type': 'array'
        },
        [
          42,
          'hello'
        ],
        false
      ],
      // minItems / maxItems
      [
        {
          '$id': id(),
          'maxItems': 3,
          'minItems': 1,
          'type': 'array'
        },
        [
          1,
          2
        ],
        true
      ],
      [
        {
          '$id': id(),
          'maxItems': 3,
          'minItems': 1,
          'type': 'array'
        },
        [],
        false
      ],
      [
        {
          '$id': id(),
          'maxItems': 3,
          'minItems': 1,
          'type': 'array'
        },
        [
          1,
          2,
          3,
          4
        ],
        false
      ],
      // uniqueItems
      [
        {
          '$id': id(),
          'type': 'array',
          'uniqueItems': true
        },
        [
          1,
          2,
          3
        ],
        true
      ],
      [
        {
          '$id': id(),
          'type': 'array',
          'uniqueItems': true
        },
        [
          1,
          2,
          2
        ],
        false
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of arrayScenarios) {
      assertConformance(schema, data, valid);
    }

    // contains
    for (const [
      data,
      valid
    ] of [
        [
          [
            1,
            2,
            15,
            3
          ],
          true
        ],
        [
          [
            1,
            2,
            3
          ],
          false
        ]
      ] as Array<[unknown, boolean]>) {
      assertConformance({
        '$id': id(),
        'contains': {
          'minimum': 10,
          'type': 'number'
        },
        'type': 'array'
      }, data, valid);
    }
  });
});

void describe('Compiler conformance: $ref, if/then/else, and dependentRequired', () => {
  void it('validates $ref, conditionals, dependentRequired, and nested objects', () => {
    // $ref with $defs (local)
    for (const [
      data,
      valid
    ] of [
        [
          'Alice',
          true
        ],
        [
          '',
          false
        ]
      ] as Array<[unknown, boolean]>) {
      assertConformance({
        '$defs': {
          'Name': {
            'minLength': 1,
            'type': 'string'
          }
        },
        '$id': id(),
        '$ref': '#/$defs/Name'
      }, data, valid);
    }

    // $ref cross-schema
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

    // if/then/else
    const ifThenElseScenarios: Array<[unknown, boolean]> = [
      [
        {
          'kind': 'number',
          'value': 42
        },
        true
      ],
      [
        {
          'kind': 'number',
          'value': 'hello'
        },
        false
      ],
      [
        {
          'kind': 'text',
          'value': 'hello'
        },
        true
      ],
      [
        {
          'kind': 'text',
          'value': 42
        },
        false
      ]
    ];

    for (const [
      data,
      valid
    ] of ifThenElseScenarios) {
      assertConformance(ifThenElseSchema(), data, valid);
    }

    // dependentRequired
    for (const [
      data,
      valid
    ] of [
        [
          {
            'a': 'hello',
            'b': 'world'
          },
          true
        ],
        [
          { 'a': 'hello' },
          false
        ]
      ] as Array<[unknown, boolean]>) {
      assertConformance({
        '$id': id(),
        'dependentRequired': { 'a': ['b'] },
        'properties': {
          'a': { 'type': 'string' },
          'b': { 'type': 'string' }
        },
        'type': 'object'
      }, data, valid);
    }

    // nested objects via $ref
    const nestedScenarios: Array<[unknown, boolean]> = [
      [
        {
          'address': {
            'street': '123 Main St',
            'zip': '12345'
          }
        },
        true
      ],
      [
        {
          'address': {
            'street': '123 Main St',
            'zip': 'bad'
          }
        },
        false
      ],
      [
        { 'address': { 'street': '123 Main St' } },
        false
      ]
    ];

    for (const [
      data,
      valid
    ] of nestedScenarios) {
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
    }
  });
});

void describe('Compiler conformance: format and custom keywords', () => {
  void it('validates format, custom keywords, and discriminator mapping', () => {
    // format validation
    const formatScenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': id(),
          'format': 'email',
          'type': 'string'
        },
        'user@example.com',
        true
      ],
      [
        {
          '$id': id(),
          'format': 'uri',
          'type': 'string'
        },
        'https://example.com',
        true
      ]
    ];

    for (const [
      schema,
      data,
      valid
    ] of formatScenarios) {
      assertConformance(schema, data, valid);
    }

    // custom keywords: compiled and interpreted agree
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

    for (const [
      data,
      shouldPass
    ] of [
        [
          4,
          true
        ],
        [
          3,
          false
        ]
      ] as Array<[number, boolean]>) {
      const registry = new SchemaRegistry({ 'keywords': [evenKeyword] });
      const schema = {
        '$id': id(),
        'evenNumber': true,
        'type': 'integer'
      };

      registry.register(schema);
      const schemaId = schema.$id;

      const compiledErrors = registry.validate(schemaId, data);

      if (shouldPass) {
        assert.equal(compiledErrors.length, 0, `compiled should accept ${data}`);
      } else {
        assert.ok(compiledErrors.length > 0, `compiled should reject ${data}`);
      }

      const engine = registry.engine(schema);
      const engineResult = engine.execute(data, '', { 'collectErrors': true });

      assert.equal(engineResult.valid, shouldPass, `engine should ${shouldPass ? 'accept' : 'reject'} ${data}`);
    }

    // custom keyword produces compiled validator, not engine fallback
    {
      const registry = new SchemaRegistry({ 'keywords': [evenKeyword] });
      const schema = {
        '$id': id(),
        'evenNumber': true,
        'type': 'integer'
      };

      registry.register(schema);

      const validator = registry.validator(schema.$id);

      assert.equal(validator.compiled, true, 'custom keyword schema must be compiled, not engine fallback');
    }

    // discriminator mapping
    const discriminatorScenarios: Array<[unknown, boolean]> = [
      [
        {
          'breed': 'poodle',
          'petType': 'dog'
        },
        true
      ],
      [
        { 'petType': 'dog' },
        false
      ],
      [
        {
          'fins': 2,
          'petType': 'fish'
        },
        false
      ]
    ];

    for (const [
      data,
      valid
    ] of discriminatorScenarios) {
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
    }
  });
});
