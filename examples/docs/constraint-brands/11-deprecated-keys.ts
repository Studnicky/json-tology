import type {
  DeprecatedKeysType, NonDeprecatedSchemaType
} from '../../../src/types/index.js';

const _UserSchema = {
  'properties': {
    'legacyId': {
      'deprecated': true,
      'type': 'string'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

// 'legacyId'
type DepKeys = DeprecatedKeysType<typeof _UserSchema>;
// { name: string }  - no legacyId
type User = NonDeprecatedSchemaType<typeof _UserSchema>;

// DepKeys is a union of deprecated property names. User omits them.
type DepKeysIsLegacyId = DepKeys extends 'legacyId' ? true : false;
type UserHasNoLegacyId = User extends { 'legacyId': unknown } ? false : true;

const check: [DepKeysIsLegacyId, UserHasNoLegacyId] = [
  true,
  true
];

console.log('Deprecated key is "legacyId":', check[0]);
console.log('NonDeprecated type omits legacyId:', check[1]);
