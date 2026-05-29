/**
 * Compile-time assertions for `Compose.annotatedEdge` inference (RDF 1.2
 * triple-term / edge-annotation pattern, Addition B of the rdf12-triple-term
 * emission plan).
 *
 * `InferType` of an annotated-edge schema must resolve to:
 *   {
 *     readonly target: <branded target>;
 *     readonly annotations: { <key>: <branded range>; ... };
 *   }
 *
 * The target and each annotation range are `$ref`s to named primitives, so
 * once resolved against a references map they must surface as their branded
 * types — NOT `unknown`.
 *
 * This file has no runtime assertions; it validates by compiling under
 * `npm run type-check:tests` (failing on the `@ts-expect-error` lines and on
 * any unsatisfied `assert<...>()`).
 */

import type { InferType } from '../../src/types/Schema.js';
import type {
  FormatBrandInterface
} from '../../src/types/ConstraintBrands.js';
import { Compose } from '../../src/modules/composition/Compose.js';

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

type AssertEqual<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Referenced named primitives — each carries a constraint that produces a brand
// ---------------------------------------------------------------------------

const PokemonSchema = {
  '$id': 'https://pokemontology.dev/Pokemon',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

void PokemonSchema;

// A branded datatype: string with a format → FormatBrandInterface<'…'>.
const TimeOfDaySchema = {
  '$id': 'https://pokemontology.dev/TimeOfDay',
  'format': 'time',
  'type': 'string'
} as const;

void TimeOfDaySchema;

// A numeric datatype: integer with a 1..100 span. The span exceeds the tight
// integer-range cap (50), so it resolves to plain `number` (a precise datatype,
// not `unknown`) rather than a literal union.
const LevelSchema = {
  '$id': 'https://pokemontology.dev/Level',
  'maximum': 100,
  'minimum': 1,
  'type': 'integer'
} as const;

void LevelSchema;

interface RefsMap {
  readonly 'https://pokemontology.dev/Level': typeof LevelSchema;
  readonly 'https://pokemontology.dev/Pokemon': typeof PokemonSchema;
  readonly 'https://pokemontology.dev/TimeOfDay': typeof TimeOfDaySchema;
}

// ---------------------------------------------------------------------------
// The annotated-edge schema under test
// ---------------------------------------------------------------------------

const EvolvesFromSchema = Compose.annotatedEdge({
  'annotations': {
    'evolutionMinLevel': { '$ref': 'https://pokemontology.dev/Level' },
    'evolutionTimeOfDay': { '$ref': 'https://pokemontology.dev/TimeOfDay' }
  },
  'predicate': 'https://pokemontology.dev/directEvolvesFrom',
  'targetRef': 'https://pokemontology.dev/Pokemon'
});

void EvolvesFromSchema;

type EvolvesFrom = InferType<typeof EvolvesFromSchema, RefsMap>;

// ---------------------------------------------------------------------------
// Shape: { target; annotations: { evolutionTimeOfDay; evolutionMinLevel } }
// ---------------------------------------------------------------------------

assert<AssertAssignable<EvolvesFrom, { readonly 'target': unknown }>>();
assert<AssertAssignable<EvolvesFrom, { readonly 'annotations': unknown }>>();

// ---------------------------------------------------------------------------
// Target resolves to the branded Pokemon class (has a required `name: string`)
// ---------------------------------------------------------------------------

type Target = EvolvesFrom['target'];
assert<AssertAssignable<Target, { readonly 'name': string }>>();

// ---------------------------------------------------------------------------
// Annotation ranges resolve to branded datatypes — NOT `unknown`.
// ---------------------------------------------------------------------------

type Annotations = EvolvesFrom['annotations'];

type TimeOfDayRange = Annotations['evolutionTimeOfDay'];
type LevelRange = Annotations['evolutionMinLevel'];

// The time-of-day range carries the format brand (string is branded).
assert<AssertAssignable<TimeOfDayRange, FormatBrandInterface<'time'>>>();
assert<AssertAssignable<TimeOfDayRange, string>>();

// The level range resolves to a precise numeric datatype — NOT `unknown`.
// The 1..100 span exceeds the tight integer-range cap (50), so it resolves to
// plain `number` rather than a literal union or numeric brands.
assert<AssertAssignable<LevelRange, number>>();
assert<AssertEqual<LevelRange, number>>();

// A bare `unknown` value must NOT be assignable to a branded range.
// @ts-expect-error — unknown is not a branded TimeOfDay range
assert<AssertAssignable<unknown, TimeOfDayRange>>();
