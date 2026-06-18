/**
 * Compile-time constraint type assertions.
 *
 * Verifies that json-tology catches errors at compile time:
 * - Cross-schema $ref resolution
 * - JSON Pointer path validation for subschemaAt
 * - Materialized type precision (defaults become non-optional)
 * - Transform decode/encode type safety
 * - Property path helpers
 * - Duplicate $id detection
 * - Typed abox() input
 * - prefixItems + items rest-tuple inference
 * - minItems/maxItems fixed/min-length tuple inference
 * - patternProperties type inference
 * - Extended pointer paths (additionalProperties, contains, dependentSchemas,
 *   not, patternProperties, prefixItems, propertyNames)
 * - readOnly/writeOnly property filtering (InputSchemaType, OutputSchemaType)
 */

import { JsonTology } from '../../src/JsonTology.js';
import { Transform } from '../../src/modules/transform/Transform.js';
import { Brand } from '../../src/modules/data/Brand.js';
import type {
  ContainsBrandType,
  ContentEncodingBrandType,
  ContentMediaTypeBrandType,
  DialectBrandType,
  FormatBrandType,
  MaxItemsBrandType,
  MaxLengthBrandType,
  MaxPropertiesBrandType,
  MinimumBrandType,
  MinItemsBrandType,
  MinLengthBrandType,
  MinPropertiesBrandType,
  MultipleOfBrandType,
  SchemaIdBrandType,
  UniqueItemsBrandType
} from '../../src/types/ConstraintBrands.js';
import type {
  DeepPropertyPathsType,
  DefaultAlignedType,
  DeprecatedKeysType,
  DiscriminatorPropertyType,
  EnumValuesType,
  ExhaustiveType,
  InputSchemaType,
  IntegerRangeType,
  MaterializedSchemaType,
  NominalSchemaType,
  NonDeprecatedSchemaType,
  OutputSchemaType,
  PropertyPathsType,
  ReadOnlyKeysType,
  SchemaPointerPathsType,
  WriteOnlyKeysType
} from '../../src/types/Infer.js';
import type { InferType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Type-level assertion helpers
// ---------------------------------------------------------------------------

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  // interop: void 0 as unknown as T is the compile-time type-test idiom; no
  // typed path exists from void to an arbitrary constraint-bounded type T.
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

const AddressSchema = {
  '$id': 'https://example.io/Address',
  'properties': {
    'city': {
      'default': 'Unknown',
      'type': 'string'
    },
    'street': { 'type': 'string' },
    'zip': { 'type': 'string' }
  },
  'required': ['street'],
  'type': 'object'
} as const;

const UserSchema = {
  '$id': 'https://example.io/User',
  'properties': {
    'address': { '$ref': 'https://example.io/Address' },
    'age': {
      'default': 0,
      'type': 'number'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const OrderSchema = {
  '$id': 'https://example.io/Order',
  'properties': {
    'buyer': { '$ref': 'https://example.io/User' },
    'orderId': { 'type': 'string' },
    'total': { 'type': 'number' }
  },
  'required': [
    'orderId',
    'total'
  ],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// 1. Cross-schema $ref resolution
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [
    AddressSchema,
    UserSchema,
    OrderSchema
  ] as const
});

const order = jt.instantiate('https://example.io/Order', {
  'buyer': {
    'address': { 'street': '123 Main St' },
    'name': 'Ada'
  },
  'orderId': 'o-1',
  'total': 42
});

// Type assertions verify cross-schema ref resolution
const _orderId: string = order.orderId;
const _total: number = order.total;

// buyer is User type (not unknown) because $ref resolved

if (order.buyer !== undefined) {
  const _buyerName: string = order.buyer.name;

  if (order.buyer.address !== undefined) {
    const _street: string = order.buyer.address.street;

    void _street;
  }

  void _buyerName;
}

void _orderId;
void _total;

// ---------------------------------------------------------------------------
// 2. JSON Pointer path validation for subschemaAt
// ---------------------------------------------------------------------------

type UserPointerPaths = SchemaPointerPathsType<typeof UserSchema>;

const _pp1: UserPointerPaths = '/properties/name';
const _pp2: UserPointerPaths = '/properties/age';
const _pp3: UserPointerPaths = '/properties/address';

void _pp1;
void _pp2;
void _pp3;

// @ts-expect-error — /properties/missing is not a valid path
const _ppBad: UserPointerPaths = '/properties/missing';

void _ppBad;

// subschemaAt with schema object provides pointer validation
jt.subschemaAt(UserSchema, '/properties/name');
jt.subschemaAt(UserSchema, '/properties/age');

// ---------------------------------------------------------------------------
// 3. Materialized type precision
// ---------------------------------------------------------------------------

type MaterializedAddress = MaterializedSchemaType<typeof AddressSchema>;

// street is required, city has default — both non-optional
const _matAddr: MaterializedAddress = {
  'city': 'Known',
  'street': '123 Main'
};

const _matStreet: string = _matAddr.street;
const _matCity: string = _matAddr.city;

void _matStreet;
void _matCity;

// materialize() returns MaterializedSchemaType
const jt2 = JsonTology.create({
  'baseIRI': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [AddressSchema] as const
});

const addr = jt2.materialize(AddressSchema, { 'street': '456 Oak' });

const _addrCity: string = addr.city;

void _addrCity;

// ---------------------------------------------------------------------------
// 4. Transform decode/encode type safety
// ---------------------------------------------------------------------------

const DateSchema = {
  '$id': 'https://example.io/Date',
  'format': 'date-time',
  'type': 'string'
} as const;

// Normalize transform: decode maps a raw `{ epoch }` wire payload into the
// schema's canonical (branded, date-time) string; encode is the inverse.
const _TransformedDateSchema = Transform.create(DateSchema, {
  'decode': (raw: { 'epoch': number }) => {
    return Brand.cast(new Date(raw.epoch).toISOString());
  },
  'encode': (value) => {
    return { 'epoch': new Date(value).getTime() };
  }
});

void _TransformedDateSchema;

// ---------------------------------------------------------------------------
// 5. Property path helpers
// ---------------------------------------------------------------------------

type UserPropertyPaths = PropertyPathsType<typeof UserSchema>;

const _prop1: UserPropertyPaths = 'name';
const _prop2: UserPropertyPaths = 'age';
const _prop3: UserPropertyPaths = 'address';

void _prop1;
void _prop2;
void _prop3;

// @ts-expect-error — 'missing' is not a property
const _propBad: UserPropertyPaths = 'missing';

void _propBad;

// Deep property paths with nested schema
const _NestedSchema = {
  'properties': {
    'user': {
      'properties': {
        'address': {
          'properties': { 'city': { 'type': 'string' } },
          'type': 'object'
        },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    }
  },
  'type': 'object'
} as const;

void _NestedSchema;

type NestedPaths = DeepPropertyPathsType<typeof _NestedSchema>;

const _dp1: NestedPaths = 'user';
const _dp2: NestedPaths = 'user.name';
const _dp3: NestedPaths = 'user.address';
const _dp4: NestedPaths = 'user.address.city';

void _dp1;
void _dp2;
void _dp3;
void _dp4;

// @ts-expect-error — invalid path
const _dpBad: NestedPaths = 'user.missing';

void _dpBad;

// ---------------------------------------------------------------------------
// 6. Duplicate $id detection (compile time)
// ---------------------------------------------------------------------------

const _DupA = {
  '$id': 'https://example.io/Dup',
  'type': 'object'
} as const;

const _DupB = {
  '$id': 'https://example.io/Dup',
  'type': 'string'
} as const;

if (false as boolean) {
  JsonTology.create({
    'baseIRI': 'https://example.io',
    'enableStrictGraph': false,
    'schemas': [
      // @ts-expect-error — duplicate $id: both schemas share 'https://example.io/Dup'
      _DupA,
      // @ts-expect-error — duplicate $id: both schemas share 'https://example.io/Dup'
      _DupB
    ] as const
  });
}

// ---------------------------------------------------------------------------
// 7. Pointer paths for $defs
// ---------------------------------------------------------------------------

const _SchemaWithDefs = {
  '$defs': {
    'Inner': {
      'properties': { 'value': { 'type': 'string' } },
      'type': 'object'
    }
  },
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void _SchemaWithDefs;

type DefsPointerPaths = SchemaPointerPathsType<typeof _SchemaWithDefs>;

const _dp5: DefsPointerPaths = '/properties/name';
const _dp6: DefsPointerPaths = '/$defs/Inner';
const _dp7: DefsPointerPaths = '/$defs/Inner/properties/value';

void _dp5;
void _dp6;
void _dp7;

// ---------------------------------------------------------------------------
// 8. Typed toQuads() input
// ---------------------------------------------------------------------------

void jt.toQuads(AddressSchema, { 'street': '123 Main' });

// ---------------------------------------------------------------------------
// 9. Cross-schema $ref chain (Order -> User -> Address)
// ---------------------------------------------------------------------------

const chainOrder = jt.instantiate('https://example.io/Order', {
  'buyer': {
    'address': { 'street': '456 Oak' },
    'name': 'Ada'
  },
  'orderId': 'o-1',
  'total': 99
});


if (chainOrder.buyer?.address !== undefined) {
  const _chainStreet: string = chainOrder.buyer.address.street;
  const _chainCity: string | undefined = chainOrder.buyer.address.city;

  void _chainStreet;
  void _chainCity;
}

// ---------------------------------------------------------------------------
// 10. Transform round-trip type enforcement
// ---------------------------------------------------------------------------

const NumSchema = {
  '$id': 'https://example.io/Num',
  'type': 'number'
} as const;

if (false as boolean) {
  Transform.create<typeof NumSchema, string>(NumSchema, {
    'decode': Number,
    // @ts-expect-error — encode must return the wire type string, not boolean
    'encode': (_value: number) => {
      return true;
    }
  });
}

void NumSchema;

// ---------------------------------------------------------------------------
// 11. prefixItems + items rest-tuple
// ---------------------------------------------------------------------------

const _TupleRestSchema = {
  'items': { 'type': 'number' },
  'prefixItems': [
    { 'type': 'string' },
    { 'type': 'boolean' }
  ],
  'type': 'array'
} as const;

void _TupleRestSchema;

type TupleRest = InferType<typeof _TupleRestSchema>;

// First two elements are string and boolean, rest are numbers
const _tr1: TupleRest = [
  'hello',
  true,
  1,
  2,
  3
];

void _tr1;

// prefixItems only — no rest
const _TupleOnlySchema = {
  'prefixItems': [
    { 'type': 'string' },
    { 'type': 'number' }
  ],
  'type': 'array'
} as const;

void _TupleOnlySchema;

type TupleOnly = InferType<typeof _TupleOnlySchema>;
const _to1: TupleOnly = [
  'hello',
  42
];

void _to1;

// ---------------------------------------------------------------------------
// 12. minItems / maxItems tuple inference
// ---------------------------------------------------------------------------

const _FixedArraySchema = {
  'items': { 'type': 'string' },
  'maxItems': 3,
  'minItems': 3,
  'type': 'array'
} as const;

void _FixedArraySchema;

type FixedArray = InferType<typeof _FixedArraySchema>;

// Fixed-length tuple: exactly 3 strings, intersected with the maxItems/minItems
// brands. The brands make the type unsatisfiable by a plain array literal —
// only runtime-coerced values carry them — so the contract is verified at the
// type level rather than by a literal assignment.
assert<AssertEqualType<
  FixedArray,
  MaxItemsBrandType<3> & MinItemsBrandType<3> & readonly [string, string, string]
>>();

const _MinArraySchema = {
  'items': { 'type': 'number' },
  'minItems': 2,
  'type': 'array'
} as const;

void _MinArraySchema;

type MinArray = InferType<typeof _MinArraySchema>;

// Min-length tuple: at least 2 numbers, then rest — carries the minItems brand.
assert<AssertEqualType<
  MinArray,
  MinItemsBrandType<2> & readonly [number, number, ...number[]]
>>();

// ---------------------------------------------------------------------------
// 13. patternProperties type inference
// ---------------------------------------------------------------------------

const _PatternSchema = {
  'patternProperties': { '^x-': { 'type': 'number' } },
  'type': 'object'
} as const;

void _PatternSchema;

type PatternProps = InferType<typeof _PatternSchema>;

// Pattern property keys are optional in the inferred shape, so the value type
// is `number | undefined` for any matching key.
const _pp4: PatternProps = { 'x-count': 42 };
const _ppVal: number | undefined = _pp4['x-count'];

void _ppVal;

// ---------------------------------------------------------------------------
// 14. Extended pointer paths
// ---------------------------------------------------------------------------

const _ExtendedSchema = {
  'additionalProperties': { 'type': 'string' },
  'contains': { 'type': 'number' },
  'dependentSchemas': {
    'credit_card': {
      'properties': { 'billing_address': { 'type': 'string' } },
      'type': 'object'
    }
  },
  'not': { 'type': 'null' },
  'patternProperties': { '^x-': { 'type': 'number' } },
  'prefixItems': [{ 'type': 'string' }],
  'properties': { 'name': { 'type': 'string' } },
  'propertyNames': {
    'pattern': '^[a-z]',
    'type': 'string'
  },
  'type': 'object'
} as const;

void _ExtendedSchema;

type ExtendedPaths = SchemaPointerPathsType<typeof _ExtendedSchema>;

// Existing keywords still work
const _ep1: ExtendedPaths = '/properties/name';

// New keyword paths
const _ep2: ExtendedPaths = '/additionalProperties';
const _ep3: ExtendedPaths = '/contains';
const _ep4: ExtendedPaths = '/dependentSchemas/credit_card';
const _ep5: ExtendedPaths = '/dependentSchemas/credit_card/properties/billing_address';
const _ep6: ExtendedPaths = '/not';
const _ep7: ExtendedPaths = '/patternProperties/^x-';
const _ep8: ExtendedPaths = '/prefixItems/0';
const _ep9: ExtendedPaths = '/propertyNames';

void _ep1;
void _ep2;
void _ep3;
void _ep4;
void _ep5;
void _ep6;
void _ep7;
void _ep8;
void _ep9;

// ---------------------------------------------------------------------------
// 15. readOnly / writeOnly property filtering
// ---------------------------------------------------------------------------

const _ApiSchema = {
  'properties': {
    'id': {
      'readOnly': true,
      'type': 'string'
    },
    'name': { 'type': 'string' },
    'password': {
      'type': 'string',
      'writeOnly': true
    }
  },
  'required': [
    'id',
    'name'
  ],
  'type': 'object'
} as const;

void _ApiSchema;

// ReadOnlyKeysType extracts readOnly property names
type ApiReadOnly = ReadOnlyKeysType<typeof _ApiSchema>;
const _ro1: ApiReadOnly = 'id';

void _ro1;

// WriteOnlyKeysType extracts writeOnly property names
type ApiWriteOnly = WriteOnlyKeysType<typeof _ApiSchema>;
const _wo1: ApiWriteOnly = 'password';

void _wo1;

// InputSchemaType — excludes readOnly (no 'id' in input)
type ApiInput = InputSchemaType<typeof _ApiSchema>;
const _input: ApiInput = { 'name': 'Ada' };


const _inputName: string = _input.name;

void _inputName;

// OutputSchemaType — excludes writeOnly (no 'password' in output)
type ApiOutput = OutputSchemaType<typeof _ApiSchema>;
const _output: ApiOutput = {
  'id': 'abc',
  'name': 'Ada'
};

const _outputId: string = _output.id;
const _outputName: string = _output.name;

void _outputId;
void _outputName;

// ---------------------------------------------------------------------------
// 16. Format brands — string
// ---------------------------------------------------------------------------

const _EmailSchema = {
  '$id': 'https://example.io/Email',
  'format': 'email',
  'type': 'string'
} as const;

type Email = InferType<typeof _EmailSchema>;

// Email is branded — not assignable from plain string
// @ts-expect-error — plain string lacks FormatBrand<'email'>
const _emailBad: Email = 'hello@example.com' as string;

void _emailBad;

// Coerce returns the branded type
const jtBrand = JsonTology.create({
  'baseIRI': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [_EmailSchema] as const
});

const _emailGood: Email = jtBrand.instantiate('https://example.io/Email', 'a@b.com');

void _emailGood;

// Two different formats are incompatible
const _UriSchema = {
  '$id': 'https://example.io/Uri',
  'format': 'uri',
  'type': 'string'
} as const;

void _UriSchema;

type Uri = InferType<typeof _UriSchema>;

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const emailVal = {} as Email;
  // @ts-expect-error — FormatBrand<'email'> is not assignable to FormatBrand<'uri'>
  const _uriFail: Uri = emailVal;

  void _uriFail;
}

// FormatBrand is intersected onto the string type
type EmailHasFormatBrand = Email extends FormatBrandType<'email'> & string ? true : false;
const _emailBrandCheck: EmailHasFormatBrand = true;

void _emailBrandCheck;

// ---------------------------------------------------------------------------
// 17. String constraint brands — minLength, maxLength, pattern
// ---------------------------------------------------------------------------

const _ConstrainedStringSchema = {
  'maxLength': 100,
  'minLength': 5,
  'pattern': '^[A-Z]',
  'type': 'string'
} as const;

void _ConstrainedStringSchema;

type ConstrainedString = InferType<typeof _ConstrainedStringSchema>;

// @ts-expect-error — plain string lacks MinLengthBrand<5>
const _csBad: ConstrainedString = 'hello' as string;

void _csBad;

// Branded type carries all three brands
type HasMinLength = ConstrainedString extends MinLengthBrandType<5> ? true : false;
type HasMaxLength = ConstrainedString extends MaxLengthBrandType<100> ? true : false;
const _csMinCheck: HasMinLength = true;
const _csMaxCheck: HasMaxLength = true;

void _csMinCheck;
void _csMaxCheck;

// ---------------------------------------------------------------------------
// 18. Number constraint brands — minimum, maximum, multipleOf
// ---------------------------------------------------------------------------

const _ConstrainedNumSchema = {
  'minimum': 0,
  'multipleOf': 5,
  'type': 'number'
} as const;

void _ConstrainedNumSchema;

type ConstrainedNum = InferType<typeof _ConstrainedNumSchema>;

// @ts-expect-error — plain number lacks MinimumBrand<0>
const _cnBad: ConstrainedNum = 42 as number;

void _cnBad;

type NumHasMinimum = ConstrainedNum extends MinimumBrandType<0> ? true : false;
type NumHasMultipleOf = ConstrainedNum extends MultipleOfBrandType<5> ? true : false;
const _cnMinCheck: NumHasMinimum = true;
const _cnMulCheck: NumHasMultipleOf = true;

void _cnMinCheck;
void _cnMulCheck;

// Different minimums are incompatible
const _OtherNumSchema = {
  'minimum': 1,
  'type': 'number'
} as const;

void _OtherNumSchema;

type OtherNum = InferType<typeof _OtherNumSchema>;

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const zeroMin = {} as ConstrainedNum;
  // @ts-expect-error — MinimumBrand<0> is not assignable to MinimumBrand<1>
  const _otherFail: OtherNum = zeroMin;

  void _otherFail;
}

// ---------------------------------------------------------------------------
// 19. Array brands — uniqueItems
// ---------------------------------------------------------------------------

const _UniqueArraySchema = {
  'items': { 'type': 'string' },
  'type': 'array',
  'uniqueItems': true
} as const;

void _UniqueArraySchema;

type UniqueArray = InferType<typeof _UniqueArraySchema>;

type HasUniqueItems = UniqueArray extends UniqueItemsBrandType ? true : false;
const _uaCheck: HasUniqueItems = true;

void _uaCheck;

// ---------------------------------------------------------------------------
// 20. Contains brand
// ---------------------------------------------------------------------------

const _ContainsSchema = {
  'contains': { 'type': 'number' },
  'type': 'array'
} as const;

void _ContainsSchema;

type ContainsArr = InferType<typeof _ContainsSchema>;

// Contains-only array narrows element type to the contains schema
type ContainsElement = ContainsArr extends readonly number[] ? true : false;
const _containsElCheck: ContainsElement = true;

void _containsElCheck;

// Contains brand is present
type HasContains = ContainsArr extends ContainsBrandType<number> ? true : false;
const _containsBrandCheck: HasContains = true;

void _containsBrandCheck;

// ---------------------------------------------------------------------------
// 21. dependentSchemas property merging
// ---------------------------------------------------------------------------

const _DependentSchema = {
  'dependentSchemas': {
    'credit_card': {
      'properties': { 'billing_address': { 'type': 'string' } },
      'required': ['billing_address'],
      'type': 'object'
    }
  },
  'properties': {
    'credit_card': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

void _DependentSchema;

type DependentObj = InferType<typeof _DependentSchema>;

// billing_address appears as optional from dependentSchemas
const _depObj: DependentObj = {
  'billing_address': '123 Main',
  'name': 'Ada'
};
const _depName: string | undefined = _depObj.name;

void _depObj;
void _depName;

// ---------------------------------------------------------------------------
// 22. Discriminator + oneOf
// ---------------------------------------------------------------------------

const _DiscriminatedSchema = {
  'discriminator': { 'propertyName': 'kind' },
  'oneOf': [
    {
      'properties': {
        'bark': { 'type': 'boolean' },
        'kind': { 'const': 'dog' }
      },
      'type': 'object'
    },
    {
      'properties': {
        'kind': { 'const': 'cat' },
        'meow': { 'type': 'boolean' }
      },
      'type': 'object'
    }
  ]
} as const;

void _DiscriminatedSchema;

type Discriminated = InferType<typeof _DiscriminatedSchema>;

// Discriminator property is required on the union
type DiscKindRequired = Discriminated extends { readonly 'kind': unknown } ? true : false;
const _discCheck: DiscKindRequired = true;

void _discCheck;

// DiscriminatorPropertyType extracts the property name
type DiscProp = DiscriminatorPropertyType<typeof _DiscriminatedSchema>;
const _discProp: DiscProp = 'kind';

void _discProp;

// ---------------------------------------------------------------------------
// 23. IntegerRangeType utility
// ---------------------------------------------------------------------------

type Rating = IntegerRangeType<1, 5>;

const _r1: Rating = 1;
const _r2: Rating = 3;
const _r3: Rating = 5;

void _r1;
void _r2;
void _r3;

// @ts-expect-error — 0 is not in 1..5
const _rBad: Rating = 0;

void _rBad;

// @ts-expect-error — 6 is not in 1..5
const _rBad2: Rating = 6;

void _rBad2;

// ---------------------------------------------------------------------------
// 24. Generic ValueInterface — typed value.instantiate()
// ---------------------------------------------------------------------------

const _ValJt = JsonTology.create({
  'baseIRI': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [AddressSchema] as const
});

const _valAddr = _ValJt.value.instantiate('https://example.io/Address', { 'street': '1st' });
const _valStreet: string | undefined = _valAddr.street;

void _valStreet;

// ---------------------------------------------------------------------------
// 25. Brands compose through allOf
// ---------------------------------------------------------------------------

const _AllOfBrandSchema = {
  'allOf': [
    {
      'format': 'email',
      'type': 'string'
    },
    {
      'minLength': 5,
      'type': 'string'
    }
  ]
} as const;

void _AllOfBrandSchema;

type AllOfBranded = InferType<typeof _AllOfBrandSchema>;

type AllOfHasFormat = AllOfBranded extends FormatBrandType<'email'> ? true : false;
type AllOfHasMinLen = AllOfBranded extends MinLengthBrandType<5> ? true : false;
const _allOfFormatCheck: AllOfHasFormat = true;
const _allOfMinLenCheck: AllOfHasMinLen = true;

void _allOfFormatCheck;
void _allOfMinLenCheck;

// ---------------------------------------------------------------------------
// 26. Content brands — contentMediaType, contentEncoding
// ---------------------------------------------------------------------------

const _ContentSchema = {
  'contentEncoding': 'base64',
  'contentMediaType': 'image/png',
  'type': 'string'
} as const;

void _ContentSchema;

type ContentStr = InferType<typeof _ContentSchema>;

// @ts-expect-error — plain string lacks ContentEncodingBrand<'base64'>
const _contentBad: ContentStr = 'abc' as string;

void _contentBad;

// Branded type carries both content brands
type HasContentEncoding = ContentStr extends ContentEncodingBrandType<'base64'> ? true : false;
type HasContentMediaType = ContentStr extends ContentMediaTypeBrandType<'image/png'> ? true : false;
const _ceCheck: HasContentEncoding = true;
const _cmtCheck: HasContentMediaType = true;

void _ceCheck;
void _cmtCheck;

// Different contentMediaType values are incompatible
const _OtherContentSchema = {
  'contentMediaType': 'application/json',
  'type': 'string'
} as const;

void _OtherContentSchema;

type OtherContent = InferType<typeof _OtherContentSchema>;

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const pngContent = {} as ContentStr;
  // @ts-expect-error — ContentMediaTypeBrand<'image/png'> not assignable to ContentMediaTypeBrand<'application/json'>
  const _otherContentFail: OtherContent = pngContent;

  void _otherContentFail;
}

// ---------------------------------------------------------------------------
// 27. Object brands — minProperties, maxProperties
// ---------------------------------------------------------------------------

const _BoundedObjSchema = {
  'maxProperties': 5,
  'minProperties': 1,
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void _BoundedObjSchema;

type BoundedObj = InferType<typeof _BoundedObjSchema>;

// Branded type carries both object brands
type HasMinProps = BoundedObj extends MinPropertiesBrandType<1> ? true : false;
type HasMaxProps = BoundedObj extends MaxPropertiesBrandType<5> ? true : false;
const _minPropCheck: HasMinProps = true;
const _maxPropCheck: HasMaxProps = true;

void _minPropCheck;
void _maxPropCheck;

// Different minProperties values are incompatible
const _OtherBoundedSchema = {
  'minProperties': 2,
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void _OtherBoundedSchema;

type OtherBounded = InferType<typeof _OtherBoundedSchema>;

if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const min1Obj = {} as BoundedObj;
  // @ts-expect-error — MinPropertiesBrand<1> not assignable to MinPropertiesBrand<2>
  const _otherBoundedFail: OtherBounded = min1Obj;

  void _otherBoundedFail;
}

// ---------------------------------------------------------------------------
// 28. Nominal brands — $id via NominalSchemaType
// ---------------------------------------------------------------------------

const _PersonSchema = {
  '$id': 'https://example.io/Person',
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void _PersonSchema;

const _RobotSchema = {
  '$id': 'https://example.io/Robot',
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void _RobotSchema;

type NominalPerson = NominalSchemaType<typeof _PersonSchema>;
type NominalRobot = NominalSchemaType<typeof _RobotSchema>;

// NominalSchemaType carries the $id brand
type PersonHasSchemaId = NominalPerson extends SchemaIdBrandType<'https://example.io/Person'> ? true : false;
const _personIdCheck: PersonHasSchemaId = true;

void _personIdCheck;

// Structurally identical schemas with different $id are incompatible
if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const person = {} as NominalPerson;
  // @ts-expect-error — SchemaIdBrand<'Person'> not assignable to SchemaIdBrand<'Robot'>
  const _robotFail: NominalRobot = person;

  void _robotFail;
}

// ---------------------------------------------------------------------------
// 29. Dialect brands — $schema via NominalSchemaType
// ---------------------------------------------------------------------------

const _Draft7Schema = {
  '$schema': 'http://json-schema.org/draft-07/schema#',
  'properties': { 'x': { 'type': 'number' } },
  'type': 'object'
} as const;

void _Draft7Schema;

const _Draft2020Schema = {
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  'properties': { 'x': { 'type': 'number' } },
  'type': 'object'
} as const;

void _Draft2020Schema;

type NominalDraft7 = NominalSchemaType<typeof _Draft7Schema>;
type NominalDraft2020 = NominalSchemaType<typeof _Draft2020Schema>;

type HasDialect7 = NominalDraft7 extends DialectBrandType<'http://json-schema.org/draft-07/schema#'> ? true : false;
const _dialect7Check: HasDialect7 = true;

void _dialect7Check;

// Different $schema values produce incompatible types
if (false as boolean) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- need branded phantom value
  const draft7 = {} as NominalDraft7;
  // @ts-expect-error — DialectBrand<'draft-07'> not assignable to DialectBrand<'2020-12'>
  const _draft2020Fail: NominalDraft2020 = draft7;

  void _draft2020Fail;
}

// ---------------------------------------------------------------------------
// 30. Object brands on patternProperties and bare objects
// ---------------------------------------------------------------------------

const _BrandedPatternSchema = {
  'minProperties': 1,
  'patternProperties': { '^x-': { 'type': 'number' } },
  'type': 'object'
} as const;

void _BrandedPatternSchema;

type BrandedPattern = InferType<typeof _BrandedPatternSchema>;

type PatternHasMinProps = BrandedPattern extends MinPropertiesBrandType<1> ? true : false;
const _patternMinCheck: PatternHasMinProps = true;

void _patternMinCheck;

const _BareObjBrandSchema = {
  'minProperties': 3,
  'type': 'object'
} as const;

void _BareObjBrandSchema;

type BareObjBranded = InferType<typeof _BareObjBrandSchema>;

type BareHasMinProps = BareObjBranded extends MinPropertiesBrandType<3> ? true : false;
const _bareMinCheck: BareHasMinProps = true;

void _bareMinCheck;

// ---------------------------------------------------------------------------
// 31. dependentRequired conditional typing
// ---------------------------------------------------------------------------

const _DependentRequiredSchema = {
  'dependentRequired': { 'credit_card': ['billing_address'] },
  'properties': {
    'billing_address': { 'type': 'string' },
    'credit_card': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

void _DependentRequiredSchema;

type DepReq = InferType<typeof _DependentRequiredSchema>;

// Without credit_card, billing_address remains optional
const _depReqNoCc: DepReq = { 'name': 'Ada' };

void _depReqNoCc;

// With credit_card, billing_address must be present
const _depReqWithCc: DepReq = {
  'billing_address': '123 Main',
  'credit_card': '4111',
  'name': 'Ada'
};

void _depReqWithCc;

// ---------------------------------------------------------------------------
// 32. Deprecated property filtering
// ---------------------------------------------------------------------------

const _DeprecatedSchema = {
  'properties': {
    'legacyId': {
      'deprecated': true,
      'type': 'string'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

void _DeprecatedSchema;

// DeprecatedKeysType extracts deprecated property names
type DeprecatedKeys = DeprecatedKeysType<typeof _DeprecatedSchema>;
const _dk1: DeprecatedKeys = 'legacyId';

void _dk1;

// @ts-expect-error — 'name' is not deprecated
const _dkBad: DeprecatedKeys = 'name';

void _dkBad;

// NonDeprecatedSchemaType omits deprecated properties
type NonDeprecated = NonDeprecatedSchemaType<typeof _DeprecatedSchema>;
const _ndObj: NonDeprecated = { 'name': 'Ada' };
const _ndName: string = _ndObj.name;

void _ndName;

// ---------------------------------------------------------------------------
// 34. EnumValuesType and ExhaustiveType
// ---------------------------------------------------------------------------

const _StatusSchema = {
  'enum': [
    'active',
    'inactive',
    'pending'
  ]
} as const;

void _StatusSchema;

type StatusValues = EnumValuesType<typeof _StatusSchema>;

const _sv1: StatusValues = 'active';
const _sv2: StatusValues = 'inactive';
const _sv3: StatusValues = 'pending';

void _sv1;
void _sv2;
void _sv3;

// @ts-expect-error — 'deleted' is not in the enum
const _svBad: StatusValues = 'deleted';

void _svBad;

// ExhaustiveType verifies all cases handled
function handleStatus(status: StatusValues): string {
  switch (status) {
    case 'active': return 'on';
    case 'inactive': return 'off';
    case 'pending': return 'waiting';
    default: {
      const _exhaustive: ExhaustiveType<typeof status> = status;

      void _exhaustive;

      return _exhaustive;
    }
  }
}

void handleStatus;

// ---------------------------------------------------------------------------
// 35. DefaultAlignedType — validates defaults match declared types
// ---------------------------------------------------------------------------

const _GoodDefaultsSchema = {
  'properties': {
    'count': {
      'default': 0,
      'type': 'number'
    },
    'name': {
      'default': 'unknown',
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

void _GoodDefaultsSchema;

// Good defaults — schema type passes through
type GoodDefaults = DefaultAlignedType<typeof _GoodDefaultsSchema>;
type GoodDefaultsIsSchema = GoodDefaults extends typeof _GoodDefaultsSchema ? true : false;
const _goodDefaultCheck: GoodDefaultsIsSchema = true;

void _goodDefaultCheck;

const _BadDefaultsSchema = {
  'properties': {
    'name': {
      'default': 42,
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

void _BadDefaultsSchema;

// Bad defaults — resolves to never
type BadDefaults = DefaultAlignedType<typeof _BadDefaultsSchema>;
type BadDefaultsIsNever = BadDefaults extends never ? true : false;
const _badDefaultCheck: BadDefaultsIsNever = true;

void _badDefaultCheck;

// ---------------------------------------------------------------------------
// 36. Auto integer range — bounded integers produce literal unions
// ---------------------------------------------------------------------------

const _RatingSchema = {
  'maximum': 5,
  'minimum': 1,
  'type': 'integer'
} as const;

void _RatingSchema;

type Rating2 = InferType<typeof _RatingSchema>;

// Auto-ranges to 1 | 2 | 3 | 4 | 5 — all literals valid
const _rating1: Rating2 = 1;
const _rating3: Rating2 = 3;
const _rating5: Rating2 = 5;

void _rating1;
void _rating3;
void _rating5;

// @ts-expect-error — 0 is outside the range
const _ratingBad1: Rating2 = 0;

void _ratingBad1;

// @ts-expect-error — 6 is outside the range
const _ratingBad2: Rating2 = 6;

void _ratingBad2;

// Works in type arrays too
const _NullableRatingSchema = {
  'maximum': 3,
  'minimum': 0,
  'type': [
    'integer',
    'null'
  ]
} as const;

void _NullableRatingSchema;

type NullableRating = InferType<typeof _NullableRatingSchema>;

const _nr1: NullableRating = 0;
const _nr2: NullableRating = 3;
const _nr3: NullableRating = null;

void _nr1;
void _nr2;
void _nr3;

// @ts-expect-error — 4 is outside the range, null is valid
const _nrBad: NullableRating = 4;

void _nrBad;

// ---------------------------------------------------------------------------
// 37. not: { type } exclusion — removes primitives from unions
// ---------------------------------------------------------------------------

const _NonNullStringSchema = {
  'not': { 'type': 'null' },
  'type': [
    'string',
    'null'
  ]
} as const;

void _NonNullStringSchema;

type NonNullStr = InferType<typeof _NonNullStringSchema>;

// null is excluded — only string remains
const _nns1: NonNullStr = 'hello';

void _nns1;

// @ts-expect-error — null excluded by not: { type: 'null' }
const _nnsBad: NonNullStr = null;

void _nnsBad;

// Excludes multiple types via not: { type: [...] }
const _OnlyStringSchema = {
  'not': {
    'type': [
      'null',
      'boolean'
    ]
  },
  'type': [
    'string',
    'boolean',
    'null'
  ]
} as const;

void _OnlyStringSchema;

type OnlyString = InferType<typeof _OnlyStringSchema>;

const _os1: OnlyString = 'hello';

void _os1;

// @ts-expect-error — boolean excluded
const _osBad1: OnlyString = true;

void _osBad1;

// @ts-expect-error — null excluded
const _osBad2: OnlyString = null;

void _osBad2;

// ---------------------------------------------------------------------------
// 38. not: { const } exclusion — removes specific values
// ---------------------------------------------------------------------------

const _NonAdminSchema = {
  'enum': [
    'admin',
    'editor',
    'viewer'
  ],
  'not': { 'const': 'admin' }
} as const;

void _NonAdminSchema;

type NonAdmin = InferType<typeof _NonAdminSchema>;

const _na1: NonAdmin = 'editor';
const _na2: NonAdmin = 'viewer';

void _na1;
void _na2;

// @ts-expect-error — 'admin' excluded by not: { const: 'admin' }
const _naBad: NonAdmin = 'admin';

void _naBad;

// ---------------------------------------------------------------------------
// 39. not: { enum } exclusion — removes set of values
// ---------------------------------------------------------------------------

const _ExcludeEnumSchema = {
  'enum': [
    'a',
    'b',
    'c',
    'd'
  ],
  'not': {
    'enum': [
      'c',
      'd'
    ]
  }
} as const;

void _ExcludeEnumSchema;

type ExcludedEnum = InferType<typeof _ExcludeEnumSchema>;

const _ee1: ExcludedEnum = 'a';
const _ee2: ExcludedEnum = 'b';

void _ee1;
void _ee2;

// @ts-expect-error — 'c' excluded
const _eeBad1: ExcludedEnum = 'c';

void _eeBad1;

// @ts-expect-error — 'd' excluded
const _eeBad2: ExcludedEnum = 'd';

void _eeBad2;

// Composing auto-range with not-const: exclude a value from integer range
const _NoFiveSchema = {
  'maximum': 10,
  'minimum': 0,
  'not': { 'const': 5 },
  'type': 'integer'
} as const;

void _NoFiveSchema;

type NoFive = InferType<typeof _NoFiveSchema>;

const _nf0: NoFive = 0;
const _nf4: NoFive = 4;
const _nf6: NoFive = 6;
const _nf10: NoFive = 10;

void _nf0;
void _nf4;
void _nf6;
void _nf10;

// @ts-expect-error — 5 excluded by not: { const: 5 }
const _nfBad: NoFive = 5;

void _nfBad;

// ---------------------------------------------------------------------------
// 40. Array brands — minItems produces MinItemsBrandType
// ---------------------------------------------------------------------------

const _MinItemsArraySchema = {
  'items': { 'type': 'string' },
  'minItems': 2,
  'type': 'array'
} as const;

void _MinItemsArraySchema;

type MinItemsArr = InferType<typeof _MinItemsArraySchema>;

// interop: MinItemsBrandType carries a phantom brand key; null cannot
// be assigned to the branded type without the unknown intermediate.
const _mia: MinItemsBrandType<2> = null as unknown as MinItemsArr;

void _mia;

// ---------------------------------------------------------------------------
// 41. Array brands — maxItems produces MaxItemsBrandType, different values incompatible
// ---------------------------------------------------------------------------

const _MaxItemsArraySchema = {
  'items': { 'type': 'number' },
  'maxItems': 5,
  'type': 'array'
} as const;

void _MaxItemsArraySchema;

type MaxItemsArr = InferType<typeof _MaxItemsArraySchema>;

// interop: MaxItemsBrandType carries a phantom brand key; null cannot
// be assigned to the branded type without the unknown intermediate.
const _mxa: MaxItemsBrandType<5> = null as unknown as MaxItemsArr;

void _mxa;

const _OtherMaxItemsSchema = {
  'items': { 'type': 'number' },
  'maxItems': 10,
  'type': 'array'
} as const;

void _OtherMaxItemsSchema;

type OtherMaxArr = InferType<typeof _OtherMaxItemsSchema>;

// interop: phantom brand key; unknown intermediate required for the negative brand test.
// @ts-expect-error — maxItems: 5 vs maxItems: 10 are incompatible brands
const _mxBad: MaxItemsBrandType<5> = null as unknown as OtherMaxArr;

void _mxBad;

// ---------------------------------------------------------------------------
// 42. Exclusive integer range — exclusiveMinimum/exclusiveMaximum
// ---------------------------------------------------------------------------

const _ExMinSchema = {
  'exclusiveMinimum': 0,
  'maximum': 5,
  'type': 'integer'
} as const;

void _ExMinSchema;

type ExMinRange = InferType<typeof _ExMinSchema>;

// 0 is excluded (exclusive), 1-5 are valid
const _exm1: ExMinRange = 1;
const _exm5: ExMinRange = 5;

void _exm1;
void _exm5;

// @ts-expect-error — 0 excluded by exclusiveMinimum
const _exmBad: ExMinRange = 0;

void _exmBad;

const _ExMaxSchema = {
  'exclusiveMaximum': 4,
  'minimum': 0,
  'type': 'integer'
} as const;

void _ExMaxSchema;

type ExMaxRange = InferType<typeof _ExMaxSchema>;

// 0-3 are valid, 4 is excluded
const _exa0: ExMaxRange = 0;
const _exa3: ExMaxRange = 3;

void _exa0;
void _exa3;

// @ts-expect-error — 4 excluded by exclusiveMaximum
const _exaBad: ExMaxRange = 4;

void _exaBad;

// ---------------------------------------------------------------------------
// 43. Both exclusive bounds and type array with exclusive bounds
// ---------------------------------------------------------------------------

const _BothExSchema = {
  'exclusiveMaximum': 5,
  'exclusiveMinimum': 0,
  'type': 'integer'
} as const;

void _BothExSchema;

type BothExRange = InferType<typeof _BothExSchema>;

// 1-4 are valid, 0 and 5 excluded
const _bex1: BothExRange = 1;
const _bex4: BothExRange = 4;

void _bex1;
void _bex4;

// @ts-expect-error — 0 excluded by exclusiveMinimum
const _bexBad1: BothExRange = 0;

void _bexBad1;

// @ts-expect-error — 5 excluded by exclusiveMaximum
const _bexBad2: BothExRange = 5;

void _bexBad2;

// Exclusive bounds in type arrays
const _NullableExSchema = {
  'exclusiveMinimum': 0,
  'maximum': 3,
  'type': [
    'integer',
    'null'
  ]
} as const;

void _NullableExSchema;

type NullableExRange = InferType<typeof _NullableExSchema>;

const _nex1: NullableExRange = 1;
const _nex3: NullableExRange = 3;
const _nexNull: NullableExRange = null;

void _nex1;
void _nex3;
void _nexNull;

// @ts-expect-error — 0 excluded by exclusiveMinimum
const _nexBad: NullableExRange = 0;

void _nexBad;

// ---------------------------------------------------------------------------
// 44. propertyNames: { enum } — strict key set
// ---------------------------------------------------------------------------

const _StrictKeysSchema = {
  'additionalProperties': { 'type': 'number' },
  'propertyNames': {
    'enum': [
      'x',
      'y',
      'z'
    ]
  },
  'type': 'object'
} as const;

void _StrictKeysSchema;

type StrictKeys = InferType<typeof _StrictKeysSchema>;

// Valid keys produce correct value type
const _sk: StrictKeys = {
  'x': 1,
  'y': 2
};

void _sk;

// Access a valid key
// interop: StrictKeys carries phantom brand keys; {} cannot satisfy the branded
// type — unknown intermediate used to exercise the indexed-access type shape.
const _skv: number | undefined = ({} as unknown as StrictKeys).x;

void _skv;

// @ts-expect-error — 'w' is not in propertyNames enum
const _skBad: StrictKeys = { 'w': 1 };

void _skBad;

// Without additionalProperties — values are unknown
const _BareStrictKeysSchema = {
  'propertyNames': {
    'enum': [
      'a',
      'b'
    ]
  },
  'type': 'object'
} as const;

void _BareStrictKeysSchema;

type BareStrictKeys = InferType<typeof _BareStrictKeysSchema>;

const _bsk: BareStrictKeys = { 'a': 'anything' };

void _bsk;

// @ts-expect-error — 'c' is not in propertyNames enum
const _bskBad: BareStrictKeys = { 'c': 1 };

void _bskBad;

// ---------------------------------------------------------------------------
// 45. if/then/else const-discriminated narrowing
// ---------------------------------------------------------------------------

const _ShapeSchema = {
  'else': { 'required': ['width'] },
  'if': {
    'properties': { 'kind': { 'const': 'circle' } },
    'required': ['kind']
  },
  'properties': {
    'kind': { 'type': 'string' },
    'radius': { 'type': 'number' },
    'width': { 'type': 'number' }
  },
  'then': { 'required': ['radius'] },
  'type': 'object'
} as const;

void _ShapeSchema;

type Shape = InferType<typeof _ShapeSchema>;

// Then branch narrows kind to 'circle' literal
const _circle: Shape = {
  'kind': 'circle',
  'radius': 10
};

void _circle;

// Else branch accepts any kind string
const _rect: Shape = {
  'kind': 'rectangle',
  'width': 20
};

void _rect;

// Verify the then branch has kind: 'circle' (not just string)
type CircleBranch = Extract<Shape, { readonly 'kind': 'circle' }>;
const _cbRadius: CircleBranch['radius'] = 10;

void _cbRadius;

// ---------------------------------------------------------------------------
// 46. if/then only (no else) — const-discriminated narrowing
// ---------------------------------------------------------------------------

const _IfThenOnlySchema = {
  'if': {
    'properties': { 'status': { 'const': 'active' } },
    'required': ['status']
  },
  'properties': {
    'expires': { 'type': 'string' },
    'status': { 'type': 'string' }
  },
  'then': { 'required': ['expires'] },
  'type': 'object'
} as const;

void _IfThenOnlySchema;

type StatusDoc = InferType<typeof _IfThenOnlySchema>;

// Then branch: status 'active' requires expires
const _active: StatusDoc = {
  'expires': '2026-12-31',
  'status': 'active'
};

void _active;

// Fallback branch: no constraint on expires
const _inactive: StatusDoc = { 'status': 'inactive' };

void _inactive;

// Verify the narrowed branch has status: 'active'
type ActiveBranch = Extract<StatusDoc, { readonly 'status': 'active' }>;
const _abExpires: ActiveBranch['expires'] = '2027-01-01';

void _abExpires;

// ---------------------------------------------------------------------------
// 47. multipleOf integer range — stepped range generation
// ---------------------------------------------------------------------------

const _MultiplesOfThreeSchema = {
  'maximum': 10,
  'minimum': 0,
  'multipleOf': 3,
  'type': 'integer'
} as const;

void _MultiplesOfThreeSchema;

type MultiplesOf3 = InferType<typeof _MultiplesOfThreeSchema>;

// Valid: 0, 3, 6, 9
const _mo0: MultiplesOf3 = 0;
const _mo3: MultiplesOf3 = 3;
const _mo6: MultiplesOf3 = 6;
const _mo9: MultiplesOf3 = 9;

void _mo0;
void _mo3;
void _mo6;
void _mo9;

// @ts-expect-error — 1 is not a multiple of 3
const _moBad1: MultiplesOf3 = 1;

void _moBad1;

// @ts-expect-error — 10 is not a multiple of 3
const _moBad2: MultiplesOf3 = 10;

void _moBad2;

// multipleOf with offset minimum
const _MultiplesOfFiveSchema = {
  'maximum': 20,
  'minimum': 7,
  'multipleOf': 5,
  'type': 'integer'
} as const;

void _MultiplesOfFiveSchema;

type MultiplesOf5 = InferType<typeof _MultiplesOfFiveSchema>;

// Valid: 10, 15, 20 (first multiple of 5 >= 7)
const _mf10: MultiplesOf5 = 10;
const _mf15: MultiplesOf5 = 15;
const _mf20: MultiplesOf5 = 20;

void _mf10;
void _mf15;
void _mf20;

// @ts-expect-error — 5 is below minimum
const _mfBad: MultiplesOf5 = 5;

void _mfBad;

// multipleOf with exclusive bounds
const _ExMultipleOfSchema = {
  'exclusiveMinimum': 0,
  'maximum': 12,
  'multipleOf': 4,
  'type': 'integer'
} as const;

void _ExMultipleOfSchema;

type ExMultiples = InferType<typeof _ExMultipleOfSchema>;

// Valid: 4, 8, 12 (exclusiveMinimum 0 → effective min 1)
const _em4: ExMultiples = 4;
const _em8: ExMultiples = 8;
const _em12: ExMultiples = 12;

void _em4;
void _em8;
void _em12;

// @ts-expect-error — 0 excluded by exclusiveMinimum
const _emBad: ExMultiples = 0;

void _emBad;

// multipleOf in type arrays
const _NullableMultiplesSchema = {
  'maximum': 6,
  'minimum': 0,
  'multipleOf': 2,
  'type': [
    'integer',
    'null'
  ]
} as const;

void _NullableMultiplesSchema;

type NullableMultiples = InferType<typeof _NullableMultiplesSchema>;

const _nm0: NullableMultiples = 0;
const _nm4: NullableMultiples = 4;
const _nmNull: NullableMultiples = null;

void _nm0;
void _nm4;
void _nmNull;

// @ts-expect-error — 3 is not a multiple of 2
const _nmBad: NullableMultiples = 3;

void _nmBad;

// ---------------------------------------------------------------------------
// 48. patternProperties template literal keys — prefix, suffix, exact
// ---------------------------------------------------------------------------

const _PrefixPatternSchema = {
  'patternProperties': { '^data_': { 'type': 'string' } },
  'type': 'object'
} as const;

void _PrefixPatternSchema;

type PrefixPattern = InferType<typeof _PrefixPatternSchema>;

// Keys matching `data_${string}` are typed as string
const _pfx1: PrefixPattern = { 'data_name': 'Alice' };

void _pfx1;

// @ts-expect-error — value must be string, not number
const _pfxBad: PrefixPattern = { 'data_age': 42 };

void _pfxBad;

const _SuffixPatternSchema = {
  'patternProperties': { '_id$': { 'type': 'number' } },
  'type': 'object'
} as const;

void _SuffixPatternSchema;

type SuffixPattern = InferType<typeof _SuffixPatternSchema>;

const _sp1: SuffixPattern = { 'user_id': 123 };

void _sp1;

// @ts-expect-error — value must be number, not string
const _spBad: SuffixPattern = { 'order_id': 'abc' };

void _spBad;

// Exact match: ^exact$ → literal key
const _ExactPatternSchema = {
  'patternProperties': { '^status$': { 'type': 'boolean' } },
  'type': 'object'
} as const;

void _ExactPatternSchema;

type ExactPattern = InferType<typeof _ExactPatternSchema>;

const _exact1: ExactPattern = { 'status': true };

void _exact1;

// @ts-expect-error — value must be boolean, not string
const _exactBad: ExactPattern = { 'status': 'active' };

void _exactBad;

// Complex regex falls back to string keys (safe)
const _ComplexPatternSchema = {
  'patternProperties': { '[a-z]+': { 'type': 'string' } },
  'type': 'object'
} as const;

void _ComplexPatternSchema;

type ComplexPattern = InferType<typeof _ComplexPatternSchema>;

// Any string key is allowed (falls back to string)
const _cp1: ComplexPattern = { 'anything': 'works' };

void _cp1;

// ---------------------------------------------------------------------------
// 49. Multiple patternProperties — intersected template literal keys
// ---------------------------------------------------------------------------

const _MultiPatternSchema = {
  'patternProperties': {
    '^data_': { 'type': 'string' },
    '^meta_': { 'type': 'number' }
  },
  'type': 'object'
} as const;

void _MultiPatternSchema;

type MultiPattern = InferType<typeof _MultiPatternSchema>;

// data_ keys must be string
const _mp1: MultiPattern = { 'data_name': 'Alice' };

void _mp1;

// meta_ keys must be number
const _mp2: MultiPattern = { 'meta_version': 42 };

void _mp2;

// @ts-expect-error — data_ value must be string, not number
const _mpBad: MultiPattern = { 'data_age': 99 };

void _mpBad;

// ---------------------------------------------------------------------------
// 50. additionalProperties: false — excess property flagging
// ---------------------------------------------------------------------------

const _ClosedSchema = {
  'additionalProperties': false,
  'properties': {
    'age': { 'type': 'integer' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

void _ClosedSchema;

type Closed = InferType<typeof _ClosedSchema>;

// Known properties work
const _closed1: Closed = {
  'age': 30,
  'name': 'Alice'
};

void _closed1;

const _closedBad: Closed = {
  // @ts-expect-error — excess property 'extra' is rejected (not a known key)
  'extra': true,
  'name': 'Bob'
};

void _closedBad;

// AP:false without properties — no excess flagging (no known keys to restrict)
const _BareClosedSchema = {
  'additionalProperties': false,
  'type': 'object'
} as const;

void _BareClosedSchema;

type BareClosed = InferType<typeof _BareClosedSchema>;

// Bare closed object degrades to Record<string, unknown>
const _bareClosed: BareClosed = { 'anything': 42 };

void _bareClosed;
