/**
 * instantiate — Anti-pattern 3: Building partial shapes by hand
 * Demonstrates: manual partial object (bad) vs Compose.pick (correct)
 *
 * A signup endpoint only needs name + email from the full Customer schema.
 * Compose.pick produces a proper sub-schema rather than passing a hand-built
 * partial object to the full schema validator.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const signupBody = {
  'email': 'cornelia.funke@bookstore.example',
  'name': 'Cornelia Funke'
};

// Anti-pattern: building a partial shape by hand and passing to the full schema
// Don't do this
const partial = {
  'email': signupBody.email,
  'name': signupBody.name
};

// The full CustomerSchema requires `id`, so this would throw InstantiationError
// if used with instantiate directly.
void partial;

// Correct approach: pick the sub-schema, coerce cleanly
const SignupSchema = Compose.pick(
  CustomerSchema,
  [
    'email',
    'name'
  ] as const,
  'https://bookstore.example/Signup'
);

jt.set(SignupSchema);

const signup = jt.instantiate(SignupSchema, signupBody);

console.assert(signup.email === signupBody.email);
console.assert(signup.name === signupBody.name);

console.log('signup schema id:', SignupSchema.$id);
console.log('coerced signup:', signup.name, '-', signup.email);
