/**
 * `uniqueItems` array brand — homogeneous arrays with `uniqueItems: true`
 * carry `UniqueItemsBrandType`.
 *
 * A plain `string[]` is not assignable to the branded type. Values must
 * pass through the validation API which enforces uniqueness at runtime.
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';

const SetSchema = {
  '$id': 'urn:brands:StringSet',
  'items': { 'type': 'string' },
  'type': 'array',
  'uniqueItems': true
} as const;

type StringSet = InferType<typeof SetSchema>;

const jt = JsonTology.create({
  'baseIri': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [SetSchema]
});

const tags: StringSet = jt.instantiate(SetSchema.$id, [
  'fiction',
  'fantasy',
  'classic'
]);

console.log('StringSet (uniqueItems brand):', tags);
console.log('StringSet is array:', Array.isArray(tags));
