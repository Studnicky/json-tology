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
void 0 as unknown as [DepKeys, User];
