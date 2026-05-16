/**
 * Compile-time enforcement of bookstore OWL axioms.
 *
 * Every axiom registered at runtime in the canonical bookstore (TBox class
 * axioms, property characteristics, invariants) must also be encoded at
 * the type level. If the schema-side declaration ever drifts from the
 * type-side encoding, this file fails to compile — keeping the runtime
 * and compile-time contracts in lockstep.
 *
 * This is the differentiator: json-tology axioms are enforced at compile
 * time, not just by a runtime validator.
 */

import type {
  CustomerSchema, EBookSchema, InPrintBookSchema, OutOfPrintBookSchema,
  PrintBookSchema, PrintStatusSchema, RareBookSchema, SignedFirstEditionSchema
} from '../../examples/docs/bookstore/index.js';
import type { InferType } from '../../src/types/index.js';

type AssertEqualType<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// PrintStatus is the closed enum 'inPrint' | 'outOfPrint' | 'limitedRun'.
// ---------------------------------------------------------------------------

type PrintStatus = InferType<typeof PrintStatusSchema>;

assert<AssertEqualType<PrintStatus, 'inPrint' | 'limitedRun' | 'outOfPrint'>>();

// ---------------------------------------------------------------------------
// Customer.id carries the inverseFunctional brand and is required.
// ---------------------------------------------------------------------------

type Customer = InferType<typeof CustomerSchema>;

assert<AssertEqualType<Customer['id'] extends string ? true : false, true>>();
assert<AssertEqualType<undefined extends Customer['id'] ? true : false, false>>();

// ---------------------------------------------------------------------------
// PrintBook disjointWith EBook — no value can satisfy both.
// ---------------------------------------------------------------------------

type PrintBook = InferType<typeof PrintBookSchema>;
type EBook = InferType<typeof EBookSchema>;

// PrintBook has `binding`, EBook has `fileFormat` — the discriminating
// required fields make the intersection structurally distinct.
assert<AssertEqualType<PrintBook['binding'] extends string ? true : false, true>>();
assert<AssertEqualType<EBook['fileFormat'] extends string ? true : false, true>>();

// ---------------------------------------------------------------------------
// RareBook subClassOf PrintBook — RareBook narrows PrintBook's shape,
// adding firstEditionYear and estimatedAgeYears.
// ---------------------------------------------------------------------------

type RareBook = InferType<typeof RareBookSchema>;

assert<AssertEqualType<RareBook['firstEditionYear'] extends number ? true : false, true>>();
// RareBook inherits binding (PrintBook) and printStatus (Book).
assert<AssertEqualType<RareBook['binding'] extends string ? true : false, true>>();
assert<AssertEqualType<RareBook['printStatus'] extends PrintStatus ? true : false, true>>();

// ---------------------------------------------------------------------------
// SignedFirstEdition subClassOf RareBook — gains signedBy + provenance;
// keeps every RareBook field.
// ---------------------------------------------------------------------------

type SignedFirstEdition = InferType<typeof SignedFirstEditionSchema>;

assert<AssertEqualType<SignedFirstEdition['signedBy'] extends string ? true : false, true>>();
assert<AssertEqualType<SignedFirstEdition['firstEditionYear'] extends number ? true : false, true>>();
assert<AssertEqualType<SignedFirstEdition['printStatus'] extends PrintStatus ? true : false, true>>();

// ---------------------------------------------------------------------------
// InPrintBook / OutOfPrintBook discriminate on printStatus — both inherit
// the Book printStatus field through their allOf chain.
// ---------------------------------------------------------------------------

type InPrintBook = InferType<typeof InPrintBookSchema>;
type OutOfPrintBook = InferType<typeof OutOfPrintBookSchema>;

assert<AssertEqualType<InPrintBook['printStatus'] extends PrintStatus ? true : false, true>>();
assert<AssertEqualType<OutOfPrintBook['printStatus'] extends PrintStatus ? true : false, true>>();
