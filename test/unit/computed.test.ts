/**
 * Computed fields — Pydantic-parity @computed_field behaviour
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import { InstantiationError } from '../../src/errors/InstantiationError.js';
import { SchemaError } from '../../src/errors/SchemaError.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ItemSchema = {
  '$id': 'https://ex.io/Item',
  'properties': { 'price': { 'type': 'number' } },
  'required': ['price'],
  'type': 'object'
} as const;

const OrderSchema = {
  '$id': 'https://ex.io/Order',
  'properties': {
    'items': {
      'items': { '$ref': 'https://ex.io/Item' },
      'type': 'array'
    },
    'total': {
      'jt:computed': true,
      'type': 'number'
    }
  },
  'required': ['items'],
  'type': 'object'
} as const;

const CustomerSchema = {
  '$id': 'https://ex.io/Customer',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

const NestedOrderSchema = {
  '$id': 'https://ex.io/NestedOrder',
  'properties': {
    'customer': { '$ref': 'https://ex.io/Customer' },
    'label': {
      'jt:computed': true,
      'type': 'string'
    },
    'qty': { 'type': 'number' }
  },
  'required': [
    'customer',
    'qty'
  ],
  'type': 'object'
} as const;

const ThrowingSchema = {
  '$id': 'https://ex.io/Throwing',
  'properties': {
    'computed': {
      'jt:computed': true,
      'type': 'string'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

function makeJt() {
  return JsonTology.create({
    'baseIRI': 'https://ex.io',
    'computeds': {
      'https://ex.io/Item': {},
      'https://ex.io/Order': {
        'total': (order: Record<string, unknown>) => {
          const items = order.items as Array<{ 'price': number }>;

          return items.reduce((sum, item) => {
            return sum + item.price;
          }, 0);
        }
      }
    },
    'enableStrictGraph': false,
    'schemas': [
      ItemSchema,
      OrderSchema
    ] as const
  });
}

// ---------------------------------------------------------------------------
// computed field absent on input is filled in by coerce()
// ---------------------------------------------------------------------------

void describe('computed fields', { 'concurrency': true }, () => {
  void it('coerce() and materialize() both fill computed field absent from input, output contains computed key', () => {
    // coerce() path — fills computed field
    const jt = makeJt();
    const coerced = jt.instantiate('https://ex.io/Order', {
      'items': [
        { 'price': 10 },
        { 'price': 5 }
      ]
    }) as Record<string, unknown>;

    assert.equal(coerced.total, 15, 'coerce() fills computed field');

    // coerce() output contains computed key (dump-equivalent sanity check)
    const dumpResult = jt.instantiate('https://ex.io/Order', { 'items': [{ 'price': 50 }] }) as Record<string, unknown>;

    assert.ok('total' in dumpResult, 'total key present on coerce() output');
    assert.equal(dumpResult.total, 50, 'total value matches sum');

    // materialize() path — also fills computed field
    const materialized = jt.materialize(OrderSchema, {
      'items': [
        { 'price': 3 },
        { 'price': 7 }
      ]
    }) as Record<string, unknown>;

    assert.equal(materialized.total, 10, 'materialize() fills computed field');
  });

  // ---------------------------------------------------------------------------
  // computed field PROVIDED on input causes validation error
  // ---------------------------------------------------------------------------

  void it('coerce() rejects input that supplies a computed property value', () => {
    const jt = makeJt();

    assert.throws(
      () => {
        jt.instantiate('https://ex.io/Order', {
          'items': [{ 'price': 10 }],
          'total': 999
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof InstantiationError, 'InstantiationError thrown');
        const messages = (err).errors.items.map((item) => {
          return `${item.path || 'root'}: ${item.message}`;
        });

        assert.ok(
          messages.some((m) => {
            return m.includes('computed') && m.includes('total');
          }),
          `expected error about computed field "total", got: ${messages.join('; ')}`
        );

        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // computed field re-runs after coerce — changing input changes result
  // ---------------------------------------------------------------------------

  void it('computed total reflects items passed', () => {
    const jt = makeJt();

    const first = jt.instantiate('https://ex.io/Order', { 'items': [{ 'price': 1 }] }) as Record<string, unknown>;

    const second = jt.instantiate('https://ex.io/Order', {
      'items': [
        { 'price': 1 },
        { 'price': 2 },
        { 'price': 3 }
      ]
    }) as Record<string, unknown>;

    assert.equal(first.total, 1);
    assert.equal(second.total, 6);
  });

  // ---------------------------------------------------------------------------
  // computed field on a nested schema (registered against the nested $id)
  // ---------------------------------------------------------------------------

  void it('computed field on nested schema works via addComputed', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://ex.io',
      'computeds': {
        'https://ex.io/NestedOrder': {
          'label': (order: Record<string, unknown>) => {
            const customer = order.customer as { 'name': string };

            return `${customer.name}#${String(order.qty)}`;
          }
        }
      },
      'enableStrictGraph': false,
      'schemas': [
        CustomerSchema,
        NestedOrderSchema
      ] as const
    });

    const result = jt.instantiate('https://ex.io/NestedOrder', {
      'customer': { 'name': 'Alice' },
      'qty': 3
    }) as Record<string, unknown>;

    assert.equal(result.label, 'Alice#3');
  });

  // ---------------------------------------------------------------------------
  // computed field that throws — error wrapped in InstantiationError
  // ---------------------------------------------------------------------------

  void it('compute function that throws is wrapped in InstantiationError', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://ex.io',
      'computeds': {
        'https://ex.io/Throwing': {
          'computed': () => {
            throw new Error('boom');
          }
        }
      },
      'enableStrictGraph': false,
      'schemas': [ThrowingSchema] as const
    });

    assert.throws(
      () => {
        jt.instantiate('https://ex.io/Throwing', { 'name': 'test' });
      },
      (err: unknown) => {
        assert.ok(err instanceof InstantiationError, 'InstantiationError thrown');
        const messages = (err).errors.items.map((item) => {
          return `${item.path || 'root'}: ${item.message}`;
        });

        assert.ok(
          messages.some((m) => {
            return m.includes('boom');
          }),
          `expected "boom" in error message, got: ${messages.join('; ')}`
        );

        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // removeComputed + missing fn registration — both disable computed field
  // ---------------------------------------------------------------------------

  void it('removeComputed disables computed field, and missing fn throws SchemaError at registration', () => {
    // removeComputed path
    const jt = makeJt();

    jt.removeComputed('https://ex.io/Order', 'total');

    const result = jt.instantiate('https://ex.io/Order', { 'items': [{ 'price': 10 }] }) as Record<string, unknown>;

    assert.ok(!('total' in result) || result.total === undefined, 'total not computed after removeComputed');

    // missing fn path — SchemaError at registration time
    assert.throws(
      () => {
        JsonTology.create({
          'baseIRI': 'https://ex.io',
          'enableStrictGraph': false,
          // No computeds provided
          'schemas': [
            OrderSchema,
            ItemSchema
          ] as const
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof SchemaError, 'SchemaError thrown for missing computed fn');
        assert.ok(
          (err).message.includes('COMPUTED_FN_MISSING')
          || (err).message.includes('jt:computed')
          || (err).message.includes('total'),
          `Expected error about missing computed fn, got: ${(err).message}`
        );

        return true;
      }
    );
  });
});
