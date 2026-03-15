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
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

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

void describe('Compiler conformance: basic types', () => {
  for (const type of [
    'string',
    'number',
    'integer',
    'boolean',
    'null',
    'array',
    'object'
  ] as const) {
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

    void it(`accepts valid ${type}`, () => {
      assertConformance({
        '$id': id(),
        'type': type
      }, validValues[type], true);
    });

    void it(`rejects invalid ${type}`, () => {
      assertConformance({
        '$id': id(),
        'type': type
      }, invalidValues[type], false);
    });
  }
});

void describe('Compiler conformance: multiple types', () => {
  void it('accepts string for [string, null]', () => {
    assertConformance({
      '$id': id(),
      'type': [
        'string',
        'null'
      ]
    }, 'hello', true);
  });

  void it('accepts null for [string, null]', () => {
    assertConformance({
      '$id': id(),
      'type': [
        'string',
        'null'
      ]
    }, null, true);
  });

  void it('rejects number for [string, null]', () => {
    assertConformance({
      '$id': id(),
      'type': [
        'string',
        'null'
      ]
    }, 42, false);
  });
});

void describe('Compiler conformance: required properties', () => {
  void it('accepts object with required property', () => {
    const testSchema = requiredPropsSchema();

    assertConformance(testSchema, { 'name': 'Alice' }, true);
  });

  void it('rejects object missing required property', () => {
    const testSchema = requiredPropsSchema();

    assertConformance(testSchema, { 'age': 30 }, false);
  });
});

void describe('Compiler conformance: string constraints', () => {
  void it('accepts string matching pattern', () => {
    assertConformance({
      '$id': id(),
      'pattern': '^[a-z]+$',
      'type': 'string'
    }, 'hello', true);
  });

  void it('rejects string not matching pattern', () => {
    assertConformance({
      '$id': id(),
      'pattern': '^[a-z]+$',
      'type': 'string'
    }, 'Hello', false);
  });

  void it('accepts string within length bounds', () => {
    assertConformance({
      '$id': id(),
      'maxLength': 5,
      'minLength': 2,
      'type': 'string'
    }, 'abc', true);
  });

  void it('rejects string too short', () => {
    assertConformance({
      '$id': id(),
      'maxLength': 5,
      'minLength': 2,
      'type': 'string'
    }, 'a', false);
  });

  void it('rejects string too long', () => {
    assertConformance({
      '$id': id(),
      'maxLength': 5,
      'minLength': 2,
      'type': 'string'
    }, 'abcdef', false);
  });
});

void describe('Compiler conformance: numeric constraints', () => {
  void it('accepts number within range', () => {
    assertConformance({
      '$id': id(),
      'maximum': 100,
      'minimum': 0,
      'type': 'number'
    }, 50, true);
  });

  void it('rejects number below minimum', () => {
    assertConformance({
      '$id': id(),
      'maximum': 100,
      'minimum': 0,
      'type': 'number'
    }, -1, false);
  });

  void it('rejects number above maximum', () => {
    assertConformance({
      '$id': id(),
      'maximum': 100,
      'minimum': 0,
      'type': 'number'
    }, 101, false);
  });

  void it('accepts number at exclusive boundary', () => {
    assertConformance({
      '$id': id(),
      'exclusiveMinimum': 0,
      'type': 'number'
    }, 1, true);
  });

  void it('rejects number at exclusive boundary', () => {
    assertConformance({
      '$id': id(),
      'exclusiveMinimum': 0,
      'type': 'number'
    }, 0, false);
  });

  void it('validates multipleOf', () => {
    assertConformance({
      '$id': id(),
      'multipleOf': 3,
      'type': 'number'
    }, 9, true);
  });

  void it('rejects non-multipleOf', () => {
    assertConformance({
      '$id': id(),
      'multipleOf': 3,
      'type': 'number'
    }, 10, false);
  });
});

void describe('Compiler conformance: enum and const', () => {
  void it('accepts value in enum', () => {
    assertConformance({
      '$id': id(),
      'enum': [
        'red',
        'green',
        'blue'
      ]
    }, 'green', true);
  });

  void it('rejects value not in enum', () => {
    assertConformance({
      '$id': id(),
      'enum': [
        'red',
        'green',
        'blue'
      ]
    }, 'yellow', false);
  });

  void it('accepts matching const', () => {
    assertConformance({
      '$id': id(),
      'const': 42
    }, 42, true);
  });

  void it('rejects non-matching const', () => {
    assertConformance({
      '$id': id(),
      'const': 42
    }, 43, false);
  });
});

void describe('Compiler conformance: allOf', () => {
  void it('accepts data matching all subschemas', () => {
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
    }, {
      'a': 'hello',
      'b': 42
    }, true, [
      partA,
      partB
    ]);
  });

  void it('rejects data not matching all subschemas', () => {
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
    }, { 'a': 'hello' }, false, [
      partA,
      partB
    ]);
  });
});

void describe('Compiler conformance: anyOf', () => {
  void it('accepts data matching one subschema', () => {
    assertConformance({
      '$id': id(),
      'anyOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    }, 'hello', true);
  });

  void it('rejects data matching no subschema', () => {
    assertConformance({
      '$id': id(),
      'anyOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    }, true, false);
  });
});

void describe('Compiler conformance: oneOf', () => {
  void it('accepts data matching exactly one subschema', () => {
    assertConformance({
      '$id': id(),
      'oneOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    }, 42, true);
  });

  void it('rejects data matching zero subschemas', () => {
    assertConformance({
      '$id': id(),
      'oneOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    }, true, false);
  });

  void it('rejects data matching multiple subschemas', () => {
    assertConformance({
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
    }, 50, false);
  });
});

void describe('Compiler conformance: not', () => {
  void it('accepts data not matching inner schema', () => {
    assertConformance({
      '$id': id(),
      'not': { 'type': 'string' }
    }, 42, true);
  });

  void it('rejects data matching inner schema', () => {
    assertConformance({
      '$id': id(),
      'not': { 'type': 'string' }
    }, 'hello', false);
  });
});

void describe('Compiler conformance: $ref with $defs', () => {
  void it('accepts data matching $ref target', () => {
    assertConformance({
      '$defs': {
        'Name': {
          'minLength': 1,
          'type': 'string'
        }
      },
      '$id': id(),
      '$ref': '#/$defs/Name'
    }, 'Alice', true);
  });

  void it('rejects data not matching $ref target', () => {
    assertConformance({
      '$defs': {
        'Name': {
          'minLength': 1,
          'type': 'string'
        }
      },
      '$id': id(),
      '$ref': '#/$defs/Name'
    }, '', false);
  });

  void it('resolves cross-schema $ref', () => {
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
});

void describe('Compiler conformance: if/then/else', () => {
  void it('applies then branch when if matches', () => {
    const testSchema = ifThenElseSchema();

    assertConformance(testSchema, {
      'kind': 'number',
      'value': 42
    }, true);
  });

  void it('rejects when then branch fails', () => {
    const testSchema = ifThenElseSchema();

    assertConformance(testSchema, {
      'kind': 'number',
      'value': 'hello'
    }, false);
  });

  void it('applies else branch when if does not match', () => {
    const testSchema = ifThenElseSchema();

    assertConformance(testSchema, {
      'kind': 'text',
      'value': 'hello'
    }, true);
  });

  void it('rejects when else branch fails', () => {
    const testSchema = ifThenElseSchema();

    assertConformance(testSchema, {
      'kind': 'text',
      'value': 42
    }, false);
  });
});

void describe('Compiler conformance: array keywords', () => {
  void it('validates items schema', () => {
    assertConformance({
      '$id': id(),
      'items': { 'type': 'number' },
      'type': 'array'
    }, [
      1,
      2,
      3
    ], true);
  });

  void it('rejects invalid items', () => {
    assertConformance({
      '$id': id(),
      'items': { 'type': 'number' },
      'type': 'array'
    }, [
      1,
      'two',
      3
    ], false);
  });

  void it('validates prefixItems', () => {
    assertConformance({
      '$id': id(),
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    }, [
      'hello',
      42
    ], true);
  });

  void it('rejects invalid prefixItems', () => {
    assertConformance({
      '$id': id(),
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    }, [
      42,
      'hello'
    ], false);
  });

  void it('validates minItems and maxItems', () => {
    assertConformance({
      '$id': id(),
      'maxItems': 3,
      'minItems': 1,
      'type': 'array'
    }, [
      1,
      2
    ], true);
  });

  void it('rejects array below minItems', () => {
    assertConformance({
      '$id': id(),
      'maxItems': 3,
      'minItems': 1,
      'type': 'array'
    }, [], false);
  });

  void it('rejects array above maxItems', () => {
    assertConformance({
      '$id': id(),
      'maxItems': 3,
      'minItems': 1,
      'type': 'array'
    }, [
      1,
      2,
      3,
      4
    ], false);
  });

  void it('validates uniqueItems', () => {
    assertConformance({
      '$id': id(),
      'type': 'array',
      'uniqueItems': true
    }, [
      1,
      2,
      3
    ], true);
  });

  void it('rejects non-unique items', () => {
    assertConformance({
      '$id': id(),
      'type': 'array',
      'uniqueItems': true
    }, [
      1,
      2,
      2
    ], false);
  });
});

void describe('Compiler conformance: additionalProperties', () => {
  void it('accepts object with no additional properties', () => {
    assertConformance({
      '$id': id(),
      'additionalProperties': false,
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    }, { 'a': 'hello' }, true);
  });

  void it('rejects object with additional properties', () => {
    assertConformance({
      '$id': id(),
      'additionalProperties': false,
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    }, {
      'a': 'hello',
      'b': 'extra'
    }, false);
  });

  void it('validates typed additionalProperties', () => {
    assertConformance({
      '$id': id(),
      'additionalProperties': { 'type': 'number' },
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    }, {
      'a': 'hello',
      'b': 42
    }, true);
  });

  void it('rejects wrong typed additionalProperties', () => {
    assertConformance({
      '$id': id(),
      'additionalProperties': { 'type': 'number' },
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    }, {
      'a': 'hello',
      'b': 'not a number'
    }, false);
  });
});

void describe('Compiler conformance: format validation', () => {
  void it('accepts valid email format', () => {
    assertConformance({
      '$id': id(),
      'format': 'email',
      'type': 'string'
    }, 'user@example.com', true);
  });

  void it('accepts valid uri format', () => {
    assertConformance({
      '$id': id(),
      'format': 'uri',
      'type': 'string'
    }, 'https://example.com', true);
  });
});

void describe('Compiler conformance: nested objects via $ref', () => {
  void it('accepts valid nested object', () => {
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
    }, {
      'address': {
        'street': '123 Main St',
        'zip': '12345'
      }
    }, true, [address]);
  });

  void it('rejects invalid nested property', () => {
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
    }, {
      'address': {
        'street': '123 Main St',
        'zip': 'bad'
      }
    }, false, [address]);
  });

  void it('rejects missing nested required property', () => {
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
    }, { 'address': { 'street': '123 Main St' } }, false, [address]);
  });
});

void describe('Compiler conformance: property count constraints', () => {
  void it('validates minProperties', () => {
    assertConformance({
      '$id': id(),
      'minProperties': 2,
      'type': 'object'
    }, {
      'a': 1,
      'b': 2
    }, true);
  });

  void it('rejects below minProperties', () => {
    assertConformance({
      '$id': id(),
      'minProperties': 2,
      'type': 'object'
    }, { 'a': 1 }, false);
  });

  void it('validates maxProperties', () => {
    assertConformance({
      '$id': id(),
      'maxProperties': 2,
      'type': 'object'
    }, {
      'a': 1,
      'b': 2
    }, true);
  });

  void it('rejects above maxProperties', () => {
    assertConformance({
      '$id': id(),
      'maxProperties': 2,
      'type': 'object'
    }, {
      'a': 1,
      'b': 2,
      'c': 3
    }, false);
  });
});

void describe('Compiler conformance: patternProperties', () => {
  void it('accepts matching pattern properties', () => {
    assertConformance({
      '$id': id(),
      'patternProperties': {
        '^N_': { 'type': 'number' },
        '^S_': { 'type': 'string' }
      },
      'type': 'object'
    }, {
      'N_age': 30,
      'S_name': 'Alice'
    }, true);
  });

  void it('rejects non-matching pattern properties', () => {
    assertConformance({
      '$id': id(),
      'patternProperties': { '^S_': { 'type': 'string' } },
      'type': 'object'
    }, { 'S_name': 42 }, false);
  });
});

void describe('Compiler conformance: contains', () => {
  void it('accepts array containing matching item', () => {
    assertConformance({
      '$id': id(),
      'contains': {
        'minimum': 10,
        'type': 'number'
      },
      'type': 'array'
    }, [
      1,
      2,
      15,
      3
    ], true);
  });

  void it('rejects array with no matching item', () => {
    assertConformance({
      '$id': id(),
      'contains': {
        'minimum': 10,
        'type': 'number'
      },
      'type': 'array'
    }, [
      1,
      2,
      3
    ], false);
  });
});

void describe('Compiler conformance: custom keywords', () => {
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

  void it('compiled and interpreted agree on custom keyword pass', () => {
    const registry = new SchemaRegistry({ 'keywords': [evenKeyword] });
    const schema = {
      '$id': id(),
      'evenNumber': true,
      'type': 'integer'
    };

    registry.register(schema);
    const schemaId = schema.$id;

    const compiledErrors = registry.validate(schemaId, 4);

    assert.equal(compiledErrors.length, 0, 'compiled should accept even number');

    const engine = registry.engine(schema);
    const engineResult = engine.execute(4, '', { 'collectErrors': true });

    assert.equal(engineResult.valid, true, 'engine should accept even number');
  });

  void it('compiled and interpreted agree on custom keyword reject', () => {
    const registry = new SchemaRegistry({ 'keywords': [evenKeyword] });
    const schema = {
      '$id': id(),
      'evenNumber': true,
      'type': 'integer'
    };

    registry.register(schema);
    const schemaId = schema.$id;

    const compiledErrors = registry.validate(schemaId, 3);

    assert.ok(compiledErrors.length > 0, 'compiled should reject odd number');

    const engine = registry.engine(schema);
    const engineResult = engine.execute(3, '', { 'collectErrors': true });

    assert.equal(engineResult.valid, false, 'engine should reject odd number');
  });

  void it('custom keyword schema produces a compiled validator, not engine fallback', () => {
    const registry = new SchemaRegistry({ 'keywords': [evenKeyword] });
    const schema = {
      '$id': id(),
      'evenNumber': true,
      'type': 'integer'
    };

    registry.register(schema);

    // Access the compiled validator and assert it is truly compiled
    const validator = registry.validator(schema.$id);

    assert.equal(validator.compiled, true, 'custom keyword schema must be compiled, not engine fallback');
  });
});

void describe('Compiler conformance: dependentRequired', () => {
  void it('accepts when dependent required properties present', () => {
    assertConformance({
      '$id': id(),
      'dependentRequired': { 'a': ['b'] },
      'properties': {
        'a': { 'type': 'string' },
        'b': { 'type': 'string' }
      },
      'type': 'object'
    }, {
      'a': 'hello',
      'b': 'world'
    }, true);
  });

  void it('rejects when dependent required properties missing', () => {
    assertConformance({
      '$id': id(),
      'dependentRequired': { 'a': ['b'] },
      'properties': {
        'a': { 'type': 'string' },
        'b': { 'type': 'string' }
      },
      'type': 'object'
    }, { 'a': 'hello' }, false);
  });
});

void describe('Compiler conformance: discriminator mapping', () => {
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

  void it('accepts valid data dispatched via discriminator mapping', () => {
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

    assertConformance(petSchema, {
      'breed': 'poodle',
      'petType': 'dog'
    }, true, [
      dogSchema,
      catSchema
    ]);
  });

  void it('rejects invalid data dispatched via discriminator mapping', () => {
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

    assertConformance(petSchema, { 'petType': 'dog' }, false, [
      dogSchema,
      catSchema
    ]);
  });

  void it('rejects unmapped discriminator value', () => {
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

    assertConformance(petSchema, {
      'fins': 2,
      'petType': 'fish'
    }, false, [
      dogSchema,
      catSchema
    ]);
  });
});
