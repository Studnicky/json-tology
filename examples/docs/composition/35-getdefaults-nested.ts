/**
 * Compose.getDefaults — Example 3: Nested defaults are traversed
 *
 * Nested object properties with their own `default`-bearing children
 * recurse — each nested level contributes its declared defaults to
 * the result. Demonstrates the recursive walk against a settings
 * schema that mirrors the canonical bookstore's notification model.
 */

import { Compose } from '../../../src/index.js';

const NotificationSettingsSchema = {
  '$id': 'https://bookstore.example/NotificationSettings',
  'properties': {
    'notifications': {
      'properties': {
        'email': {
          'default': true,
          'type': 'boolean'
        },
        'push': {
          'default': false,
          'type': 'boolean'
        }
      },
      'type': 'object'
    },
    'theme': {
      'default': 'light',
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

const defaults = Compose.getDefaults(NotificationSettingsSchema) as {
  'notifications'?: { 'email'?: boolean;
    'push'?: boolean };
  'theme'?: string;
};

console.assert(defaults.theme === 'light');
console.assert(defaults.notifications?.email === true);
console.assert(defaults.notifications?.push === false);
console.log('NotificationSettings defaults (nested recursion):', defaults);
