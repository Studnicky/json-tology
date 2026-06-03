/**
 * Compile-time assertions: a CURIE `$id` authored as a string literal must
 * flow through to the compile-time schema map (and through Compose combinators)
 * as that literal — never widened to `string` — so no `as` cast is needed to
 * key the typed facade by a CURIE id.
 *
 * Compile with: tsc --noEmit --project tsconfig.test-types.json
 */

import type { SchemaMapFromTupleType } from '../../src/types/Registry.js';
import { Compose } from '../../src/modules/composition/Compose.js';
import { JsonTology } from '../../src/index.js';

type AssertEqual<TA, TB>
  = [TA] extends [TB] ? ([TB] extends [TA] ? true : false) : false;

function assertType<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// A plain schema authored with a CURIE $id literal keys the schema map by that
// CURIE — no `as` cast on the id, no expansion at authoring time.
// ---------------------------------------------------------------------------
const FooSchema = {
  '$id': 'ex:Foo',
  'properties': { 'id': { 'type': 'string' } },
  'required': ['id'],
  'type': 'object'
} as const;

type FooMapKeys = keyof SchemaMapFromTupleType<readonly [typeof FooSchema]>;

assertType<AssertEqual<FooMapKeys, 'ex:Foo'>>();

// ---------------------------------------------------------------------------
// Compose.subClassOf preserves the CURIE $id of an inline body literal.
// ---------------------------------------------------------------------------
const StringValueSchema = {
  '$id': 'ex:StringValue',
  'type': 'string'
} as const;

const IriSchema = Compose.subClassOf(StringValueSchema, {
  '$id': 'ex:IriString',
  'format': 'iri',
  'type': 'string'
});

type IriId = (typeof IriSchema)['$id'];
type IriMapKeys = keyof SchemaMapFromTupleType<readonly [typeof IriSchema]>;

assertType<AssertEqual<IriId, 'ex:IriString'>>();
assertType<AssertEqual<IriMapKeys, 'ex:IriString'>>();

// ---------------------------------------------------------------------------
// Compose.disjointWith / complementOf preserve the CURIE $id of an inline body.
// ---------------------------------------------------------------------------
const PrintFormat = {
  '$id': 'ex:Print',
  'properties': { 'pages': { 'type': 'integer' } },
  'type': 'object'
} as const;

const DigitalFormat = Compose.disjointWith(PrintFormat, {
  '$id': 'ex:Digital',
  'properties': { 'bytes': { 'type': 'integer' } },
  'type': 'object'
});

type DigitalId = (typeof DigitalFormat)['$id'];

assertType<AssertEqual<DigitalId, 'ex:Digital'>>();

const NotPrint = Compose.complementOf(PrintFormat, {
  '$id': 'ex:NotPrint',
  'type': 'object'
});

type NotPrintId = (typeof NotPrint)['$id'];

assertType<AssertEqual<NotPrintId, 'ex:NotPrint'>>();

// ---------------------------------------------------------------------------
// Combinators that take the new id as a direct string argument preserve the
// CURIE literal through ordinary string-literal inference (no `const` needed).
// ---------------------------------------------------------------------------
const FooExtended = Compose.extend(FooSchema, { 'note': { 'type': 'string' } }, 'ex:FooExt');

type FooExtId = (typeof FooExtended)['$id'];

assertType<AssertEqual<FooExtId, 'ex:FooExt'>>();

const FooPicked = Compose.pick(FooSchema, ['id'] as const, 'ex:FooPick');

type FooPickId = (typeof FooPicked)['$id'];

assertType<AssertEqual<FooPickId, 'ex:FooPick'>>();

// ---------------------------------------------------------------------------
// The typed facade accepts the CURIE literal directly as the schema id.
// Guarded in an unexecuted function: the call signatures are type-checked
// without running them (the negative case would throw at runtime).
// ---------------------------------------------------------------------------
function facadeTypecheck(): void {
  const jt = JsonTology.create({
    'baseIRI': 'https://ex.io',
    'prefixes': { 'ex': 'https://ex.io/' },
    'schemas': [FooSchema]
  });

  jt.instantiate('ex:Foo', { 'id': 'a' });
  // @ts-expect-error an unregistered CURIE/id is rejected at compile time
  jt.instantiate('ex:Missing', { 'id': 'a' });
}

void facadeTypecheck;

// ---------------------------------------------------------------------------
// Suppress unused variable warnings — these schemas are asserted at the type
// level only; the assertions above are the test.
// ---------------------------------------------------------------------------
void [
  IriSchema,
  DigitalFormat,
  NotPrint,
  FooExtended,
  FooPicked
];
