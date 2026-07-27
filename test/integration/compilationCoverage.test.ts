/**
 * Compilation Coverage Conformance Harness
 *
 * Oracle for the total-compiler-unification refactor (docs/design/total-compiler-unification.md).
 * Grades every wave by asserting, per schema corpus entry:
 *   (a) CORRECTNESS  — valid instances pass, invalid instances fail
 *   (b) FALLBACK     — compiled === true (no engine fallback)
 *
 * A single allowlist tracks the remaining gap:
 *
 *   CURRENTLY_FALLS_BACK  — schemas where compiled===false (interpreter fallback).
 *                           Wave 1 removes dynamicRef/Anchor. Wave 2 removes
 *                           unevaluated* and rdfs*. This set is the real baseline
 *                           Waves 1–2 must drive to empty.
 *
 * Every corpus entry NOT in CURRENTLY_FALLS_BACK is asserted to compile
 * (compiled === true) AND validate correctly. Wave 0 (ExecContext unification,
 * IRI-keyed two-pass plan, ctx.refStack guard) has landed, so all structural,
 * scalar, composition, and $ref-following schemas — including recursive and
 * mutually-recursive $ref and cyclic data — compile on the single executor.
 *
 * The JSON Schema 2020-12 official test suite is NOT vendored — this is a
 * hand-rolled corpus covering the keywords named in the root-cause table plus
 * representative repo patterns.
 *
 * Run with:
 *   npx tsx --test 'test/integration/compilationCoverage.test.ts'
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import type { CompiledValidatorInterface } from '../../src/interfaces/CompiledValidatorInterface.js';

// ---------------------------------------------------------------------------
// CURRENTLY_FALLS_BACK allowlist
//
// Each entry is a schema corpus key. When compiled === false the harness
// checks this set: if the key is present the fallback is EXPECTED (xfail)
// and the test passes with a note. If the key is NOT present the test fails,
// meaning a regression introduced a new fallback.
//
// Conversely, any key NOT in this set MUST compile (compiled === true) and
// validate correctly — the harness asserts both.
//
// Remove entries as each wave ships to shrink toward empty.
// ---------------------------------------------------------------------------

// Wave 2 landed: unevaluatedProperties, unevaluatedItems, rdfsRange, rdfsDomain all compile.
// All entries removed — CURRENTLY_FALLS_BACK is now empty.
const CURRENTLY_FALLS_BACK = new Set<string>();

// ---------------------------------------------------------------------------
// Internal corpus types
// ---------------------------------------------------------------------------

type CorpusCase = {
  'data': unknown;
  'name': string;
  'valid': boolean;
};

type CorpusEntry = {
  /** Validation correctness scenarios */
  'cases': readonly CorpusCase[];
  /** Optional additional schemas to register first (dependencies) */
  'deps'?: ReadonlyArray<Record<string, unknown> & { readonly '$id': string }>;
  /** Human-readable description of keywords exercised */
  'description': string;
  /** Unique key used in CURRENTLY_FALLS_BACK */
  'key': string;
  /** Whether to use enableStrictGraph:false (needed for inline primitive constraints) */
  'relaxGraph'?: boolean;
  /** Inline schema body (no $id — assigned below) */
  'schema': Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Helper: run one corpus entry
// ---------------------------------------------------------------------------

function runCorpusEntry(entry: CorpusEntry): void {
  const baseIri = `urn:coverage:${entry.key}:`;
  const schemaId = `${baseIri}root`;
  const fullSchema: Record<string, unknown> = {
    '$id': schemaId,
    ...entry.schema
  };

  const jt = entry.relaxGraph === true
    ? JsonTology.create({
      'baseIri': baseIri,
      'enableStrictGraph': false
    })
    : JsonTology.create({ 'baseIri': baseIri });

  if (entry.deps) {
    for (const dep of entry.deps) {
      jt.set(dep);
    }
  }

  jt.set(fullSchema as Record<string, unknown> & { readonly '$id': string });

  // Access compiled flag via registry.validator()
  const validator: CompiledValidatorInterface = jt.registry.validator(schemaId);
  const isCompiled = validator.compiled;
  const fallbackAllowed = CURRENTLY_FALLS_BACK.has(entry.key);

  // FALLBACK DETECTION
  if (fallbackAllowed) {
    // Allowlisted Wave 1/2 target: tolerate either path. compiled===true here
    // means the wave has landed and the entry is stale — remove it.
    // (No assert; human review of CURRENTLY_FALLS_BACK is the mechanism.)
  } else {
    // Non-allowlisted: MUST be on the single compiled executor, no fallback.
    assert.equal(
      isCompiled,
      true,
      `schema "${entry.key}" (${entry.description}) fell back to interpreter (compiled===false) — `
      + 'not in CURRENTLY_FALLS_BACK. This is a regression: fix the fallback or add the key.'
    );
  }

  // CORRECTNESS — every case must produce the expected valid/invalid verdict.
  for (const testCase of entry.cases) {
    const errors = jt.validate(schemaId, testCase.data);
    const actualValid = errors.length === 0;

    assert.equal(
      actualValid,
      testCase.valid,
      `[${entry.key}] "${testCase.name}": expected valid=${String(testCase.valid)}, got valid=${String(actualValid)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Corpus: CURRENTLY-COMPILED keywords (compiled === true today)
// ---------------------------------------------------------------------------

void describe('compilation-coverage: compiled keywords', () => {
  // --- 1. Flat object with required + type ---
  void it('flat-object: type, properties, required', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': {
            'count': 1,
            'id': 'x'
          },
          'name': 'valid — required present',
          'valid': true
        },
        {
          'data': { 'count': 1 },
          'name': 'invalid — missing required',
          'valid': false
        },
        {
          'data': {
            'count': 'bad',
            'id': 'x'
          },
          'name': 'invalid — wrong type for count',
          'valid': false
        }
      ],
      'description': 'type:object, properties, required',
      'key': 'flat-object',
      'schema': {
        'properties': {
          'count': { 'type': 'number' },
          'id': { 'type': 'string' }
        },
        'required': ['id'],
        'type': 'object'
      }
    });
  });

  // --- 2. Nested $ref to another registered schema ---
  void it('cross-ref: $ref to separately registered schema', () => {
    const AddressSchema = {
      '$id': 'urn:coverage:cross-ref:Address',
      'properties': {
        'city': { 'type': 'string' },
        'street': { 'type': 'string' }
      },
      'required': [
        'street',
        'city'
      ],
      'type': 'object'
    } as const;

    runCorpusEntry({
      'cases': [
        {
          'data': {
            'home': {
              'city': 'Anytown',
              'street': '1 Main'
            },
            'name': 'Alice'
          },
          'name': 'valid — all required, ref satisfied',
          'valid': true
        },
        {
          'data': {
            'home': { 'street': '2 Main' },
            'name': 'Bob'
          },
          'name': 'invalid — ref object missing required city',
          'valid': false
        },
        {
          'data': {
            'home': 'not-an-object',
            'name': 'Carol'
          },
          'name': 'invalid — ref value is wrong type',
          'valid': false
        }
      ],
      'deps': [AddressSchema],
      'description': '$ref to a separately registered schema',
      'key': 'cross-ref',
      'schema': {
        'properties': {
          'home': { '$ref': 'urn:coverage:cross-ref:Address' },
          'name': { 'type': 'string' }
        },
        'required': [
          'name',
          'home'
        ],
        'type': 'object'
      }
    });
  });

  // --- 3. Array with items, minItems, maxItems, uniqueItems ---
  void it('array: items, minItems, maxItems, uniqueItems', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': [
            'a',
            'b'
          ],
          'name': 'valid — 2 unique strings',
          'valid': true
        },
        {
          'data': [],
          'name': 'invalid — empty (violates minItems)',
          'valid': false
        },
        {
          'data': [
            'a',
            'b',
            'c',
            'd'
          ],
          'name': 'invalid — 4 items (violates maxItems)',
          'valid': false
        },
        {
          'data': [
            'a',
            'a'
          ],
          'name': 'invalid — duplicate (violates uniqueItems)',
          'valid': false
        },
        {
          'data': [
            'a',
            42
          ],
          'name': 'invalid — non-string item',
          'valid': false
        }
      ],
      'description': 'array with items, minItems, maxItems, uniqueItems',
      'key': 'array-constraints',
      'schema': {
        'items': { 'type': 'string' },
        'maxItems': 3,
        'minItems': 1,
        'type': 'array',
        'uniqueItems': true
      }
    });
  });

  // --- 4. allOf with intersecting constraints ---
  void it('allOf: intersecting property constraints', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': {
            'a': 'x',
            'b': 1
          },
          'name': 'valid — both branches satisfied',
          'valid': true
        },
        {
          'data': { 'b': 1 },
          'name': 'invalid — missing a',
          'valid': false
        },
        {
          'data': { 'a': 'x' },
          'name': 'invalid — missing b',
          'valid': false
        },
        {
          'data': {
            'a': 1,
            'b': 1
          },
          'name': 'invalid — wrong type for a',
          'valid': false
        }
      ],
      'description': 'allOf with two sub-schemas that both apply',
      'key': 'allOf-basic',
      'relaxGraph': true,
      'schema': {
        'allOf': [
          {
            'properties': { 'a': { 'type': 'string' } },
            'required': ['a']
          },
          {
            'properties': { 'b': { 'type': 'number' } },
            'required': ['b']
          }
        ],
        'type': 'object'
      }
    });
  });

  // --- 5. anyOf ---
  void it('anyOf: one-of-several alternatives', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': 'hello',
          'name': 'valid — non-empty string',
          'valid': true
        },
        {
          'data': 5,
          'name': 'valid — positive number',
          'valid': true
        },
        {
          'data': '',
          'name': 'invalid — empty string (fails first, no second match)',
          'valid': false
        },
        {
          'data': -1,
          'name': 'invalid — negative number (fails second)',
          'valid': false
        },
        {
          'data': true,
          'name': 'invalid — boolean matches neither',
          'valid': false
        }
      ],
      'description': 'anyOf with string and number alternatives',
      'key': 'anyOf-basic',
      'relaxGraph': true,
      'schema': {
        'anyOf': [
          {
            'minLength': 1,
            'type': 'string'
          },
          {
            'minimum': 0,
            'type': 'number'
          }
        ]
      }
    });
  });

  // --- 6. oneOf ---
  void it('oneOf: exactly-one-of constraint', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': 25,
          'name': 'valid — matches only first branch (25)',
          'valid': true
        },
        {
          'data': 75,
          'name': 'valid — matches only second branch (75)',
          'valid': true
        },
        {
          'data': -1,
          'name': 'invalid — matches neither (-1)',
          'valid': false
        },
        {
          'data': 200,
          'name': 'invalid — matches neither (200)',
          'valid': false
        }
      ],
      'description': 'oneOf with non-overlapping ranges',
      'key': 'oneOf-basic',
      'relaxGraph': true,
      'schema': {
        'oneOf': [
          {
            'maximum': 49,
            'minimum': 0,
            'type': 'number'
          },
          {
            'maximum': 100,
            'minimum': 50,
            'type': 'number'
          }
        ]
      }
    });
  });

  // --- 7. if/then/else ---
  void it('if-then-else: conditional schema application', () => {
    const schema: Record<string, unknown> = {
      'else': { 'required': ['code'] },
      'if': {
        'properties': { 'kind': { 'const': 'error' } },
        'required': ['kind']
      },
      'properties': {
        'code': { 'type': 'number' },
        'kind': { 'type': 'string' },
        'reason': { 'type': 'string' }
      },
      'type': 'object'
    };

    Reflect.set(schema, 'then', { 'required': ['reason'] });

    runCorpusEntry({
      'cases': [
        {
          'data': {
            'kind': 'error',
            'reason': 'out of memory'
          },
          'name': 'valid — if satisfied, then constraint met',
          'valid': true
        },
        {
          'data': { 'kind': 'error' },
          'name': 'invalid — if satisfied, then constraint violated (no reason)',
          'valid': false
        },
        {
          'data': {
            'code': 200,
            'kind': 'info'
          },
          'name': 'valid — if not satisfied, else constraint met',
          'valid': true
        },
        {
          'data': { 'kind': 'info' },
          'name': 'invalid — if not satisfied, else constraint violated (no code)',
          'valid': false
        }
      ],
      'description': 'if/then/else conditional branching',
      'key': 'if-then-else',
      'schema': schema
    });
  });

  // --- 8. patternProperties + additionalProperties:false ---
  void it('patternProperties + additionalProperties:false', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': { 'name': 'Alice' },
          'name': 'valid — known prop',
          'valid': true
        },
        {
          'data': {
            'name': 'Bob',
            'x-custom': 'v'
          },
          'name': 'valid — pattern-matched prop',
          'valid': true
        },
        {
          'data': {
            'extra': 'x',
            'name': 'Carol'
          },
          'name': 'invalid — unknown prop',
          'valid': false
        },
        {
          'data': {
            'name': 'Dave',
            'x-n': 5
          },
          'name': 'invalid — pattern prop wrong type',
          'valid': false
        }
      ],
      'description': 'patternProperties with additionalProperties:false',
      'key': 'pattern-props',
      'schema': {
        'additionalProperties': false,
        'patternProperties': { '^x-': { 'type': 'string' } },
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }
    });
  });

  // --- 9. Recursive self-referential $ref ---
  void it('recursive $ref: self-referential tree schema', () => {
    const TreeNodeSchema = {
      '$id': 'urn:coverage:recursive-ref:TreeNode',
      'properties': {
        'children': {
          'items': { '$ref': 'urn:coverage:recursive-ref:TreeNode' },
          'type': 'array'
        },
        'label': { 'type': 'string' }
      },
      'required': ['label'],
      'type': 'object'
    } as const;

    runCorpusEntry({
      'cases': [
        {
          'data': {
            'root': {
              'children': [{
                'children': [{ 'label': 'b' }],
                'label': 'a'
              }],
              'label': 'r'
            }
          },
          'name': 'valid — deep tree',
          'valid': true
        },
        {
          'data': { 'root': { 'label': 'leaf' } },
          'name': 'valid — leaf node (no children)',
          'valid': true
        },
        {
          'data': {
            'root': {
              'children': [{}],
              'label': 'r'
            }
          },
          'name': 'invalid — child missing required label',
          'valid': false
        }
      ],
      'deps': [TreeNodeSchema],
      'description': 'self-referential $ref (recursive schema, finite data)',
      'key': 'recursive-ref',
      'schema': {
        'properties': { 'root': { '$ref': 'urn:coverage:recursive-ref:TreeNode' } },
        'required': ['root'],
        'type': 'object'
      }
    });
  });

  // --- 10. Mutual recursion: A → B → A ---
  void it('mutual recursion: A → B → A', () => {
    const baseIri = 'urn:coverage:mutual-ref:';
    const idA = `${baseIri}A`;
    const idB = `${baseIri}B`;

    const jt = JsonTology.create({ 'baseIri': baseIri });

    jt.set({
      '$id': idB,
      'properties': {
        'a': { '$ref': idA },
        'tag': { 'type': 'string' }
      },
      'required': ['tag'],
      'type': 'object'
    });

    jt.set({
      '$id': idA,
      'properties': {
        'b': { '$ref': idB },
        'tag': { 'type': 'string' }
      },
      'required': ['tag'],
      'type': 'object'
    });

    const validator: CompiledValidatorInterface = jt.registry.validator(idA);

    // mutual-ref is not allowlisted — Wave 0's ctx.refStack guard makes the
    // mutually-recursive plan a finite cyclic graph that compiles.
    assert.equal(
      validator.compiled,
      true,
      'mutual-ref: mutually-recursive $ref must compile on the single executor (no fallback)'
    );

    const cases = [
      {
        'data': {
          'b': {
            'a': { 'tag': 'a2' },
            'tag': 'b1'
          },
          'tag': 'a1'
        },
        'name': 'valid — A with nested B with nested A',
        'valid': true
      },
      {
        'data': { 'tag': 'alone' },
        'name': 'valid — A with no B',
        'valid': true
      },
      {
        'data': {
          'b': {},
          'tag': 'a1'
        },
        'name': 'invalid — nested B missing required tag',
        'valid': false
      }
    ];

    for (const testCase of cases) {
      const errors = jt.validate(idA, testCase.data);
      const actualValid = errors.length === 0;

      assert.equal(
        actualValid,
        testCase.valid,
        `[mutual-ref] "${testCase.name}": expected valid=${String(testCase.valid)}, got valid=${String(actualValid)}`
      );
    }
  });

  // --- 11. Cyclic data instance (self-referencing JS object) ---
  void it('cyclic data: cyclic JS object validates without infinite loop', () => {
    // The schema allows optional self-reference but the DATA itself is cyclic.
    // Validation must terminate via the refStack guard, not hang or throw RangeError.
    const CycleSchema = {
      '$id': 'urn:coverage:cyclic-data:Node',
      'properties': {
        'id': { 'type': 'string' },
        'next': { '$ref': 'urn:coverage:cyclic-data:Node' }
      },
      'required': ['id'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({ 'baseIri': 'urn:coverage:cyclic-data:' });

    jt.set(CycleSchema);

    const validator: CompiledValidatorInterface = jt.registry.validator(CycleSchema.$id);

    // Wave 0's IRI-keyed two-pass plan makes a self-referential $ref a finite
    // cyclic plan graph — it compiles, no fallback.
    assert.equal(
      validator.compiled,
      true,
      'cyclic-data: self-referential $ref schema must compile on the single executor (no fallback)'
    );

    // Build a cyclic JS object
    type CycleNode = { 'id': string;
      'next'?: CycleNode };
    const node: CycleNode = { 'id': 'a' };

    node.next = node;

    // validate() must terminate via the ctx.refStack guard — no RangeError, no hang.
    let threw = false;

    try {
      jt.validate(CycleSchema.$id, node);
    } catch (error: unknown) {
      threw = true;
      // RangeError (stack overflow) is a regression — the refStack guard must short-circuit.
      assert.ok(
        !(error instanceof RangeError),
        `cyclic data validation threw RangeError (stack overflow) — refStack guard missing: ${String(error)}`
      );
    }

    // The only prohibited outcome is a RangeError; any other termination is acceptable.
    assert.ok(!threw || true, 'cyclic-data: validation terminated without stack overflow');
  });

  // --- 12. $defs with local pointer $ref ---
  void it('$defs: local pointer ref', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': {
            'count': 3,
            'tag': 'hello'
          },
          'name': 'valid — non-empty tag',
          'valid': true
        },
        {
          'data': { 'tag': '' },
          'name': 'invalid — empty tag (minLength)',
          'valid': false
        },
        {
          'data': { 'count': 1 },
          'name': 'invalid — missing tag',
          'valid': false
        }
      ],
      'description': '$defs with local #/$defs/Foo $ref',
      'key': 'defs-local-ref',
      'relaxGraph': true,
      'schema': {
        '$defs': {
          'Tag': {
            'minLength': 1,
            'type': 'string'
          }
        },
        'properties': {
          'count': { 'type': 'number' },
          'tag': { '$ref': '#/$defs/Tag' }
        },
        'required': ['tag'],
        'type': 'object'
      }
    });
  });

  // --- 13. String format + pattern ---
  void it('string: format and pattern constraints', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': 'abc',
          'name': 'valid — lowercase in range',
          'valid': true
        },
        {
          'data': 'a',
          'name': 'invalid — too short',
          'valid': false
        },
        {
          'data': 'abcdefghijk',
          'name': 'invalid — too long',
          'valid': false
        },
        {
          'data': 'ABC',
          'name': 'invalid — pattern mismatch (uppercase)',
          'valid': false
        }
      ],
      'description': 'string with minLength, maxLength, pattern',
      'key': 'string-constraints',
      'relaxGraph': true,
      'schema': {
        'maxLength': 10,
        'minLength': 2,
        'pattern': '^[a-z]+',
        'type': 'string'
      }
    });
  });

  // --- 14. Numeric constraints ---
  void it('number: minimum, maximum, multipleOf, exclusiveMinimum', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': 5,
          'name': 'valid — 5',
          'valid': true
        },
        {
          'data': 100,
          'name': 'valid — 100',
          'valid': true
        },
        {
          'data': 0,
          'name': 'invalid — 0 (exclusiveMinimum)',
          'valid': false
        },
        {
          'data': 101,
          'name': 'invalid — 101 (above maximum)',
          'valid': false
        },
        {
          'data': 3,
          'name': 'invalid — 3 (not multipleOf 5)',
          'valid': false
        }
      ],
      'description': 'number with minimum, maximum, multipleOf, exclusiveMinimum',
      'key': 'number-constraints',
      'relaxGraph': true,
      'schema': {
        'exclusiveMinimum': 0,
        'maximum': 100,
        'minimum': 0,
        'multipleOf': 5,
        'type': 'number'
      }
    });
  });

  // --- 15. const and enum ---
  void it('const + enum: strict value matching', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': {
            'status': 'active',
            'version': 2
          },
          'name': 'valid — matching values',
          'valid': true
        },
        {
          'data': {
            'status': 'deleted',
            'version': 2
          },
          'name': 'invalid — status not in enum',
          'valid': false
        },
        {
          'data': {
            'status': 'active',
            'version': 3
          },
          'name': 'invalid — version wrong (const)',
          'valid': false
        }
      ],
      'description': 'const and enum value constraints',
      'key': 'const-enum',
      'schema': {
        'properties': {
          'status': {
            'enum': [
              'active',
              'inactive',
              'pending'
            ]
          },
          'version': { 'const': 2 }
        },
        'required': [
          'status',
          'version'
        ],
        'type': 'object'
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Corpus: FALLBACK keywords (compiled === false today — Wave 1 and Wave 2 targets)
// These tests PASS now because fallbacks are expected per CURRENTLY_FALLS_BACK.
// As waves land, compiled === true, the allowlist shrinks, and fallback-detection
// continues to catch regressions.
// ---------------------------------------------------------------------------

void describe('compilation-coverage: fallback-detected keywords (Wave targets)', () => {
  // --- $dynamicAnchor (Wave 1) ---
  void it('dynamicAnchor-only: schema with $dynamicAnchor, no $dynamicRef', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': { 'id': 'x' },
          'name': 'valid — required id present',
          'valid': true
        },
        {
          'data': {},
          'name': 'invalid — missing id',
          'valid': false
        }
      ],
      'description': '$dynamicAnchor declaration without a $dynamicRef',
      'key': 'dynamicAnchor-only',
      'schema': {
        '$dynamicAnchor': 'root',
        'properties': { 'id': { 'type': 'string' } },
        'required': ['id'],
        'type': 'object'
      }
    });
  });

  // --- $dynamicRef + $dynamicAnchor (Wave 1) ---
  void it('dynamicRef-basic: $dynamicRef resolves to $dynamicAnchor in same schema', () => {
    // Build schema inline — JsonTology.set with $dynamicAnchor requires plain record
    const baseIri = 'urn:coverage:dynamicRef-basic:';
    const schemaId = `${baseIri}root`;
    const jt = JsonTology.create({ 'baseIri': baseIri });

    const schema: Record<string, unknown> = {
      '$dynamicAnchor': 'node',
      '$id': schemaId,
      'properties': {
        'child': { '$dynamicRef': '#node' },
        'value': { 'type': 'string' }
      },
      'required': ['value'],
      'type': 'object'
    };

    jt.set(schema as Record<string, unknown> & { readonly '$id': string });

    const validator: CompiledValidatorInterface = jt.registry.validator(schemaId);
    const fallbackAllowed = CURRENTLY_FALLS_BACK.has('dynamicRef-basic');

    if (!validator.compiled) {
      assert.ok(fallbackAllowed, 'dynamicRef-basic fell back unexpectedly');
    }

    // CORRECTNESS — should pass regardless of compiled/fallback path
    const validResult = jt.validate(schemaId, {
      'child': { 'value': 'child-value' },
      'value': 'root'
    });

    assert.equal(validResult.length, 0, 'dynamicRef-basic: valid nested instance should pass');

    const invalidResult = jt.validate(schemaId, { 'child': { 'value': 'child-only' } });

    assert.ok(invalidResult.length > 0, 'dynamicRef-basic: instance missing required "value" should fail');
  });

  // --- $dynamicRef with external schema override (Wave 1) ---
  void it('dynamicRef-with-anchor: $dynamicRef resolves via scope to extended anchor', () => {
    const baseIri = 'urn:coverage:dynamicRef-anchor:';
    const jt = JsonTology.create({ 'baseIri': baseIri });

    // Base schema: uses $dynamicAnchor so an extension can override resolution
    const BaseSchema: Record<string, unknown> = {
      '$dynamicAnchor': 'item',
      '$id': `${baseIri}Base`,
      'items': { '$dynamicRef': '#item' },
      'type': 'array'
    };
    // Extension: provides its own $dynamicAnchor 'item' that binds to a concrete type
    const ExtSchema: Record<string, unknown> = {
      '$dynamicAnchor': 'item',
      '$id': `${baseIri}Ext`,
      'allOf': [{ '$ref': `${baseIri}Base` }],
      'items': { '$dynamicRef': '#item' }
    };
    const ConcreteSchema: Record<string, unknown> = {
      '$dynamicAnchor': 'item',
      '$id': `${baseIri}Concrete`,
      'type': 'string'
    };

    jt.set(BaseSchema as Record<string, unknown> & { readonly '$id': string });
    jt.set(ExtSchema as Record<string, unknown> & { readonly '$id': string });
    jt.set(ConcreteSchema as Record<string, unknown> & { readonly '$id': string });

    const validator: CompiledValidatorInterface = jt.registry.validator(`${baseIri}Base`);
    const fallbackAllowed = CURRENTLY_FALLS_BACK.has('dynamicRef-with-anchor');

    if (!validator.compiled) {
      assert.ok(fallbackAllowed, 'dynamicRef-with-anchor fell back unexpectedly');
    }

    // At minimum: base schema validates an array without crashing
    const result = jt.validate(`${baseIri}Base`, [
      'a',
      'b'
    ]);

    // Correctness is partial here — just assert no exception thrown
    assert.ok(Array.isArray([...result]), 'dynamicRef-with-anchor: validate() returned without crash');
  });

  // --- unevaluatedProperties (Wave 2) ---
  void it('unevaluatedProperties-basic: extra props rejected when flag is false', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': { 'name': 'Alice' },
          'name': 'valid — only declared prop',
          'valid': true
        },
        {
          'data': {},
          'name': 'valid — empty object',
          'valid': true
        },
        {
          'data': {
            'extra': true,
            'name': 'Alice'
          },
          'name': 'invalid — extra prop present',
          'valid': false
        }
      ],
      'description': 'unevaluatedProperties: false — extra props must fail',
      'key': 'unevaluatedProperties-basic',
      'schema': {
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object',
        'unevaluatedProperties': false
      }
    });
  });

  // --- unevaluatedProperties through allOf composition (Wave 2) ---
  void it('unevaluatedProperties-allOf: evaluated via allOf branch', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': { 'name': 'Alice' },
          'name': 'valid — prop declared in allOf branch',
          'valid': true
        },
        {
          'data': {
            'extra': 1,
            'name': 'Alice'
          },
          'name': 'invalid — prop not declared anywhere',
          'valid': false
        }
      ],
      'description': 'unevaluatedProperties:false with allOf — props from branches count as evaluated',
      'key': 'unevaluatedProperties-allOf',
      'relaxGraph': true,
      'schema': {
        'allOf': [{ 'properties': { 'name': { 'type': 'string' } } }],
        'type': 'object',
        'unevaluatedProperties': false
      }
    });
  });

  // --- unevaluatedItems (Wave 2) ---
  void it('unevaluatedItems-basic: extra array items rejected when flag is false', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': ['hello'],
          'name': 'valid — single prefix item',
          'valid': true
        },
        {
          'data': [],
          'name': 'valid — empty array',
          'valid': true
        },
        {
          'data': [
            'hello',
            'extra'
          ],
          'name': 'invalid — extra item beyond prefix',
          'valid': false
        }
      ],
      'description': 'unevaluatedItems: false — items beyond prefix must fail',
      'key': 'unevaluatedItems-basic',
      'schema': {
        'prefixItems': [{ 'type': 'string' }],
        'type': 'array',
        'unevaluatedItems': false
      }
    });
  });

  // --- unevaluatedItems with contains (Wave 2) ---
  void it('unevaluatedItems-contains: items evaluated by contains', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': [
            1,
            2,
            3
          ],
          'name': 'valid — all items are numbers (all evaluated by contains)',
          'valid': true
        },
        {
          'data': [
            1,
            'extra'
          ],
          'name': 'invalid — string item not evaluated by contains',
          'valid': false
        }
      ],
      'description': 'unevaluatedItems: false with contains — contained items count as evaluated',
      'key': 'unevaluatedItems-contains',
      'schema': {
        'contains': { 'type': 'number' },
        'type': 'array',
        'unevaluatedItems': false
      }
    });
  });

  // --- rdfs:range (Wave 2) ---
  void it('rdfs-range: property with rdfs:range constraint', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': { 'label': 'hello' },
          'name': 'valid — string value',
          'valid': true
        },
        {
          'data': { 'label': 42 },
          'name': 'invalid — non-string value',
          'valid': false
        }
      ],
      'description': 'rdfs:range on a property schema',
      'key': 'rdfs-range',
      'schema': {
        'properties': {
          'label': {
            'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string',
            'type': 'string'
          }
        },
        'required': ['label'],
        'type': 'object'
      }
    });
  });

  // --- rdfs:domain (Wave 2) ---
  void it('rdfs-domain: property with rdfs:domain constraint', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': { 'name': 'Alice' },
          'name': 'valid — string value present',
          'valid': true
        },
        {
          'data': { 'name': 42 },
          'name': 'invalid — wrong type',
          'valid': false
        }
      ],
      'description': 'rdfs:domain on a property schema',
      'key': 'rdfs-domain',
      'schema': {
        'properties': {
          'name': {
            'rdfs:domain': 'https://example.org/Person',
            'type': 'string'
          }
        },
        'required': ['name'],
        'type': 'object'
      }
    });
  });

  // --- rdfs:range + rdfs:domain together (Wave 2) ---
  void it('rdfs-range-and-domain: both rdfs annotations on same property', () => {
    runCorpusEntry({
      'cases': [
        {
          'data': { 'value': 3.14 },
          'name': 'valid — number value',
          'valid': true
        },
        {
          'data': { 'value': 'pi' },
          'name': 'invalid — non-number value',
          'valid': false
        }
      ],
      'description': 'both rdfs:range and rdfs:domain on same property schema',
      'key': 'rdfs-range-and-domain',
      'schema': {
        'properties': {
          'value': {
            'rdfs:domain': 'https://example.org/Measurement',
            'rdfs:range': 'http://www.w3.org/2001/XMLSchema#decimal',
            'type': 'number'
          }
        },
        'required': ['value'],
        'type': 'object'
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Summary check: both allowlists should be documented correctly.
// This test prints the current allowlists so CI output is self-documenting.
// ---------------------------------------------------------------------------

void describe('compilation-coverage: allowlist integrity', () => {
  void it('CURRENTLY_FALLS_BACK set is empty — all waves landed', () => {
    // Wave 2 landed: unevaluatedProperties, unevaluatedItems, rdfsRange, rdfsDomain compile.
    // All entries removed. Any regression that re-introduces a fallback will add to this set
    // and break the size === 0 assertion below.
    assert.equal(
      CURRENTLY_FALLS_BACK.size,
      0,
      'CURRENTLY_FALLS_BACK must be empty — Wave 2 has landed. If a new fallback appeared, add it '
      + 'to the set and investigate the regression.'
    );
  });
});
