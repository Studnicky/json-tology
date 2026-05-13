/**
 * Anti-patterns: Compose calls that produce compile-time brand errors.
 *
 * Every block below intentionally fails to compile and is guarded by
 * `@ts-expect-error`.  The blocks live inside `if (false as boolean)` so they
 * are dead code at runtime but still type-checked by `tsc`.  This file
 * documents what NOT to do and serves as a regression guard — removing a
 * `@ts-expect-error` comment would cause `tsc --strict` to error, proving the
 * brand is still being emitted.
 *
 * Brand catalogue
 * ---------------
 * SelfSubClassType         — Compose.subClassOf body.$id collides with parent.$id
 * SelfEquivalentType       — Compose.equivalent options.$id equals source.$id
 * IntersectionIdCollisionType — Compose.intersection newId collides with an input $id
 * DiscriminatorMissingType — Compose.discriminatedUnion variant lacks a const+required discriminator
 */

import { Compose } from '../../../src/index.js';
import { BookSchema } from './entities/Book.js';
import { CustomerSchema } from './entities/Customer.js';
import { IsbnSchema } from './entities/Isbn.js';
import { TitleSchema } from './entities/Title.js';

// ---------------------------------------------------------------------------
// Brand: SelfSubClassType
//
// Compose.subClassOf checks that the body schema's $id does not match the
// parent's $id.  Declaring Book as a subclass of itself is an ontological
// contradiction and is rejected at compile time.
// ---------------------------------------------------------------------------

if (false as boolean) {
  // @ts-expect-error — SelfSubClassType: body.$id ('urn:bookstore:Book') collides with parent.$id
  const _selfSub = Compose.subClassOf(BookSchema, {
    '$id': 'urn:bookstore:Book',
    'type': 'object'
  } as const);

  void _selfSub;
}

// ---------------------------------------------------------------------------
// Brand: SelfEquivalentType
//
// Compose.equivalent rejects options.$id === source.$id.  Creating an
// "equivalent" alias that points back to the same IRI is a no-op and surfaces
// as a compile-time error rather than silently producing a broken schema.
// ---------------------------------------------------------------------------

if (false as boolean) {
  Compose.equivalent(IsbnSchema, {
    // @ts-expect-error — SelfEquivalentType: options.$id matches source.$id ('urn:bookstore:Isbn')
    '$id': 'urn:bookstore:Isbn',
    'description': 'duplicate alias'
  } as const);
}

// ---------------------------------------------------------------------------
// Brand: IntersectionIdCollisionType
//
// Compose.intersection rejects newId when it collides with any input schema's
// $id.  Reusing 'urn:bookstore:Book' as the intersection ID would silently
// shadow the original Book schema, so it is a compile-time error.
// ---------------------------------------------------------------------------

if (false as boolean) {
  Compose.intersection(
    [
      BookSchema,
      CustomerSchema
    ] as const,
    // @ts-expect-error — IntersectionIdCollisionType: newId 'urn:bookstore:Book' collides with BookSchema.$id
    'urn:bookstore:Book'
  );
}

// ---------------------------------------------------------------------------
// Brand: DiscriminatorMissingType (variant missing the discriminator property)
//
// Compose.discriminatedUnion requires every variant to declare the
// discriminator property with a `const` value AND list it in `required`.
// IsbnSchema has no `format` property at all, so it fails the check.
// ---------------------------------------------------------------------------

const WithFormatSchema = {
  '$id': 'urn:bookstore:_AntiPattern_WithFormat',
  'properties': {
    'format': { 'const': 'epub' as const },
    'title': { '$ref': TitleSchema.$id }
  },
  'required': [
    'format',
    'title'
  ] as const,
  'type': 'object'
} as const;

if (false as boolean) {
  Compose.discriminatedUnion(
    'format',
    [
      WithFormatSchema,
      // @ts-expect-error — DiscriminatorMissingType: IsbnSchema has no 'format' property (DiscriminatorMissingType brand)
      IsbnSchema
    ] as const,
    'urn:bookstore:_AntiPattern_FormatUnion'
  );
}

// ---------------------------------------------------------------------------
// Brand: DiscriminatorMissingType (property present but not a const)
//
// A discriminator property that uses `type: 'string'` rather than
// `const: 'value'` is ambiguous — the union cannot be narrowed — so it is
// also rejected at compile time.
// ---------------------------------------------------------------------------

const NonConstFormatSchema = {
  '$id': 'urn:bookstore:_AntiPattern_NonConstFormat',
  'properties': {
    'format': { 'type': 'string' as const },
    'title': { '$ref': TitleSchema.$id }
  },
  'required': [
    'format',
    'title'
  ] as const,
  'type': 'object'
} as const;

if (false as boolean) {
  Compose.discriminatedUnion(
    'format',
    [
      WithFormatSchema,
      // @ts-expect-error — DiscriminatorMissingType: 'format' is type:string, not a const (DiscriminatorMissingType brand)
      NonConstFormatSchema
    ] as const,
    'urn:bookstore:_AntiPattern_FormatUnion2'
  );
}

// Suppress unused-variable warnings for the well-typed fixtures
void [
  WithFormatSchema,
  NonConstFormatSchema
];
