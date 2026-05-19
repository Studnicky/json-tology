/**
 * Transform.chain — Example 2: Decode direction left-to-right, encode right-to-left
 * Demonstrates: three-step chain with correct stage ordering against bookstore
 *
 * Three steps: (1) strip currency symbol, (2) strip whitespace, (3) parse to float.
 * Encode runs in reverse: float → fixed-string → prefix € → prefix "Price: ".
 * The fixture is the cover price of Patrick Süskind's Das Parfum (Diogenes, 1985)
 * in a formatted display string.
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const DisplayPriceSchema = {
  '$id': 'https://bookstore.example/DisplayPrice',
  'type': 'string'
} as const;

// Decode: A.decode → B.decode → C.decode = domain (number)
// Encode: C.encode → B.encode → A.encode = wire (string)
const ChainedPriceSchema = Transform.chain<typeof DisplayPriceSchema, number>(
  DisplayPriceSchema,
  [
    // Step A: strip "Price: " prefix
    {
      'decode': (rawInput: unknown) => {
        return (rawInput as string).replace('Price: ', '');
      },
      'encode': (rawInput: unknown) => {
        return `Price: ${rawInput as string}`;
      }
    },
    // Step B: strip currency symbol
    {
      'decode': (rawInput: unknown) => {
        return (rawInput as string).replace('€', '').trim();
      },
      'encode': (rawInput: unknown) => {
        return `€${rawInput as string}`;
      }
    },
    // Step C: parse to float / format to two decimal places
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

jt.set(ChainedPriceSchema);

const price = jt.instantiate(ChainedPriceSchema, 'Price: €24.95');

console.assert(price === 24.95);

const wire = jt.encode(ChainedPriceSchema, price);

console.assert(wire === 'Price: €24.95');
