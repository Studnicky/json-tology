import { JsonTology } from '../../src/JsonTology.js';
import { Transform } from '../../src/modules/transform/Transform.js';
import type { InferType } from '../../src/types/Schema.js';
import type {
  ParseOutputType, ValidateChainType
} from '../../src/types/Transform.js';
import type {
  ChainMismatchType, ChainSchemaMismatchType
} from '../../src/types/TypeErrors.js';
import type { TransformStageType } from '../../src/types/TransformStage.js';

// Bidirectional type-equality assertion: surfaces a compile error unless the
// two types are mutually assignable.
type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

const DateTimeSchema = {
  '$id': 'https://example.io/DateTime',
  'type': 'string'
} as const;

// Normalize transform: decode maps a raw `{ iso }` wire payload into the
// schema's canonical string form; encode is the inverse. The schema describes
// decode's OUTPUT, so `ParseOutputType` is the canonical string.
const NormalizedDateSchema = Transform.create(DateTimeSchema, {
  'decode': (raw: { 'iso': string }) => {
    return raw.iso;
  },
  'encode': (value: string) => {
    return { 'iso': value };
  }
});

const jt = JsonTology.create({
  'baseIri': 'https://example.io',
  'enableStrictGraph': false,
  'schemas': [NormalizedDateSchema] as const
});

type WireLevel = InferType<typeof NormalizedDateSchema>;
type ParsedCanonical = ParseOutputType<typeof NormalizedDateSchema>;

const _wireTypeCheck: WireLevel = '2024-01-01T00:00:00.000Z';
const _parsedTypeCheck: ParsedCanonical = '2024-01-01T00:00:00.000Z';

const parsed = jt.instantiate(NormalizedDateSchema, { 'iso': '2024-01-01T00:00:00.000Z' });
const materialized = jt.materialize(NormalizedDateSchema, '2024-01-01T00:00:00.000Z');
const encoded = jt.encode(NormalizedDateSchema, '2024-01-01T00:00:00.000Z');

const _parsedCanonical: string = parsed;
const _materializedCanonical: string = materialized;
const _encodedWire: { 'iso': string } = encoded;

// @ts-expect-error instantiate() returns the canonical string, not the wire object
const _badParsed: { 'iso': string } = parsed;
// @ts-expect-error encode() returns the wire object, not the canonical string
const _badEncoded: string = encoded;

// Runtime-unsafe type assertions — guarded to prevent execution
if (false as boolean) {
  // @ts-expect-error encode() expects the canonical string, not a wire object
  jt.encode(NormalizedDateSchema, { 'iso': '2024-01-01T00:00:00.000Z' });
}

void [
  _wireTypeCheck,
  _parsedTypeCheck,
  _parsedCanonical,
  _materializedCanonical,
  _encodedWire,
  _badParsed,
  _badEncoded
];

// ---------------------------------------------------------------------------
// Transform.chain pairwise + tail compatibility
//
// A normalize chain decodes the raw wire type (first stage's free input) into
// the schema's canonical type (last stage's output). PipeBase's canonical type
// is string, so every valid chain must terminate in string.
// ---------------------------------------------------------------------------

const PipeBase = {
  '$id': 'https://example.io/PipeBase',
  'type': 'string'
} as const;

const trimStage: TransformStageType<string, string> = {
  'decode': (raw: string) => {
    return raw.trim();
  },
  'encode': (value: string) => {
    return ` ${value} `;
  }
};

const upperStage: TransformStageType<string, string> = {
  'decode': (value: string) => {
    return value.toUpperCase();
  },
  'encode': (value: string) => {
    return value.toLowerCase();
  }
};

const stringToNumberStage: TransformStageType<string, number> = {
  'decode': (value: string) => {
    return value.length;
  },
  'encode': (value: number) => {
    return 'x'.repeat(value);
  }
};

const numberToDateStage: TransformStageType<number, Date> = {
  'decode': (value: number) => {
    return new Date(value);
  },
  'encode': (value: Date) => {
    return value.getTime();
  }
};

const numberToStringStage: TransformStageType<number, string> = {
  'decode': String,
  'encode': Number
};

// Positive: well-typed chain terminating in the canonical string type.
const okChain = Transform.chain(PipeBase, [
  trimStage,
  upperStage
] as const);

type OkChainOutput = ParseOutputType<typeof okChain>;
const _okChainOutput: OkChainOutput = 'value';

// Round-trip through number and back to the canonical string.
const twoStageChain = Transform.chain(PipeBase, [
  stringToNumberStage,
  numberToStringStage
] as const);

type TwoStageChainOutput = ParseOutputType<typeof twoStageChain>;
const _twoStageChainOutput: TwoStageChainOutput = 'value';

// Single-stage chain whose only stage produces the canonical string.
const singleStageChain = Transform.chain(PipeBase, [trimStage] as const);

type SingleStageChainOutput = ParseOutputType<typeof singleStageChain>;
const _singleStageChainOutput: SingleStageChainOutput = 'value';

// Negative cases assert the EXACT rejection brand the validator inserts, not
// merely that the call fails to compile (which a line-based @ts-expect-error
// would, even if the chain broke for an unrelated reason).

// Interior mismatch: stage 0 produces number, stage 1 expects string →
// ChainMismatchType<0, number, string> at the broken position.
type InteriorMismatch = ValidateChainType<[typeof stringToNumberStage, typeof upperStage], string>;
assert<AssertEqualType<InteriorMismatch[1], ChainMismatchType<0, number, string>>>();

// Tail mismatch: chain terminates in number, canonical type is string →
// ChainSchemaMismatchType<string, number>.
type TailNumberMismatch = ValidateChainType<[typeof stringToNumberStage], string>;
assert<AssertEqualType<TailNumberMismatch[0], ChainSchemaMismatchType<string, number>>>();

// Tail mismatch: a pairwise-valid chain terminates in Date, canonical type is
// string → ChainSchemaMismatchType<string, Date>. This isolates the
// tail-anchor rule (the chain is internally consistent).
type TailDateMismatch = ValidateChainType<[typeof stringToNumberStage, typeof numberToDateStage], string>;
assert<AssertEqualType<TailDateMismatch[1], ChainSchemaMismatchType<string, Date>>>();

void [
  okChain,
  twoStageChain,
  singleStageChain,
  _okChainOutput,
  _twoStageChainOutput,
  _singleStageChainOutput,
  numberToStringStage,
  numberToDateStage
];

// ---------------------------------------------------------------------------
// Transform.encode value must match the canonical form
// ---------------------------------------------------------------------------

// Positive: passing the canonical string to encode is accepted.
const _encodedFromString: { 'iso': string } = jt.encode(NormalizedDateSchema, '2024-06-01T00:00:00.000Z');

// Negative: a number is neither the canonical string nor the wire object.
if (false as boolean) {
  // @ts-expect-error encode rejects values that are not the canonical string
  jt.encode(NormalizedDateSchema, 42);
}

void [_encodedFromString];

// ---------------------------------------------------------------------------
// Transform.create — decode return type tolerates a partial canonical value
//
// `instantiate(codec, ..., { enableDefaults: true })` runs decode →
// applyDefaults → validate, so `decode` only needs to return the fields it
// actually transforms; schema `default`s fill the rest. `encode` still
// requires the FULL canonical value, since it runs on the validated,
// fully-defaulted result — its type is untouched by this contract.
// ---------------------------------------------------------------------------

const BookWireSchema = {
  '$id': 'https://bookstore.example/schema/BookWire',
  'properties': {
    'available': {
      'default': true,
      'type': 'boolean'
    },
    'isbn': { 'type': 'string' },
    'stock': {
      'default': 0,
      'type': 'number'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'available',
    'stock'
  ],
  'type': 'object'
} as const;

// `decode` returns only `isbn`/`title` — a genuinely partial object literal,
// not a cast. This type-checks BECAUSE the declared return type is
// `Partial<CanonicalShapeType<...>>`; `available`/`stock` are left for
// `enableDefaults` to fill at runtime.
const BookWireCodec = Transform.create(BookWireSchema, {
  'decode': (raw: { 'isbn13': string;
    'title': string }) => {
    return {
      'isbn': raw.isbn13,
      'title': raw.title
    };
  },
  'encode': (book) => {
    return {
      'isbn13': book.isbn,
      'title': book.title
    };
  }
});

const jtBook = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [BookWireCodec] as const
});

// instantiate() with enableDefaults still returns the FULL canonical shape —
// not `Partial` — proving decode's widened return type has no effect on
// instantiate()'s own return type, which derives from the schema's
// `InferSchemaType`/`ParseOutputType`, independent of decode's declared type.
type BookCanonical = ParseOutputType<typeof BookWireCodec>;
const _fullBookCanonical: BookCanonical = {
  'available': true,
  'isbn': '9780743273565',
  'stock': 0,
  'title': 'Gatsby'
};

assert<AssertEqualType<BookCanonical, {
  'available': boolean;
  'isbn': string;
  'stock': number;
  'title': string;
}>>();

const bookInstance = jtBook.instantiate(
  BookWireCodec,
  {
    'isbn13': '9780743273565',
    'title': 'Gatsby'
  },
  { 'enableDefaults': true }
);

const _bookInstanceIsFullCanonical: BookCanonical = bookInstance;

void [
  _fullBookCanonical,
  _bookInstanceIsFullCanonical
];
