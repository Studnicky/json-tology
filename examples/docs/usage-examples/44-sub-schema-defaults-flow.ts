/**
 * Sub-schema patterns — defaults flow through $ref via instantiate
 *
 * Defaults declared inside a referenced schema apply when the parent's
 * value reaches that slot. The registry walks the `$ref` graph, so
 * transitive defaults all resolve in a single pass.
 *
 * Demonstrated by registering a small Preferences sub-schema and
 * referencing it from a Profile schema; both are registered against
 * `` so the canonical registry's `enableDefaults`
 * behaviour drives the example.
 */

import {
  createBookstoreDocRegistry,
  CustomerIdSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PreferencesSchema = {
  '$id': 'https://bookstore.example/Preferences',
  'properties': {
    'locale': {
      'default': 'en-US',
      'type': 'string'
    },
    'notifications': {
      'default': true,
      'type': 'boolean'
    }
  },
  'type': 'object'
} as const;

const ProfileSchema = {
  '$id': 'https://bookstore.example/Profile',
  'properties': {
    'customerId': { '$ref': CustomerIdSchema.$id },
    'preferences': { '$ref': PreferencesSchema.$id }
  },
  'required': ['customerId'],
  'type': 'object'
} as const;

const jt2 = jt.set(PreferencesSchema).set(ProfileSchema);

const profile = jt2.instantiate(ProfileSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'preferences': {}
}, { 'enableDefaults': true }) as {
  readonly 'preferences': {
    readonly 'locale': string;
    readonly 'notifications': boolean;
  };
};

console.assert(profile.preferences.locale === 'en-US');
console.assert(profile.preferences.notifications);
// 'en-US' — filled via $ref
console.log('locale default:', profile.preferences.locale);
// true — filled via $ref
console.log('notifications default:', profile.preferences.notifications);
