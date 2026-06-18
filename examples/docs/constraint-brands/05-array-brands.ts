import type { InferType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const TagSetSchema = {
  '$id': 'urn:brands:TagSet',
  'items': { 'type': 'string' },
  'type': 'array',
  'uniqueItems': true
} as const;

type TagSet = InferType<typeof TagSetSchema>;
// readonly string[] & UniqueItemsBrandType

const NumberArraySchema = {
  '$id': 'urn:brands:NumberArray',
  'contains': { 'type': 'number' },
  'type': 'array'
} as const;

type NumberArray = InferType<typeof NumberArraySchema>;
// readonly number[] & ContainsBrandType<number>

const jt = JsonTology.create({
  'baseIri': 'urn:brands:',
  'enableStrictGraph': false,
  'schemas': [
    TagSetSchema,
    NumberArraySchema
  ]
});

const tags: TagSet = jt.instantiate(TagSetSchema.$id, [
  'fiction',
  'fantasy',
  'classic'
]);
const nums: NumberArray = jt.instantiate(NumberArraySchema.$id, [
  1,
  2,
  3
]);

console.log('TagSet (uniqueItems brand):', tags);
console.log('NumberArray (contains<number> brand):', nums);

// Duplicate tags are rejected at runtime by uniqueItems validation.
const dupErrors = JsonTology.validate(TagSetSchema, [
  'fiction',
  'fiction'
]);

console.log('Duplicate-tag errors:', dupErrors.items.map((err) => {
  return err.message;
}));
