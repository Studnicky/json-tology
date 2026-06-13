/**
 * Class hydration ORM recipes — DDD value object (Money)
 *
 * `Money.fromPlain` is the right strategy here because `Money`'s
 * constructor enforces invariants. Bypassing it via prototype swap
 * would silently allow negative amounts. Registered on a sibling of
 * the canonical `MoneySchema` so the bookstore's plain wire shape
 * for money stays intact.
 *
 * The Money class is the wire side (TWire). decode lowers it to canonical JSON,
 * encode hydrates canonical JSON into a Money instance.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  MoneySchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

class Money {
  public static fromPlain(plain: {
    'amount': number;
    'currency': string;
  }): Money {
    return new Money(plain.amount, plain.currency);
  }

  public constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {
    if (amount < 0) {
      throw new RangeError('Money cannot be negative');
    }
  }

  public add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error('currency mismatch');
    }

    return new Money(this.amount + other.amount, this.currency);
  }
}

const DddMoneySchema = Compose.equivalent(
  MoneySchema,
  { '$id': 'https://bookstore.example/DddMoney' } as const
);

jt.set(DddMoneySchema);

// Class hydration: Money is the wire side. decode lowers it to canonical JSON,
// encode hydrates back to a Money instance (via fromPlain).
const dddMoneyTransform = jt.addTransform(DddMoneySchema, {
  'decode': (instance: Money) => {
    return {
      'amount': instance.amount,
      'currency': instance.currency
    };
  },
  'encode': (wire) => {
    // Narrow at the hydration boundary — runtime values are the validated
    // canonical JSON.
    const source = wire;

    return Money.fromPlain({
      'amount': source.amount,
      'currency': source.currency
    });
  }
});

// Hydrate canonical JSON into a Money instance.
const wire = aboxFixtures.rareBook.price;
const hydrated = jt.encode(dddMoneyTransform, wire);

console.assert(hydrated instanceof Money);
console.assert(hydrated.amount === wire.amount);

const doubled = hydrated.add(hydrated);

console.assert(doubled.amount === wire.amount * 2);
// true — fromPlain ran
console.log('instanceof Money:', hydrated instanceof Money);
// rare book price amount
console.log('amount:', hydrated.amount);
// amount * 2 via add()
console.log('doubled amount:', doubled.amount);
