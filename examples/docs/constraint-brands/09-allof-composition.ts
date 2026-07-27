import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const ValidatedEmailSchema = {
  '$id': 'urn:brands:ValidatedEmail',
  'allOf': [
    {
      'format': 'email',
      'type': 'string'
    },
    {
      'minLength': 5,
      'type': 'string'
    }
  ]
} as const;

type VEmail = InferType<typeof ValidatedEmailSchema>;
// string & FormatBrandType<'email'> & string & MinimumLengthBrandType<5>
// simplifies to: string & FormatBrandType<'email'> & MinimumLengthBrandType<5>

const jt = JsonTology.create({
  'baseIri': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [ValidatedEmailSchema]
});

// allOf intersects brands from both branches: email format AND minLength 5.
const vemail: VEmail = jt.instantiate(ValidatedEmailSchema.$id, 'user@example.com');

console.log('allOf branded email:', vemail);

// Validation rejects strings that fail either branch.
const shortErrors = JsonTology.validate(ValidatedEmailSchema, 'a@b');

console.log('Errors for "a@b" (too short):', shortErrors.items.map((err) => {
  return err.message;
}));
