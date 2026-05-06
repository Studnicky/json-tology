// Merged from: conditionalValidation.test.ts, discriminatorValidation.test.ts, containsValidation.test.ts, patternPropertiesValidation.test.ts, validationEdgeCases.test.ts, validationErrorsViews.test.ts, arrays.test.ts, objects.test.ts, scalars.test.ts, compositionExec.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// Validation type aliases (CheckFnType, ValidateWithErrorsFnType, ValidationErrorType) are internal contracts for the exec primitives below.
import type {
  CheckFnType, ValidateWithErrorsFnType, ValidationErrorType
} from '../../src/types/Validation.js';
// CustomKeywordEntryInterface is the internal compiled-keyword shape consumed by the validation runtime.
import type { CustomKeywordEntryInterface } from '../../src/interfaces/CustomKeywordEntry.js';
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
    void it('validates then branch when if matches', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/ITE1';

      registry.register(makeThenElseSchema(
        schemaId,
        { 'properties': { 'kind': { 'const': 'person' } } },
        {
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name']
        }
      ));

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates else branch when if does not match', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/ITE2';

      registry.register(makeThenElseSchema(
        schemaId,
        { 'properties': { 'kind': { 'const': 'org' } } },
        {
          'properties': { 'orgName': { 'type': 'string' } },
          'required': ['orgName']
        },
        {
          'properties': { 'label': { 'type': 'string' } },
          'required': ['label']
        }
      ));

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates if does not match and no else branch', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/ITE3';

      registry.register(makeThenElseSchema(
        schemaId,
        { 'properties': { 'kind': { 'const': 'special' } } },
        {
          'properties': { 'code': { 'type': 'number' } },
          'required': ['code']
        }
      ));

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
  // allOf
  // ---------------------------------------------------------------------------

  void describe('allOf validation', () => {
    void it('validates allOf requiring all subschemas to match', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/AllOf1';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
      ];

      for (const {
        data, name, valid
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates allOf with overlapping property constraints', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/AllOfOverlap';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
  // anyOf
  // ---------------------------------------------------------------------------

  void describe('anyOf validation', () => {
    void it('validates anyOf accepting data matching any branch', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/AnyOf1';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
  // oneOf
  // ---------------------------------------------------------------------------

  void describe('oneOf validation', () => {
    void it('validates oneOf accepting data matching exactly one branch', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/OneOf1';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
  // not
  // ---------------------------------------------------------------------------

  void describe('not validation', () => {
    void it('validates not rejecting data matching the negated schema', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/Not1';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
  // dependentRequired
  // ---------------------------------------------------------------------------

  void describe('dependentRequired validation', () => {
    void it('validates dependent properties when trigger is present', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/DepReq1';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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
  // dependentSchemas
  // ---------------------------------------------------------------------------

  void describe('dependentSchemas validation', () => {
    void it('validates dependent schema when trigger property is present', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://cond.test/DepSchema1';

      const schema: Record<string, unknown> = {
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
      };

      registry.register(schema);

      const scenarios: Array<{ 'data': unknown;
        'name': string;
        'valid': boolean }> = [
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

        registry.register(schema);
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

    registry.register({
      '$id': 'https://disc.test/BranchA',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/BranchB',
      'properties': {
        'x': { 'type': 'number' },
        'y': { 'type': 'number' }
      },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/OverlapOneOf',
      'oneOf': [
        { '$ref': 'https://disc.test/BranchA' },
        { '$ref': 'https://disc.test/BranchB' }
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/EmptyOneOf',
      'oneOf': [],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/BoolOneOf',
      'oneOf': [
        true,
        false
      ]
    });

    registry.register({
      '$id': 'https://disc.test/StringObj',
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    });

    registry.register({
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

    for (const {
      data, name, schema, valid
    } of scenarios) {
      void it(name, () => {
        const errors = registry.validate(schema, data);

        assert.equal(errors.length === 0, valid, name);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // anyOf edge cases
  // ---------------------------------------------------------------------------

  void describe('anyOf edge cases', () => {
    const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

    registry.register({
      '$id': 'https://disc.test/AnyBranchX',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AnyBranchY',
      'properties': { 'y': { 'type': 'number' } },
      'required': ['y'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/NoMatchAnyOf',
      'anyOf': [
        { '$ref': 'https://disc.test/AnyBranchX' },
        { '$ref': 'https://disc.test/AnyBranchY' }
      ],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AllBranchReqX',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AllBranchOptX',
      'properties': { 'x': { 'type': 'number' } },
      'type': 'object'
    });

    registry.register({
      '$id': 'https://disc.test/AllMatchAnyOf',
      'anyOf': [
        { '$ref': 'https://disc.test/AllBranchReqX' },
        { '$ref': 'https://disc.test/AllBranchOptX' }
      ],
      'type': 'object'
    });

    registry.register({
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

    for (const {
      data, name, schema, valid
    } of scenarios) {
      void it(name, () => {
        const errors = registry.validate(schema, data);

        assert.equal(errors.length === 0, valid, name);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Discriminated union patterns (const-based discriminator via $ref)
  // ---------------------------------------------------------------------------

  void describe('Discriminated union validation', () => {
    const shapeRegistry = JsonTology.create({ 'baseIRI': 'urn:test:' });

    shapeRegistry.register({
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

    shapeRegistry.register({
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

    shapeRegistry.register({
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

    for (const {
      data, name, valid
    } of shapeScenarios) {
      void it(name, () => {
        const errors = shapeRegistry.validate('https://disc.test/Shape', data);

        assert.equal(errors.length === 0, valid, name);
      });
    }

    const eventRegistry = JsonTology.create({ 'baseIRI': 'urn:test:' });

    eventRegistry.register({
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

    eventRegistry.register({
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

    eventRegistry.register({
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

    eventRegistry.register({
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

    for (const {
      data, name, valid
    } of eventScenarios) {
      void it(name, () => {
        const errors = eventRegistry.validate('https://disc.test/Event', data);

        assert.equal(errors.length === 0, valid, name);
      });
    }
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

      registry.register({
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

        registry.register(schema);
        assert.equal(registry.validate(schema.$id as string, data).length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // minContains
  // ---------------------------------------------------------------------------

  void describe('minContains validation', () => {
    void it('validates minContains 0 scenarios', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/MinZero';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
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
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates minContains 2 scenarios', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/MinTwo';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
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
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates minContains greater than array length always fails', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/MinExceedsLength';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
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
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // maxContains
  // ---------------------------------------------------------------------------

  void describe('maxContains validation', () => {
    void it('validates maxContains 1 scenarios', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/MaxOne';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
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
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates maxContains 0 scenarios', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/MaxZero';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
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
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // minContains + maxContains range
  // ---------------------------------------------------------------------------

  void describe('minContains and maxContains range', () => {
    void it('validates matching count within min and max bounds', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/Range';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
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
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
      }
    });

    void it('validates maxContains less than minContains always fails', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const schemaId = 'https://contains.test/Impossible';

      registry.register({
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

      const scenarios: Array<{ 'data': unknown;
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
      } of scenarios) {
        const errors = registry.validate(schemaId, data);

        assert.equal(errors.length === 0, valid, name);
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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

      registry.register({
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
    const rejectScenarios: Array<{
      'name': string;
      'schema': Record<string, unknown>;
    }> = [{
      'name': 'rejects schema with empty string $id',
      'schema': {
        '$id': '',
        'properties': { 'x': { 'type': 'string' } },
        'type': 'object'
      }
    }];

    for (const {
      'name': n, 'schema': sch
    } of rejectScenarios) {
      void it(n, () => {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        assert.throws(
          () => {
            registry.register(sch);
          },
          `${n} should throw`
        );
      });
    }

    const acceptScenarios: Array<{
      'data': Record<string, unknown>;
      'expected': string[];
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'data': {},
        'expected': [],
        'name': 'schema with only $id and type validates empty object',
        'schema': {
          '$id': 'https://edge.test/EmptyObj',
          'type': 'object'
        }
      },
      {
        'data': { 'anything': true },
        'expected': [],
        'name': 'schema with only $id and type allows extra properties',
        'schema': {
          '$id': 'https://edge.test/EmptyObj2',
          'type': 'object'
        }
      },
      {
        'data': {},
        'expected': [],
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
      void it(name, () => {
        const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

        registry.register(schema);
        assert.ok(registry.validate(schema.$id as string, data).ok, `expected valid: ${name}`);
      });
    }

    void it('handles registerAnonymous and validates against synthetic ID', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });
      const syntheticId = registry.registerAnonymous({
        'properties': { 'value': { 'type': 'number' } },
        'required': ['value'],
        'type': 'object'
      });

      assert.ok(syntheticId.startsWith('urn:json-tology:'), 'synthetic ID has expected prefix');
      assert.ok(registry.validate(syntheticId, { 'value': 42 }).ok, 'valid data passes');
      assert.ok(registry.validate(syntheticId, { 'value': 'not-a-number' }).length > 0, 'invalid data fails');
    });
  });

  // ---------------------------------------------------------------------------
  // Numeric boundary scenarios
  // ---------------------------------------------------------------------------

  void describe('Numeric boundary validation', () => {
    void describe('minimum/maximum at exact boundaries', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/NumBounds', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });

    void describe('exclusiveMinimum and exclusiveMaximum', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/ExclBounds', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });

    void describe('multipleOf with integers', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/MultOf', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // String constraint scenarios
  // ---------------------------------------------------------------------------

  void describe('String constraint validation', () => {
    void describe('string length constraints at boundaries', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/StrLen', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });

    void describe('pattern constraint', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/Pattern', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Array constraint scenarios
  // ---------------------------------------------------------------------------

  void describe('Array constraint validation', () => {
    const scenarios: Array<{
      'data': Record<string, unknown>;
      'name': string;
      'valid': boolean;
    }> = [
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

    registry.register({
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
      void it(name, () => {
        const errors = registry.validate('https://edge.test/ArrayItems', data);

        if (valid) {
          assert.ok(errors.ok);
        } else {
          assert.ok(errors.length > 0);
        }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Enum/const scenarios
  // ---------------------------------------------------------------------------

  void describe('Enum and const validation', () => {
    void describe('enum constraints', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/Enum', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });

    void describe('const constraints', () => {
      const scenarios: Array<{
        'data': Record<string, unknown>;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/Const', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Validation boundary -- wrong top-level type
  // ---------------------------------------------------------------------------

  void describe('Top-level type validation', () => {
    const scenarios: Array<{
      'data': unknown;
      'name': string;
      'schemaId': string;
      'valid': boolean;
    }> = [
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

    registry.register({
      '$id': 'https://edge.test/NoReq',
      'properties': {
        'a': { 'type': 'string' },
        'b': { 'type': 'number' }
      },
      'type': 'object'
    });

    registry.register({
      '$id': 'https://edge.test/ObjOnly',
      'type': 'object'
    });

    for (const {
      data, name, schemaId, valid
    } of scenarios) {
      void it(name, () => {
        const errors = registry.validate(schemaId, data);

        if (valid) {
          assert.ok(errors.ok);
        } else {
          assert.ok(errors.length > 0);
        }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Coercion edge cases
  // ---------------------------------------------------------------------------

  void describe('Coercion edge cases', () => {
    void describe('coerce applies nested defaults', () => {
      const scenarios: Array<{
        'expected': unknown;
        'name': string;
        'value': unknown;
      }> = [
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

      registry.register({
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
        void it(n, () => {
          const parts = (path as string).split('.');
          let current: unknown = result;

          for (const part of parts) {
            current = (current as Record<string, unknown>)[part];
          }

          assert.equal(current, exp);
        });
      }
    });

    void it('coerce does not mutate the input object', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
    });

    void it('coerce throws InstantiationError with path info on nested failure', () => {
      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register({
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
        assert.ok(error instanceof InstantiationError, 'nested failure: instanceof InstantiationError');
        assert.ok(error.errors.length > 0, 'nested failure: has errors');
      }
    });

    void describe('castTypes coercion', () => {
      const scenarios: Array<{
        'expectedType': string;
        'expectedValue': unknown;
        'input': Record<string, unknown>;
        'name': string;
      }> = [{
        'expectedType': 'number',
        'expectedValue': 25,
        'input': {
          'age': '25',
          'name': 'Alice'
        },
        'name': 'coerces string number to number'
      }];

      for (const {
        'expectedType': expType, 'expectedValue': expVal, 'input': inp, 'name': n
      } of scenarios) {
        void it(n, () => {
          const registry = JsonTology.create({
            'baseIRI': 'urn:test:',
            'enableTypeCast': true
          });

          registry.register({
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

          const result = registry.instantiate('https://edge.test/CastNum', inp) as Record<string, unknown>;

          assert.equal(result.age, expVal);
          assert.equal(typeof result.age, expType);
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-schema $ref validation
  // ---------------------------------------------------------------------------

  void describe('Cross-schema $ref validation', () => {
    void describe('validates data against cross-schema refs', () => {
      const scenarios: Array<{
        'data': unknown;
        'name': string;
        'valid': boolean;
      }> = [
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

      const registry = JsonTology.create({ 'baseIRI': 'urn:test:' });

      registry.register([
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/City', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
      }
    });

    void describe('deeply chained refs (A -> B -> C)', () => {
      const scenarios: Array<{
        'data': unknown;
        'name': string;
        'valid': boolean;
      }> = [
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

      registry.register([
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
        void it(name, () => {
          const errors = registry.validate('https://edge.test/A', data);

          if (valid) {
            assert.ok(errors.ok);
          } else {
            assert.ok(errors.length > 0);
          }
        });
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

          assert.ok(owl['@graph'] !== undefined, 'OWL output has @graph');
          const graph = owl['@graph'] as Array<Record<string, unknown>>;
          const markerClass = graph.find((node) => {
            return node['@id'] === 'https://edge.test/Marker';
          });

          assert.ok(markerClass !== undefined, 'Marker class present in OWL graph');
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

          assert.ok(graph.length > 0, 'SHACL graph has nodes');
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
          assert.ok(jt.validate('https://edge.test/Tree', {
            'children': [{
              'children': [],
              'label': 'child'
            }],
            'label': 'root'
          }).ok, 'recursive data validates');

          const owl = jt.ontology().jsonLdObject();

          assert.ok(owl['@graph'] !== undefined, 'recursive schema serializes without infinite loop');
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

    for (const {
      'check': chk, 'name': n, 'schemas': schs
    } of scenarios) {
      void it(n, () => {
        const jt = JsonTology.create({
          'baseIRI': 'https://edge.test',
          'schemas': schs
        });

        chk(jt);
      });
    }
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
            assert.deepEqual(jt.list(), []);
          },
          'name': 'list() returns empty array when no schemas registered'
        },
        {
          'check': (jt) => {
            assert.equal(jt.has('https://edge.test/Nonexistent'), false);
          },
          'name': 'has() returns false for unknown schema'
        },
        {
          'check': (jt) => {
            assert.equal(jt.get('https://edge.test/Nonexistent'), undefined);
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

      for (const {
        check, name
      } of scenarios) {
        void it(name, () => {
          const jt = JsonTology.create({ 'baseIRI': 'https://edge.test' });

          check(jt);
        });
      }
    });

    void it('register() chains and accumulates schemas', () => {
      const jt = JsonTology.create({ 'baseIRI': 'https://edge.test' });

      jt.register({
        '$id': 'https://edge.test/First',
        'type': 'object'
      });
      jt.register({
        '$id': 'https://edge.test/Second',
        'type': 'object'
      });

      assert.equal(jt.list().length, 2, 'two schemas registered');
      assert.ok(jt.has('https://edge.test/First'), 'First schema present');
      assert.ok(jt.has('https://edge.test/Second'), 'Second schema present');
    });

    void it('ontology cache invalidates after register()', () => {
      const jt = JsonTology.create({
        'baseIRI': 'https://edge.test',
        'schemas': [{
          '$id': 'https://edge.test/A',
          'type': 'object'
        }] as const
      });

      const ont1 = jt.ontology();

      jt.register({
        '$id': 'https://edge.test/B',
        'type': 'object'
      });

      const ont2 = jt.ontology();

      assert.notStrictEqual(ont1, ont2, 'new ontology instance after registration');
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
    void it('returns zero count and empty arrays when there are no errors', () => {
      const errs = new ValidationErrors([]);
      const rollup = errs.aggregate();

      assert.equal(rollup.count, 0, 'count is 0');
      assert.deepEqual(rollup.paths, [], 'paths is empty');
      assert.deepEqual(rollup.keywords, [], 'keywords is empty');
    });

    void it('count matches .length', () => {
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
    });

    void it('deduplicates paths and keywords', () => {
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
    });

    void it('returns paths and keywords sorted alphabetically', () => {
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
    });

    void it('includes root errors (empty path) in paths', () => {
      const errs = new ValidationErrors([{
        'keyword': 'required',
        'message': "must have required property 'name'",
        'params': { 'missingProperty': 'name' },
        'path': ''
      }]);

      const rollup = errs.aggregate();

      assert.deepEqual(rollup.paths, [''], 'root error path is empty string');
      assert.equal(rollup.count, 1, 'count is 1');
    });

    void it('is safe to spread into a structured log line', () => {
      const errs = new ValidationErrors([{
        'keyword': 'type',
        'message': 'must be string',
        'params': { 'type': 'string' },
        'path': '/name'
      }]);

      const rollup = errs.aggregate();
      const logLine = {
        ...rollup,
        'schema': 'https://example.com/User'
      };

      assert.equal(logLine.count, 1, 'spread count');
      assert.deepEqual(logLine.paths, ['name'], 'spread paths (access form)');
      assert.deepEqual(logLine.keywords, ['type'], 'spread keywords');
      assert.equal(logLine.schema, 'https://example.com/User', 'additional field preserved');
    });
  });

  // ---------------------------------------------------------------------------
  // report()
  // ---------------------------------------------------------------------------

  void describe('ValidationErrors.report()', () => {
    void it('returns RFC 7807 shape with default type/title/status', () => {
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
    });

    void it('detail is singular when there is exactly 1 error', () => {
      const errs = new ValidationErrors([{
        'keyword': 'type',
        'message': 'must be string',
        'params': {},
        'path': '/name'
      }]);

      assert.equal(errs.report().detail, '1 validation error', 'singular detail');
    });

    void it('detail is plural when there are multiple errors', () => {
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
    });

    void it('each errors entry carries path, keyword, message, params', () => {
      const errs = new ValidationErrors([{
        'keyword': 'format',
        'message': 'must match format "uuid"',
        'params': { 'format': 'uuid' },
        'path': '/id'
      }]);

      const problem = errs.report();

      assert.equal(problem.errors.length, 1, 'one error entry');
      assert.deepEqual(
        problem.errors,
        [{
          'keyword': 'format',
          'message': 'must match format "uuid"',
          'params': { 'format': 'uuid' },
          'path': '/id'
        }],
        'errors entry carries all fields'
      );
    });

    void it('overrides merge over defaults', () => {
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
    });

    void it('instance is undefined when not provided', () => {
      const errs = new ValidationErrors([{
        'keyword': 'type',
        'message': 'err',
        'params': {},
        'path': ''
      }]);

      assert.equal(errs.report().instance, undefined, 'instance is undefined by default');
    });

    void it('payload survives structuredClone round-trip identically', () => {
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
      const cloned = structuredClone(problem);

      assert.deepEqual(cloned, problem, 'structuredClone round-trip is identical');
    });

    void it('errors array is empty when ValidationErrors has no items', () => {
      const errs = new ValidationErrors([]);
      const problem = errs.report();

      assert.equal(problem.errors.length, 0, 'no error entries');
      assert.equal(problem.detail, '0 validation errors', 'zero plural detail');
    });
  });
}

// ===========================================================================
// Source: arrays.test.ts
// ===========================================================================
{
  const passing: ValidateWithErrorsFnType = ((value: unknown) => {
    return {
      'valid': true,
      value
    };
  }) as ValidateWithErrorsFnType;
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

  void describe('Arrays', () => {
    void describe('validateBounds', () => {
      void it('returns valid when array is within bounds', () => {
        const result = Arrays.validateBounds('/a', [
          1,
          2,
          3
        ], 1, 5, false);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when array is below minItems', () => {
        const result = Arrays.validateBounds('/a', [1], 3, undefined, false);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'minItems');
      });

      void it('returns invalid when array is above maxItems', () => {
        const result = Arrays.validateBounds('/a', [
          1,
          2,
          3,
          4
        ], undefined, 2, false);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'maxItems');
      });

      void it('returns invalid when uniqueItems is true and array has duplicates', () => {
        const result = Arrays.validateBounds('/a', [
          1,
          2,
          2,
          3
        ], undefined, undefined, true);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'uniqueItems');
      });

      void it('returns valid when uniqueItems is true and all items are unique', () => {
        const result = Arrays.validateBounds('/a', [
          1,
          2,
          3
        ], undefined, undefined, true);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });
    });

    void describe('validateContains', () => {
      void it('returns valid when containsCheck is undefined', () => {
        const result = Arrays.validateContains('/a', [
          1,
          2
        ]);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when at least one item matches', () => {
        const result = Arrays.validateContains('/a', [
          1,
          2,
          3
        ], passingCheck);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when no item matches', () => {
        const result = Arrays.validateContains('/a', [
          1,
          2,
          3
        ], failingCheck);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'contains');
      });

      void it('returns invalid when match count is below minContains', () => {
        const result = Arrays.validateContains('/a', [
          1,
          2,
          3
        ], oneMatch, 2);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.match(result.errors[0].message, /at least 2/u);
      });

      void it('returns invalid when match count is above maxContains', () => {
        const result = Arrays.validateContains('/a', [
          1,
          2,
          3
        ], passingCheck, undefined, 2);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.match(result.errors[0].message, /at most 2/u);
      });
    });

    void describe('validateItems', () => {
      void it('returns valid when itemValidator is undefined', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validateItems('/a', [
          1,
          2
        ], undefined, undefined, errors, false, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns valid when all items pass', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validateItems('/a', [
          1,
          2,
          3
        ], passing, undefined, errors, false, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns earlyExit when item fails and collectErrors is false', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validateItems('/a', [
          1,
          2
        ], failing, undefined, errors, false, false, false, false);

        assert.equal(result.valid, false);
        assert.equal(result.earlyExit, true);
      });

      void it('collects errors when item fails and collectErrors is true', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validateItems('/a', [
          1,
          2
        ], failing, undefined, errors, true, false, false, false);

        assert.equal(result.valid, false);
        assert.equal(result.earlyExit, false);
        assert.equal(errors.length, 2);
      });

      void it('skips prefix items when prefixValidators are present', () => {
        const errors: ValidationErrorType[] = [];
        const arr = [
          1,
          2,
          3,
          4
        ];
        const prefixValidators = [
          passing,
          passing
        ];
        const result = Arrays.validateItems('/a', arr, passing, prefixValidators, errors, false, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });
    });

    void describe('validatePrefixItems', () => {
      void it('returns valid when prefixValidators is undefined', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validatePrefixItems('/a', [
          1,
          2
        ], undefined, errors, false, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns valid when all prefix items pass', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validatePrefixItems('/a', [
          1,
          2,
          3
        ], [
          passing,
          passing
        ], errors, false, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns earlyExit when prefix item fails and collectErrors is false', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validatePrefixItems('/a', [
          1,
          2
        ], [
          failing,
          passing
        ], errors, false, false, false, false);

        assert.equal(result.valid, false);
        assert.equal(result.earlyExit, true);
      });

      void it('collects errors when prefix item fails and collectErrors is true', () => {
        const errors: ValidationErrorType[] = [];
        const result = Arrays.validatePrefixItems('/a', [
          1,
          2
        ], [
          failing,
          failing
        ], errors, true, false, false, false);

        assert.equal(result.valid, false);
        assert.equal(result.earlyExit, false);
        assert.equal(errors.length, 2);
      });
    });
  });
}

// ===========================================================================
// Source: objects.test.ts
// ===========================================================================
{
  function passingValidator(): ValidateWithErrorsFnType {
    return ((value: unknown) => {
      return {
        'valid': true,
        'value': value
      };
    }) as ValidateWithErrorsFnType;
  }

  function failingValidator(): ValidateWithErrorsFnType {
    return ((value: unknown, path: string, errors: ValidationErrorType[]) => {
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
    }) as ValidateWithErrorsFnType;
  }

  function coercingValidator(coercedValue: unknown): ValidateWithErrorsFnType {
    return (() => {
      return {
        'valid': true,
        'value': coercedValue
      };
    }) as ValidateWithErrorsFnType;
  }

  void describe('Objects', () => {
    void describe('applyDefaults', () => {
      void it('applies missing defaults', () => {
        const obj: Record<string, unknown> = { 'a': 1 };
        const defaults = new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>([[
          'b',
          {
            'defaultValue': 42,
            'hasDefault': true
          }
        ]]);

        Objects.applyDefaults(obj, defaults);

        assert.equal(obj.b, 42);
      });

      void it('does not overwrite existing keys', () => {
        const obj: Record<string, unknown> = { 'a': 1 };
        const defaults = new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>([[
          'a',
          {
            'defaultValue': 999,
            'hasDefault': true
          }
        ]]);

        Objects.applyDefaults(obj, defaults);

        assert.equal(obj.a, 1);
      });

      void it('skips when hasDefault is false', () => {
        const obj: Record<string, unknown> = {};
        const defaults = new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>([[
          'x',
          {
            'defaultValue': 'nope',
            'hasDefault': false
          }
        ]]);

        Objects.applyDefaults(obj, defaults);

        assert.equal('x' in obj, false);
      });
    });

    void describe('validateDependentRequired', () => {
      void it('returns valid when no entries', () => {
        const errors: ValidationErrorType[] = [];
        const result = Objects.validateDependentRequired('', { 'a': 1 }, [], errors, true);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
        assert.equal(errors.length, 0);
      });

      void it('returns valid when trigger present and dep present', () => {
        const errors: ValidationErrorType[] = [];
        const entries: Array<[string, string[]]> = [[
          'a',
          ['b']
        ]];
        const result = Objects.validateDependentRequired('', {
          'a': 1,
          'b': 2
        }, entries, errors, true);

        assert.equal(result.valid, true);
        assert.equal(errors.length, 0);
      });

      void it('returns invalid when trigger present and dep missing', () => {
        const errors: ValidationErrorType[] = [];
        const entries: Array<[string, string[]]> = [[
          'a',
          ['b']
        ]];
        const result = Objects.validateDependentRequired('', { 'a': 1 }, entries, errors, true);

        assert.equal(result.valid, false);
        assert.equal(errors.length, 1);
      });

      void it('returns valid for non-object value', () => {
        const errors: ValidationErrorType[] = [];
        const entries: Array<[string, string[]]> = [[
          'a',
          ['b']
        ]];
        const result = Objects.validateDependentRequired('', 'not-an-object', entries, errors, true);

        assert.equal(result.valid, true);
      });

      void it('earlyExits when collectErrors is false', () => {
        const errors: ValidationErrorType[] = [];
        const entries: Array<[string, string[]]> = [[
          'a',
          [
            'b',
            'c'
          ]
        ]];
        const result = Objects.validateDependentRequired('', { 'a': 1 }, entries, errors, false);

        assert.equal(result.valid, false);
        assert.equal(result.earlyExit, true);
        assert.equal(errors.length, 0);
      });
    });

    void describe('validateRequired', () => {
      void it('returns valid when required is undefined', () => {
        const result = Objects.validateRequired('', { 'a': 1 });

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when all required present', () => {
        const result = Objects.validateRequired('', {
          'a': 1,
          'b': 2
        }, [
          'a',
          'b'
        ]);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid with error when missing required', () => {
        const result = Objects.validateRequired('/root', { 'a': 1 }, [
          'a',
          'b'
        ]);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
      });
    });

    void describe('validateProperties', () => {
      void it('validates known property', () => {
        const propValidators = new Map<string, ValidateWithErrorsFnType>([[
          'name',
          passingValidator()
        ]]);
        const errors: ValidationErrorType[] = [];
        const defaults = new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>();

        const result = Objects.validateProperties(
          '',
          { 'name': 'Alice' },
          propValidators,
          undefined,
          false,
          undefined,
          undefined,
          false,
          defaults,
          errors,
          true,
          false,
          false
        );

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns invalid for unknown property with additionalIsFalse', () => {
        const propValidators = new Map<string, ValidateWithErrorsFnType>();
        const errors: ValidationErrorType[] = [];
        const defaults = new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>();

        const result = Objects.validateProperties(
          '',
          { 'extra': 'bad' },
          propValidators,
          undefined,
          true,
          undefined,
          undefined,
          false,
          defaults,
          errors,
          true,
          false,
          false
        );

        assert.equal(result.valid, false);
        assert.equal(errors.length, 1);
      });

      void it('strips unknown keys when stripUnknown is true', () => {
        const propValidators = new Map<string, ValidateWithErrorsFnType>([[
          'name',
          passingValidator()
        ]]);
        const errors: ValidationErrorType[] = [];
        const defaults = new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>();
        const allowedKeys = new Set(['name']);
        const obj: Record<string, unknown> = {
          'extra': 'removed',
          'name': 'Alice'
        };

        Objects.validateProperties(
          '',
          obj,
          propValidators,
          undefined,
          false,
          undefined,
          allowedKeys,
          true,
          defaults,
          errors,
          true,
          false,
          false
        );

        assert.equal('extra' in obj, false);
        assert.equal(obj.name, 'Alice');
      });

      void it('matches pattern property', () => {
        const propValidators = new Map<string, ValidateWithErrorsFnType>();
        const patternPropValidators = [{
          'regex': /^x-/u,
          'validator': coercingValidator('coerced')
        }];
        const errors: ValidationErrorType[] = [];
        const defaults = new Map<string, { 'defaultValue': unknown;
          'hasDefault': boolean }>();
        const obj: Record<string, unknown> = { 'x-custom': 'original' };

        const result = Objects.validateProperties(
          '',
          obj,
          propValidators,
          patternPropValidators,
          false,
          undefined,
          undefined,
          false,
          defaults,
          errors,
          true,
          false,
          false
        );

        assert.equal(result.valid, true);
        assert.equal(obj['x-custom'], 'coerced');
      });
    });

    void describe('validatePropertyCount', () => {
      void it('returns valid when within bounds', () => {
        const result = Objects.validatePropertyCount('', {
          'a': 1,
          'b': 2
        }, 1, 3);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when below minProperties', () => {
        const result = Objects.validatePropertyCount('', { 'a': 1 }, 2);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
      });

      void it('returns invalid when above maxProperties', () => {
        const result = Objects.validatePropertyCount('', {
          'a': 1,
          'b': 2,
          'c': 3
        }, undefined, 2);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
      });
    });

    void describe('validatePropertyNames', () => {
      void it('returns valid when validator is undefined', () => {
        const errors: ValidationErrorType[] = [];
        const result = Objects.validatePropertyNames('', { 'a': 1 }, undefined, errors, true);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns valid when all names pass', () => {
        const errors: ValidationErrorType[] = [];
        const result = Objects.validatePropertyNames('', { 'ok': 1 }, passingValidator(), errors, true);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns invalid when a name fails', () => {
        const errors: ValidationErrorType[] = [];
        const result = Objects.validatePropertyNames('', { 'bad': 1 }, failingValidator(), errors, true);

        assert.equal(result.valid, false);
        assert.equal(errors.length, 1);
      });
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

  void describe('Scalars', () => {
    void describe('validateConst', () => {
      void it('returns valid when hasConst is false', () => {
        const result = Scalars.validateConst('/x', 'anything', false);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when value matches constVal', () => {
        const result = Scalars.validateConst('/x', 42, true, 42);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid with error when value does not match constVal', () => {
        const result = Scalars.validateConst('/x', 'wrong', true, 'expected');

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'const');
        assert.equal(result.errors[0].path, '/x');
      });
    });

    void describe('validateEnum', () => {
      void it('returns valid when enumValues is undefined', () => {
        const result = Scalars.validateEnum('/x', 'anything');

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when value is in the enum set', () => {
        const enumValues = [
          'a',
          'b',
          'c'
        ];
        const enumSet = new Set<boolean | null | number | string>([
          'a',
          'b',
          'c'
        ]);
        const result = Scalars.validateEnum('/x', 'b', enumValues, enumSet);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when value is not in the enum set', () => {
        const enumValues = [
          'a',
          'b',
          'c'
        ];
        const enumSet = new Set<boolean | null | number | string>([
          'a',
          'b',
          'c'
        ]);
        const result = Scalars.validateEnum('/x', 'z', enumValues, enumSet);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'enum');
        assert.equal(result.errors[0].path, '/x');
      });
    });

    void describe('validateFormat', () => {
      void it('returns valid when formatValidator is undefined', () => {
        const result = Scalars.validateFormat('/x', 'anything');

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when formatValidator passes', () => {
        const result = Scalars.validateFormat('/x', 'a@b.com', 'email', emailValidator);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when formatValidator fails', () => {
        const result = Scalars.validateFormat('/x', 'not-an-email', 'email', emailValidator);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'format');
        assert.match(result.errors[0].message, /email/u);
      });
    });

    void describe('validateString', () => {
      void it('returns valid when value is within bounds', () => {
        const result = Scalars.validateString('/x', 'hello', 2, 10);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when value is below minLength', () => {
        const result = Scalars.validateString('/x', 'hi', 5);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'minLength');
      });

      void it('returns invalid when value is above maxLength', () => {
        const result = Scalars.validateString('/x', 'hello world', undefined, 5);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'maxLength');
      });

      void it('returns valid when value matches pattern', () => {
        const result = Scalars.validateString('/x', 'abc123', undefined, undefined, /^[a-z]+\d+$/u, '^[a-z]+\\d+$');

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when value does not match pattern', () => {
        const result = Scalars.validateString('/x', '!!!', undefined, undefined, /^[a-z]+$/u, '^[a-z]+$');

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'pattern');
      });

      void it('returns valid when all constraints are undefined', () => {
        const result = Scalars.validateString('/x', 'anything');

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });
    });

    void describe('validateNumber', () => {
      void it('returns valid when all constraints are undefined', () => {
        const result = Scalars.validateNumber('/x', 42);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when value is below minimum', () => {
        const result = Scalars.validateNumber('/x', 3, 5);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'minimum');
      });

      void it('returns invalid when value is above maximum', () => {
        const result = Scalars.validateNumber('/x', 20, undefined, 10);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'maximum');
      });

      void it('returns invalid when value is at exclusiveMinimum', () => {
        const result = Scalars.validateNumber('/x', 5, undefined, undefined, 5);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'exclusiveMinimum');
      });

      void it('returns invalid when value is at exclusiveMaximum', () => {
        const result = Scalars.validateNumber('/x', 10, undefined, undefined, undefined, 10);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'exclusiveMaximum');
      });

      void it('returns invalid when value is not a multiple of multipleOf', () => {
        const result = Scalars.validateNumber('/x', 7, undefined, undefined, undefined, undefined, 3);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'multipleOf');
      });
    });

    void describe('validateType', () => {
      void it('returns valid when types array is empty', () => {
        const result = Scalars.validateType('/x', [], 'anything');

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when value matches a single type', () => {
        const result = Scalars.validateType('/x', ['string'], 'hello');

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when value matches one of multiple types', () => {
        const result = Scalars.validateType('/x', [
          'string',
          'number'
        ], 42);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when value matches no type', () => {
        const result = Scalars.validateType('/x', ['string'], 42);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].keyword, 'type');
        assert.equal(result.errors[0].path, '/x');
      });
    });
  });
}

// ===========================================================================
// Source: compositionExec.test.ts
// ===========================================================================
{
  function passingValidator(): ValidateWithErrorsFnType {
    return ((value: unknown) => {
      return {
        'valid': true,
        'value': value
      };
    }) as ValidateWithErrorsFnType;
  }

  function failingValidator(): ValidateWithErrorsFnType {
    return ((value: unknown, path: string, errors: ValidationErrorType[]) => {
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
    }) as ValidateWithErrorsFnType;
  }

  const alwaysTrue: CheckFnType = (_: unknown): boolean => {
    return true;
  };

  const alwaysFalse: CheckFnType = (_: unknown): boolean => {
    return false;
  };

  void describe('Composition', () => {
    void describe('validateAllOf', () => {
      void it('returns valid when validators is undefined', () => {
        const errors: ValidationErrorType[] = [];
        const result = Composition.validateAllOf('test', '', undefined, errors, true, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
        assert.equal(result.value, 'test');
      });

      void it('returns valid when all pass', () => {
        const errors: ValidationErrorType[] = [];
        const validators = [
          passingValidator(),
          passingValidator()
        ];
        const result = Composition.validateAllOf('test', '', validators, errors, true, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns earlyExit when one fails with collectErrors false', () => {
        const errors: ValidationErrorType[] = [];
        const validators = [
          passingValidator(),
          failingValidator()
        ];
        const result = Composition.validateAllOf('test', '/root', validators, errors, false, false, false, false);

        assert.equal(result.valid, false);
        assert.equal(result.earlyExit, true);
      });

      void it('collects errors when one fails with collectErrors true', () => {
        const errors: ValidationErrorType[] = [];
        const validators = [
          passingValidator(),
          failingValidator()
        ];
        const result = Composition.validateAllOf('test', '/root', validators, errors, true, false, false, false);

        assert.equal(result.valid, false);
        assert.equal(result.earlyExit, false);
        assert.equal(errors.length, 1);
      });
    });

    void describe('validateAnyOf', () => {
      void it('returns valid when checks is undefined', () => {
        const result = Composition.validateAnyOf('', 'test');

        assert.equal(result.valid, true);
        assert.equal(result.error, undefined);
      });

      void it('returns valid when one matches', () => {
        const checks: CheckFnType[] = [
          alwaysFalse,
          alwaysTrue
        ];
        const result = Composition.validateAnyOf('', 'test', checks);

        assert.equal(result.valid, true);
        assert.equal(result.error, undefined);
      });

      void it('returns invalid with error when none match', () => {
        const checks: CheckFnType[] = [
          alwaysFalse,
          alwaysFalse
        ];
        const result = Composition.validateAnyOf('/root', 'test', checks);

        assert.equal(result.valid, false);
        assert.notEqual(result.error, undefined);
      });
    });

    void describe('validateOneOf', () => {
      void it('returns valid when checks is undefined', () => {
        const result = Composition.validateOneOf('', 'test');

        assert.equal(result.valid, true);
        assert.equal(result.error, undefined);
      });

      void it('returns valid when exactly one matches', () => {
        const checks: CheckFnType[] = [
          alwaysFalse,
          alwaysTrue,
          alwaysFalse
        ];
        const result = Composition.validateOneOf('', 'test', checks);

        assert.equal(result.valid, true);
        assert.equal(result.error, undefined);
      });

      void it('returns invalid when zero match', () => {
        const checks: CheckFnType[] = [
          alwaysFalse,
          alwaysFalse
        ];
        const result = Composition.validateOneOf('/root', 'test', checks);

        assert.equal(result.valid, false);
        assert.notEqual(result.error, undefined);
      });

      void it('returns invalid when multiple match', () => {
        const checks: CheckFnType[] = [
          alwaysTrue,
          alwaysTrue
        ];
        const result = Composition.validateOneOf('/root', 'test', checks);

        assert.equal(result.valid, false);
        assert.notEqual(result.error, undefined);
      });
    });

    void describe('validateNot', () => {
      void it('returns valid when check is undefined', () => {
        const result = Composition.validateNot('', 'test');

        assert.equal(result.valid, true);
        assert.equal(result.error, undefined);
      });

      void it('returns valid when complement fails (value passes not)', () => {
        const result = Composition.validateNot('', 'test', alwaysFalse);

        assert.equal(result.valid, true);
        assert.equal(result.error, undefined);
      });

      void it('returns invalid when complement passes (value fails not)', () => {
        const result = Composition.validateNot('/root', 'test', alwaysTrue);

        assert.equal(result.valid, false);
        assert.notEqual(result.error, undefined);
      });
    });

    void describe('validateIfThenElse', () => {
      void it('returns valid when ifCheck is undefined', () => {
        const errors: ValidationErrorType[] = [];
        const result = Composition.validateIfThenElse('test', '', undefined, undefined, undefined, errors, true, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.value, 'test');
      });

      void it('returns valid when if true and then passes', () => {
        const errors: ValidationErrorType[] = [];
        const result = Composition.validateIfThenElse('test', '', alwaysTrue, passingValidator(), undefined, errors, true, false, false, false);

        assert.equal(result.valid, true);
      });

      void it('returns invalid when if true and then fails', () => {
        const errors: ValidationErrorType[] = [];
        const result = Composition.validateIfThenElse('test', '/root', alwaysTrue, failingValidator(), undefined, errors, true, false, false, false);

        assert.equal(result.valid, false);
      });

      void it('returns valid when if false and else passes', () => {
        const errors: ValidationErrorType[] = [];
        const result = Composition.validateIfThenElse('test', '', alwaysFalse, undefined, passingValidator(), errors, true, false, false, false);

        assert.equal(result.valid, true);
      });

      void it('returns valid when if false and no else', () => {
        const errors: ValidationErrorType[] = [];
        const result = Composition.validateIfThenElse('test', '', alwaysFalse, undefined, undefined, errors, true, false, false, false);

        assert.equal(result.valid, true);
      });
    });

    void describe('validateDependentSchemas', () => {
      void it('returns valid when validators is undefined', () => {
        const errors: ValidationErrorType[] = [];
        const result = Composition.validateDependentSchemas({ 'a': 1 }, '', undefined, errors, true, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns valid when trigger present and schema passes', () => {
        const errors: ValidationErrorType[] = [];
        const deps = [{
          'trigger': 'a',
          'validator': passingValidator()
        }];
        const result = Composition.validateDependentSchemas({ 'a': 1 }, '', deps, errors, true, false, false, false);

        assert.equal(result.valid, true);
        assert.equal(result.earlyExit, false);
      });

      void it('returns valid for non-object value', () => {
        const errors: ValidationErrorType[] = [];
        const deps = [{
          'trigger': 'a',
          'validator': failingValidator()
        }];
        const result = Composition.validateDependentSchemas('not-an-object', '', deps, errors, true, false, false, false);

        assert.equal(result.valid, true);
      });
    });

    void describe('validateCustomKeywords', () => {
      void it('returns valid when entries is undefined', () => {
        const result = Composition.validateCustomKeywords('', 'test');

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns valid when all pass', () => {
        const entries: CustomKeywordEntryInterface[] = [{
          'allowedTypes': undefined,
          'keyword': 'x-even',
          'schemaValue': true,
          'validate': (() => {
            return true;
          }) as CustomKeywordEntryInterface['validate']
        }];
        const result = Composition.validateCustomKeywords('', 42, entries);

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      });

      void it('returns invalid when one fails', () => {
        const entries: CustomKeywordEntryInterface[] = [{
          'allowedTypes': undefined,
          'keyword': 'x-fail',
          'schemaValue': true,
          'validate': (() => {
            return false;
          }) as CustomKeywordEntryInterface['validate']
        }];
        const result = Composition.validateCustomKeywords('/root', 42, entries);

        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
      });
    });
  });
}

