/**
 * Runtime enforcement of OWL 2 property-characteristic conflict detection.
 *
 * Verifies that SchemaRegistry.register() throws SchemaError with code
 * PROPERTY_CHARACTERISTIC_CONFLICT for each of the three hard-conflict pairs,
 * and that registration succeeds for individual characteristics and
 * non-conflicting combinations.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaError } from '../../src/errors/SchemaError.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function registry(): SchemaRegistry {
  return new SchemaRegistry();
}

function assertConflict(
  schema: Record<string, unknown>,
  propertyName: string,
  ...characteristics: string[]
): void {
  const reg = registry();

  assert.throws(
    () => {
      reg.register(schema);
    },
    (error: unknown) => {
      assert.ok(error instanceof SchemaError, `Expected SchemaError, got ${String(error)}`);
      assert.strictEqual(error.code, 'PROPERTY_CHARACTERISTIC_CONFLICT');
      assert.ok(
        error.message.includes(propertyName),
        `Expected error message to include property name "${propertyName}", got: ${error.message}`
      );
      for (const char of characteristics) {
        assert.ok(
          error.message.includes(char),
          `Expected error message to include characteristic "${char}", got: ${error.message}`
        );
      }

      return true;
    }
  );
}

// ---------------------------------------------------------------------------
// Positive: individual characteristics register without error
// ---------------------------------------------------------------------------

void describe('OWL property characteristics — registration succeeds (individual)', () => {
  const entries: Array<[string, Record<string, unknown>]> = [
    [
      'symmetric',
      {
        '$id': 'urn:test:Sym',
        'properties': { 'rel': { 'symmetric': true } },
        'type': 'object'
      }
    ],
    [
      'asymmetric',
      {
        '$id': 'urn:test:Asym',
        'properties': { 'rel': { 'asymmetric': true } },
        'type': 'object'
      }
    ],
    [
      'reflexive',
      {
        '$id': 'urn:test:Refl',
        'properties': { 'rel': { 'reflexive': true } },
        'type': 'object'
      }
    ],
    [
      'irreflexive',
      {
        '$id': 'urn:test:Irr',
        'properties': { 'rel': { 'irreflexive': true } },
        'type': 'object'
      }
    ],
    [
      'transitive',
      {
        '$id': 'urn:test:Trans',
        'properties': { 'rel': { 'transitive': true } },
        'type': 'object'
      }
    ],
    [
      'functional',
      {
        '$id': 'urn:test:Func',
        'properties': { 'rel': { 'functional': true } },
        'type': 'object'
      }
    ],
    [
      'inverseFunctional',
      {
        '$id': 'urn:test:InvFunc',
        'properties': { 'rel': { 'inverseFunctional': true } },
        'type': 'object'
      }
    ]
  ];

  for (const [
    name,
    schema
  ] of entries) {
    void it(`registers ${name} without error`, () => {
      assert.doesNotThrow(() => {
        registry().register(schema);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Positive: non-conflicting pairs register without error
// ---------------------------------------------------------------------------

void describe('OWL property characteristics — registration succeeds (non-conflicting pairs)', () => {
  void it('symmetric + reflexive (SimilarBook pattern)', () => {
    assert.doesNotThrow(() => {
      registry().register({
        '$id': 'urn:test:SymRefl',
        'properties': {
          'rel': {
            'reflexive': true,
            'symmetric': true
          }
        },
        'type': 'object'
      });
    });
  });

  void it('transitive + irreflexive (Order.placedAt pattern)', () => {
    assert.doesNotThrow(() => {
      registry().register({
        '$id': 'urn:test:TransIrr',
        'properties': {
          'rel': {
            'irreflexive': true,
            'transitive': true
          }
        },
        'type': 'object'
      });
    });
  });

  void it('functional + inverseFunctional', () => {
    assert.doesNotThrow(() => {
      registry().register({
        '$id': 'urn:test:FuncInvFunc',
        'properties': {
          'rel': {
            'functional': true,
            'inverseFunctional': true
          }
        },
        'type': 'object'
      });
    });
  });

  void it('asymmetric alone (Sequel pattern)', () => {
    assert.doesNotThrow(() => {
      registry().register({
        '$id': 'urn:test:AsymAlone',
        'properties': { 'rel': { 'asymmetric': true } },
        'type': 'object'
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Negative: hard-conflict pair 1 — symmetric + asymmetric
// ---------------------------------------------------------------------------

void describe('OWL property characteristics — conflict: symmetric + asymmetric', () => {
  void it('throws SchemaError PROPERTY_CHARACTERISTIC_CONFLICT', () => {
    assertConflict(
      {
        '$id': 'urn:test:SymAsymConflict',
        'properties': {
          'relates': {
            'asymmetric': true,
            'symmetric': true
          }
        },
        'type': 'object'
      },
      'relates',
      'symmetric',
      'asymmetric'
    );
  });

  void it('identifies the offending property name in the message', () => {
    const reg = registry();

    try {
      reg.register({
        '$id': 'urn:test:SymAsymConflict2',
        'properties': {
          'mySpecialProp': {
            'asymmetric': true,
            'symmetric': true
          }
        },
        'type': 'object'
      });
      assert.fail('Expected SchemaError to be thrown');
    } catch (error) {
      assert.ok(error instanceof SchemaError);
      assert.ok(error.message.includes('mySpecialProp'));
    }
  });
});

// ---------------------------------------------------------------------------
// Negative: hard-conflict pair 2 — reflexive + irreflexive
// ---------------------------------------------------------------------------

void describe('OWL property characteristics — conflict: reflexive + irreflexive', () => {
  void it('throws SchemaError PROPERTY_CHARACTERISTIC_CONFLICT', () => {
    assertConflict(
      {
        '$id': 'urn:test:ReflIrrConflict',
        'properties': {
          'target': {
            'irreflexive': true,
            'reflexive': true
          }
        },
        'type': 'object'
      },
      'target',
      'reflexive',
      'irreflexive'
    );
  });

  void it('identifies the offending property name in the message', () => {
    const reg = registry();

    try {
      reg.register({
        '$id': 'urn:test:ReflIrrConflict2',
        'properties': {
          'loopEdge': {
            'irreflexive': true,
            'reflexive': true
          }
        },
        'type': 'object'
      });
      assert.fail('Expected SchemaError to be thrown');
    } catch (error) {
      assert.ok(error instanceof SchemaError);
      assert.ok(error.message.includes('loopEdge'));
    }
  });
});

// ---------------------------------------------------------------------------
// Negative: hard-conflict pair 3 — asymmetric + reflexive
// ---------------------------------------------------------------------------

void describe('OWL property characteristics — conflict: asymmetric + reflexive', () => {
  void it('throws SchemaError PROPERTY_CHARACTERISTIC_CONFLICT', () => {
    assertConflict(
      {
        '$id': 'urn:test:AsymReflConflict',
        'properties': {
          'edge': {
            'asymmetric': true,
            'reflexive': true
          }
        },
        'type': 'object'
      },
      'edge',
      'asymmetric',
      'reflexive'
    );
  });

  void it('identifies the offending property name in the message', () => {
    const reg = registry();

    try {
      reg.register({
        '$id': 'urn:test:AsymReflConflict2',
        'properties': {
          'predecessorOf': {
            'asymmetric': true,
            'reflexive': true
          }
        },
        'type': 'object'
      });
      assert.fail('Expected SchemaError to be thrown');
    } catch (error) {
      assert.ok(error instanceof SchemaError);
      assert.ok(error.message.includes('predecessorOf'));
    }
  });
});

// ---------------------------------------------------------------------------
// Negative: conflict detected regardless of other valid properties
// ---------------------------------------------------------------------------

void describe('OWL property characteristics — conflict detected among multiple properties', () => {
  void it('detects conflict when only one of several properties is bad', () => {
    const reg = registry();

    assert.throws(
      () => {
        reg.register({
          '$id': 'urn:test:MultiPropConflict',
          'properties': {
            'badProp': {
              'asymmetric': true,
              'symmetric': true
            },
            'goodProp': { 'symmetric': true },
            'otherGoodProp': { 'transitive': true }
          },
          'type': 'object'
        });
      },
      (error: unknown) => {
        assert.ok(error instanceof SchemaError);
        assert.strictEqual(error.code, 'PROPERTY_CHARACTERISTIC_CONFLICT');
        assert.ok(error.message.includes('badProp'));

        return true;
      }
    );
  });
});
