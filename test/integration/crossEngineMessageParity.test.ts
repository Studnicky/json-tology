/**
 * Cross-engine MESSAGE parity tests.
 *
 * The compiledInterpretedParity tests assert that compiled and interpreter paths
 * agree on pass/fail verdicts. This file goes further: for every invalid
 * (schema, data) pair, it asserts that the ERROR MESSAGES produced by the
 * compiled path (registry.validate) deep-equal those produced by the interpreter
 * path (registry.engine(schema).errors(data)).
 *
 * Message drift was the primary source of user-visible inconsistency. This test
 * is the regression sentinel for Wave A+C's VALIDATION_MESSAGES.ts unification.
 * Any keyword that re-introduces an inline message string in either backend
 * will be caught here.
 *
 * Keywords covered (previously-drifted set):
 *   minProperties, maxProperties, additionalProperties, dependentRequired,
 *   anyOf, oneOf, uniqueItems, contains, enum
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { ValidationErrorType } from '../../src/types/Validation.js';
import { JsonTology } from '../../src/index.js';

type Scenario = { 'data': unknown;
  'description': string;
  'valid': boolean };

/**
 * For each invalid scenario, assert that compiled-path and interpreter-path
 * messages deep-equal each other (sorted by path+keyword for stability).
 */
function assertMessageParity(
  jt: JsonTology,
  schemaId: string,
  scenarios: Scenario[]
): void {
  const schemaObj = jt.registry.get(schemaId) as Record<string, unknown>;

  for (const scenario of scenarios) {
    const {
      data, description, valid
    } = scenario;
    const compiledErrors = [...jt.registry.validate(schemaId, data).items];
    const interpreterErrors = jt.registry.engine(schemaObj).errors(data);

    const verdictCompiled = compiledErrors.length === 0;
    const verdictInterpreter = interpreterErrors.length === 0;

    assert.equal(verdictCompiled, valid, `compiled verdict: ${description}`);
    assert.equal(verdictInterpreter, valid, `interpreter verdict: ${description}`);

    if (!valid) {
      // Normalise + sort so order differences don't produce false failures.
      const sort = (errs: ValidationErrorType[]): Array<{ 'keyword': string;
        'message': string;
        'path': string }> => {
        return errs
          .map((err) => {
            return {
              'keyword': err.keyword,
              'message': err.message,
              'path': err.path
            };
          })
          .sort((left, right) => {
            const byPath = left.path.localeCompare(right.path);

            return byPath === 0 ? left.keyword.localeCompare(right.keyword) : byPath;
          });
      };

      assert.deepEqual(
        sort(compiledErrors),
        sort(interpreterErrors),
        `message parity failed for "${description}" — `
        + `compiled: ${JSON.stringify(sort(compiledErrors))} / `
        + `interpreter: ${JSON.stringify(sort(interpreterErrors))}`
      );
    }
  }
}

void describe('cross-engine message parity', () => {
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
        'valid': false
      },
      {
        'data': {},
        'description': 'zero properties when min is 2 — invalid',
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:MinProps', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:MaxProps', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:AdditionalProps', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:DepReq', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:AnyOf', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:OneOf', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:UniqueItems', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:Contains', scenarios);
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:Enum', scenarios);
  });

  // ---------------------------------------------------------------------------
  // format (strict-by-default)
  // ---------------------------------------------------------------------------

  void it('keyword: format strict-by-default — both engines agree on message', () => {
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:Format', scenarios);
  });

  // ---------------------------------------------------------------------------
  // contentEncoding (strict-by-default)
  // ---------------------------------------------------------------------------

  void it('keyword: contentEncoding strict-by-default — both engines agree on message', () => {
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:ContentEncoding', scenarios);
  });

  // ---------------------------------------------------------------------------
  // contentMediaType (strict-by-default)
  // ---------------------------------------------------------------------------

  void it('keyword: contentMediaType strict-by-default — both engines agree on message', () => {
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
        'valid': false
      }
    ];

    assertMessageParity(jt, 'urn:msg-parity:ContentMediaType', scenarios);
  });
});
