/**
 * Class hydration ORM recipes — DDD value object (Money)
 *
 * `fromPlain` is the right strategy here because `Money`'s
 * constructor enforces invariants. Bypassing it via prototype swap
 * would silently allow negative amounts. Registered on a sibling of
 * the canonical `MoneySchema` so the bookstore's plain wire shape
 * for money stays intact.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
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

const DddMoneyTransform = Transform.create<typeof DddMoneySchema, Money>(DddMoneySchema, {
  'decode': (plain) => {
    return Money.fromPlain(plain as {
      'amount': number;
      'currency': string;
    });
  },
  'encode': (instance) => {
    return {
      'amount': instance.amount,
      'currency': instance.currency
    };
  }
});

const wire = aboxFixtures.rareBook.price;
const decoded = jt.instantiate(DddMoneyTransform, wire);

console.assert(decoded instanceof Money);
console.assert(decoded.amount === wire.amount);

const doubled = decoded.add(decoded);

console.assert(doubled.amount === wire.amount * 2);
// true — fromPlain ran
console.log('instanceof Money:', decoded instanceof Money);
// rare book price amount
console.log('amount:', decoded.amount);
// amount * 2 via add()
console.log('doubled amount:', doubled.amount);
