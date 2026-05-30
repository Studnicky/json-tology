import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const EvenDiceSchema = {
  '$id': 'urn:brands:EvenDice',
  'maximum': 6,
  'minimum': 1,
  'multipleOf': 2,
  'type': 'integer'
} as const;

type EvenDice = InferType<typeof EvenDiceSchema>;
// 2 | 4 | 6

const jt = JsonTology.create({
  'baseIRI': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [EvenDiceSchema]
});

// Only multiples of 2 within 1..6 are valid: 2, 4, 6.
const roll: EvenDice = jt.instantiate(EvenDiceSchema.$id, 4);

console.log('EvenDice value (2 | 4 | 6):', roll);

// Odd values are rejected at runtime.
const oddErrors = JsonTology.validate(EvenDiceSchema, 3);

console.log('Errors for 3 (not a multiple of 2):', oddErrors.items.map((err) => {
  return err.message;
}));
