/**
 * Custom formats — replace a built-in validator
 *
 * Built-ins live under the same names (`date`, `email`, `uuid`, ...).
 * Registering a custom validator under one of those names replaces
 * the built-in for that `JsonTology` instance only. Other instances
 * (including the canonical `bookstoreEntities`) retain the built-ins.
 *
 * Demonstrated against `EmailSchema` reused from the bookstore.
 */

import { JsonTology } from '../../../src/index.js';
import { EmailSchema } from '../bookstore/index.js';

const formats: Record<string, (value: unknown) => boolean> = {
  // Replace the built-in 'email' with a stricter rule that requires
  // a two-letter-plus TLD.
  'email': (value) => {
    return typeof value === 'string'
      && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/iu.test(value);
  }
};

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  formats,
  'schemas': [EmailSchema] as const
});

// Bastian's bookstore email matches the stricter rule.
const okErrs = jt.validate(EmailSchema.$id, 'bastian.bux@bookstore.example');

console.assert(okErrs.length === 0);

// An email lacking a TLD fails the stricter rule.
const badErrs = jt.validate(EmailSchema.$id, 'bastian@localhost');

console.assert(badErrs.length > 0);
