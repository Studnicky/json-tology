/**
 * Compile-time type assertions for per-format branded types
 * (Finding 23 / design 0002 cluster H).
 *
 * Each registered JSON Schema `format` keyword produces a named branded
 * alias (`EmailBrandInterface`, `UriBrandInterface`, ...) layered on top
 * of the parametric `FormatBrandType<F>`. `InferType` already
 * intersects `FormatBrandType<F>` whenever `format: F` is declared
 * on a string or number property, so the named aliases are structurally
 * satisfied by the inferred type.
 *
 * The promotion contract:
 *
 * - A raw `string` value cannot be assigned to a branded field (compile error).
 * - A value returned from `JsonTology.instantiate(EmailSchema, x)` is
 *   assignable to `EmailBrandInterface`.
 * - Two distinct format brands are mutually incompatible (an `EmailBrand`
 *   value is not assignable to a `UriBrand` field).
 */

import {
  describe, it
} from 'node:test';

import { JsonTology } from '../../src/JsonTology.js';
import type {
  BinaryBrandInterface,
  ByteBrandInterface,
  DateBrandInterface,
  DateTimeBrandInterface,
  DoubleBrandInterface,
  DurationBrandInterface,
  EmailBrandInterface,
  FloatBrandInterface,
  FormatBrandType,
  HostnameBrandInterface,
  IdnEmailBrandInterface,
  IdnHostnameBrandInterface,
  Int32BrandInterface,
  Int64BrandInterface,
  Ipv4BrandInterface,
  Ipv6BrandInterface,
  IriBrandInterface,
  IriReferenceBrandInterface,
  JsonPointerBrandInterface,
  RegexBrandInterface,
  RelativeJsonPointerBrandInterface,
  TimeBrandInterface,
  UriBrandInterface,
  UriReferenceBrandInterface,
  UriTemplateBrandInterface,
  UuidBrandInterface
} from '../../src/types/ConstraintBrands.js';
import type { InferType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AssertAssignableType<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// 1. Email — InferType produces a value assignable to EmailBrandInterface
// ---------------------------------------------------------------------------

const _EmailSchema = {
  '$id': 'https://example.io/Email',
  'format': 'email',
  'type': 'string'
} as const;

void _EmailSchema;

type Email = InferType<typeof _EmailSchema>;

assert<AssertAssignableType<Email, EmailBrandInterface>>();
assert<AssertAssignableType<Email, FormatBrandType<'email'>>>();
assert<AssertAssignableType<Email, string>>();

// instantiate returns the branded type; assignment to EmailBrandInterface is OK
const jtEmail = JsonTology.create({
  'baseIRI': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [_EmailSchema] as const
});

const _emailGood: EmailBrandInterface = jtEmail.instantiate(
  'https://example.io/Email',
  'a@b.com'
);

void _emailGood;

// Plain string is NOT assignable to EmailBrandInterface
function takeEmail(_e: EmailBrandInterface): void {
  void _e;
}

// @ts-expect-error — plain string lacks the email format brand
takeEmail('a@b.com');

void takeEmail;

// ---------------------------------------------------------------------------
// 2. Distinct format brands are mutually incompatible
// ---------------------------------------------------------------------------

const _UriSchema = {
  '$id': 'https://example.io/Uri',
  'format': 'uri',
  'type': 'string'
} as const;

void _UriSchema;

type Uri = InferType<typeof _UriSchema>;

assert<AssertAssignableType<Uri, UriBrandInterface>>();

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const emailVal = {} as EmailBrandInterface;
  // @ts-expect-error — EmailBrandInterface is not assignable to UriBrandInterface
  const _uriFromEmail: UriBrandInterface = emailVal;

  void _uriFromEmail;
}

// ---------------------------------------------------------------------------
// 3. UUID
// ---------------------------------------------------------------------------

const _UuidSchema = {
  '$id': 'https://example.io/Uuid',
  'format': 'uuid',
  'type': 'string'
} as const;

void _UuidSchema;

type Uuid = InferType<typeof _UuidSchema>;
assert<AssertAssignableType<Uuid, UuidBrandInterface>>();

// ---------------------------------------------------------------------------
// 4. Date / Date-Time / Time / Duration
// ---------------------------------------------------------------------------

const _DateSchema = {
  '$id': 'https://example.io/D',
  'format': 'date',
  'type': 'string'
} as const;

void _DateSchema;
assert<AssertAssignableType<InferType<typeof _DateSchema>, DateBrandInterface>>();

const _DateTimeSchema = {
  '$id': 'https://example.io/DT',
  'format': 'date-time',
  'type': 'string'
} as const;

void _DateTimeSchema;
assert<AssertAssignableType<InferType<typeof _DateTimeSchema>, DateTimeBrandInterface>>();

const _TimeSchema = {
  '$id': 'https://example.io/T',
  'format': 'time',
  'type': 'string'
} as const;

void _TimeSchema;
assert<AssertAssignableType<InferType<typeof _TimeSchema>, TimeBrandInterface>>();

const _DurationSchema = {
  '$id': 'https://example.io/Du',
  'format': 'duration',
  'type': 'string'
} as const;

void _DurationSchema;
assert<AssertAssignableType<InferType<typeof _DurationSchema>, DurationBrandInterface>>();

// ---------------------------------------------------------------------------
// 5. Hostname / IDN-hostname / IDN-email
// ---------------------------------------------------------------------------

const _HostnameSchema = {
  '$id': 'https://example.io/H',
  'format': 'hostname',
  'type': 'string'
} as const;

void _HostnameSchema;
assert<AssertAssignableType<InferType<typeof _HostnameSchema>, HostnameBrandInterface>>();

const _IdnHostnameSchema = {
  '$id': 'https://example.io/IH',
  'format': 'idn-hostname',
  'type': 'string'
} as const;

void _IdnHostnameSchema;
assert<AssertAssignableType<InferType<typeof _IdnHostnameSchema>, IdnHostnameBrandInterface>>();

const _IdnEmailSchema = {
  '$id': 'https://example.io/IE',
  'format': 'idn-email',
  'type': 'string'
} as const;

void _IdnEmailSchema;
assert<AssertAssignableType<InferType<typeof _IdnEmailSchema>, IdnEmailBrandInterface>>();

// ---------------------------------------------------------------------------
// 6. IPv4 / IPv6
// ---------------------------------------------------------------------------

const _Ipv4Schema = {
  '$id': 'https://example.io/Ip4',
  'format': 'ipv4',
  'type': 'string'
} as const;

void _Ipv4Schema;
assert<AssertAssignableType<InferType<typeof _Ipv4Schema>, Ipv4BrandInterface>>();

const _Ipv6Schema = {
  '$id': 'https://example.io/Ip6',
  'format': 'ipv6',
  'type': 'string'
} as const;

void _Ipv6Schema;
assert<AssertAssignableType<InferType<typeof _Ipv6Schema>, Ipv6BrandInterface>>();

// IPv4 and IPv6 are distinct brands
if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- branded phantom value
  const v4 = {} as Ipv4BrandInterface;
  // @ts-expect-error — Ipv4 is not assignable to Ipv6
  const _v6: Ipv6BrandInterface = v4;

  void _v6;
}

// ---------------------------------------------------------------------------
// 7. URI family — uri / uri-reference / uri-template / iri / iri-reference
// ---------------------------------------------------------------------------

const _UriRefSchema = {
  '$id': 'https://example.io/UR',
  'format': 'uri-reference',
  'type': 'string'
} as const;

void _UriRefSchema;
assert<AssertAssignableType<InferType<typeof _UriRefSchema>, UriReferenceBrandInterface>>();

const _UriTplSchema = {
  '$id': 'https://example.io/UT',
  'format': 'uri-template',
  'type': 'string'
} as const;

void _UriTplSchema;
assert<AssertAssignableType<InferType<typeof _UriTplSchema>, UriTemplateBrandInterface>>();

const _IriSchema = {
  '$id': 'https://example.io/I',
  'format': 'iri',
  'type': 'string'
} as const;

void _IriSchema;
assert<AssertAssignableType<InferType<typeof _IriSchema>, IriBrandInterface>>();

const _IriRefSchema = {
  '$id': 'https://example.io/IR',
  'format': 'iri-reference',
  'type': 'string'
} as const;

void _IriRefSchema;
assert<AssertAssignableType<InferType<typeof _IriRefSchema>, IriReferenceBrandInterface>>();

// uri and uri-reference are distinct brands
if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- branded phantom value
  const uri = {} as UriBrandInterface;
  // @ts-expect-error — UriBrandInterface is not assignable to UriReferenceBrandInterface
  const _ur: UriReferenceBrandInterface = uri;

  void _ur;
}

// ---------------------------------------------------------------------------
// 8. Regex / JSON Pointer / Relative JSON Pointer
// ---------------------------------------------------------------------------

const _RegexSchema = {
  '$id': 'https://example.io/Re',
  'format': 'regex',
  'type': 'string'
} as const;

void _RegexSchema;
assert<AssertAssignableType<InferType<typeof _RegexSchema>, RegexBrandInterface>>();

const _JsonPointerSchema = {
  '$id': 'https://example.io/JP',
  'format': 'json-pointer',
  'type': 'string'
} as const;

void _JsonPointerSchema;
assert<AssertAssignableType<InferType<typeof _JsonPointerSchema>, JsonPointerBrandInterface>>();

const _RelJsonPointerSchema = {
  '$id': 'https://example.io/RJP',
  'format': 'relative-json-pointer',
  'type': 'string'
} as const;

void _RelJsonPointerSchema;
assert<AssertAssignableType<
  InferType<typeof _RelJsonPointerSchema>,
  RelativeJsonPointerBrandInterface
>>();

// ---------------------------------------------------------------------------
// 9. Binary / Byte (OpenAPI string formats)
// ---------------------------------------------------------------------------

const _BinarySchema = {
  '$id': 'https://example.io/Bin',
  'format': 'binary',
  'type': 'string'
} as const;

void _BinarySchema;
assert<AssertAssignableType<InferType<typeof _BinarySchema>, BinaryBrandInterface>>();

const _ByteSchema = {
  '$id': 'https://example.io/Byte',
  'format': 'byte',
  'type': 'string'
} as const;

void _ByteSchema;
assert<AssertAssignableType<InferType<typeof _ByteSchema>, ByteBrandInterface>>();

// ---------------------------------------------------------------------------
// 10. Numeric formats — int32 / int64 / float / double
// ---------------------------------------------------------------------------

const _Int32Schema = {
  '$id': 'https://example.io/I32',
  'format': 'int32',
  'type': 'integer'
} as const;

void _Int32Schema;
assert<AssertAssignableType<InferType<typeof _Int32Schema>, Int32BrandInterface>>();

const _Int64Schema = {
  '$id': 'https://example.io/I64',
  'format': 'int64',
  'type': 'integer'
} as const;

void _Int64Schema;
assert<AssertAssignableType<InferType<typeof _Int64Schema>, Int64BrandInterface>>();

const _FloatSchema = {
  '$id': 'https://example.io/F',
  'format': 'float',
  'type': 'number'
} as const;

void _FloatSchema;
assert<AssertAssignableType<InferType<typeof _FloatSchema>, FloatBrandInterface>>();

const _DoubleSchema = {
  '$id': 'https://example.io/Do',
  'format': 'double',
  'type': 'number'
} as const;

void _DoubleSchema;
assert<AssertAssignableType<InferType<typeof _DoubleSchema>, DoubleBrandInterface>>();

// Plain number is NOT assignable to Int32BrandInterface
function takeInt32(_n: Int32BrandInterface): void {
  void _n;
}

// @ts-expect-error — plain number lacks the int32 format brand
takeInt32(42);

void takeInt32;

// int32 and int64 are distinct brands
if (false as boolean) {
  const i32 = 0 as unknown as Int32BrandInterface;
  // @ts-expect-error — Int32 is not assignable to Int64
  const _i64: Int64BrandInterface = i32;

  void _i64;
}

// ---------------------------------------------------------------------------
// 11. Branded fields inside an object schema
// ---------------------------------------------------------------------------

const _UserSchema = {
  '$id': 'https://example.io/User',
  'properties': {
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'id': {
      'format': 'uuid',
      'type': 'string'
    }
  },
  'required': [
    'id',
    'email'
  ],
  'type': 'object'
} as const;

void _UserSchema;

type User = InferType<typeof _UserSchema>;

assert<AssertAssignableType<User['email'], EmailBrandInterface>>();
assert<AssertAssignableType<User['id'], UuidBrandInterface>>();

// instantiate returns a User where the fields satisfy their brands
const jtUser = JsonTology.create({
  'baseIRI': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [_UserSchema] as const
});

const _u = jtUser.instantiate('https://example.io/User', {
  'email': 'a@b.com',
  'id': '12345678-1234-4123-8123-123456789abc'
});

const _emailField: EmailBrandInterface = _u.email;
const _idField: UuidBrandInterface = _u.id;

void _emailField;
void _idField;

// Raw object with plain strings cannot be assigned to a branded User —
// each field is rejected because the plain string lacks its format brand.
if (false as boolean) {
  const _bad: User = {
    // @ts-expect-error — plain string lacks FormatBrand<'email'>
    'email': 'a@b.com',
    // @ts-expect-error — plain string lacks FormatBrand<'uuid'>
    'id': '12345678-1234-4123-8123-123456789abc'
  };

  void _bad;
}

void describe('format brands (Finding 23)', () => {
  void it('compiles with format brand intersections enabled', () => {
    void 0;
  });
});
