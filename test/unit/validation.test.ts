// Merged from: conditionalValidation.test.ts, discriminatorValidation.test.ts, containsValidation.test.ts, patternPropertiesValidation.test.ts, validationEdgeCases.test.ts, validationErrorsViews.test.ts, arrays.test.ts, objects.test.ts, scalars.test.ts, compositionExec.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// Validation type aliases (CheckFnType, ValidateWithErrorsFnType, ValidationErrorType) are internal contracts for the exec primitives below.
import type {
  CheckFnType, ValidateWithErrorsFnType, ValidationErrorType
} from '../../src/types/Validation.js';
import {
  describe, it
} from 'node:test';
import {
  BaseError, InstantiationError, JsonTology, ValidationErrors
} from '../../src/index.js';
// Internal exec classes (Arrays/Composition/Objects/Scalars) are validation runtime
// primitives invoked from the compiler — they have no public surface; the dedicated
// validateBounds / validateProperties / validateConst tests below exercise them directly.
import { Arrays } from '../../src/modules/validation/exec/Arrays.js';
import { Composition } from '../../src/modules/validation/exec/Composition.js';
import { Objects } from '../../src/modules/validation/exec/Objects.js';
import { Scalars } from '../../src/modules/validation/exec/Scalars.js';

// ===========================================================================
// Source: conditionalValidation.test.ts
// ===========================================================================
{
  function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
    Reflect.set(target, key, value);

    return target;
  }

  // eslint-disable-next-line @stylistic/max-len
  function makeThenElseSchema(id: string, ifSchema: unknown, thenSchema: unknown, elseSchema?: unknown): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      '$id': id,
      'if': ifSchema,
      'type': 'object'
    };

    setSchemaKey(schema, 'then', thenSchema);
    if (elseSchema !== undefined) {
      setSchemaKey(schema, 'else', elseSchema);
    }

    return schema;
  }

  // ---------------------------------------------------------------------------
  // if/then/else
  // ---------------------------------------------------------------------------

  void describe('if/then/else validation', () => {
    void it('GBU: then branch, else branch, and no-else branch scenarios', () => {
      // then branch: if condition matches
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/ITE1';

        registry.set(makeThenElseSchema(schemaId, { 'properties': { 'kind': { 'const': 'person' } } }, {
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name']
        }));

        for (const {
          data, name, valid
        } of [
            {
              'data': {
                'kind': 'person',
                'name': 'Alice'
              },
              'name': 'if matches (kind=person) and then satisfied',
              'valid': true
            },
            {
              'data': { 'kind': 'person' },
              'name': 'if matches (kind=person) but then not satisfied — missing name',
              'valid': false
            },
            {
              'data': null,
              'name': 'edge: null data for if/then schema',
              'valid': false
            },
            {
              'data': {},
              'name': 'edge: empty object — if properties vacuously pass so then enforced — fails',
              'valid': false
            },
            {
              'data': {
                'kind': 'person',
                'name': ''
              },
              'name': 'edge: empty string satisfies type string in then branch',
              'valid': true
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // else branch: if condition does not match, else required
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/ITE2';

        registry.set(makeThenElseSchema(schemaId, { 'properties': { 'kind': { 'const': 'org' } } }, {
          'properties': { 'orgName': { 'type': 'string' } },
          'required': ['orgName']
        }, {
          'properties': { 'label': { 'type': 'string' } },
          'required': ['label']
        }));

        for (const {
          data, name, valid
        } of [
            {
              'data': {
                'kind': 'person',
                'label': 'Alice'
              },
              'name': 'if does not match — else requires label — satisfied',
              'valid': true
            },
            {
              'data': { 'kind': 'person' },
              'name': 'if does not match — else requires label — missing',
              'valid': false
            },
            {
              'data': null,
              'name': 'edge: null data for if/then/else schema',
              'valid': false
            },
            {
              'data': {
                'kind': 'other',
                'label': ''
              },
              'name': 'edge: empty string label satisfies else branch required string',
              'valid': true
            },
            {
              'data': {
                'kind': 'org',
                'orgName': 'Acme'
              },
              'name': 'edge: data matching if branch with then satisfied',
              'valid': true
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // no else branch: if does not match, no else — passes
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/ITE3';

        registry.set(makeThenElseSchema(schemaId, { 'properties': { 'kind': { 'const': 'special' } } }, {
          'properties': { 'code': { 'type': 'number' } },
          'required': ['code']
        }));

        for (const {
          data, name, valid
        } of [
            {
              'data': { 'kind': 'normal' },
              'name': 'if does not match, no else — passes',
              'valid': true
            },
            {
              'data': null,
              'name': 'edge: null data with no else branch',
              'valid': false
            },
            {
              'data': {},
              'name': 'edge: empty object — if properties vacuously pass, then requires code — fails',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // allOf
  // ---------------------------------------------------------------------------

  void describe('allOf validation', () => {
    void it('GBU: allOf required subschemas, overlapping numeric constraints', () => {
      // all subschemas must match
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/AllOf1';

        registry.set({
          '$id': schemaId,
          'allOf': [
            {
              'properties': { 'name': { 'type': 'string' } },
              'required': ['name']
            },
            {
              'properties': { 'age': { 'type': 'number' } },
              'required': ['age']
            }
          ],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of [
            {
              'data': {
                'age': 30,
                'name': 'Alice'
              },
              'name': 'both name and age present',
              'valid': true
            },
            {
              'data': { 'name': 'Alice' },
              'name': 'missing age',
              'valid': false
            },
            {
              'data': { 'age': 30 },
              'name': 'missing name',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // overlapping numeric constraints
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/AllOfOverlap';

        registry.set({
          '$id': schemaId,
          'allOf': [
            {
              'properties': {
                'x': {
                  'minimum': 0,
                  'type': 'number'
                }
              }
            },
            {
              'properties': {
                'x': {
                  'maximum': 100,
                  'type': 'number'
                }
              }
            }
          ],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of [
            {
              'data': { 'x': 50 },
              'name': 'x within both constraints',
              'valid': true
            },
            {
              'data': { 'x': -1 },
              'name': 'x below minimum',
              'valid': false
            },
            {
              'data': { 'x': 101 },
              'name': 'x above maximum',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // anyOf / oneOf / not — GBU table
  // ---------------------------------------------------------------------------

  void describe('anyOf, oneOf, not validation', () => {
    void it('GBU: anyOf branch-match, oneOf exclusive-match, not negation table-driven', () => {
      // anyOf: any branch
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/AnyOf1';

        registry.set({
          '$id': schemaId,
          'properties': {
            'val': {
              'anyOf': [
                { 'type': 'string' },
                { 'type': 'number' }
              ]
            }
          },
          'required': ['val'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of [
            {
              'data': { 'val': 'hello' },
              'name': 'string matches first branch',
              'valid': true
            },
            {
              'data': { 'val': 42 },
              'name': 'number matches second branch',
              'valid': true
            },
            {
              'data': { 'val': true },
              'name': 'boolean matches neither branch',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // oneOf: exactly one branch
      {
        // enableStrictGraph: false — synthetic oneOf branches with inline constraints
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });
        const schemaId = 'https://cond.test/OneOf1';

        registry.set({
          '$id': schemaId,
          'properties': {
            'val': {
              'oneOf': [
                {
                  'maximum': 10,
                  'type': 'number'
                },
                {
                  'minimum': 20,
                  'type': 'number'
                }
              ]
            }
          },
          'required': ['val'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of [
            {
              'data': { 'val': 5 },
              'name': 'matches first branch only (val <= 10)',
              'valid': true
            },
            {
              'data': { 'val': 25 },
              'name': 'matches second branch only (val >= 20)',
              'valid': true
            },
            {
              'data': { 'val': 15 },
              'name': 'matches neither (between 10 and 20)',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // not: negation
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/Not1';

        registry.set({
          '$id': schemaId,
          'properties': {
            'val': {
              'not': { 'type': 'string' },
              'type': [
                'string',
                'number'
              ]
            }
          },
          'required': ['val'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of [
            {
              'data': { 'val': 42 },
              'name': 'number does not match negated string schema',
              'valid': true
            },
            {
              'data': { 'val': 'hello' },
              'name': 'string matches negated schema — rejected',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // dependentRequired + dependentSchemas — GBU table
  // ---------------------------------------------------------------------------

  void describe('dependentRequired and dependentSchemas validation', () => {
    void it('GBU: dependentRequired mutual requirement, dependentSchemas trigger constraint', () => {
      // dependentRequired: mutual dependency
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/DepReq1';

        registry.set({
          '$id': schemaId,
          'dependentRequired': {
            'email': ['name'],
            'name': ['email']
          },
          'properties': {
            'email': { 'type': 'string' },
            'name': { 'type': 'string' }
          },
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of [
            {
              'data': {
                'email': 'a@b.c',
                'name': 'Alice'
              },
              'name': 'both present — valid',
              'valid': true
            },
            {
              'data': {},
              'name': 'neither present — valid',
              'valid': true
            },
            {
              'data': { 'name': 'Alice' },
              'name': 'name without email — invalid',
              'valid': false
            },
            {
              'data': { 'email': 'a@b.c' },
              'name': 'email without name — invalid',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // dependentSchemas: trigger activates schema constraint
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://cond.test/DepSchema1';

        registry.set({
          '$id': schemaId,
          'dependentSchemas': {
            'billing': {
              'properties': { 'billingAddress': { 'type': 'string' } },
              'required': ['billingAddress']
            }
          },
          'properties': {
            'billing': { 'type': 'boolean' },
            'billingAddress': { 'type': 'string' }
          },
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of [
            {
              'data': {},
              'name': 'billing absent — no dependent constraint',
              'valid': true
            },
            {
              'data': {
                'billing': true,
                'billingAddress': '123 Main St'
              },
              'name': 'billing present — billingAddress provided',
              'valid': true
            },
            {
              'data': { 'billing': true },
              'name': 'billing present — billingAddress missing',
              'valid': false
            }
          ]) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // uniqueItems
  // ---------------------------------------------------------------------------

  void describe('uniqueItems validation', () => {
    void it('validates uniqueItems scenarios', () => {
      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'schema': Record<string, unknown>;
        'valid': boolean }> = [
        {
          'data': {
            'tags': [
              'a',
              'b',
              'c'
            ]
          },
          'name': 'unique items — valid',
          'schema': {
            '$id': 'https://cond.test/Unique1',
            'properties': {
              'tags': {
                'items': { 'type': 'string' },
                'type': 'array',
                'uniqueItems': true
              }
            },
            'required': ['tags'],
            'type': 'object'
          },
          'valid': true
        },
        {
          'data': {
            'tags': [
              'a',
              'b',
              'a'
            ]
          },
          'name': 'duplicate items — rejected',
          'schema': {
            '$id': 'https://cond.test/Unique1b',
            'properties': {
              'tags': {
                'items': { 'type': 'string' },
                'type': 'array',
                'uniqueItems': true
              }
            },
            'required': ['tags'],
            'type': 'object'
          },
          'valid': false
        },
        {
          'data': { 'list': [] },
          'name': 'empty array with uniqueItems — valid',
          'schema': {
            '$id': 'https://cond.test/Unique2',
            'properties': {
              'list': {
                'type': 'array',
                'uniqueItems': true
              }
            },
            'required': ['list'],
            'type': 'object'
          },
          'valid': true
        }
      ];

      for (const {
        data, name, schema, valid
      } of scenarios) {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        registry.set(schema);
        assert.equal(registry.validate(schema.$id as string, data).length === 0, valid, name);
      }
    });
  });
}

// ===========================================================================
// Source: discriminatorValidation.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// oneOf edge cases
// ---------------------------------------------------------------------------

  void describe('oneOf edge cases', () => {
    const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

    registry.set({
      '$id': 'https://disc.test/BranchA',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/BranchB',
      'properties': {
        'x': { 'type': 'number' },
        'y': { 'type': 'number' }
      },
      'required': ['x'],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/OverlapOneOf',
      'oneOf': [
        { '$ref': 'https://disc.test/BranchA' },
        { '$ref': 'https://disc.test/BranchB' }
      ],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/EmptyOneOf',
      'oneOf': [],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/BoolOneOf',
      'oneOf': [
        true,
        false
      ]
    });

    registry.set({
      '$id': 'https://disc.test/StringObj',
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/IdenticalOneOf',
      'oneOf': [
        { '$ref': 'https://disc.test/StringObj' },
        { '$ref': 'https://disc.test/StringObj' }
      ],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'schema': string;
      'valid': boolean }> = [
      {
        'data': { 'x': 1 },
        'name': 'rejects value matching both oneOf branches (overlapping schemas)',
        'schema': 'https://disc.test/OverlapOneOf',
        'valid': false
      },
      {
        'data': { 'any': 'value' },
        'name': 'treats empty oneOf as vacuously true',
        'schema': 'https://disc.test/EmptyOneOf',
        'valid': true
      },
      {
        'data': { 'key': 'value' },
        'name': 'validates oneOf with boolean schemas (true+false yields exactly one match)',
        'schema': 'https://disc.test/BoolOneOf',
        'valid': true
      },
      {
        'data': { 'a': 'hello' },
        'name': 'rejects value when oneOf has identical $ref schemas (matches both)',
        'schema': 'https://disc.test/IdenticalOneOf',
        'valid': false
      }
    ];

    void it('oneOf edge cases: overlapping, empty, boolean schemas, identical refs', () => {
      for (const {
        data, name, schema, valid
      } of scenarios) {
        const errors = registry.validate(schema, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // anyOf edge cases
  // ---------------------------------------------------------------------------

  void describe('anyOf edge cases', () => {
    const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

    registry.set({
      '$id': 'https://disc.test/AnyBranchX',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/AnyBranchY',
      'properties': { 'y': { 'type': 'number' } },
      'required': ['y'],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/NoMatchAnyOf',
      'anyOf': [
        { '$ref': 'https://disc.test/AnyBranchX' },
        { '$ref': 'https://disc.test/AnyBranchY' }
      ],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/AllBranchReqX',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/AllBranchOptX',
      'properties': { 'x': { 'type': 'number' } },
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/AllMatchAnyOf',
      'anyOf': [
        { '$ref': 'https://disc.test/AllBranchReqX' },
        { '$ref': 'https://disc.test/AllBranchOptX' }
      ],
      'type': 'object'
    });

    registry.set({
      '$id': 'https://disc.test/EmptyAnyOf',
      'anyOf': [],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'schema': string;
      'valid': boolean }> = [
      {
        'data': { 'z': 'nope' },
        'name': 'rejects value that matches no anyOf branch',
        'schema': 'https://disc.test/NoMatchAnyOf',
        'valid': false
      },
      {
        'data': { 'x': 42 },
        'name': 'accepts value that matches all anyOf branches',
        'schema': 'https://disc.test/AllMatchAnyOf',
        'valid': true
      },
      {
        'data': { 'any': 'value' },
        'name': 'treats empty anyOf as vacuously true',
        'schema': 'https://disc.test/EmptyAnyOf',
        'valid': true
      }
    ];

    void it('anyOf edge cases: no-match, all-match, empty anyOf', () => {
      for (const {
        data, name, schema, valid
      } of scenarios) {
        const errors = registry.validate(schema, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Discriminated union patterns (const-based discriminator via $ref)
  // ---------------------------------------------------------------------------

  void describe('Discriminated union validation', () => {
    const shapeRegistry = JsonTology.create({ 'baseIRI': 'urn:test:' });

    shapeRegistry.set({
      '$id': 'https://disc.test/Circle',
      'properties': {
        'kind': { 'const': 'circle' },
        'radius': { 'type': 'number' }
      },
      'required': [
        'kind',
        'radius'
      ],
      'type': 'object'
    });

    shapeRegistry.set({
      '$id': 'https://disc.test/Square',
      'properties': {
        'kind': { 'const': 'square' },
        'side': { 'type': 'number' }
      },
      'required': [
        'kind',
        'side'
      ],
      'type': 'object'
    });

    shapeRegistry.set({
      '$id': 'https://disc.test/Shape',
      'oneOf': [
        { '$ref': 'https://disc.test/Circle' },
        { '$ref': 'https://disc.test/Square' }
      ],
      'type': 'object'
    });

    const shapeScenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'kind': 'circle',
          'radius': 5
        },
        'name': 'Shape: valid circle',
        'valid': true
      },
      {
        'data': {
          'kind': 'square',
          'side': 10
        },
        'name': 'Shape: valid square',
        'valid': true
      },
      {
        'data': { 'radius': 5 },
        'name': 'Shape: rejects when discriminator property is missing',
        'valid': false
      },
      {
        'data': {
          'kind': 'triangle',
          'sides': 3
        },
        'name': 'Shape: rejects when discriminator value matches no branch',
        'valid': false
      },
      {
        'data': {
          'kind': 42,
          'radius': 5
        },
        'name': 'Shape: rejects when discriminator value is a number',
        'valid': false
      },
      {
        'data': {
          'kind': null,
          'radius': 5
        },
        'name': 'Shape: rejects when discriminator value is null',
        'valid': false
      },
      {
        'data': {},
        'name': 'Shape: edge: empty object — missing discriminator key entirely',
        'valid': false
      },
      {
        'data': null,
        'name': 'Shape: edge: null data at top level',
        'valid': false
      },
      {
        'data': {
          'kind': '',
          'radius': 5
        },
        'name': 'Shape: unhappy: discriminator value is empty string — matches no branch',
        'valid': false
      },
      {
        'data': {
          'kind': false,
          'radius': 5
        },
        'name': 'Shape: unhappy: discriminator value is boolean false',
        'valid': false
      }
    ];

    void it('Shape discriminated union: valid/invalid circle+square+edge cases', () => {
      for (const {
        data, name, valid
      } of shapeScenarios) {
        const errors = shapeRegistry.validate('https://disc.test/Shape', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    const eventRegistry = JsonTology.create({ 'baseIRI': 'urn:test:' });

    eventRegistry.set({
      '$id': 'https://disc.test/MessageEvent',
      'properties': {
        'payload': { 'type': 'string' },
        'type': { 'const': 'message' }
      },
      'required': [
        'type',
        'payload'
      ],
      'type': 'object'
    });

    eventRegistry.set({
      '$id': 'https://disc.test/ErrorEvent',
      'properties': {
        'code': { 'type': 'number' },
        'type': { 'const': 'error' }
      },
      'required': [
        'type',
        'code'
      ],
      'type': 'object'
    });

    eventRegistry.set({
      '$id': 'https://disc.test/LogEvent',
      'properties': {
        'level': {
          'enum': [
            'info',
            'warn',
            'error'
          ]
        },
        'type': { 'const': 'log' }
      },
      'required': [
        'type',
        'level'
      ],
      'type': 'object'
    });

    eventRegistry.set({
      '$id': 'https://disc.test/Event',
      'oneOf': [
        { '$ref': 'https://disc.test/MessageEvent' },
        { '$ref': 'https://disc.test/ErrorEvent' },
        { '$ref': 'https://disc.test/LogEvent' }
      ],
      'type': 'object'
    });

    const eventScenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'payload': 'hello',
          'type': 'message'
        },
        'name': 'Event: valid message event',
        'valid': true
      },
      {
        'data': {
          'code': 404,
          'type': 'error'
        },
        'name': 'Event: valid error event',
        'valid': true
      },
      {
        'data': {
          'level': 'warn',
          'type': 'log'
        },
        'name': 'Event: valid log event',
        'valid': true
      },
      {
        'data': { 'type': 'message' },
        'name': 'Event: rejects when branch-specific required field is missing',
        'valid': false
      },
      {
        'data': {
          'code': 'not-a-number',
          'type': 'error'
        },
        'name': 'Event: rejects when branch-specific field has wrong type',
        'valid': false
      },
      {
        'data': {
          'level': 'debug',
          'type': 'log'
        },
        'name': 'Event: rejects when branch-specific enum value is invalid',
        'valid': false
      }
    ];

    void it('Event discriminated union: valid/invalid message+error+log events', () => {
      for (const {
        data, name, valid
      } of eventScenarios) {
        const errors = eventRegistry.validate('https://disc.test/Event', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });
}

// ===========================================================================
// Source: containsValidation.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Basic contains
// ---------------------------------------------------------------------------

  void describe('contains validation', () => {
    void it('validates basic contains scenarios', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/Basic';

      registry.set({
        '$id': schemaId,
        'properties': {
          'values': {
            'contains': { 'type': 'number' },
            'type': 'array'
          }
        },
        'required': ['values'],
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'values': [
              'a',
              'b',
              42
            ]
          },
          'name': 'array with a matching number item',
          'valid': true
        },
        {
          'data': {
            'values': [
              1,
              2,
              3
            ]
          },
          'name': 'all items match',
          'valid': true
        },
        {
          'data': {
            'values': [
              'a',
              'b',
              'c'
            ]
          },
          'name': 'no items match',
          'valid': false
        },
        {
          'data': { 'values': [] },
          'name': 'empty array has no items to match',
          'valid': false
        },
        {
          'data': {
            'values': [
              null,
              null,
              null
            ]
          },
          'name': 'edge: array of nulls — none match type number',
          'valid': false
        },
        {
          'data': { 'values': [42] },
          'name': 'edge: single-element array with matching item',
          'valid': true
        },
        {
          'data': { 'values': ['only'] },
          'name': 'edge: single-element array with non-matching item',
          'valid': false
        },
        {
          'data': {
            'values': [
              undefined,
              Number.NaN,
              Infinity
            ]
          },
          'name': 'unhappy: array with undefined, NaN, Infinity — none are finite numbers',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // contains with true/false schemas
  // ---------------------------------------------------------------------------

  void describe('contains with boolean schemas', () => {
    void it('validates boolean contains scenarios', () => {
      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'schema': Record<string, unknown>;
        'valid': boolean }> = [
        {
          'data': {
            'values': [
              1,
              'a',
              null,
              false
            ]
          },
          'name': 'contains true — any non-empty array passes',
          'schema': {
            '$id': 'https://contains.test/TrueSchema',
            'properties': {
              'values': {
                'contains': true,
                'type': 'array'
              }
            },
            'required': ['values'],
            'type': 'object'
          },
          'valid': true
        },
        {
          'data': {
            'values': [
              1,
              2,
              3
            ]
          },
          'name': 'contains false — no item can match',
          'schema': {
            '$id': 'https://contains.test/FalseSchema',
            'properties': {
              'values': {
                'contains': false,
                'type': 'array'
              }
            },
            'required': ['values'],
            'type': 'object'
          },
          'valid': false
        },
        {
          'data': {
            'values': [
              1,
              2,
              3
            ]
          },
          'name': 'contains false with minContains 0 passes',
          'schema': {
            '$id': 'https://contains.test/FalseMinZero',
            'properties': {
              'values': {
                'contains': false,
                'minContains': 0,
                'type': 'array'
              }
            },
            'required': ['values'],
            'type': 'object'
          },
          'valid': true
        }
      ];

      for (const {
        data, name, schema, valid
      } of scenarios) {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        registry.set(schema);
        assert.equal(registry.validate(schema.$id as string, data).length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // minContains
  // ---------------------------------------------------------------------------

  void describe('minContains validation', () => {
    void it('GBU: minContains=0 (optional), minContains=2 (bounded), minContains=5 exceeds length', () => {
      // Good: minContains=0 — array without matches is still valid
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://contains.test/MinZero';

        registry.set({
          '$id': schemaId,
          'properties': {
            'values': {
              'contains': { 'type': 'number' },
              'minContains': 0,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        });

        const zeroScenarios: Array<{ 'data': unknown;
          'name': string;
          'valid': boolean }> = [
          {
            'data': {
              'values': [
                'a',
                'b',
                'c'
              ]
            },
            'name': 'no matching items — valid because minContains is 0',
            'valid': true
          },
          {
            'data': { 'values': [] },
            'name': 'empty array — valid because minContains is 0',
            'valid': true
          }
        ];

        for (const {
          data, name, valid
        } of zeroScenarios) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // Good: minContains=2 — requires at least 2 matching items
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://contains.test/MinTwo';

        registry.set({
          '$id': schemaId,
          'properties': {
            'values': {
              'contains': { 'type': 'number' },
              'minContains': 2,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        });

        const twoScenarios: Array<{ 'data': unknown;
          'name': string;
          'valid': boolean }> = [
          {
            'data': {
              'values': [
                'a',
                1,
                'b',
                2
              ]
            },
            'name': 'two matching items',
            'valid': true
          },
          {
            'data': {
              'values': [
                1,
                2,
                3
              ]
            },
            'name': 'three matching items',
            'valid': true
          },
          {
            'data': {
              'values': [
                'a',
                1,
                'b'
              ]
            },
            'name': 'only one matching item — fails',
            'valid': false
          },
          {
            'data': {
              'values': [
                'a',
                'b'
              ]
            },
            'name': 'no matching items — fails',
            'valid': false
          }
        ];

        for (const {
          data, name, valid
        } of twoScenarios) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // Bad: minContains=5 exceeds array length — always fails
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://contains.test/MinExceedsLength';

        registry.set({
          '$id': schemaId,
          'properties': {
            'values': {
              'contains': { 'type': 'number' },
              'minContains': 5,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        });

        const exceedsScenarios: Array<{ 'data': unknown;
          'name': string;
          'valid': boolean }> = [
          {
            'data': {
              'values': [
                1,
                2,
                3
              ]
            },
            'name': 'array has only 3 items, cannot satisfy minContains=5',
            'valid': false
          },
          {
            'data': {
              'values': [
                1,
                2
              ]
            },
            'name': 'even with all matching, not enough items',
            'valid': false
          }
        ];

        for (const {
          data, name, valid
        } of exceedsScenarios) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // maxContains
  // ---------------------------------------------------------------------------

  void describe('maxContains validation', () => {
    void it('GBU: maxContains=1 (allows exactly one), maxContains=0 (forbids any match)', () => {
      // Good: maxContains=1 — at most 1 matching item
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://contains.test/MaxOne';

        registry.set({
          '$id': schemaId,
          'properties': {
            'values': {
              'contains': { 'type': 'number' },
              'maxContains': 1,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        });

        const oneScenarios: Array<{ 'data': unknown;
          'name': string;
          'valid': boolean }> = [
          {
            'data': {
              'values': [
                'a',
                1,
                'b'
              ]
            },
            'name': 'exactly one matching item',
            'valid': true
          },
          {
            'data': {
              'values': [
                1,
                2,
                'a'
              ]
            },
            'name': 'two matching items — exceeds maxContains',
            'valid': false
          }
        ];

        for (const {
          data, name, valid
        } of oneScenarios) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // Bad: maxContains=0 (combined with minContains=0) — no matches allowed
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://contains.test/MaxZero';

        registry.set({
          '$id': schemaId,
          'properties': {
            'values': {
              'contains': { 'type': 'number' },
              'maxContains': 0,
              'minContains': 0,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        });

        const zeroScenarios: Array<{ 'data': unknown;
          'name': string;
          'valid': boolean }> = [
          {
            'data': {
              'values': [
                'a',
                'b',
                'c'
              ]
            },
            'name': 'no matching items — valid',
            'valid': true
          },
          {
            'data': {
              'values': [
                'a',
                1,
                'b'
              ]
            },
            'name': 'one matching item — exceeds maxContains=0',
            'valid': false
          }
        ];

        for (const {
          data, name, valid
        } of zeroScenarios) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // minContains + maxContains range
  // ---------------------------------------------------------------------------

  void describe('minContains and maxContains range', () => {
    void it('GBU: [2,4] range valid, below min fails, above max fails; impossible [min>max] always fails', () => {
      // Good: minContains=2 maxContains=4 range
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://contains.test/Range';

        registry.set({
          '$id': schemaId,
          'properties': {
            'values': {
              'contains': { 'type': 'number' },
              'maxContains': 4,
              'minContains': 2,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        });

        const rangeScenarios: Array<{ 'data': unknown;
          'name': string;
          'valid': boolean }> = [
          {
            'data': {
              'values': [
                'a',
                1,
                'b',
                2
              ]
            },
            'name': 'exactly 2 matching items (lower bound)',
            'valid': true
          },
          {
            'data': {
              'values': [
                1,
                2,
                3,
                'a'
              ]
            },
            'name': 'exactly 3 matching items (mid range)',
            'valid': true
          },
          {
            'data': {
              'values': [
                1,
                2,
                3,
                4
              ]
            },
            'name': 'exactly 4 matching items (upper bound)',
            'valid': true
          },
          {
            'data': {
              'values': [
                'a',
                1,
                'b',
                'c'
              ]
            },
            'name': 'only 1 matching item — below minContains',
            'valid': false
          },
          {
            'data': {
              'values': [
                1,
                2,
                3,
                4,
                5
              ]
            },
            'name': '5 matching items — exceeds maxContains',
            'valid': false
          }
        ];

        for (const {
          data, name, valid
        } of rangeScenarios) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }

      // Ugly: impossible constraint maxContains < minContains — always fails
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
        const schemaId = 'https://contains.test/Impossible';

        registry.set({
          '$id': schemaId,
          'properties': {
            'values': {
              'contains': { 'type': 'number' },
              'maxContains': 1,
              'minContains': 3,
              'type': 'array'
            }
          },
          'required': ['values'],
          'type': 'object'
        });

        const impossibleScenarios: Array<{ 'data': unknown;
          'name': string;
          'valid': boolean }> = [
          {
            'data': {
              'values': [
                1,
                2,
                3
              ]
            },
            'name': 'cannot satisfy min=3 and max=1 with 3 numbers',
            'valid': false
          },
          {
            'data': { 'values': [1] },
            'name': 'cannot satisfy min=3 and max=1 with 1 number',
            'valid': false
          },
          {
            'data': {
              'values': [
                'a',
                'b'
              ]
            },
            'name': 'cannot satisfy min=3 and max=1 with no numbers',
            'valid': false
          }
        ];

        for (const {
          data, name, valid
        } of impossibleScenarios) {
          assert.equal(registry.validate(schemaId, data).length === 0, valid, name);
        }
      }
    });
  });
}

// ===========================================================================
// Source: patternPropertiesValidation.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Basic patternProperties
// ---------------------------------------------------------------------------

  void describe('patternProperties basic matching', () => {
    void it('validates single pattern against declared schema', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/BasicString',
        'patternProperties': { '^S_': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': { 'S_name': 'Alice' },
          'name': 'single matching key with valid type',
          'valid': true
        },
        {
          'data': {
            'S_a': 'x',
            'S_b': 'y'
          },
          'name': 'multiple matching keys with valid type',
          'valid': true
        },
        {
          'data': { 'S_count': 42 },
          'name': 'matching key with wrong type',
          'valid': false
        },
        {
          'data': {},
          'name': 'edge: empty object — no keys to match patterns',
          'valid': true
        },
        {
          'data': { '': 'value' },
          'name': 'edge: empty string key — does not match ^S_ pattern',
          'valid': true
        },
        {
          'data': { 'S_': 'val' },
          'name': 'edge: key is exactly the pattern prefix with empty suffix',
          'valid': true
        },
        {
          'data': { 'S_name': null },
          'name': 'unhappy: matching key with null value — not a string',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/BasicString', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates multiple distinct patterns independently', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/MultiPattern',
        'patternProperties': {
          '^I_': { 'type': 'integer' },
          '^S_': { 'type': 'string' }
        },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'I_count': 5,
            'S_name': 'Alice'
          },
          'name': 'both patterns satisfied',
          'valid': true
        },
        {
          'data': { 'S_name': 42 },
          'name': 'S_ key with wrong type (number instead of string)',
          'valid': false
        },
        {
          'data': { 'I_count': 'five' },
          'name': 'I_ key with wrong type (string instead of integer)',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/MultiPattern', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('allows keys that match no pattern when additionalProperties is not restricted', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/Unrestricted',
        'patternProperties': { '^S_': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [{
        'data': { 'other': 123 },
        'name': 'non-matching key passes when additionalProperties unrestricted',
        'valid': true
      }];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/Unrestricted', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Overlapping patterns
  // ---------------------------------------------------------------------------

  void describe('patternProperties with overlapping patterns', () => {
    void it('applies all matching pattern schemas to a single property', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/Overlap',
        'patternProperties': {
          '^S_': { 'type': 'string' },
          '_name$': { 'minLength': 3 }
        },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': { 'S_name': 'Alice' },
          'name': 'S_name matches both patterns, satisfies both',
          'valid': true
        },
        {
          'data': { 'S_name': 'Al' },
          'name': 'S_name matches both patterns, too short for _name$',
          'valid': false
        },
        {
          'data': { 'X_name': 'Bob' },
          'name': 'X_name matches only _name$, satisfies minLength',
          'valid': true
        },
        {
          'data': { 'X_name': 'Bo' },
          'name': 'X_name matches only _name$, too short',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/Overlap', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // patternProperties + properties on same key
  // ---------------------------------------------------------------------------

  void describe('patternProperties combined with properties on the same key', () => {
    void it('enforces both explicit property and pattern type constraints', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/PropAndPattern',
        'patternProperties': { '^S_': { 'type': 'string' } },
        'properties': { 'S_name': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': { 'S_name': 'Alice' },
          'name': 'S_name is string, satisfies both properties and pattern',
          'valid': true
        },
        {
          'data': { 'S_name': 99 },
          'name': 'S_name is not string, fails both properties and pattern',
          'valid': false
        },
        {
          'data': { 'S_other': 42 },
          'name': 'S_other matches pattern but wrong type',
          'valid': false
        },
        {
          'data': { 'S_other': 'ok' },
          'name': 'S_other matches pattern with correct type',
          'valid': true
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/PropAndPattern', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // patternProperties + additionalProperties schema
  // ---------------------------------------------------------------------------

  void describe('patternProperties with additionalProperties schema', () => {
    void it('applies additionalProperties schema to keys not matching any pattern', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/AdditionalSchema',
        'additionalProperties': { 'type': 'boolean' },
        'patternProperties': { '^S_': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': { 'S_val': 'ok' },
          'name': 'pattern-matched key with valid type',
          'valid': true
        },
        {
          'data': { 'flag': true },
          'name': 'unmatched key satisfies additionalProperties boolean',
          'valid': true
        },
        {
          'data': { 'flag': 'not-a-boolean' },
          'name': 'unmatched key violates additionalProperties boolean',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/AdditionalSchema', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('allows explicit properties alongside pattern-matched properties', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/ExplicitAndPattern',
        'additionalProperties': { 'type': 'boolean' },
        'patternProperties': { '^x_': { 'type': 'number' } },
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'name': 'Alice',
            'x_score': 10
          },
          'name': 'explicit property + pattern-matched key both valid',
          'valid': true
        },
        {
          'data': {
            'name': 'Alice',
            'unknown': 'not-bool'
          },
          'name': 'unknown key fails additionalProperties boolean',
          'valid': false
        },
        {
          'data': {
            'extra': true,
            'name': 'Alice'
          },
          'name': 'unknown key satisfies additionalProperties boolean',
          'valid': true
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/ExplicitAndPattern', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // patternProperties + additionalProperties=false
  // ---------------------------------------------------------------------------

  void describe('patternProperties with additionalProperties false', () => {
    void it('allows only keys matching patterns when additionalProperties is false', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/PatternFalse',
        'additionalProperties': false,
        'patternProperties': {
          '^I_': { 'type': 'integer' },
          '^S_': { 'type': 'string' }
        },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'I_count': 1,
            'S_name': 'ok'
          },
          'name': 'keys matching patterns are allowed',
          'valid': true
        },
        {
          'data': {},
          'name': 'empty object is valid',
          'valid': true
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/PatternFalse', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Complex regex patterns
  // ---------------------------------------------------------------------------

  void describe('patternProperties with complex regex patterns', () => {
    void it('validates type constraints with anchored digit-only pattern', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/DigitKeys',
        'patternProperties': { '^\\d+$': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            '0': 'zero',
            '123': 'value'
          },
          'name': 'digit keys with valid string values',
          'valid': true
        },
        {
          'data': { '123': 42 },
          'name': 'digit key with wrong type (number instead of string)',
          'valid': false
        },
        {
          'data': { 'abc': 'text' },
          'name': 'edge: non-digit key does not match ^\\d+$ pattern — passes',
          'valid': true
        },
        {
          'data': { '': 'empty-key' },
          'name': 'edge: empty string key does not match ^\\d+$ pattern',
          'valid': true
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/DigitKeys', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates type constraints with dot-separated key pattern', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/DotSep',
        'patternProperties': { '^[a-z]+(\\.[a-z]+)*$': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'app': 'v1',
            'app.server.host': 'localhost'
          },
          'name': 'dot-separated keys with valid string values',
          'valid': true
        },
        {
          'data': { 'app': 123 },
          'name': 'matching key with wrong type (number instead of string)',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/DotSep', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // All items matching pattern
  // ---------------------------------------------------------------------------

  void describe('patternProperties where every key matches the pattern', () => {
    void it('validates when all keys conform to the single pattern schema', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/AllMatch',
        'patternProperties': { '^field_': { 'type': 'number' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'field_a': 1,
            'field_b': 2,
            'field_c': 3
          },
          'name': 'all keys match pattern with valid types',
          'valid': true
        },
        {
          'data': {
            'field_a': 1,
            'field_b': 'two'
          },
          'name': 'one key has wrong type',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/AllMatch', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // No matches — falls through to additionalProperties
  // ---------------------------------------------------------------------------

  void describe('patternProperties with no matching keys', () => {
    void it('treats unmatched keys per additionalProperties schema constraint', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/NoMatch',
        'additionalProperties': { 'type': 'boolean' },
        'patternProperties': { '^x_': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'flag': true,
            'other': false
          },
          'name': 'all unmatched keys satisfy additionalProperties boolean',
          'valid': true
        },
        {
          'data': { 'flag': 'not-a-boolean' },
          'name': 'unmatched key violates additionalProperties boolean',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/NoMatch', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('accepts empty objects regardless of pattern configuration', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/NoMatchEmpty',
        'additionalProperties': false,
        'patternProperties': { '^zzz_': { 'type': 'string' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [{
        'data': {},
        'name': 'empty object with additionalProperties false',
        'valid': true
      }];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/NoMatchEmpty', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Nested schemas in patternProperties (via $defs + $ref)
  // ---------------------------------------------------------------------------

  void describe('patternProperties with nested object schemas', () => {
    void it('validates pattern property values against referenced nested object constraints', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$defs': {
          'Addr': {
            'properties': {
              'city': { 'type': 'string' },
              'zip': {
                'pattern': '^\\d{5}$',
                'type': 'string'
              }
            },
            'required': [
              'city',
              'zip'
            ],
            'type': 'object'
          }
        },
        '$id': 'https://pattern.test/Nested',
        'patternProperties': { '^addr_': { '$ref': '#/$defs/Addr' } },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'addr_home': {
              'city': 'Springfield',
              'zip': '62704'
            },
            'addr_work': {
              'city': 'Shelbyville',
              'zip': '62565'
            }
          },
          'name': 'multiple valid nested address objects',
          'valid': true
        },
        {
          'data': { 'addr_home': { 'city': 'Springfield' } },
          'name': 'missing required zip in nested object',
          'valid': false
        },
        {
          'data': {
            'addr_home': {
              'city': 'Springfield',
              'zip': 'bad'
            }
          },
          'name': 'invalid zip pattern in nested object',
          'valid': false
        },
        {
          'data': { 'addr_home': 'not an object' },
          'name': 'non-object value for pattern-matched key expecting object',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/Nested', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // patternProperties + required
  // ---------------------------------------------------------------------------

  void describe('patternProperties interaction with required', () => {
    void it('required applies to named keys only, not to patterns', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/WithRequired',
        'patternProperties': { '^opt_': { 'type': 'string' } },
        'properties': { 'id': { 'type': 'string' } },
        'required': ['id'],
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': { 'id': 'abc' },
          'name': 'required id present, no pattern-matched keys needed',
          'valid': true
        },
        {
          'data': {
            'id': 'abc',
            'opt_label': 'hello'
          },
          'name': 'required id present plus valid pattern-matched key',
          'valid': true
        },
        {
          'data': { 'opt_label': 'hello' },
          'name': 'missing required id',
          'valid': false
        },
        {
          'data': {
            'id': 'abc',
            'opt_count': 99
          },
          'name': 'required id present but pattern-matched key has wrong type',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/WithRequired', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple exclusive (non-overlapping) patterns
  // ---------------------------------------------------------------------------

  void describe('patternProperties with exclusive non-overlapping patterns', () => {
    void it('applies each pattern schema only to its own matching keys', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/Exclusive',
        'patternProperties': {
          '^bool_': { 'type': 'boolean' },
          '^num_': { 'type': 'number' },
          '^str_': { 'type': 'string' }
        },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'bool_active': true,
            'num_score': 95,
            'str_name': 'Alice'
          },
          'name': 'all three patterns satisfied with correct types',
          'valid': true
        },
        {
          'data': { 'str_name': 123 },
          'name': 'str_ key with wrong type (number)',
          'valid': false
        },
        {
          'data': { 'num_score': 'high' },
          'name': 'num_ key with wrong type (string)',
          'valid': false
        },
        {
          'data': { 'bool_active': 'yes' },
          'name': 'bool_ key with wrong type (string)',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/Exclusive', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('handles mixed valid and invalid keys across exclusive patterns', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://pattern.test/ExclusiveMixed',
        'patternProperties': {
          '^ct_': { 'type': 'integer' },
          '^nm_': { 'type': 'string' }
        },
        'type': 'object'
      });

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
        {
          'data': {
            'ct_items': 10,
            'nm_first': 'Ada'
          },
          'name': 'both patterns satisfied',
          'valid': true
        },
        {
          'data': {
            'ct_items': 'ten',
            'nm_first': 'Ada'
          },
          'name': 'ct_ key has wrong type (string instead of integer)',
          'valid': false
        }
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://pattern.test/ExclusiveMixed', data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });
}

// ===========================================================================
// Source: validationEdgeCases.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Schema registration edge cases
// ---------------------------------------------------------------------------

  void describe('Registration edge cases', () => {
    void it('GBU: empty $id throws, minimal schemas accept valid data, anonymous synthetic ID works', () => {
      // Bad: rejects schema with empty string $id
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        assert.throws(() => {
          registry.set({
            '$id': '',
            'properties': { 'x': { 'type': 'string' } },
            'type': 'object'
          });
        }, 'rejects schema with empty string $id');
      }

      // Good: minimal schemas accept valid data
      {
        const acceptScenarios = [
          {
            'data': {},
            'name': 'schema with only $id and type validates empty object',
            'schema': {
              '$id': 'https://edge.test/EmptyObj',
              'type': 'object'
            }
          },
          {
            'data': { 'anything': true },
            'name': 'schema with only $id and type allows extra properties',
            'schema': {
              '$id': 'https://edge.test/EmptyObj2',
              'type': 'object'
            }
          },
          {
            'data': {},
            'name': 'schema with $defs but no properties validates empty object',
            'schema': {
              '$defs': {
                'Inner': {
                  'properties': { 'x': { 'type': 'number' } },
                  'type': 'object'
                }
              },
              '$id': 'https://edge.test/DefsOnly',
              'type': 'object'
            }
          }
        ];

        for (const {
          data, name, schema
        } of acceptScenarios) {
          const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

          registry.set(schema);
          const validateResult = registry.validate(schema.$id, data);

          assert.equal(validateResult.ok, true, `expected valid: ${name}`);
          assert.equal(validateResult.length, 0, `expected zero errors: ${name}`);
        }
      }
    });

    void it('handles registerAnonymous and validates against synthetic ID', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const syntheticId = registry.registerAnonymous({
        'properties': { 'value': { 'type': 'number' } },
        'required': ['value'],
        'type': 'object'
      });

      assert.match(syntheticId, /^urn:json-tology:/u, 'synthetic ID has expected prefix');

      const validResult = registry.validate(syntheticId, { 'value': 42 });

      assert.equal(validResult.ok, true, 'valid data passes');
      assert.equal(validResult.length, 0, 'valid data has zero errors');

      const invalidResult = registry.validate(syntheticId, { 'value': 'not-a-number' });

      assert.equal(invalidResult.ok, false, 'invalid data fails');
      assert.equal(invalidResult.length, 1, 'invalid data has exactly one type error');
      assert.equal(invalidResult.items[0].keyword, 'type');
      assert.equal(invalidResult.items[0].path, '/value');
    });
  });

  // ---------------------------------------------------------------------------
  // Numeric boundary scenarios
  // ---------------------------------------------------------------------------

  void describe('Numeric boundary validation', () => {
    void it('GBU: minimum/maximum, exclusiveMinimum/Maximum, multipleOf table-driven', () => {
      // minimum/maximum at exact boundaries
      {
        const scenarios = [
          {
            'data': { 'score': 0 },
            'name': 'minimum boundary (0) passes',
            'valid': true
          },
          {
            'data': { 'score': 100 },
            'name': 'maximum boundary (100) passes',
            'valid': true
          },
          {
            'data': { 'score': -1 },
            'name': 'below minimum (-1) fails',
            'valid': false
          },
          {
            'data': { 'score': 101 },
            'name': 'above maximum (101) fails',
            'valid': false
          },
          {
            'data': { 'score': 50.5 },
            'name': 'fractional value within bounds passes',
            'valid': true
          },
          {
            'data': { 'score': -0.001 },
            'name': 'value just below minimum fails',
            'valid': false
          }
        ];
        // enableStrictGraph: false — synthetic fixture with inline numeric bounds
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set({
          '$id': 'https://edge.test/NumBounds',
          'properties': {
            'score': {
              'maximum': 100,
              'minimum': 0,
              'type': 'number'
            }
          },
          'required': ['score'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/NumBounds', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }

      // exclusiveMinimum and exclusiveMaximum
      {
        const scenarios = [
          {
            'data': { 'val': 5 },
            'name': 'middle value (5) passes',
            'valid': true
          },
          {
            'data': { 'val': 0 },
            'name': 'exclusive minimum boundary (0) fails',
            'valid': false
          },
          {
            'data': { 'val': 10 },
            'name': 'exclusive maximum boundary (10) fails',
            'valid': false
          }
        ];
        // enableStrictGraph: false — synthetic fixture with inline exclusiveMinimum/Maximum
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set({
          '$id': 'https://edge.test/ExclBounds',
          'properties': {
            'val': {
              'exclusiveMaximum': 10,
              'exclusiveMinimum': 0,
              'type': 'number'
            }
          },
          'required': ['val'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/ExclBounds', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }

      // multipleOf with integers
      {
        const scenarios = [
          {
            'data': { 'count': 0 },
            'name': 'zero is multipleOf 3',
            'valid': true
          },
          {
            'data': { 'count': 9 },
            'name': '9 is multipleOf 3',
            'valid': true
          },
          {
            'data': { 'count': 7 },
            'name': '7 is not multipleOf 3',
            'valid': false
          }
        ];
        // enableStrictGraph: false — synthetic fixture with inline multipleOf
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set({
          '$id': 'https://edge.test/MultOf',
          'properties': {
            'count': {
              'multipleOf': 3,
              'type': 'integer'
            }
          },
          'required': ['count'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/MultOf', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // String constraint scenarios
  // ---------------------------------------------------------------------------

  void describe('String constraint validation', () => {
    void it('GBU: string length constraints and pattern table-driven', () => {
      // string length constraints at boundaries
      {
        const scenarios = [
          {
            'data': { 'code': 'ab' },
            'name': 'minLength boundary (2 chars) passes',
            'valid': true
          },
          {
            'data': { 'code': 'abcde' },
            'name': 'maxLength boundary (5 chars) passes',
            'valid': true
          },
          {
            'data': { 'code': 'a' },
            'name': 'below minLength (1 char) fails',
            'valid': false
          },
          {
            'data': { 'code': 'abcdef' },
            'name': 'above maxLength (6 chars) fails',
            'valid': false
          }
        ];
        // enableStrictGraph: false — synthetic fixture with inline string length constraints
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set({
          '$id': 'https://edge.test/StrLen',
          'properties': {
            'code': {
              'maxLength': 5,
              'minLength': 2,
              'type': 'string'
            }
          },
          'required': ['code'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/StrLen', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }

      // pattern constraint
      {
        const scenarios = [
          {
            'data': { 'zip': '12345' },
            'name': 'valid 5-digit zip passes',
            'valid': true
          },
          {
            'data': { 'zip': '1234' },
            'name': '4-digit zip fails',
            'valid': false
          },
          {
            'data': { 'zip': '123456' },
            'name': '6-digit zip fails',
            'valid': false
          },
          {
            'data': { 'zip': 'abcde' },
            'name': 'alpha zip fails',
            'valid': false
          }
        ];
        // enableStrictGraph: false — synthetic fixture with inline pattern constraint
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set({
          '$id': 'https://edge.test/Pattern',
          'properties': {
            'zip': {
              'pattern': '^\\d{5}$',
              'type': 'string'
            }
          },
          'required': ['zip'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/Pattern', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Array constraint scenarios
  // ---------------------------------------------------------------------------

  void describe('Array constraint validation', () => {
    void it('GBU: minItems, maxItems, item type table-driven', () => {
      const scenarios = [
        {
          'data': { 'tags': ['a'] },
          'name': 'minItems boundary (1 item) passes',
          'valid': true
        },
        {
          'data': {
            'tags': [
              'a',
              'b',
              'c'
            ]
          },
          'name': 'maxItems boundary (3 items) passes',
          'valid': true
        },
        {
          'data': { 'tags': [] },
          'name': 'empty array (below minItems) fails',
          'valid': false
        },
        {
          'data': {
            'tags': [
              'a',
              'b',
              'c',
              'd'
            ]
          },
          'name': 'above maxItems (4 items) fails',
          'valid': false
        },
        {
          'data': { 'tags': [1] },
          'name': 'wrong item type (number) fails',
          'valid': false
        }
      ];
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://edge.test/ArrayItems',
        'properties': {
          'tags': {
            'items': { 'type': 'string' },
            'maxItems': 3,
            'minItems': 1,
            'type': 'array'
          }
        },
        'required': ['tags'],
        'type': 'object'
      });

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate('https://edge.test/ArrayItems', data);

        if (valid) {
          assert.equal(errors.ok, true, name);
          assert.equal(errors.length, 0, name);
        } else {
          assert.equal(errors.ok, false, name);
          assert(errors.length > 0, `expected at least one validation error: ${name}`);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Enum/const scenarios
  // ---------------------------------------------------------------------------

  void describe('Enum and const validation', () => {
    void it('GBU: enum valid/invalid, const exact-match/mismatch/type-error table-driven', () => {
      // enum constraints
      {
        const scenarios = [
          {
            'data': { 'status': 'active' },
            'name': 'valid enum value passes',
            'valid': true
          },
          {
            'data': { 'status': 'unknown' },
            'name': 'invalid enum value fails',
            'valid': false
          }
        ];
        // enableStrictGraph: false — synthetic fixture with inline enum constraint
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set({
          '$id': 'https://edge.test/Enum',
          'properties': {
            'status': {
              'enum': [
                'active',
                'inactive',
                'pending'
              ],
              'type': 'string'
            }
          },
          'required': ['status'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/Enum', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }

      // const constraints
      {
        const scenarios = [
          {
            'data': { 'version': 2 },
            'name': 'exact const value passes',
            'valid': true
          },
          {
            'data': { 'version': 1 },
            'name': 'different number fails',
            'valid': false
          },
          {
            'data': { 'version': '2' },
            'name': 'string "2" fails (wrong type)',
            'valid': false
          }
        ];
        // enableStrictGraph: false — synthetic fixture with inline const constraint
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set({
          '$id': 'https://edge.test/Const',
          'properties': {
            'version': {
              'const': 2,
              'type': 'number'
            }
          },
          'required': ['version'],
          'type': 'object'
        });

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/Const', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Validation boundary -- wrong top-level type
  // ---------------------------------------------------------------------------

  void describe('Top-level type validation', () => {
    void it('GBU: empty object passes, string/number/null/array/undefined rejected for object schema', () => {
      const scenarios = [
        {
          'data': {},
          'name': 'empty object against schema with no required fields',
          'schemaId': 'https://edge.test/NoReq',
          'valid': true
        },
        {
          'data': 'a string',
          'name': 'string rejected for object schema',
          'schemaId': 'https://edge.test/ObjOnly',
          'valid': false
        },
        {
          'data': 42,
          'name': 'number rejected for object schema',
          'schemaId': 'https://edge.test/ObjOnly',
          'valid': false
        },
        {
          'data': null,
          'name': 'null rejected for object schema',
          'schemaId': 'https://edge.test/ObjOnly',
          'valid': false
        },
        {
          'data': [],
          'name': 'array rejected for object schema',
          'schemaId': 'https://edge.test/ObjOnly',
          'valid': false
        },
        {
          'data': undefined,
          'name': 'undefined rejected for object schema',
          'schemaId': 'https://edge.test/ObjOnly',
          'valid': false
        }
      ];
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$id': 'https://edge.test/NoReq',
        'properties': {
          'a': { 'type': 'string' },
          'b': { 'type': 'number' }
        },
        'type': 'object'
      });
      registry.set({
        '$id': 'https://edge.test/ObjOnly',
        'type': 'object'
      });

      for (const {
        data, name, schemaId, valid
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        if (valid) {
          assert.equal(errors.ok, true, name);
          assert.equal(errors.length, 0, name);
        } else {
          assert.equal(errors.ok, false, name);
          assert(errors.length > 0, `expected at least one validation error: ${name}`);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Coercion edge cases
  // ---------------------------------------------------------------------------

  void describe('Coercion edge cases', () => {
    void it('coerce applies nested defaults: name preserved, theme and volume defaults applied', () => {
      const scenarios: Array<{ 'expected': unknown;
        'name': string;
        'value': unknown }> = [
        {
          'expected': 'Alice',
          'name': 'name preserved',
          'value': 'name'
        },
        {
          'expected': 'light',
          'name': 'theme default applied',
          'value': 'settings.theme'
        },
        {
          'expected': 50,
          'name': 'volume default applied',
          'value': 'settings.volume'
        }
      ];
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.set({
        '$defs': {
          'Settings': {
            'properties': {
              'theme': {
                'default': 'light',
                'type': 'string'
              },
              'volume': {
                'default': 50,
                'type': 'number'
              }
            },
            'type': 'object'
          }
        },
        '$id': 'https://edge.test/WithDefaults',
        'properties': {
          'name': { 'type': 'string' },
          'settings': { '$ref': '#/$defs/Settings' }
        },
        'required': ['name'],
        'type': 'object'
      });

      const result = registry.instantiate('https://edge.test/WithDefaults', {
        'name': 'Alice',
        'settings': {}
      }) as Record<string, Record<string, unknown>>;

      for (const {
        'expected': exp, 'name': n, 'value': path
      } of scenarios) {
        const parts = (path as string).split('.');
        let current: unknown = result;

        for (const part of parts) {
          current = (current as Record<string, unknown>)[part];
        }

        assert.equal(current, exp, n);
      }
    });

    void it('coerce: does not mutate input, throws InstantiationError with path on nested failure', () => {
      // no mutation
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        registry.set({
          '$id': 'https://edge.test/NoMutate',
          'properties': {
            'role': {
              'default': 'user',
              'type': 'string'
            }
          },
          'type': 'object'
        });
        const input = {};

        registry.instantiate('https://edge.test/NoMutate', input);
        assert.equal(Object.keys(input).length, 0, 'input object not mutated');
      }

      // nested failure throws InstantiationError with path
      {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        registry.set({
          '$defs': {
            'Address': {
              'properties': {
                'city': { 'type': 'string' },
                'zip': {
                  'pattern': '^\\d{5}$',
                  'type': 'string'
                }
              },
              'required': [
                'city',
                'zip'
              ],
              'type': 'object'
            }
          },
          '$id': 'https://edge.test/NestedErr',
          'properties': {
            'address': { '$ref': '#/$defs/Address' },
            'name': { 'type': 'string' }
          },
          'required': [
            'name',
            'address'
          ],
          'type': 'object'
        });

        try {
          registry.instantiate('https://edge.test/NestedErr', {
            'address': {
              'city': 'Springfield',
              'zip': 'bad'
            },
            'name': 'Alice'
          });
          assert.fail('should have thrown');
        } catch (error) {
          assert(error instanceof InstantiationError, 'nested failure: instanceof InstantiationError');
          assert.equal(error.code, 'INSTANTIATION_FAILED');
          assert.equal(error.retryable, false);
          assert(error.errors.length > 0, 'nested failure: has errors');
          const patternErr = error.errors.items.find((item) => {
            return item.keyword === 'pattern';
          });

          assert(patternErr !== undefined, 'nested failure surfaces pattern keyword');
          assert.equal(patternErr.path, '/address/zip');
        }
      }
    });

    void it('castTypes coercion: string-number coerced to number', () => {
      const registry = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableTypeCast': true
      });

      registry.set({
        '$id': 'https://edge.test/CastNum',
        'properties': {
          'age': { 'type': 'number' },
          'name': { 'type': 'string' }
        },
        'required': [
          'name',
          'age'
        ],
        'type': 'object'
      });

      const result = registry.instantiate('https://edge.test/CastNum', {
        'age': '25',
        'name': 'Alice'
      }) as Record<string, unknown>;

      assert.equal(result.age, 25, 'string "25" coerced to number 25');
      assert.equal(typeof result.age, 'number', 'result.age is a number');
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-schema $ref validation
  // ---------------------------------------------------------------------------

  void describe('Cross-schema $ref validation', () => {
    void it('GBU: cross-schema refs valid/invalid, deeply chained A→B→C table-driven', () => {
      // cross-schema City→Country
      {
        const scenarios = [
          {
            'data': {
              'country': {
                'code': 'US',
                'name': 'United States'
              },
              'name': 'Springfield'
            },
            'name': 'valid City with valid Country ref',
            'valid': true
          },
          {
            'data': {
              'country': {
                'code': 'USA',
                'name': 'United States'
              },
              'name': 'Springfield'
            },
            'name': 'invalid country code (too long)',
            'valid': false
          },
          {
            'data': { 'name': 'Springfield' },
            'name': 'missing required country ref',
            'valid': false
          }
        ];
        // enableStrictGraph: false — cross-schema fixtures with inline length constraints
        const registry = JsonTology.create({
          'baseIRI': 'urn:test:',
          'enableStrictGraph': false
        });

        registry.set([
          {
            '$id': 'https://edge.test/Country',
            'properties': {
              'code': {
                'maxLength': 2,
                'minLength': 2,
                'type': 'string'
              },
              'name': { 'type': 'string' }
            },
            'required': [
              'code',
              'name'
            ],
            'type': 'object'
          },
          {
            '$id': 'https://edge.test/City',
            'properties': {
              'country': { '$ref': 'https://edge.test/Country' },
              'name': { 'type': 'string' }
            },
            'required': [
              'name',
              'country'
            ],
            'type': 'object'
          }
        ]);

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/City', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }

      // deeply chained A→B→C
      {
        const scenarios = [
          {
            'data': { 'b': { 'c': { 'value': 42 } } },
            'name': 'valid deeply chained ref data',
            'valid': true
          },
          {
            'data': { 'b': { 'c': { 'value': 'not-a-number' } } },
            'name': 'invalid at deepest level (string instead of number)',
            'valid': false
          }
        ];
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        registry.set([
          {
            '$id': 'https://edge.test/C',
            'properties': { 'value': { 'type': 'number' } },
            'required': ['value'],
            'type': 'object'
          },
          {
            '$id': 'https://edge.test/B',
            'properties': { 'c': { '$ref': 'https://edge.test/C' } },
            'required': ['c'],
            'type': 'object'
          },
          {
            '$id': 'https://edge.test/A',
            'properties': { 'b': { '$ref': 'https://edge.test/B' } },
            'required': ['b'],
            'type': 'object'
          }
        ]);

        for (const {
          data, name, valid
        } of scenarios) {
          const errors = registry.validate('https://edge.test/A', data);

          if (valid) {
            assert.equal(errors.ok, true, name);
            assert.equal(errors.length, 0, name);
          } else {
            assert.equal(errors.ok, false, name);
            assert(errors.length > 0, `expected at least one validation error: ${name}`);
          }
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Serialization edge cases
  // ---------------------------------------------------------------------------

  void describe('Serialization edge cases', () => {
    const scenarios: Array<{
      'check': (jt: ReturnType<typeof JsonTology.create>) => void;
      'name': string;
      'schemas': ReadonlyArray<Record<string, unknown>>;
    }> = [
      {
        'check': (jt) => {
          const owl = jt.ontology().jsonLdObject();

          assert(Array.isArray(owl['@graph']), 'OWL output has @graph array');
          const graph = owl['@graph'] as Array<Record<string, unknown>>;
          const markerClass = graph.find((node) => {
            return node['@id'] === 'https://edge.test/Marker';
          });

          assert(markerClass !== undefined, 'Marker class present in OWL graph');
          assert.equal(markerClass['@type'], 'http://www.w3.org/2002/07/owl#Class');
        },
        'name': 'serializes schema with no properties to valid OWL class',
        'schemas': [{
          '$id': 'https://edge.test/Marker',
          'type': 'object'
        }]
      },
      {
        'check': (jt) => {
          const shacl = jt.ontology().shaclObject();
          const graph = shacl['@graph'] as Array<Record<string, unknown>>;

          assert(graph.length > 0, 'SHACL graph has nodes');
          const allScalarsShape = graph.find((node) => {
            return node['@id'] === 'https://edge.test/AllScalars';
          });

          assert(allScalarsShape !== undefined, 'AllScalars NodeShape present');
        },
        'name': 'serializes schema with all scalar types',
        'schemas': [{
          '$id': 'https://edge.test/AllScalars',
          'properties': {
            'active': { 'type': 'boolean' },
            'count': { 'type': 'integer' },
            'name': { 'type': 'string' },
            'score': { 'type': 'number' }
          },
          'type': 'object'
        }]
      },
      {
        'check': (jt) => {
          const recursiveResult = jt.validate('https://edge.test/Tree', {
            'children': [{
              'children': [],
              'label': 'child'
            }],
            'label': 'root'
          });

          assert.equal(recursiveResult.ok, true, 'recursive data validates');
          assert.equal(recursiveResult.length, 0);

          const owl = jt.ontology().jsonLdObject();

          assert(Array.isArray(owl['@graph']), 'recursive schema serializes without infinite loop');
          const treeClass = (owl['@graph'] as Array<Record<string, unknown>>).find((node) => {
            return node['@id'] === 'https://edge.test/Tree';
          });

          assert(treeClass !== undefined, 'Tree class present in recursive output');
        },
        'name': 'handles schema with self-referencing $ref',
        'schemas': [{
          '$id': 'https://edge.test/Tree',
          'properties': {
            'children': {
              'items': { '$ref': 'https://edge.test/Tree' },
              'type': 'array'
            },
            'label': { 'type': 'string' }
          },
          'required': ['label'],
          'type': 'object'
        }]
      }
    ];

    void it('GBU: OWL class, SHACL shape, and recursive self-ref serialization scenarios', () => {
      for (const scenario of scenarios) {
        const jt = JsonTology.create({
          'baseIRI': 'https://edge.test',
          'schemas': scenario.schemas
        });

        scenario.check(jt);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // JsonTology facade edge cases
  // ---------------------------------------------------------------------------

  void describe('JsonTology facade edge cases', () => {
    void describe('unregistered schema lookups', () => {
      const scenarios: Array<{
        'check': (jt: ReturnType<typeof JsonTology.create>) => void;
        'name': string;
      }> = [
        {
          'check': (jt) => {
            assert.deepEqual([...jt.registry.keys()], []);
          },
          'name': 'list() returns empty array when no schemas registered'
        },
        {
          'check': (jt) => {
            assert.equal(jt.registry.has('https://edge.test/Nonexistent'), false);
          },
          'name': 'has() returns false for unknown schema'
        },
        {
          'check': (jt) => {
            assert.equal(jt.registry.get('https://edge.test/Nonexistent'), undefined);
          },
          'name': 'get() returns undefined for unknown schema'
        },
        {
          'check': (jt) => {
            assert.equal(jt.toSchema('https://edge.test/Nonexistent'), undefined);
          },
          'name': 'toSchema() returns undefined for unregistered schema'
        }
      ];

      void it('unregistered schema lookups: list/has/get/toSchema all return empty/false/undefined', () => {
        for (const scenario of scenarios) {
          const jt = JsonTology.create({ 'baseIRI': 'https://edge.test' });

          scenario.check(jt);
        }
      });
    });

    void it('register() chains/accumulates schemas and invalidates ontology cache', () => {
      // chains and accumulates
      {
        const jt = JsonTology.create({ 'baseIRI': 'https://edge.test' });

        jt.set({
          '$id': 'https://edge.test/First',
          'type': 'object'
        });
        jt.set({
          '$id': 'https://edge.test/Second',
          'type': 'object'
        });

        assert.deepEqual([...jt.registry.keys()], [
          'https://edge.test/First',
          'https://edge.test/Second'
        ]);
        assert.equal(jt.registry.has('https://edge.test/First'), true, 'First schema present');
        assert.equal(jt.registry.has('https://edge.test/Second'), true, 'Second schema present');
      }

      // ontology cache invalidates after register
      {
        const jt = JsonTology.create({
          'baseIRI': 'https://edge.test',
          'schemas': [{
            '$id': 'https://edge.test/A',
            'type': 'object'
          }] as const
        });
        const ont1 = jt.ontology();

        jt.set({
          '$id': 'https://edge.test/B',
          'type': 'object'
        });

        assert.notStrictEqual(ont1, jt.ontology(), 'new ontology instance after registration');
      }
    });
  });
}

// ===========================================================================
// Source: validationErrorsViews.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// aggregate()
// ---------------------------------------------------------------------------

  void describe('ValidationErrors.aggregate()', () => {
    void it('GBU: empty aggregate, count matches length, deduplication, sorting, root path, log spread', () => {
      // empty
      {
        const errs = new ValidationErrors([]);
        const rollup = errs.aggregate();

        assert.equal(rollup.count, 0, 'count is 0');
        assert.deepEqual(rollup.paths, [], 'paths is empty');
        assert.deepEqual(rollup.keywords, [], 'keywords is empty');
      }

      // count matches length
      {
        const errs = new ValidationErrors([
          {
            'keyword': 'type',
            'message': 'must be string',
            'params': {},
            'path': '/name'
          },
          {
            'keyword': 'minimum',
            'message': 'must be >= 0',
            'params': { 'limit': 0 },
            'path': '/age'
          }
        ]);

        assert.equal(errs.aggregate().count, errs.length, 'aggregate().count === .length');
      }

      // deduplication
      {
        const errs = new ValidationErrors([
          {
            'keyword': 'type',
            'message': 'must be string',
            'params': {},
            'path': '/name'
          },
          {
            'keyword': 'minLength',
            'message': 'too short',
            'params': { 'limit': 1 },
            'path': '/name'
          },
          {
            'keyword': 'type',
            'message': 'must be number',
            'params': {},
            'path': '/age'
          }
        ]);
        const rollup = errs.aggregate();

        assert.equal(rollup.count, 3, 'count is 3 (no dedup on count)');
        assert.deepEqual(rollup.paths, [
          'age',
          'name'
        ], 'paths deduped and sorted (access form)');
        assert.deepEqual(rollup.keywords, [
          'minLength',
          'type'
        ], 'keywords deduped and sorted');
      }

      // alphabetical sorting
      {
        const errs = new ValidationErrors([
          {
            'keyword': 'type',
            'message': 'err',
            'params': {},
            'path': '/z'
          },
          {
            'keyword': 'minLength',
            'message': 'err',
            'params': {},
            'path': '/a'
          },
          {
            'keyword': 'format',
            'message': 'err',
            'params': {},
            'path': '/m'
          }
        ]);
        const rollup = errs.aggregate();

        assert.deepEqual(rollup.paths, [
          'a',
          'm',
          'z'
        ], 'paths are sorted (access form)');
        assert.deepEqual(rollup.keywords, [
          'format',
          'minLength',
          'type'
        ], 'keywords are sorted');
      }

      // root errors (empty path)
      {
        const errs = new ValidationErrors([{
          'keyword': 'required',
          'message': "must have required property 'name'",
          'params': { 'missingProperty': 'name' },
          'path': ''
        }]);
        const rollup = errs.aggregate();

        assert.deepEqual(rollup.paths, [''], 'root error path is empty string');
        assert.equal(rollup.count, 1, 'count is 1');
      }

      // safe to spread into log line
      {
        const errs = new ValidationErrors([{
          'keyword': 'type',
          'message': 'must be string',
          'params': { 'type': 'string' },
          'path': '/name'
        }]);
        const logLine = {
          ...errs.aggregate(),
          'schema': 'https://example.com/User'
        };

        assert.equal(logLine.count, 1, 'spread count');
        assert.deepEqual(logLine.paths, ['name'], 'spread paths (access form)');
        assert.deepEqual(logLine.keywords, ['type'], 'spread keywords');
        assert.equal(logLine.schema, 'https://example.com/User', 'additional field preserved');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // report()
  // ---------------------------------------------------------------------------

  void describe('ValidationErrors.report()', () => {
    void it('GBU: RFC 7807 defaults, singular/plural detail, errors entries, overrides, instance, clone', () => {
      // RFC 7807 shape defaults
      {
        const errs = new ValidationErrors([{
          'keyword': 'type',
          'message': 'must be string',
          'params': {},
          'path': '/name'
        }]);
        const problem = errs.report();

        assert.equal(problem.type, 'https://json-tology.dev/problems/validation', 'type');
        assert.equal(problem.title, 'Validation failed', 'title');
        assert.equal(problem.status, 422, 'status');
        assert.equal(problem.detail, '1 validation error', 'singular detail');
      }

      // plural detail
      {
        const errs = new ValidationErrors([
          {
            'keyword': 'type',
            'message': 'must be string',
            'params': {},
            'path': '/name'
          },
          {
            'keyword': 'minimum',
            'message': 'must be >= 0',
            'params': { 'limit': 0 },
            'path': '/age'
          }
        ]);

        assert.equal(errs.report().detail, '2 validation errors', 'plural detail');
      }

      // errors entries carry all fields
      {
        const errs = new ValidationErrors([{
          'keyword': 'format',
          'message': 'must match format "uuid"',
          'params': { 'format': 'uuid' },
          'path': '/id'
        }]);
        const problem = errs.report();

        assert.equal(problem.errors.length, 1, 'one error entry');
        assert.deepEqual(problem.errors, [{
          'keyword': 'format',
          'message': 'must match format "uuid"',
          'params': { 'format': 'uuid' },
          'path': '/id'
        }], 'errors entry carries all fields');
      }

      // overrides merge over defaults
      {
        const errs = new ValidationErrors([{
          'keyword': 'type',
          'message': 'must be string',
          'params': {},
          'path': '/name'
        }]);
        const problem = errs.report({
          'instance': '/api/users',
          'status': 400,
          'title': 'Bad request'
        });

        assert.equal(problem.status, 400, 'overridden status');
        assert.equal(problem.title, 'Bad request', 'overridden title');
        assert.equal(problem.instance, '/api/users', 'instance attached');
        assert.equal(problem.type, 'https://json-tology.dev/problems/validation', 'type unchanged');
      }

      // instance is undefined by default
      {
        const errs = new ValidationErrors([{
          'keyword': 'type',
          'message': 'err',
          'params': {},
          'path': ''
        }]);

        assert.equal(errs.report().instance, undefined, 'instance is undefined by default');
      }

      // structuredClone round-trip
      {
        const errs = new ValidationErrors([
          {
            'keyword': 'format',
            'message': 'must match format "uuid"',
            'params': { 'format': 'uuid' },
            'path': '/id'
          },
          {
            'keyword': 'minItems',
            'message': 'must NOT have fewer than 1 items',
            'params': { 'limit': 1 },
            'path': '/items'
          }
        ]);
        const problem = errs.report({ 'instance': '/orders' });

        assert.deepEqual(structuredClone(problem), problem, 'structuredClone round-trip is identical');
      }

      // empty errors array
      {
        const errs = new ValidationErrors([]);
        const problem = errs.report();

        assert.equal(problem.errors.length, 0, 'no error entries');
        assert.equal(problem.detail, '0 validation errors', 'zero plural detail');
      }
    });
  });
}

// ===========================================================================
// Source: arrays.test.ts
// ===========================================================================
{
  const passing: ValidateWithErrorsFnType = (value: unknown) => {
    return {
      'valid': true,
      value
    };
  };
  const failing: ValidateWithErrorsFnType = (value, path, errors, collectErrors) => {
    if (collectErrors) {
      errors.push(BaseError.validationError(path, 'type', 'mock'));
    }

    return {
      'valid': false,
      value
    };
  };
  const passingCheck: CheckFnType = () => {
    return true;
  };
  const failingCheck: CheckFnType = () => {
    return false;
  };
  const oneMatch: CheckFnType = (value) => {
    return value === 1;
  };

  void describe('Arrays — Good/Bad/Ugly', () => {
    void it('validateBounds: within-bounds, minItems, maxItems, uniqueItems', () => {
      // Good: within bounds
      const e1: ValidationErrorType[] = [];
      const r1 = Arrays.validateBounds('/a', [
        1,
        2,
        3
      ], 1, 5, false, e1);

      assert.equal(r1, true);
      assert.equal(e1.length, 0);

      // Bad: below minItems
      const e2: ValidationErrorType[] = [];
      const r2 = Arrays.validateBounds('/a', [1], 3, undefined, false, e2);

      assert.equal(r2, false);
      assert.equal(e2.length, 1);
      assert.equal(e2[0].keyword, 'minItems');

      // Bad: above maxItems
      const e3: ValidationErrorType[] = [];
      const r3 = Arrays.validateBounds('/a', [
        1,
        2,
        3,
        4
      ], undefined, 2, false, e3);

      assert.equal(r3, false);
      assert.equal(e3.length, 1);
      assert.equal(e3[0].keyword, 'maxItems');

      // Ugly: uniqueItems with duplicates
      const e4: ValidationErrorType[] = [];
      const r4 = Arrays.validateBounds('/a', [
        1,
        2,
        2,
        3
      ], undefined, undefined, true, e4);

      assert.equal(r4, false);
      assert.equal(e4.length, 1);
      assert.equal(e4[0].keyword, 'uniqueItems');

      // Good: uniqueItems all unique
      const e5: ValidationErrorType[] = [];
      const r5 = Arrays.validateBounds('/a', [
        1,
        2,
        3
      ], undefined, undefined, true, e5);

      assert.equal(r5, true);
      assert.equal(e5.length, 0);
    });

    void it('validateContains: undefined, match, no-match, minContains, maxContains', () => {
      // Good: no containsCheck = valid
      const e1: ValidationErrorType[] = [];
      const r1 = Arrays.validateContains('/a', [
        1,
        2
      ], undefined, undefined, undefined, e1);

      assert.equal(r1, true);
      assert.equal(e1.length, 0);

      // Good: at least one matches
      const e2: ValidationErrorType[] = [];
      const r2 = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], passingCheck, undefined, undefined, e2);

      assert.equal(r2, true);
      assert.equal(e2.length, 0);

      // Bad: no item matches
      const e3: ValidationErrorType[] = [];
      const r3 = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], failingCheck, undefined, undefined, e3);

      assert.equal(r3, false);
      assert.equal(e3.length, 1);
      assert.equal(e3[0].keyword, 'contains');

      // Bad: below minContains
      const e4: ValidationErrorType[] = [];
      const r4 = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], oneMatch, 2, undefined, e4);

      assert.equal(r4, false);
      assert.equal(e4.length, 1);
      assert.match(e4[0].message, /at least 2/u);

      // Bad: above maxContains
      const e5: ValidationErrorType[] = [];
      const r5 = Arrays.validateContains('/a', [
        1,
        2,
        3
      ], passingCheck, undefined, 2, e5);

      assert.equal(r5, false);
      assert.equal(e5.length, 1);
      assert.match(e5[0].message, /at most 2/u);
    });

    void it('validateItems: undefined validator, all-pass, earlyExit, collect-errors, prefix-skip', () => {
      // Good: no validator = valid
      const e1: ValidationErrorType[] = [];
      const r1 = Arrays.validateItems('/a', [
        1,
        2
      ], undefined, undefined, e1, false, false, false, false);

      assert.equal(r1.valid, true);
      assert.equal(r1.earlyExit, false);

      // Good: all items pass
      const e2: ValidationErrorType[] = [];
      const r2 = Arrays.validateItems('/a', [
        1,
        2,
        3
      ], passing, undefined, e2, false, false, false, false);

      assert.equal(r2.valid, true);
      assert.equal(r2.earlyExit, false);

      // Bad: earlyExit when fails and collectErrors is false
      const e3: ValidationErrorType[] = [];
      const r3 = Arrays.validateItems('/a', [
        1,
        2
      ], failing, undefined, e3, false, false, false, false);

      assert.equal(r3.valid, false);
      assert.equal(r3.earlyExit, true);

      // Bad: collects errors when collectErrors is true
      const e4: ValidationErrorType[] = [];
      const r4 = Arrays.validateItems('/a', [
        1,
        2
      ], failing, undefined, e4, true, false, false, false);

      assert.equal(r4.valid, false);
      assert.equal(r4.earlyExit, false);
      assert.equal(e4.length, 2);

      // Ugly: skips prefix-covered indices when prefixValidators present
      const e5: ValidationErrorType[] = [];
      const r5 = Arrays.validateItems('/a', [
        1,
        2,
        3,
        4
      ], passing, [
        passing,
        passing
      ], e5, false, false, false, false);

      assert.equal(r5.valid, true);
      assert.equal(r5.earlyExit, false);
    });

    void it('validatePrefixItems: undefined, all-pass, earlyExit, collect-errors', () => {
      // Good: no prefixValidators = valid
      const e1: ValidationErrorType[] = [];
      const r1 = Arrays.validatePrefixItems('/a', [
        1,
        2
      ], undefined, e1, false, false, false, false);

      assert.equal(r1.valid, true);
      assert.equal(r1.earlyExit, false);

      // Good: all prefix items pass
      const e2: ValidationErrorType[] = [];
      const r2 = Arrays.validatePrefixItems('/a', [
        1,
        2,
        3
      ], [
        passing,
        passing
      ], e2, false, false, false, false);

      assert.equal(r2.valid, true);
      assert.equal(r2.earlyExit, false);

      // Bad: earlyExit when fails and collectErrors is false
      const e3: ValidationErrorType[] = [];
      const r3 = Arrays.validatePrefixItems('/a', [
        1,
        2
      ], [
        failing,
        passing
      ], e3, false, false, false, false);

      assert.equal(r3.valid, false);
      assert.equal(r3.earlyExit, true);

      // Bad: collects errors when collectErrors is true
      const e4: ValidationErrorType[] = [];
      const r4 = Arrays.validatePrefixItems('/a', [
        1,
        2
      ], [
        failing,
        failing
      ], e4, true, false, false, false);

      assert.equal(r4.valid, false);
      assert.equal(r4.earlyExit, false);
      assert.equal(e4.length, 2);
    });
  });
}

// ===========================================================================
// Source: objects.test.ts
// ===========================================================================
{
  const passingValidatorImpl: ValidateWithErrorsFnType = (value: unknown) => {
    return {
      'valid': true,
      'value': value
    };
  };

  const failingValidatorImpl: ValidateWithErrorsFnType = (
    value: unknown,
    path: string,
    errors: ValidationErrorType[]
  ) => {
    errors.push({
      'instancePath': path,
      'keyword': 'type',
      'message': 'mock failure',
      'params': {}
    } as unknown as ValidationErrorType);

    return {
      'valid': false,
      'value': value
    };
  };

  function passingValidator(): ValidateWithErrorsFnType {
    return passingValidatorImpl;
  }

  function failingValidator(): ValidateWithErrorsFnType {
    return failingValidatorImpl;
  }

  function coercingValidator(coercedValue: unknown): ValidateWithErrorsFnType {
    const impl: ValidateWithErrorsFnType = () => {
      return {
        'valid': true,
        'value': coercedValue
      };
    };

    return impl;
  }

  void describe('Objects — Good/Bad/Ugly', () => {
    void it('applyDefaults: applies missing, skips existing, skips hasDefault=false', () => {
      // Good: applies missing default
      const obj1: Record<string, unknown> = { 'a': 1 };
      const d1 = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>([[
        'b',
        {
          'defaultValue': 42,
          'hasDefault': true
        }
      ]]);

      Objects.applyDefaults(obj1, d1);
      assert.equal(obj1.b, 42);

      // Bad: does not overwrite existing
      const obj2: Record<string, unknown> = { 'a': 1 };
      const d2 = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>([[
        'a',
        {
          'defaultValue': 999,
          'hasDefault': true
        }
      ]]);

      Objects.applyDefaults(obj2, d2);
      assert.equal(obj2.a, 1);

      // Ugly: skips when hasDefault is false
      const obj3: Record<string, unknown> = {};
      const d3 = new Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }>([[
        'x',
        {
          'defaultValue': 'nope',
          'hasDefault': false
        }
      ]]);

      Objects.applyDefaults(obj3, d3);
      assert.equal('x' in obj3, false);
    });

    void it('validateDependentRequired: empty, trigger+dep, trigger+miss, non-object, earlyExit', () => {
      // Good: no entries = valid
      const e1: ValidationErrorType[] = [];
      const r1 = Objects.validateDependentRequired('', { 'a': 1 }, [], e1, true);

      assert.equal(r1.valid, true);
      assert.equal(r1.earlyExit, false);
      assert.equal(e1.length, 0);

      // Good: trigger present and dep present = valid
      const e2: ValidationErrorType[] = [];
      const r2 = Objects.validateDependentRequired('', {
        'a': 1,
        'b': 2
      }, [[
        'a',
        ['b']
      ]], e2, true);

      assert.equal(r2.valid, true);
      assert.equal(e2.length, 0);

      // Bad: trigger present but dep missing = invalid
      const e3: ValidationErrorType[] = [];
      const r3 = Objects.validateDependentRequired('', { 'a': 1 }, [[
        'a',
        ['b']
      ]], e3, true);

      assert.equal(r3.valid, false);
      assert.equal(e3.length, 1);

      // Ugly: non-object value = valid (skipped)
      const e4: ValidationErrorType[] = [];
      const r4 = Objects.validateDependentRequired('', 'not-an-object', [[
        'a',
        ['b']
      ]], e4, true);

      assert.equal(r4.valid, true);

      // Ugly: earlyExit when collectErrors is false
      const e5: ValidationErrorType[] = [];
      const r5 = Objects.validateDependentRequired('', { 'a': 1 }, [[
        'a',
        [
          'b',
          'c'
        ]
      ]], e5, false);

      assert.equal(r5.valid, false);
      assert.equal(r5.earlyExit, true);
      assert.equal(e5.length, 0);
    });

    void it('validateRequired + validatePropertyCount + validatePropertyNames: table-driven', () => {
      // validateRequired
      const err1: ValidationErrorType[] = [];
      const rr1 = Objects.validateRequired('', { 'a': 1 }, undefined, err1);

      assert.equal(rr1, true);
      assert.equal(err1.length, 0);

      const err2: ValidationErrorType[] = [];
      const rr2 = Objects.validateRequired('', {
        'a': 1,
        'b': 2
      }, [
        'a',
        'b'
      ], err2);

      assert.equal(rr2, true);

      const err3: ValidationErrorType[] = [];
      const rr3 = Objects.validateRequired('/root', { 'a': 1 }, [
        'a',
        'b'
      ], err3);

      assert.equal(rr3, false);
      assert.equal(err3.length, 1);

      // validatePropertyCount
      const erc1: ValidationErrorType[] = [];
      const rc1 = Objects.validatePropertyCount('', {
        'a': 1,
        'b': 2
      }, 1, 3, erc1);

      assert.equal(rc1, true);
      assert.equal(erc1.length, 0);

      const erc2: ValidationErrorType[] = [];
      const rc2 = Objects.validatePropertyCount('', { 'a': 1 }, 2, undefined, erc2);

      assert.equal(rc2, false);
      assert.equal(erc2.length, 1);

      const erc3: ValidationErrorType[] = [];
      const rc3 = Objects.validatePropertyCount('', {
        'a': 1,
        'b': 2,
        'c': 3
      }, undefined, 2, erc3);

      assert.equal(rc3, false);
      assert.equal(erc3.length, 1);

      // validatePropertyNames
      const e1: ValidationErrorType[] = [];
      const rn1 = Objects.validatePropertyNames('', { 'a': 1 }, undefined, e1, true);

      assert.equal(rn1.valid, true);
      assert.equal(rn1.earlyExit, false);

      const e2: ValidationErrorType[] = [];
      const rn2 = Objects.validatePropertyNames('', { 'ok': 1 }, passingValidator(), e2, true);

      assert.equal(rn2.valid, true);
      assert.equal(rn2.earlyExit, false);

      const e3: ValidationErrorType[] = [];
      const rn3 = Objects.validatePropertyNames('', { 'bad': 1 }, failingValidator(), e3, true);

      assert.equal(rn3.valid, false);
      assert.equal(e3.length, 1);
    });

    void it('validateProperties: known-prop, additional-false, stripUnknown, pattern-prop', () => {
      const emptyDefaults = (): Map<string, { 'defaultValue': unknown;
        'hasDefault': boolean }> => {
        return new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>();
      };

      // Good: validates known property
      const e1: ValidationErrorType[] = [];
      const r1 = Objects.validateProperties('', { 'name': 'Alice' }, new Map([[
        'name',
        passingValidator()
      ]]), undefined, false, undefined, undefined, false, emptyDefaults(), e1, true, false, false);

      assert.equal(r1.valid, true);
      assert.equal(r1.earlyExit, false);

      // Bad: invalid for unknown property with additionalIsFalse
      const e2: ValidationErrorType[] = [];
      const r2 = Objects.validateProperties('', { 'extra': 'bad' }, new Map(), undefined, true, undefined, undefined, false, emptyDefaults(), e2, true, false, false);

      assert.equal(r2.valid, false);
      assert.equal(e2.length, 1);

      // Ugly: strips unknown keys when stripUnknown is true
      const obj3: Record<string, unknown> = {
        'extra': 'removed',
        'name': 'Alice'
      };
      const e3: ValidationErrorType[] = [];

      Objects.validateProperties('', obj3, new Map([[
        'name',
        passingValidator()
      ]]), undefined, false, undefined, new Set(['name']), true, emptyDefaults(), e3, true, false, false);
      assert.equal('extra' in obj3, false);
      assert.equal(obj3.name, 'Alice');

      // Ugly: matches pattern property
      const obj4: Record<string, unknown> = { 'x-custom': 'original' };
      const e4: ValidationErrorType[] = [];
      const r4 = Objects.validateProperties('', obj4, new Map(), [{
        'regex': /^x-/u,
        'validator': coercingValidator('coerced')
      }], false, undefined, undefined, false, emptyDefaults(), e4, true, false, false);

      assert.equal(r4.valid, true);
      assert.equal(obj4['x-custom'], 'coerced');
    });
  });
}

// ===========================================================================
// Source: scalars.test.ts
// ===========================================================================
{
  function emailValidator(value: unknown): boolean {
    return typeof value === 'string' && value.includes('@');
  }

  void describe('Scalars — Good/Bad/Ugly', () => {
    void it('validateConst / validateEnum / validateFormat: table-driven', () => {
      const enumVals = [
        'a',
        'b',
        'c'
      ];
      const enumSet = new Set<boolean | null | number | string>([
        'a',
        'b',
        'c'
      ]);

      // validateConst
      const ec1: ValidationErrorType[] = [];
      const rc1 = Scalars.validateConst('/x', 'anything', false, undefined, ec1);

      assert.equal(rc1, true);
      assert.equal(ec1.length, 0);

      const ec2: ValidationErrorType[] = [];
      const rc2 = Scalars.validateConst('/x', 42, true, 42, ec2);

      assert.equal(rc2, true);
      assert.equal(ec2.length, 0);

      const ec3: ValidationErrorType[] = [];
      const rc3 = Scalars.validateConst('/x', 'wrong', true, 'expected', ec3);

      assert.equal(rc3, false);
      assert.equal(ec3.length, 1);
      assert.equal(ec3[0].keyword, 'const');
      assert.equal(ec3[0].path, '/x');

      // validateEnum
      const ee1: ValidationErrorType[] = [];

      assert.equal(Scalars.validateEnum('/x', 'anything', undefined, undefined, ee1), true);

      const ee2: ValidationErrorType[] = [];

      assert.equal(Scalars.validateEnum('/x', 'b', enumVals, enumSet, ee2), true);

      const ee3: ValidationErrorType[] = [];
      const re3 = Scalars.validateEnum('/x', 'z', enumVals, enumSet, ee3);

      assert.equal(re3, false);
      assert.equal(ee3.length, 1);
      assert.equal(ee3[0].keyword, 'enum');
      assert.equal(ee3[0].path, '/x');

      // validateFormat
      const ef1: ValidationErrorType[] = [];

      assert.equal(Scalars.validateFormat('/x', 'anything', undefined, undefined, ef1), true);

      const ef2: ValidationErrorType[] = [];

      assert.equal(Scalars.validateFormat('/x', 'a@b.com', 'email', emailValidator, ef2), true);

      const ef3: ValidationErrorType[] = [];
      const rf3 = Scalars.validateFormat('/x', 'not-an-email', 'email', emailValidator, ef3);

      assert.equal(rf3, false);
      assert.equal(ef3.length, 1);
      assert.equal(ef3[0].keyword, 'format');
      assert.match(ef3[0].message, /email/u);
    });

    void it('validateString + validateNumber + validateType: table-driven', () => {
      // validateString
      const es1: ValidationErrorType[] = [];
      const rs1 = Scalars.validateString('/x', 'hello', 2, 10, undefined, undefined, es1);

      assert.equal(rs1, true);
      assert.equal(es1.length, 0);

      const es2: ValidationErrorType[] = [];
      const rs2 = Scalars.validateString('/x', 'hi', 5, undefined, undefined, undefined, es2);

      assert.equal(rs2, false);
      assert.equal(es2[0].keyword, 'minLength');

      const es3: ValidationErrorType[] = [];
      const rs3 = Scalars.validateString('/x', 'hello world', undefined, 5, undefined, undefined, es3);

      assert.equal(rs3, false);
      assert.equal(es3[0].keyword, 'maxLength');

      const es4: ValidationErrorType[] = [];
      const rs4 = Scalars.validateString('/x', 'abc123', undefined, undefined, /^[a-z]+\d+$/u, '^[a-z]+\\d+$', es4);

      assert.equal(rs4, true);

      const es5: ValidationErrorType[] = [];
      const rs5 = Scalars.validateString('/x', '!!!', undefined, undefined, /^[a-z]+$/u, '^[a-z]+$', es5);

      assert.equal(rs5, false);
      assert.equal(es5[0].keyword, 'pattern');

      const es6: ValidationErrorType[] = [];

      assert.equal(Scalars.validateString('/x', 'anything', undefined, undefined, undefined, undefined, es6), true);

      // validateNumber
      const en1: ValidationErrorType[] = [];

      assert.equal(Scalars.validateNumber('/x', 42, undefined, undefined, undefined, undefined, undefined, en1), true);

      const en2: ValidationErrorType[] = [];

      Scalars.validateNumber('/x', 3, 5, undefined, undefined, undefined, undefined, en2);
      assert.equal(en2[0].keyword, 'minimum');

      const en3: ValidationErrorType[] = [];

      Scalars.validateNumber('/x', 20, undefined, 10, undefined, undefined, undefined, en3);
      assert.equal(en3[0].keyword, 'maximum');

      const en4: ValidationErrorType[] = [];

      Scalars.validateNumber('/x', 5, undefined, undefined, 5, undefined, undefined, en4);
      assert.equal(en4[0].keyword, 'exclusiveMinimum');

      const en5: ValidationErrorType[] = [];

      Scalars.validateNumber('/x', 10, undefined, undefined, undefined, 10, undefined, en5);
      assert.equal(en5[0].keyword, 'exclusiveMaximum');

      const en6: ValidationErrorType[] = [];
      const rn6 = Scalars.validateNumber('/x', 7, undefined, undefined, undefined, undefined, 3, en6);

      assert.equal(rn6, false);
      assert.equal(en6.length, 1);
      assert.equal(en6[0].keyword, 'multipleOf');

      // validateType
      const et1: ValidationErrorType[] = [];

      assert.equal(Scalars.validateType('/x', [], 'anything', et1), true);

      const et2: ValidationErrorType[] = [];

      assert.equal(Scalars.validateType('/x', ['string'], 'hello', et2), true);

      const et3: ValidationErrorType[] = [];

      assert.equal(Scalars.validateType('/x', [
        'string',
        'number'
      ], 42, et3), true);

      const et4: ValidationErrorType[] = [];
      const rt4 = Scalars.validateType('/x', ['string'], 42, et4);

      assert.equal(rt4, false);
      assert.equal(et4.length, 1);
      assert.equal(et4[0].keyword, 'type');
      assert.equal(et4[0].path, '/x');
    });
  });
}

// ===========================================================================
// Source: compositionExec.test.ts
// ===========================================================================
{
  const passingValidatorImpl: ValidateWithErrorsFnType = (value: unknown) => {
    return {
      'valid': true,
      'value': value
    };
  };

  const failingValidatorImpl: ValidateWithErrorsFnType = (
    value: unknown,
    path: string,
    errors: ValidationErrorType[]
  ) => {
    errors.push({
      'instancePath': path,
      'keyword': 'type',
      'message': 'mock failure',
      'params': {}
    } as unknown as ValidationErrorType);

    return {
      'valid': false,
      'value': value
    };
  };

  function passingValidator(): ValidateWithErrorsFnType {
    return passingValidatorImpl;
  }

  function failingValidator(): ValidateWithErrorsFnType {
    return failingValidatorImpl;
  }

  const alwaysTrue: CheckFnType = (_: unknown): boolean => {
    return true;
  };

  const alwaysFalse: CheckFnType = (_: unknown): boolean => {
    return false;
  };

  void describe('Composition — Good/Bad/Ugly', () => {
    void it('validateAllOf: undefined, all-pass, earlyExit, collect-errors', () => {
      const e1: ValidationErrorType[] = [];
      const r1 = Composition.validateAllOf('test', '', undefined, e1, true, false, false, false);

      assert.equal(r1.valid, true);
      assert.equal(r1.earlyExit, false);
      assert.equal(r1.value, 'test');

      const e2: ValidationErrorType[] = [];
      const r2 = Composition.validateAllOf('test', '', [
        passingValidator(),
        passingValidator()
      ], e2, true, false, false, false);

      assert.equal(r2.valid, true);
      assert.equal(r2.earlyExit, false);

      const e3: ValidationErrorType[] = [];
      const r3 = Composition.validateAllOf('test', '/root', [
        passingValidator(),
        failingValidator()
      ], e3, false, false, false, false);

      assert.equal(r3.valid, false);
      assert.equal(r3.earlyExit, true);

      const e4: ValidationErrorType[] = [];
      const r4 = Composition.validateAllOf('test', '/root', [
        passingValidator(),
        failingValidator()
      ], e4, true, false, false, false);

      assert.equal(r4.valid, false);
      assert.equal(r4.earlyExit, false);
      assert.equal(e4.length, 1);
    });

    void it('validateAnyOf + validateOneOf + validateNot: table-driven', () => {
      // anyOf
      const ea1: ValidationErrorType[] = [];

      assert.equal(Composition.validateAnyOf('', 'test', undefined, ea1), true);

      const ea2: ValidationErrorType[] = [];

      assert.equal(Composition.validateAnyOf('', 'test', [
        alwaysFalse,
        alwaysTrue
      ], ea2), true);

      const ea3: ValidationErrorType[] = [];

      assert.equal(Composition.validateAnyOf('/root', 'test', [
        alwaysFalse,
        alwaysFalse
      ], ea3), false);

      // oneOf
      const eo1: ValidationErrorType[] = [];

      assert.equal(Composition.validateOneOf('', 'test', undefined, eo1), true);

      const eo2: ValidationErrorType[] = [];

      assert.equal(Composition.validateOneOf('', 'test', [
        alwaysFalse,
        alwaysTrue,
        alwaysFalse
      ], eo2), true);

      const eo3: ValidationErrorType[] = [];

      assert.equal(Composition.validateOneOf('/root', 'test', [
        alwaysFalse,
        alwaysFalse
      ], eo3), false);

      const eo4: ValidationErrorType[] = [];

      assert.equal(Composition.validateOneOf('/root', 'test', [
        alwaysTrue,
        alwaysTrue
      ], eo4), false);

      // not
      const en1: ValidationErrorType[] = [];

      assert.equal(Composition.validateNot('', 'test', undefined, en1), true);

      const en2: ValidationErrorType[] = [];

      assert.equal(Composition.validateNot('', 'test', alwaysFalse, en2), true);

      const en3: ValidationErrorType[] = [];

      assert.equal(Composition.validateNot('/root', 'test', alwaysTrue, en3), false);
    });

    void it('validateIfThenElse + validateDependentSchemas + validateCustomKeywords', () => {
      // validateIfThenElse
      const ei1: ValidationErrorType[] = [];
      const rite1 = Composition.validateIfThenElse('test', '', undefined, undefined, undefined, ei1, true, false, false, false);

      assert.equal(rite1.valid, true);
      assert.equal(rite1.value, 'test');

      const ei2: ValidationErrorType[] = [];

      assert.equal(Composition.validateIfThenElse('test', '', alwaysTrue, passingValidator(), undefined, ei2, true, false, false, false).valid, true);

      const ei3: ValidationErrorType[] = [];

      assert.equal(Composition.validateIfThenElse('test', '/root', alwaysTrue, failingValidator(), undefined, ei3, true, false, false, false).valid, false);

      const ei4: ValidationErrorType[] = [];

      assert.equal(Composition.validateIfThenElse('test', '', alwaysFalse, undefined, passingValidator(), ei4, true, false, false, false).valid, true);

      const ei5: ValidationErrorType[] = [];

      assert.equal(Composition.validateIfThenElse('test', '', alwaysFalse, undefined, undefined, ei5, true, false, false, false).valid, true);

      // validateDependentSchemas
      const ed1: ValidationErrorType[] = [];
      const rds1 = Composition.validateDependentSchemas({ 'a': 1 }, '', undefined, ed1, true, false, false, false);

      assert.equal(rds1.valid, true);
      assert.equal(rds1.earlyExit, false);

      const ed2: ValidationErrorType[] = [];
      const rds2 = Composition.validateDependentSchemas({ 'a': 1 }, '', [{
        'trigger': 'a',
        'validator': passingValidator()
      }], ed2, true, false, false, false);

      assert.equal(rds2.valid, true);
      assert.equal(rds2.earlyExit, false);

      const ed3: ValidationErrorType[] = [];
      const rds3 = Composition.validateDependentSchemas('not-an-object', '', [{
        'trigger': 'a',
        'validator': failingValidator()
      }], ed3, true, false, false, false);

      assert.equal(rds3.valid, true);

      // validateCustomKeywords
      const eck1: ValidationErrorType[] = [];
      const rck1 = Composition.validateCustomKeywords('', 'test', undefined, eck1);

      assert.equal(rck1, true);
      assert.equal(eck1.length, 0);

      const eck2: ValidationErrorType[] = [];
      const rck2 = Composition.validateCustomKeywords('', 42, [{
        'allowedTypes': undefined,
        'keyword': 'x-even',
        'schemaValue': true,
        'validate': () => {
          return true;
        }
      }], eck2);

      assert.equal(rck2, true);
      assert.equal(eck2.length, 0);

      const eck3: ValidationErrorType[] = [];
      const rck3 = Composition.validateCustomKeywords('/root', 42, [{
        'allowedTypes': undefined,
        'keyword': 'x-fail',
        'schemaValue': true,
        'validate': () => {
          return false;
        }
      }], eck3);

      assert.equal(rck3, false);
      assert.equal(eck3.length, 1);
    });
  });
}

