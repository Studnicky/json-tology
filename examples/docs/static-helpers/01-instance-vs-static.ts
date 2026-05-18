/**
 * Static helpers: instance vs static for validate
 *
 * The instance form reuses the registry's compiled validators across calls.
 * The static form builds an ephemeral registry, registers the schema, runs
 * the operation, and discards the registry — useful for one-off scripts
 * and self-contained schemas.
 *
 * Both return the same `ValidationErrors` collection for the same data.
 *
 * Pick the static form for one-off scripts or examples; pick the instance
 * form when multiple schemas reference each other or when you need
 * registered invariants and computed fields.
 */

import { JsonTology } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema, IsbnSchema
} from '../bookstore/index.js';

// Instance form — CustomerSchema was registered once at JsonTology.create()
// time; every call reuses the compiled validator. CustomerSchema references
// AddressSchema, EmailSchema, etc. — all resolved via the shared registry.
const errs = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);

console.assert(errs.length === 0);

// Static form — builds an ephemeral one-shot registry for a single schema,
// runs validate, discards the registry. Each call repeats the compilation.
// Use the static form for self-contained schemas with no cross-schema $ref.
// IsbnSchema is a plain string primitive: no external $ref needed.
const errs2 = JsonTology.validate(IsbnSchema, aboxFixtures.rareBook.isbn);

console.assert(errs2.length === 0);

// Both return empty ValidationErrors for valid data.
console.assert(errs.length === 0);
console.assert(errs2.length === 0);
