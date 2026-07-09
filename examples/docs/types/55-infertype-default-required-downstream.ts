/**
 * InferType — default-bearing properties stay optional; a downstream
 * consumer that needs the field required adds it to the schema's own
 * `required` array too.
 *
 * `default` is a runtime-fill concept: `instantiate()` always fills a
 * missing default in, but InferType keeps the property optional at the
 * type level, because nothing guarantees a default has run before the
 * type is read (a `materialize({ enablePartial: true })` result, or a
 * value constructed by hand, may not have it). A consumer that needs the
 * field required downstream — e.g. assigning into a shape checked under
 * `exactOptionalPropertyTypes` — declares the property `required` on the
 * schema too (a property can carry both `default` and `required` at
 * once), or accepts the optional type and narrows it at the call site.
 */

import type { InferType } from '../../../src/types/index.js';

const _AddressesOptionalSchema = {
  '$id': 'urn:example:AddressesOptional',
  'properties': {
    'addresses': {
      'default': [],
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': [],
  'type': 'object'
} as const;

const _AddressesRequiredSchema = {
  '$id': 'urn:example:AddressesRequired',
  'properties': {
    'addresses': {
      'default': [],
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': ['addresses'],
  'type': 'object'
} as const;

type AssertExtendsType<TLeft, TRight>
  = [TLeft] extends [TRight] ? true : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

// default alone: addresses stays optional — addresses?: string[]
type OptionalShape = InferType<typeof _AddressesOptionalSchema>;

assert<AssertExtendsType<OptionalShape, { 'addresses'?: string[]; }>>();

// default AND required: addresses is required at the type level too —
// instantiate() still fills it in when the caller omits it.
type RequiredShape = InferType<typeof _AddressesRequiredSchema>;

assert<AssertExtendsType<RequiredShape, { 'addresses': string[]; }>>();

console.log('default alone -> optional at the type level (default optional InferType)');
console.log('default + required -> required at the type level too');
