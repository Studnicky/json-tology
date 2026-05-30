/**
 * Anti-pattern: a `Compose.intersection` whose `newId` collides with one
 * of the input schemas' `$id`. The compiler raises an
 * `IntersectionIdCollisionType` brand at the call site so the mistake
 * fails before any runtime registration.
 */

import { Compose } from '../../../src/index.js';
import { BookSchema } from '../bookstore/index.js';

const AuditSchema = {
  '$id': 'https://bookstore.example/Audit',
  'properties': {
    'createdAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'updatedAt': {
      'format': 'date-time',
      'type': 'string'
    }
  },
  'required': [
    'createdAt',
    'updatedAt'
  ],
  'type': 'object'
} as const;

// ✗ Runtime anti-pattern — `newId` collides with BookSchema.$id.
// The collision check fires at the type level when both schemas share the same $id.
const _Bad = Compose.intersection(
  [
    BookSchema,
    AuditSchema
  ] as const,
  'https://bookstore.example/Book'
);

console.log('Intersection $id collision anti-pattern: newId must not match any input schema $id | BookSchema.$id:', BookSchema.$id);
void 0 as unknown as typeof _Bad;
