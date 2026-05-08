/**
 * Compile-time tests for generalised `if/then/else` discriminator inference.
 *
 * The matcher in `Infer.ts` recognises four narrowing patterns:
 *
 *   1. Single-property const discriminator (regression — already worked).
 *   2. Multi-property const discriminator — conjunction of literals.
 *   3. Enum discriminator — union of literal branches.
 *   4. Type-only discriminator — structural narrowing by primitive type.
 *
 * In every case the then branch is intersected with `{ [K]: V }` derived from
 * `if.properties`. The else branch (or default branch when `else` is omitted)
 * remains unconstrained.
 */

import {
  describe, it
} from 'node:test';

import type { InferSchemaType } from '../../src/types/Schema.js';

// ============================================================================
// Utility: type-level equality check
// ============================================================================

type Expect<T extends true> = T;

type Equal<TA, TB>
  = (<TVal>() => TVal extends TA ? 1 : 2) extends (<TVal>() => TVal extends TB ? 1 : 2)
    ? true
    : false;

// ============================================================================
// 1. Regression — single-property const discriminator
// ============================================================================
//
// Pre-existing behaviour: `if: { properties: { kind: { const: 'X' } }, required: ['kind'] }`
// narrows the then branch with `{ kind: 'X' }`.

const _SingleConstSchema = {
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
  // eslint-disable-next-line unicorn/no-thenable -- JSON Schema keyword
  'then': { 'required': ['radius'] },
  'type': 'object'
} as const;

void _SingleConstSchema;

type SingleConstShape = InferSchemaType<typeof _SingleConstSchema>;

type SingleConstThenBranch = Extract<SingleConstShape, { readonly 'kind': 'circle' }>;
type SingleConstRegressionCheck = Expect<Equal<SingleConstThenBranch['radius'], number>>;

void ((): SingleConstRegressionCheck => {
  return true;
})();

void describe('if/then/else: single-property const discriminator (regression)', () => {
  void it('narrows the then branch with the const literal', () => {
    const circle: SingleConstShape = {
      'kind': 'circle',
      'radius': 10
    };
    const rect: SingleConstShape = {
      'kind': 'rectangle',
      'width': 20
    };

    void circle;
    void rect;
  });
});

// ============================================================================
// 2. Multi-property const discriminator — conjunction
// ============================================================================

const _MultiConstSchema = {
  'if': {
    'properties': {
      'color': { 'const': 'red' },
      'kind': { 'const': 'circle' }
    },
    'required': [
      'kind',
      'color'
    ]
  },
  'properties': {
    'color': { 'type': 'string' },
    'kind': { 'type': 'string' },
    'radius': { 'type': 'number' }
  },
  // eslint-disable-next-line unicorn/no-thenable -- JSON Schema keyword
  'then': { 'required': ['radius'] },
  'type': 'object'
} as const;

void _MultiConstSchema;

type MultiConstShape = InferSchemaType<typeof _MultiConstSchema>;

type MultiConstThenBranch = Extract<MultiConstShape, { readonly 'color': 'red';
  readonly 'kind': 'circle'; }>;
type MultiConstThenCheck = Expect<Equal<MultiConstThenBranch['radius'], number>>;

void ((): MultiConstThenCheck => {
  return true;
})();

void describe('if/then/else: multi-property const discriminator', () => {
  void it('narrows the then branch with the conjunction of literals', () => {
    const redCircle: MultiConstShape = {
      'color': 'red',
      'kind': 'circle',
      'radius': 5
    };
    const blueCircle: MultiConstShape = {
      'color': 'blue',
      'kind': 'circle'
    };

    void redCircle;
    void blueCircle;
  });
});

// ============================================================================
// 3. Enum discriminator — union of literal branches
// ============================================================================

const _EnumDiscriminatorSchema = {
  'if': {
    'properties': {
      'role': {
        'enum': [
          'admin',
          'editor'
        ]
      }
    },
    'required': ['role']
  },
  'properties': {
    'permissions': { 'type': 'string' },
    'role': { 'type': 'string' }
  },
  // eslint-disable-next-line unicorn/no-thenable -- JSON Schema keyword
  'then': { 'required': ['permissions'] },
  'type': 'object'
} as const;

void _EnumDiscriminatorSchema;

type EnumDiscriminatorShape = InferSchemaType<typeof _EnumDiscriminatorSchema>;

type EnumThenBranch = Extract<EnumDiscriminatorShape, { readonly 'role': 'admin' | 'editor' }>;
type EnumDiscriminatorCheck = Expect<Equal<EnumThenBranch['permissions'], string>>;

void ((): EnumDiscriminatorCheck => {
  return true;
})();

void describe('if/then/else: enum discriminator', () => {
  void it('narrows the then branch to the enum union', () => {
    const admin: EnumDiscriminatorShape = {
      'permissions': 'all',
      'role': 'admin'
    };
    const editor: EnumDiscriminatorShape = {
      'permissions': 'edit',
      'role': 'editor'
    };
    const viewer: EnumDiscriminatorShape = { 'role': 'viewer' };

    void admin;
    void editor;
    void viewer;
  });
});

// ============================================================================
// 4. Type-only discriminator — structural narrowing
// ============================================================================

const _TypeOnlyDiscriminatorSchema = {
  'if': {
    'properties': { 'count': { 'type': 'number' } },
    'required': ['count']
  },
  'properties': {
    'count': {},
    'label': { 'type': 'string' }
  },
  // eslint-disable-next-line unicorn/no-thenable -- JSON Schema keyword
  'then': { 'required': ['label'] },
  'type': 'object'
} as const;

void _TypeOnlyDiscriminatorSchema;

type TypeOnlyShape = InferSchemaType<typeof _TypeOnlyDiscriminatorSchema>;

type TypeOnlyThenBranch = Extract<TypeOnlyShape, { readonly 'count': number;
  readonly 'label': string; }>;
type TypeOnlyDiscriminatorCheck = Expect<Equal<TypeOnlyThenBranch['label'], string>>;

void ((): TypeOnlyDiscriminatorCheck => {
  return true;
})();

void describe('if/then/else: type-only discriminator', () => {
  void it('narrows the then branch structurally by primitive type', () => {
    const counted: TypeOnlyShape = {
      'count': 3,
      'label': 'three'
    };

    void counted;
  });
});
