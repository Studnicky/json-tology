/**
 * Composition benchmarks: extend / intersection / discriminatedUnion.
 *
 * Authors a derived schema and runs first-validate against it.
 * Compares json-tology Compose.* against Zod's .extend / .merge / z.discriminatedUnion
 * and TypeBox Type.Composite / Type.Union.
 */

import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { z } from 'zod';
import {
  literal as vLiteral,
  number as vNumber,
  object as vObject,
  safeParse as vSafeParse,
  variant as vVariant
} from 'valibot';
import { Compose } from '../../../src/modules/composition/Compose.js';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';

// ---------------------------------------------------------------------------
// Base schemas (book domain)
// ---------------------------------------------------------------------------

const BaseBookJt = {
  '$id': 'urn:bench:Book',
  'properties': {
    'isbn': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title'
  ],
  'type': 'object'
} as const;

const BaseBookTb = Type.Object({
  'isbn': Type.String(),
  'title': Type.String()
});

const BaseBookZod = z.object({
  'isbn': z.string(),
  'title': z.string()
});

const validBook = {
  'isbn': '978-0-123-45678-9',
  'title': 'The Pragmatic Programmer'
};

// Discriminated union variants
const CircleJt = {
  '$id': 'urn:bench:Circle',
  'properties': {
    'kind': {
      'const': 'circle',
      'type': 'string'
    },
    'radius': { 'type': 'number' }
  },
  'required': [
    'kind',
    'radius'
  ],
  'type': 'object'
} as const;

const RectJt = {
  '$id': 'urn:bench:Rect',
  'properties': {
    'height': { 'type': 'number' },
    'kind': {
      'const': 'rect',
      'type': 'string'
    },
    'width': { 'type': 'number' }
  },
  'required': [
    'kind',
    'width',
    'height'
  ],
  'type': 'object'
} as const;

const validCircle = {
  'kind': 'circle',
  'radius': 5
};

const CircleZod = z.object({
  'kind': z.literal('circle'),
  'radius': z.number()
});
const RectZod = z.object({
  'height': z.number(),
  'kind': z.literal('rect'),
  'width': z.number()
});
const ShapeZod = z.discriminatedUnion('kind', [
  CircleZod,
  RectZod
]);

const CircleTb = Type.Object({
  'kind': Type.Literal('circle'),
  'radius': Type.Number()
});
const RectTb = Type.Object({
  'height': Type.Number(),
  'kind': Type.Literal('rect'),
  'width': Type.Number()
});
const ShapeTb = Type.Union([
  CircleTb,
  RectTb
]);

const CircleVb = vObject({
  'kind': vLiteral('circle'),
  'radius': vNumber()
});
const RectVb = vObject({
  'height': vNumber(),
  'kind': vLiteral('rect'),
  'width': vNumber()
});
const ShapeVb = vVariant('kind', [
  CircleVb,
  RectVb
]);

export function runComposeBench(): BenchResult[] {
  const results: BenchResult[] = [];

  section('compose — extend (build derived schema, no validation)');

  results.push(bench('extend build', 'json-tology', () => {
    Compose.extend(
      BaseBookJt,
      { 'properties': { 'pages': { 'type': 'integer' } } } as const,
      'urn:bench:ExtBook'
    );
  }));

  results.push(bench('extend build', 'typebox', () => {
    Type.Composite([
      BaseBookTb,
      Type.Object({ 'pages': Type.Integer() })
    ]);
  }));

  results.push(bench('extend build', 'zod', () => {
    BaseBookZod.extend({ 'pages': z.number().int() });
  }));

  section('compose — extend + validate (warm, build outside loop)');

  // warm: register once outside the timing loop — measures steady-state validate, not registration + compile
  const ExtBookJt = Compose.extend(
    BaseBookJt,
    { 'properties': { 'pages': { 'type': 'integer' } } } as const,
    'urn:bench:ExtBookJt'
  );
  const extReg = new SchemaRegistry({ 'enableStrictGraph': false });

  extReg.set(BaseBookJt);
  extReg.set(ExtBookJt);

  const extBookId = (ExtBookJt as { '$id': string }).$id;
  const extBookValid = {
    ...validBook,
    'pages': 200
  };

  const extTbCompiled = TypeCompiler.Compile(Type.Composite([
    BaseBookTb,
    Type.Object({ 'pages': Type.Integer() })
  ]));
  const extZodSchema = BaseBookZod.extend({ 'pages': z.number().int() });

  results.push(bench('extend + validate', 'json-tology', () => {
    extReg.validate(extBookId, extBookValid);
  }));

  results.push(bench('extend + validate', 'typebox', () => {
    extTbCompiled.Check(extBookValid);
  }));

  results.push(bench('extend + validate', 'zod', () => {
    extZodSchema.safeParse(extBookValid);
  }));

  section('compose — discriminatedUnion validation (warm)');

  const ShapeJt = Compose.discriminatedUnion(
    'kind',
    [
      CircleJt,
      RectJt
    ] as const,
    'urn:bench:Shape'
  );
  const reg = new SchemaRegistry({ 'enableStrictGraph': false });

  reg.set(CircleJt);
  reg.set(RectJt);
  reg.set({ ...ShapeJt });
  reg.validate((ShapeJt as { '$id': string }).$id, validCircle);

  const ShapeTbCompiled = TypeCompiler.Compile(ShapeTb);

  ShapeTbCompiled.Check(validCircle);
  ShapeZod.safeParse(validCircle);
  vSafeParse(ShapeVb, validCircle);

  results.push(bench('discriminated union', 'json-tology', () => {
    reg.validate((ShapeJt as { '$id': string }).$id, validCircle);
  }));

  results.push(bench('discriminated union', 'typebox', () => {
    ShapeTbCompiled.Check(validCircle);
  }));

  results.push(bench('discriminated union', 'zod', () => {
    ShapeZod.safeParse(validCircle);
  }));

  results.push(bench('discriminated union', 'valibot', () => {
    vSafeParse(ShapeVb, validCircle);
  }));

  section('compose — intersection (warm, build outside loop)');

  const Tagged = {
    '$id': 'urn:bench:Tagged',
    'properties': {
      'tags': {
        'items': { 'type': 'string' },
        'type': 'array'
      }
    },
    'required': ['tags'],
    'type': 'object'
  } as const;

  const TaggedTb = Type.Object({ 'tags': Type.Array(Type.String()) });
  const TaggedZod = z.object({ 'tags': z.array(z.string()) });

  // warm: register once outside the timing loop — measures steady-state validate, not registration + compile
  const BookTaggedInter = Compose.intersection(
    [
      BaseBookJt,
      Tagged
    ],
    'urn:bench:BookTagged'
  );
  const subReg = new SchemaRegistry({ 'enableStrictGraph': false });

  subReg.set(BaseBookJt);
  subReg.set(Tagged);
  subReg.set({ ...BookTaggedInter });

  const bookTaggedId = (BookTaggedInter as { '$id': string }).$id;
  const bookTaggedValid = {
    ...validBook,
    'tags': ['a']
  };

  const interTbCompiled = TypeCompiler.Compile(Type.Intersect([
    BaseBookTb,
    TaggedTb
  ]));
  const interZodSchema = z.intersection(BaseBookZod, TaggedZod);

  results.push(bench('intersection', 'json-tology', () => {
    subReg.validate(bookTaggedId, bookTaggedValid);
  }));

  results.push(bench('intersection', 'typebox', () => {
    interTbCompiled.Check(bookTaggedValid);
  }));

  results.push(bench('intersection', 'zod', () => {
    interZodSchema.safeParse(bookTaggedValid);
  }));

  return results;
}

// Standalone demo — shows Compose.extend, discriminatedUnion, and intersection.
// Run: npx tsx examples/docs/benchmarks/compose.bench.ts
const demoReg = new SchemaRegistry({ 'enableStrictGraph': false });

const ExtBookDemo = Compose.extend(
  BaseBookJt,
  { 'properties': { 'pages': { 'type': 'integer' } } } as const,
  'urn:bench:ExtBookDemo'
);

demoReg.set(BaseBookJt);
demoReg.set(ExtBookDemo);

const extId = (ExtBookDemo as { '$id': string }).$id;
const extValid = {
  ...validBook,
  'pages': 350
};
const extResult = demoReg.validate(extId, extValid);

const ShapeDemo = Compose.discriminatedUnion('kind', [
  CircleJt,
  RectJt
] as const, 'urn:bench:ShapeDemo');
const shapeReg = new SchemaRegistry({ 'enableStrictGraph': false });

shapeReg.set(CircleJt);
shapeReg.set(RectJt);
shapeReg.set({ ...ShapeDemo });

const shapeResult = shapeReg.validate((ShapeDemo as { '$id': string }).$id, validCircle);

console.log('extend + validate (book with pages):', extResult);
console.log('discriminatedUnion validate (circle):', shapeResult);
