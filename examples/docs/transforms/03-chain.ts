/**
 * Transform.chain — Example 1: Multi-step string → float transform
 * Demonstrates: left-to-right decode chain, right-to-left encode chain
 *
 * The transform schema registers onto the canonical bookstore via
 * `bookstoreEntities.set()`. The price string is the wire form of
 * Bastian Balthazar Bux's rare 1979 Thienemann edition of Michael Ende's
 * Die unendliche Geschichte (€850.00).
 */

import { Transform } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities
} from '../bookstore/index.js';

const FormattedPriceSchema = {
  '$id': 'https://bookstore.example/FormattedPrice',
  'type': 'string'
} as const;

const PricedSchema = Transform.chain<typeof FormattedPriceSchema, number>(
  FormattedPriceSchema,
  [
    // Step 1: strip currency symbol and thousands separators.
    {
      'decode': (rawInput: unknown) => {
        return (rawInput as string).replaceAll(/[€,]/gu, '');
      },
      'encode': (rawInput: unknown) => {
        return `€${rawInput as string}`;
      }
    },
    // Step 2: parse to float / format to two decimal places.
    {
      'decode': (rawInput: unknown) => {
        return Number.parseFloat(rawInput as string);
      },
      'encode': (numInput: unknown) => {
        return (numInput as number).toFixed(2);
      }
    }
  ]
);

bookstoreEntities.set(PricedSchema);

const price = bookstoreEntities.instantiate(PricedSchema.$id, '€850.00');

console.assert(price === 850);
console.assert(price === aboxFixtures.rareBook.price.amount);

const wire = bookstoreEntities.encode(PricedSchema, price);

console.assert(wire === '€850.00');
