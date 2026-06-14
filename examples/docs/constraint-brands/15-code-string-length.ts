import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const CodeSchema = {
  '$id': 'urn:brands:Code',
  'maxLength': 10,
  'minLength': 3,
  'type': 'string'
} as const;

type Code = InferType<typeof CodeSchema>;
// string & MinLengthBrandType<3> & MaxLengthBrandType<10>

const jt = JsonTology.create({
  'baseIRI': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [CodeSchema]
});

const code: Code = jt.instantiate(CodeSchema.$id, 'ABC');

console.log('Code value (minLength 3, maxLength 10):', code);

// Too-short strings are rejected.
const shortErrors = JsonTology.validate(CodeSchema, 'AB');

console.log('Errors for "AB" (too short):', shortErrors.items.map((err) => {
  return err.message;
}));
