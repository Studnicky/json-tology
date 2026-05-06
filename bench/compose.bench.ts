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
import { Compose } from '../src/modules/composition/Compose.js';
import { SchemaRegistry } from '../src/modules/registry/SchemaRegistry.js';
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

  section('compose — extend + first validate (build then check one value)');

  let counter = 0;

  results.push(bench('extend + validate', 'json-tology', () => {
    counter++;
    const child = Compose.extend(
      BaseBookJt,
      { 'properties': { 'pages': { 'type': 'integer' } } } as const,
      `urn:bench:ExtBookJt:${String(counter)}`
    );
    const reg = new SchemaRegistry();

    reg.register(BaseBookJt);
    reg.register(child as Record<string, unknown>);
    reg.validate((child as { '$id': string }).$id, {
      ...validBook,
      'pages': 200
    });
  }));

  results.push(bench('extend + validate', 'typebox', () => {
    const composite = Type.Composite([
      BaseBookTb,
      Type.Object({ 'pages': Type.Integer() })
    ]);
    const compiled = TypeCompiler.Compile(composite);

    compiled.Check({
      ...validBook,
      'pages': 200
    });
  }));

  results.push(bench('extend + validate', 'zod', () => {
    const extended = BaseBookZod.extend({ 'pages': z.number().int() });

    extended.safeParse({
      ...validBook,
      'pages': 200
    });
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
  const reg = new SchemaRegistry();

  reg.register(CircleJt);
  reg.register(RectJt);
  reg.register(ShapeJt as Record<string, unknown>);
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

  section('compose — intersection (build + validate)');

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

  let icounter = 0;

  results.push(bench('intersection', 'json-tology', () => {
    icounter++;
    const inter = Compose.intersection(
      BaseBookJt,
      Tagged,
      `urn:bench:BookTagged:${String(icounter)}`
    );
    const subreg = new SchemaRegistry();

    subreg.register(BaseBookJt);
    subreg.register(Tagged);
    subreg.register(inter as Record<string, unknown>);
    subreg.validate((inter as { '$id': string }).$id, {
      ...validBook,
      'tags': ['a']
    });
  }));

  results.push(bench('intersection', 'typebox', () => {
    const inter = Type.Intersect([
      BaseBookTb,
      TaggedTb
    ]);
    const compiled = TypeCompiler.Compile(inter);

    compiled.Check({
      ...validBook,
      'tags': ['a']
    });
  }));

  results.push(bench('intersection', 'zod', () => {
    const inter = z.intersection(BaseBookZod, TaggedZod);

    inter.safeParse({
      ...validBook,
      'tags': ['a']
    });
  }));

  return results;
}
