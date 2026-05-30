/**
 * BaseError — public surface: code, toJson, flatten
 *
 * Every json-tology error subclasses BaseError. Catch by class,
 * inspect the structured projections. Demonstrates the trust-boundary
 * pattern: instantiate against the canonical bookstore ReviewSchema
 * and surface the failure as a structured envelope.
 */

import { BaseError } from '../../../src/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

try {
  bookstoreEntities.instantiate(ReviewSchema.$id, {
    'body': 'Too',
    'rating': 99
  });
} catch (error) {
  if (error instanceof BaseError) {
    console.assert(typeof error.code === 'string');
    console.assert(typeof error.toJson() === 'object');
    console.assert(Array.isArray(error.flatten()));

    console.log('error.code:', error.code);
    console.log('error.toJson():', JSON.stringify(error.toJson(), null, 2));
    console.log('error.flatten() count:', error.flatten().length);
  }
}
