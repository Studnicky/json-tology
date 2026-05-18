/**
 * Invariants — cross-field validation after structural validation
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import { InstantiationError } from '../../src/errors/InstantiationError.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OrderItemSchema = {
  '$id': 'https://test.dev/inv/OrderItem',
  'properties': {
    'price': { 'type': 'number' },
    'qty': { 'type': 'number' }
  },
  'required': [
    'price',
    'qty'
  ],
  'type': 'object'
} as const;

const OrderSchema = {
  '$defs': { 'OrderItem': OrderItemSchema },
  '$id': 'https://test.dev/inv/Order',
  'properties': {
    'items': {
      'items': { '$ref': 'https://test.dev/inv/OrderItem' },
      'type': 'array'
    },
    'total': { 'type': 'number' }
  },
  'required': [
    'items',
    'total'
  ],
  'type': 'object'
} as const;

const ChildSchema = {
  '$id': 'https://test.dev/inv/Child',
  'properties': { 'value': { 'type': 'number' } },
  'required': ['value'],
  'type': 'object'
} as const;

const ParentSchema = {
  '$defs': { 'Child': ChildSchema },
  '$id': 'https://test.dev/inv/Parent',
  'properties': {
    'child': { '$ref': 'https://test.dev/inv/Child' },
    'label': { 'type': 'string' }
  },
  'required': [
    'child',
    'label'
  ],
  'type': 'object'
} as const;

interface OrderItem { 'price': number;
  'qty': number }
interface Order { 'items': OrderItem[];
  'total': number }

function sumItems(items: OrderItem[]): number {
  return items.reduce((acc, item) => {
    return acc + item.price * item.qty;
  }, 0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('invariants', { 'concurrency': true }, () => {
  void it('passing invariant returns no error', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'invariants': {
        'https://test.dev/inv/Order': [{
          'fn': (order: unknown) => {
            const typed = order as Order;

            return typed.total === sumItems(typed.items) ? null : 'total mismatch';
          },
          'name': 'totalMatchesItems'
        }]
      },
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });
    const data: Order = {
      'items': [
        {
          'price': 10,
          'qty': 2
        },
        {
          'price': 5,
          'qty': 1
        }
      ],
      'total': 25
    };
    const errors = jt.validate(OrderSchema.$id, data);

    assert.equal(errors.length, 0);
  });

  void it('failing invariant adds error to errors() output and ValidationErrors', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'invariants': {
        'https://test.dev/inv/Order': [{
          'fn': (order: unknown) => {
            const typed = order as Order;

            return typed.total === sumItems(typed.items) ? null : 'total must equal sum of items';
          },
          'name': 'totalMatchesItems'
        }]
      },
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });
    const data: Order = {
      'items': [{
        'price': 10,
        'qty': 2
      }],
      'total': 999
    };
    const errors = jt.validate(OrderSchema.$id, data);

    assert.equal(errors.length, 1);
    assert.equal(errors.items[0].message, 'total must equal sum of items');
    assert.equal(errors.items[0].keyword, 'jt:invariant');
  });

  void it('failing invariant causes coerce() to throw InstantiationError', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'invariants': {
        'https://test.dev/inv/Order': [{
          'fn': (order: unknown) => {
            const typed = order as Order;

            return typed.total === sumItems(typed.items) ? null : 'total mismatch';
          },
          'name': 'totalMatchesItems'
        }]
      },
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });
    const data: Order = {
      'items': [{
        'price': 5,
        'qty': 1
      }],
      'total': 999
    };

    assert.throws(
      () => {
        jt.instantiate(OrderSchema.$id, data);
      },
      (err: unknown) => {
        assert.ok(err instanceof InstantiationError, 'is InstantiationError');
        assert.equal(err.errors.items[0].message, 'total mismatch');

        return true;
      }
    );
  });

  void it('failing invariant causes is() to return false', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'invariants': {
        'https://test.dev/inv/Order': [{
          'fn': (order: unknown) => {
            const typed = order as Order;

            return typed.total === sumItems(typed.items) ? null : 'total mismatch';
          },
          'name': 'totalMatchesItems'
        }]
      },
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });

    assert.equal(
      jt.is(OrderSchema.$id, {
        'items': [{
          'price': 5,
          'qty': 1
        }],
        'total': 999
      }),
      false
    );
    assert.equal(
      jt.is(OrderSchema.$id, {
        'items': [{
          'price': 5,
          'qty': 1
        }],
        'total': 5
      }),
      true
    );
  });

  void it('multiple invariants on the same schema all run; all failures collected', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'invariants': {
        'https://test.dev/inv/Order': [
          {
            'fn': (order: unknown) => {
              const typed = order as Order;

              return typed.total === sumItems(typed.items) ? null : 'total mismatch';
            },
            'name': 'totalMatchesItems'
          },
          {
            'fn': (order: unknown) => {
              const typed = order as Order;

              return typed.items.length > 0 ? null : 'order must have at least one item';
            },
            'name': 'hasItems'
          }
        ]
      },
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });
    const data: Order = {
      'items': [],
      'total': 999
    };
    const errors = jt.validate(OrderSchema.$id, data);

    assert.equal(errors.length, 2);

    const messages = new Set(errors.items.map((err) => {
      return err.message;
    }));

    assert.ok(messages.has('total mismatch'));
    assert.ok(messages.has('order must have at least one item'));
  });

  void it('invariants do not run if structural validation fails', () => {
    let invariantRan = false;
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'invariants': {
        'https://test.dev/inv/Order': [{
          'fn': () => {
            invariantRan = true;

            return null;
          },
          'name': 'shouldNotRun'
        }]
      },
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });

    // Missing required 'total' field
    const errors = jt.validate(OrderSchema.$id, { 'items': [] });

    assert.ok(!invariantRan, 'invariant must not run when structure fails');
    assert.ok(errors.length > 0, 'structural error returned');

    const invariantErrors = errors.items.filter((err) => {
      return err.keyword === 'jt:invariant';
    });

    assert.equal(invariantErrors.length, 0);
  });

  void it('imperative addInvariant registers post-construction', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });

    const data: Order = {
      'items': [{
        'price': 10,
        'qty': 1
      }],
      'total': 999
    };

    assert.equal(jt.validate(OrderSchema.$id, data).length, 0, 'no invariant yet');

    jt.addInvariant<Order>(
      OrderSchema.$id,
      {
        'fn': (order) => {
          return order.total === sumItems(order.items) ? null : 'total mismatch';
        },
        'name': 'totalMatchesItems'
      }
    );

    assert.equal(jt.validate(OrderSchema.$id, data).length, 1, 'invariant fires after addInvariant');
  });

  void it('removeInvariant by name removes the invariant', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });

    jt.addInvariant<Order>(
      OrderSchema.$id,
      {
        'fn': (order) => {
          return order.total === sumItems(order.items) ? null : 'total mismatch';
        },
        'name': 'totalMatchesItems'
      }
    );

    const data: Order = {
      'items': [{
        'price': 10,
        'qty': 1
      }],
      'total': 999
    };

    assert.equal(jt.validate(OrderSchema.$id, data).length, 1, 'fires before remove');

    jt.removeInvariant(OrderSchema.$id, 'totalMatchesItems');

    assert.equal(jt.validate(OrderSchema.$id, data).length, 0, 'gone after remove');
  });

  void it('invariant on Parent fires once for the parent value (not duplicated per-field)', () => {
    let callCount = 0;
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'schemas': [
        ChildSchema,
        ParentSchema
      ] as const
    });

    jt.addInvariant(ParentSchema.$id, {
      'fn': () => {
        callCount++;

        return null;
      },
      'name': 'counter'
    });

    jt.validate(ParentSchema.$id, {
      'child': { 'value': 1 },
      'label': 'test'
    });

    assert.equal(callCount, 1, 'invariant fires exactly once per call');
  });

  void it('error pointer reflects configured pointer when supplied', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://test.dev',
      'enableStrictGraph': false,
      'schemas': [
        OrderItemSchema,
        OrderSchema
      ] as const
    });

    jt.addInvariant(OrderSchema.$id, {
      'fn': () => {
        return 'always fails';
      },
      'name': 'withPointer',
      'pointer': '/total'
    });

    const errors = jt.validate(OrderSchema.$id, {
      'items': [{
        'price': 1,
        'qty': 1
      }],
      'total': 1
    });

    assert.equal(errors.length, 1);
    assert.equal(errors.items[0].path, '/total');
  });
});
