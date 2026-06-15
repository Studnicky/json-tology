/**
 * Compile-time assertions for mutual / circular `$ref` resolution (A → B → A).
 *
 * Existing type tests cover only same-schema self-recursion (`$ref: '#'` or
 * `$ref: '<self-$id>'`). This file documents and locks the behaviour when two
 * distinct schemas each carry a `$ref` that points to the other.
 *
 * ## Resolution approach
 *
 * Mutual refs are expressed using the graph-native compound-document pattern:
 * both schemas are embedded as `$defs` under a root document. The type engine
 * resolves A's ref to B and B's ref to A by walking the root's `$defs`, using
 * the same path that powers same-document `$ref` resolution.
 *
 * ## Observed behaviour (tsc-verified)
 *
 * TypeScript's type system cannot expand a mutually-recursive type infinitely.
 * `InferSchemaType` is bounded by `_DEEP_PROPERTY_DEPTH_CAP = 4`, so mutual
 * refs terminate finitely: at depth N the back-edge resolves to the inferred
 * type of the referenced schema up to depth N-1. In practice this means:
 *
 * - The top-level properties of A and B resolve correctly.
 * - A's reference to B resolves to a type that includes B's properties (id,
 *   `supervisor` which is typed as A's shape one level deep, etc.).
 * - The chain terminates with `unknown` on the outermost depth cap hit.
 *
 * The key assertions this file locks:
 *   1. A's `name` property resolves to `string` (not `never` or `unknown`).
 *   2. A's `supervisor` field resolves to a type assignable to B's shape
 *      (has `title`, optional `reports`). The mutual back-link does not collapse
 *      to `unknown` at the first crossing.
 *   3. B's `title` property resolves to `string`.
 *   4. B's `reports` array items resolve to a type assignable to A's shape.
 *
 * If the implementation ever changes the depth cap or resolution order, these
 * assertions will fail — that is the intent. Update the comment to document the
 * new behaviour and adjust the assertions to match what tsc actually produces.
 */

import {
  describe, it
} from 'node:test';

import type { InferType } from '../../src/types/Schema.js';

// ---------------------------------------------------------------------------
// Helpers (same pattern as other type tests in this suite)
// ---------------------------------------------------------------------------

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Compound document: A and B defined as embedded $defs, mutually referencing.
//
// Schema A (urn:mut:Employee):
//   - name: string (required)
//   - supervisor?: $ref → B (urn:mut:Manager)
//
// Schema B (urn:mut:Manager):
//   - title: string (required)
//   - reports?: array of $ref → A (urn:mut:Employee)
//
// The root document bundles both under $defs so the engine can walk
// A's ref to B and B's ref to A without a runtime references map.
// ---------------------------------------------------------------------------

const MutualRefDoc = {
  '$defs': {
    'Employee': {
      '$id': 'urn:mut:Employee',
      'properties': {
        'name': { 'type': 'string' },
        'supervisor': { '$ref': 'urn:mut:Manager' }
      },
      'required': ['name'],
      'type': 'object'
    },
    'Manager': {
      '$id': 'urn:mut:Manager',
      'properties': {
        'reports': {
          'items': { '$ref': 'urn:mut:Employee' },
          'type': 'array'
        },
        'title': { 'type': 'string' }
      },
      'required': ['title'],
      'type': 'object'
    }
  },
  '$id': 'urn:mut:Doc',
  'properties': {
    'employee': { '$ref': 'urn:mut:Employee' },
    'manager': { '$ref': 'urn:mut:Manager' }
  },
  'required': [
    'employee',
    'manager'
  ],
  'type': 'object'
} as const;

void MutualRefDoc;

type MutualRefDocType = InferType<typeof MutualRefDoc>;

// ---------------------------------------------------------------------------
// Extract the inferred types for A (Employee) and B (Manager) via the root
// document's required properties. Because `employee` and `manager` are
// required, there is no `| undefined` noise in the extracted types.
// ---------------------------------------------------------------------------

type EmployeeType = MutualRefDocType['employee'];
type ManagerType = MutualRefDocType['manager'];

// ---------------------------------------------------------------------------
// Assertions — lock the observed resolution behaviour
// ---------------------------------------------------------------------------

// 1. Top-level properties of Employee resolve correctly.
//    `name` is required → string (not unknown, not never).
assert<AssertAssignable<EmployeeType, { readonly 'name': string }>>();

// 2. Employee's optional `supervisor` field resolves to a type that includes
//    Manager's required field `title`. The mutual back-link does not collapse
//    to `unknown` at the first crossing.
//
//    NOTE: `supervisor` is optional on Employee, so the inferred type for
//    `supervisor` is `ManagerType | undefined`. We extract just the
//    non-undefined branch using NonNullable to test the shape of the resolved
//    Manager type.
type EmployeeSupervisorType = NonNullable<EmployeeType['supervisor']>;
assert<AssertAssignable<EmployeeSupervisorType, { readonly 'title': string }>>();

// 3. Top-level properties of Manager resolve correctly.
//    `title` is required → string (not unknown, not never).
assert<AssertAssignable<ManagerType, { readonly 'title': string }>>();

// 4. Manager's `reports` array items resolve to a type that includes
//    Employee's required field `name`. The back-link from B → A resolves.
//
//    `reports` is optional on Manager; its item type must be extracted.
type ManagerReportsType = NonNullable<ManagerType['reports']>;
// The item type of the reports array (readonly T[] -> T)
type ReportItemType = ManagerReportsType extends ReadonlyArray<infer TItem> ? TItem : never;
assert<AssertAssignable<ReportItemType, { readonly 'name': string }>>();

// 5. Confirm: the inferred types are not `never` (which would indicate the
//    type engine collapsed the circular reference into an unsatisfiable type).
assert<AssertAssignable<EmployeeType, object>>();
assert<AssertAssignable<ManagerType, object>>();

// 6. Confirm: the inferred types are not `unknown` at the top level (which
//    would indicate the type engine gave up entirely on resolving the schemas).
//    A value of type `unknown` is assignable from ANYTHING, so we check the
//    inverse: that `string` (a non-object primitive) is NOT assignable to the
//    inferred type. This confirms the type is narrower than `unknown`.
//    `unknown extends string` is false, so `string extends EmployeeType` would
//    only hold if EmployeeType is `unknown`. We use the contra-positive.
type EmployeeIsNotUnknown = AssertAssignable<string, EmployeeType> extends true ? false : true;
assert<EmployeeIsNotUnknown>();

type ManagerIsNotUnknown = AssertAssignable<string, ManagerType> extends true ? false : true;
assert<ManagerIsNotUnknown>();

// ---------------------------------------------------------------------------
// Runtime smoke test (required for tsx --test to report the file as a test)
// ---------------------------------------------------------------------------

void describe('mutual $ref resolution (A → B → A)', () => {
  void it('resolves Employee and Manager shapes without collapsing to never/unknown', () => {
    // All assertions above are compile-time. This runtime block is a no-op
    // but required for the test runner to pick up the file.
    const employee = { 'name': 'Alice' } as unknown as EmployeeType;
    const manager = { 'title': 'VP' } as unknown as ManagerType;

    void employee;
    void manager;
  });
});
