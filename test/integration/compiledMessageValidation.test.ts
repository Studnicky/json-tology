/**
 * Compiled-path message validation tests.
 *
 * For every (schema, data) scenario, asserts the compiled path (registry.validate)
 * verdict, error presence, and — for invalid cases — the keyword and
 * VALIDATION_MESSAGES-sourced message of the expected error.
 *
 * Keywords covered:
 *   minProperties, maxProperties, additionalProperties, dependentRequired,
 *   anyOf, oneOf, uniqueItems, contains, enum, format, contentEncoding,
 *   contentMediaType
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';
import { VALIDATION_MESSAGES } from '../../src/constants/VALIDATION_MESSAGES.js';
import type { ValidationErrorType } from '../../src/types/Validation.js';

type ErrorSummaryType = {
  'keyword': string;
  'message': string;
};

type ValidScenario = {
  'data': unknown;
  'description': string;
  'valid': true;
};

type InvalidScenario = {
  'data': unknown;
  'description': string;
  'expectedKeyword': string;
  'expectedMessage': string;
  'valid': false;
};

type Scenario = InvalidScenario | ValidScenario;

function assertCompiledMessages(
  jt: JsonTology,
  schemaId: string,
  scenarios: Scenario[]
): void {
  for (const scenario of scenarios) {
    const {
      data, description, valid
    } = scenario;
    const compiledErrors = [...jt.registry.validate(schemaId, data).items];
    const verdictCompiled = compiledErrors.length === 0;

    assert.equal(verdictCompiled, valid, `compiled verdict: ${description}`);

    if (valid) {
      assert.equal(compiledErrors.length, 0, `expected no errors for: ${description}`);
    } else {
      assert.ok(compiledErrors.length > 0, `expected errors for: ${description}`);

      const {
        expectedKeyword, expectedMessage
      } = scenario;
      const match = compiledErrors.find((err: ValidationErrorType): boolean => {
        return err.keyword === expectedKeyword && err.message === expectedMessage;
      });

      const actualSummary = JSON.stringify(compiledErrors.map((err: ValidationErrorType): ErrorSummaryType => {
        return {
          'keyword': err.keyword,
          'message': err.message
        };
      }));
      const failureMessage = `expected error with keyword="${expectedKeyword}" message="${expectedMessage}" for: ${description}\nactual errors: ${actualSummary}`;

      assert.ok(match !== undefined, failureMessage);
    }
  }
}

void describe('compiled-path message validation', () => {
  // ---------------------------------------------------------------------------
  // minProperties
  // ---------------------------------------------------------------------------

  void it('keyword: minProperties', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:MinProps',
      'minProperties': 2,
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'a': 1,
          'b': 2
        },
        'description': 'exactly minProperties — valid',
        'valid': true
      },
      {
        'data': { 'a': 1 },
        'description': 'one property when min is 2 — invalid',
        'expectedKeyword': 'minProperties',
        'expectedMessage': VALIDATION_MESSAGES.minProperties(2),
        'valid': false
      },
      {
        'data': {},
        'description': 'zero properties when min is 2 — invalid',
        'expectedKeyword': 'minProperties',
        'expectedMessage': VALIDATION_MESSAGES.minProperties(2),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:MinProps', scenarios);
  });

  // ---------------------------------------------------------------------------
  // maxProperties
  // ---------------------------------------------------------------------------

  void it('keyword: maxProperties', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:MaxProps',
      'maxProperties': 2,
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'a': 1,
          'b': 2
        },
        'description': 'exactly maxProperties — valid',
        'valid': true
      },
      {
        'data': {
          'a': 1,
          'b': 2,
          'c': 3
        },
        'description': 'three properties when max is 2 — invalid',
        'expectedKeyword': 'maxProperties',
        'expectedMessage': VALIDATION_MESSAGES.maxProperties(2),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:MaxProps', scenarios);
  });

  // ---------------------------------------------------------------------------
  // additionalProperties
  // ---------------------------------------------------------------------------

  void it('keyword: additionalProperties: false', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:AdditionalProps',
      'additionalProperties': false,
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': { 'name': 'Alice' },
        'description': 'only known property — valid',
        'valid': true
      },
      {
        'data': {
          'extra': 'x',
          'name': 'Alice'
        },
        'description': 'additional property present — invalid',
        'expectedKeyword': 'additionalProperties',
        'expectedMessage': VALIDATION_MESSAGES.additionalProperties('extra'),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:AdditionalProps', scenarios);
  });

  // ---------------------------------------------------------------------------
  // dependentRequired
  // ---------------------------------------------------------------------------

  void it('keyword: dependentRequired', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:DepReq',
      'dependentRequired': { 'email': ['username'] },
      'properties': {
        'email': { 'type': 'string' },
        'username': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'email': 'a@b.com',
          'username': 'alice'
        },
        'description': 'email + username — valid',
        'valid': true
      },
      {
        'data': { 'email': 'a@b.com' },
        'description': 'email without username — invalid',
        'expectedKeyword': 'dependentRequired',
        'expectedMessage': VALIDATION_MESSAGES.dependentRequired('username', 'email'),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:DepReq', scenarios);
  });

  // ---------------------------------------------------------------------------
  // anyOf
  // ---------------------------------------------------------------------------

  void it('keyword: anyOf', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:msg-parity:',
      'enableStrictGraph': false
    });

    jt.set({
      '$id': 'urn:msg-parity:AnyOf',
      'anyOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    });

    const scenarios: Scenario[] = [
      {
        'data': 'hello',
        'description': 'string matches first branch — valid',
        'valid': true
      },
      {
        'data': 42,
        'description': 'number matches second branch — valid',
        'valid': true
      },
      {
        'data': true,
        'description': 'boolean matches no branch — invalid',
        'expectedKeyword': 'anyOf',
        'expectedMessage': VALIDATION_MESSAGES.anyOf,
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:AnyOf', scenarios);
  });

  // ---------------------------------------------------------------------------
  // oneOf
  // ---------------------------------------------------------------------------

  void it('keyword: oneOf', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:msg-parity:',
      'enableStrictGraph': false
    });

    jt.set({
      '$id': 'urn:msg-parity:OneOf',
      'oneOf': [
        { 'type': 'string' },
        { 'type': 'number' }
      ]
    });

    const scenarios: Scenario[] = [
      {
        'data': 'hello',
        'description': 'string matches exactly one branch — valid',
        'valid': true
      },
      {
        'data': true,
        'description': 'boolean matches no branch — invalid',
        'expectedKeyword': 'oneOf',
        'expectedMessage': VALIDATION_MESSAGES.oneOf,
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:OneOf', scenarios);
  });

  // ---------------------------------------------------------------------------
  // uniqueItems
  // ---------------------------------------------------------------------------

  void it('keyword: uniqueItems', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:UniqueItems',
      'items': { 'type': 'number' },
      'type': 'array',
      'uniqueItems': true
    });

    const scenarios: Scenario[] = [
      {
        'data': [
          1,
          2,
          3
        ],
        'description': 'all unique — valid',
        'valid': true
      },
      {
        'data': [
          1,
          2,
          1
        ],
        'description': 'duplicate value — invalid',
        'expectedKeyword': 'uniqueItems',
        'expectedMessage': VALIDATION_MESSAGES.uniqueItems,
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:UniqueItems', scenarios);
  });

  // ---------------------------------------------------------------------------
  // contains
  // ---------------------------------------------------------------------------

  void it('keyword: contains', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:Contains',
      'contains': { 'type': 'string' },
      'type': 'array'
    });

    const scenarios: Scenario[] = [
      {
        'data': [
          1,
          'hello',
          2
        ],
        'description': 'contains a string — valid',
        'valid': true
      },
      {
        'data': [
          1,
          2,
          3
        ],
        'description': 'no string element — invalid',
        'expectedKeyword': 'contains',
        'expectedMessage': VALIDATION_MESSAGES.contains(1),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:Contains', scenarios);
  });

  // ---------------------------------------------------------------------------
  // enum
  // ---------------------------------------------------------------------------

  void it('keyword: enum', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:Enum',
      'enum': [
        'a',
        'b',
        'c'
      ]
    });

    const scenarios: Scenario[] = [
      {
        'data': 'a',
        'description': 'value in enum — valid',
        'valid': true
      },
      {
        'data': 'd',
        'description': 'value not in enum — invalid',
        'expectedKeyword': 'enum',
        'expectedMessage': VALIDATION_MESSAGES.enum,
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:Enum', scenarios);
  });

  // ---------------------------------------------------------------------------
  // format (strict-by-default)
  // ---------------------------------------------------------------------------

  void it('keyword: format', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:Format',
      'format': 'email',
      'type': 'string'
    });

    const scenarios: Scenario[] = [
      {
        'data': 'alice@example.com',
        'description': 'valid email — passes',
        'valid': true
      },
      {
        'data': 'not-an-email',
        'description': 'invalid email — fails with format message',
        'expectedKeyword': 'format',
        'expectedMessage': VALIDATION_MESSAGES.format('email'),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:Format', scenarios);
  });

  // ---------------------------------------------------------------------------
  // contentEncoding (strict-by-default)
  // ---------------------------------------------------------------------------

  void it('keyword: contentEncoding', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:ContentEncoding',
      'contentEncoding': 'base64',
      'type': 'string'
    });

    const scenarios: Scenario[] = [
      {
        'data': 'aGVsbG8=',
        'description': 'valid base64 string — passes',
        'valid': true
      },
      {
        'data': 'not valid base64!!!',
        'description': 'invalid base64 string — fails with contentEncoding message',
        'expectedKeyword': 'contentEncoding',
        'expectedMessage': VALIDATION_MESSAGES.contentEncoding('base64'),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:ContentEncoding', scenarios);
  });

  // ---------------------------------------------------------------------------
  // contentMediaType (strict-by-default)
  // ---------------------------------------------------------------------------

  void it('keyword: contentMediaType', () => {
    const jt = JsonTology.create({ 'baseIRI': 'urn:msg-parity:' });

    jt.set({
      '$id': 'urn:msg-parity:ContentMediaType',
      'contentEncoding': 'base64',
      'contentMediaType': 'application/json',
      'type': 'string'
    });

    // {"key":"value"} base64-encoded = eyJrZXkiOiJ2YWx1ZSJ9
    const scenarios: Scenario[] = [
      {
        'data': 'eyJrZXkiOiJ2YWx1ZSJ9',
        'description': 'valid base64-encoded JSON — passes',
        'valid': true
      },
      {
        'data': 'bm90IGpzb24=',
        'description': 'valid base64 but not JSON content — fails with contentMediaType message',
        'expectedKeyword': 'contentMediaType',
        'expectedMessage': VALIDATION_MESSAGES.contentMediaType('application/json'),
        'valid': false
      }
    ];

    assertCompiledMessages(jt, 'urn:msg-parity:ContentMediaType', scenarios);
  });
});
