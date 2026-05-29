/**
 * toSchema — Example 3: Returns undefined for unregistered schemas
 * Demonstrates: toSchema returns undefined when schema ID is not in the registry
 *
 * A schema ID that was never registered produces undefined; no error is thrown.
 */

import {
  bookstoreEntities
} from '../bookstore/index.js';

const missing = (bookstoreEntities.toSchema as (id: string) => Record<string, unknown> | undefined)('https://bookstore.example/NonExistent');

console.assert(missing === undefined, 'Unregistered schema should return undefined');
