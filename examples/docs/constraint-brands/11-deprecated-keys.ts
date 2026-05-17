import type {
  DeprecatedKeysType, NonDeprecatedSchemaType
} from '../../../src/types/index.js';

const UserSchema = {
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

type DepKeys = DeprecatedKeysType<typeof UserSchema>; // 'legacyId'
type User = NonDeprecatedSchemaType<typeof UserSchema>; // { name: string }  - no legacyId
void 0 as unknown as [DepKeys, User];
