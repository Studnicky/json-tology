/**
 * Transform.pipe — Example 1: Multi-step string → float transform
 * Demonstrates: left-to-right decode chain, right-to-left encode chain
 */

import {
  JsonTology, Transform
} from '../../../src/index.js';

const FormattedPriceSchema = {
  '$id': 'https://bookstore.example/FormattedPrice',
  'type': 'string'
} as const;

const PricedSchema = Transform.pipe<typeof FormattedPriceSchema, number>(
  FormattedPriceSchema,
  [
    // Step 1: strip currency symbol
    {
      'decode': (rawInput: unknown) => {
        return (rawInput as string).replaceAll(/[$,]/gu, '');
      },
      'encode': (rawInput: unknown) => {
        return `$${(rawInput as string)}`;
      }
    },
    // Step 2: parse to float
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

const localJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [PricedSchema] as const
});

const price = localJt.coerce(PricedSchema.$id, '$14.99');

console.assert(price === 14.99);

const wire = localJt.encode(PricedSchema, price);

console.assert(wire === '14.99');
