/**
 * Optimized Unicode code-point length predicate tests.
 *
 * Verifies that `satisfiesMinimumLength` and `satisfiesMaximumLength` return identical
 * results to the reference `[...str].length` implementation across ASCII
 * strings, astral-plane (emoji / musical symbols) strings, and strings that
 * straddle each fast-path boundary.
 *
 * Boundary cases per predicate:
 *   satisfiesMinimumLength(m): len < m, len == m, len == 2m-1, len == 2m
 *   satisfiesMaximumLength(M): len == M, len == M+1
 *
 * A "pure-surrogate" string (only astral characters, each costing 2 UTF-16
 * units) exercises the case where code-point length is half the UTF-16 length.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Predicates } from '../../src/modules/data/Predicates.js';

// ---------------------------------------------------------------------------
// Reference implementation — ground truth via spread (allocates, but correct)
// ---------------------------------------------------------------------------

function referenceMinLength(value: string, minimum: number): boolean {
  return [...value].length >= minimum;
}

function referenceMaxLength(value: string, maximum: number): boolean {
  return [...value].length <= maximum;
}

// ---------------------------------------------------------------------------
// Test strings
// ---------------------------------------------------------------------------

// ASCII: every char is 1 UTF-16 unit, 1 code point.
// len=3, cp=3
const ASCII3 = 'abc';
// len=5, cp=5
const ASCII5 = 'hello';
// len=6, cp=6
const ASCII6 = 'foobar';

// Astral-plane characters (surrogate pairs): each is 2 UTF-16 units, 1 code point.
// 𝄞 = U+1D11E (MUSICAL SYMBOL G CLEF), 😀 = U+1F600 (GRINNING FACE)
// len=2, cp=1
const ASTRAL1 = '𝄞';
// len=4, cp=2
const ASTRAL2 = '𝄞😀';
// len=6, cp=3
const ASTRAL3 = '𝄞😀𝄞';
// len=10, cp=5
const ASTRAL5 = '𝄞😀𝄞😀𝄞';

// Mixed: 2 ASCII + 1 astral = 4 UTF-16 units, 3 code points.
// len=4, cp=3
const MIXED3 = 'ab𝄞';

// ---------------------------------------------------------------------------
// Helpers — assert both predicates match the reference for a given string + limit
// ---------------------------------------------------------------------------

function assertMinLength(value: string, minimum: number): void {
  const expected = referenceMinLength(value, minimum);
  const actual = Predicates.satisfiesMinimumLength(value, minimum);

  assert.equal(
    actual,
    expected,
    `satisfiesMinimumLength(${JSON.stringify(value)}, ${minimum}): expected ${String(expected)}, got ${String(actual)}`
  );
}

function assertMaxLength(value: string, maximum: number): void {
  const expected = referenceMaxLength(value, maximum);
  const actual = Predicates.satisfiesMaximumLength(value, maximum);

  assert.equal(
    actual,
    expected,
    `satisfiesMaximumLength(${JSON.stringify(value)}, ${maximum}): expected ${String(expected)}, got ${String(actual)}`
  );
}

// ---------------------------------------------------------------------------
// satisfiesMinimumLength — ASCII
// ---------------------------------------------------------------------------

void describe('Predicates.satisfiesMinimumLength — ASCII', () => {
  // m = 3, str.length = 3, cp = 3  → len < 2m so residual band is hit (m <= len < 2m)
  void it('ASCII str len == m — returns true (boundary: len == m)', () => {
    assertMinLength(ASCII3, 3);
  });

  // m = 4, str.length = 3, cp = 3  → len < m fast-path false
  void it('ASCII str len < m — returns false (fast-path: len < m)', () => {
    assertMinLength(ASCII3, 4);
  });

  // m = 3, str.length = 5, cp = 5  → len >= 2m → fast-path true
  void it('ASCII str len >= 2m — returns true (fast-path: len >= 2*m)', () => {
    assertMinLength(ASCII5, 2);
  });

  // m = 3, str.length = 5 — residual band (3 <= 5 < 6)
  void it('ASCII str len == 2m-1 — residual band scan (m=3, len=5)', () => {
    assertMinLength(ASCII5, 3);
  });

  // m = 3, str.length = 6 — exactly at 2m boundary (fast-path)
  void it('ASCII str len == 2m — fast-path true (m=3, len=6)', () => {
    assertMinLength(ASCII6, 3);
  });

  void it('empty string — returns false for minimum=1', () => {
    assertMinLength('', 1);
  });

  void it('empty string — returns true for minimum=0', () => {
    assertMinLength('', 0);
  });
});

// ---------------------------------------------------------------------------
// satisfiesMinimumLength — astral-plane strings
// ---------------------------------------------------------------------------

void describe('Predicates.satisfiesMinimumLength — astral-plane', () => {
  // ASTRAL1: len=2, cp=1.  m=1: len >= 2*m=2 → fast-path true
  void it('single astral char, m=1 — fast-path true (len == 2*m)', () => {
    assertMinLength(ASTRAL1, 1);
  });

  // ASTRAL1: len=2, cp=1.  m=2: len < m=2 is false (len==m), len >= 2m=4 is false → residual band
  void it('single astral char, m=2 — residual band returns false (cp=1 < m=2)', () => {
    assertMinLength(ASTRAL1, 2);
  });

  // ASTRAL2: len=4, cp=2.  m=2: len >= 2*m=4 → fast-path true
  void it('two astral chars, m=2 — fast-path true (len == 2*m)', () => {
    assertMinLength(ASTRAL2, 2);
  });

  // ASTRAL2: len=4, cp=2.  m=3: len < m=3 is false, len >= 2m=6 is false → residual
  void it('two astral chars, m=3 — residual band returns false (cp=2 < m=3)', () => {
    assertMinLength(ASTRAL2, 3);
  });

  // ASTRAL3: len=6, cp=3.  m=3: len >= 2m=6 → fast-path true
  void it('three astral chars, m=3 — fast-path true', () => {
    assertMinLength(ASTRAL3, 3);
  });

  // ASTRAL5: len=10, cp=5.  m=5: len >= 2m=10 → fast-path true
  void it('five astral chars, m=5 — fast-path true', () => {
    assertMinLength(ASTRAL5, 5);
  });

  // ASTRAL3: len=6, cp=3.  m=4: len < m=4 is false, len >= 2m=8 is false → residual (6 in [4,8))
  void it('three astral chars, m=4 — residual band returns false (cp=3 < m=4)', () => {
    assertMinLength(ASTRAL3, 4);
  });
});

// ---------------------------------------------------------------------------
// satisfiesMinimumLength — mixed strings
// ---------------------------------------------------------------------------

void describe('Predicates.satisfiesMinimumLength — mixed ASCII + astral', () => {
  // MIXED3: 'ab𝄞', len=4, cp=3.  m=3: len < 2m=6, len >= m=3 → residual band → true
  void it('mixed str cp=3, m=3 — residual band returns true', () => {
    assertMinLength(MIXED3, 3);
  });

  // MIXED3: len=4, cp=3.  m=2: len >= 2m=4 → fast-path true
  void it('mixed str cp=3, m=2 — fast-path true (len == 2*m)', () => {
    assertMinLength(MIXED3, 2);
  });

  // MIXED3: len=4, cp=3.  m=4: len < m=4 is false, len >= 2m=8 is false → residual
  void it('mixed str cp=3, m=4 — residual band returns false', () => {
    assertMinLength(MIXED3, 4);
  });
});

// ---------------------------------------------------------------------------
// satisfiesMaximumLength — ASCII
// ---------------------------------------------------------------------------

void describe('Predicates.satisfiesMaximumLength — ASCII', () => {
  // M=5, str.length=5 → len <= M fast-path true
  void it('ASCII str len == M — fast-path true', () => {
    assertMaxLength(ASCII5, 5);
  });

  // M=4, str.length=5 → len > M → scan; cp=5 > M → false
  void it('ASCII str len == M+1 — scan returns false', () => {
    assertMaxLength(ASCII5, 4);
  });

  // M=6, str.length=5 → len <= M → fast-path true
  void it('ASCII str len < M — fast-path true', () => {
    assertMaxLength(ASCII5, 6);
  });

  void it('empty string — true for M=0', () => {
    assertMaxLength('', 0);
  });

  void it('single ASCII char — false for M=0', () => {
    assertMaxLength('a', 0);
  });
});

// ---------------------------------------------------------------------------
// satisfiesMaximumLength — astral-plane strings
// ---------------------------------------------------------------------------

void describe('Predicates.satisfiesMaximumLength — astral-plane', () => {
  // ASTRAL1: len=2, cp=1.  M=1: len > M → scan; cp=1 <= M=1 → true
  void it('single astral char, M=1 — scan returns true (cp == M)', () => {
    assertMaxLength(ASTRAL1, 1);
  });

  // ASTRAL1: len=2, cp=1.  M=0: len > M → scan; cp=1 > M=0 → false
  void it('single astral char, M=0 — scan returns false (cp > M)', () => {
    assertMaxLength(ASTRAL1, 0);
  });

  // ASTRAL2: len=4, cp=2.  M=2: len > M → scan; cp=2 <= M → true
  void it('two astral chars, M=2 — scan returns true (cp == M)', () => {
    assertMaxLength(ASTRAL2, 2);
  });

  // ASTRAL2: len=4, cp=2.  M=1: len > M → scan; cp=2 > M=1 → false
  void it('two astral chars, M=1 — scan returns false (cp > M)', () => {
    assertMaxLength(ASTRAL2, 1);
  });

  // ASTRAL3: len=6, cp=3.  M=4: len > M → scan; cp=3 <= M → true
  void it('three astral chars, M=4 — scan returns true (cp < M)', () => {
    assertMaxLength(ASTRAL3, 4);
  });

  // ASTRAL5: len=10, cp=5.  M=5: len > M → scan; cp=5 <= M → true
  void it('five astral chars, M=5 — scan returns true (cp == M)', () => {
    assertMaxLength(ASTRAL5, 5);
  });

  // ASTRAL5: len=10, cp=5.  M=4: len > M → scan; cp=5 > M → false
  void it('five astral chars, M=4 — scan returns false (cp > M)', () => {
    assertMaxLength(ASTRAL5, 4);
  });
});

// ---------------------------------------------------------------------------
// satisfiesMaximumLength — mixed strings
// ---------------------------------------------------------------------------

void describe('Predicates.satisfiesMaximumLength — mixed ASCII + astral', () => {
  // MIXED3: 'ab𝄞', len=4, cp=3.  M=3: len > M → scan; cp=3 <= M → true
  void it('mixed str cp=3, M=3 — scan returns true (cp == M)', () => {
    assertMaxLength(MIXED3, 3);
  });

  // MIXED3: len=4, cp=3.  M=2: len > M → scan; cp=3 > M=2 → false
  void it('mixed str cp=3, M=2 — scan returns false (cp > M)', () => {
    assertMaxLength(MIXED3, 2);
  });

  // MIXED3: len=4, cp=3.  M=5: len <= M=5 → fast-path true
  void it('mixed str len <= M — fast-path true', () => {
    assertMaxLength(MIXED3, 5);
  });
});

// ---------------------------------------------------------------------------
// Pure-surrogate strings (only astral chars — cp = len/2)
// ---------------------------------------------------------------------------

void describe('pure-surrogate strings — cp == len/2', () => {
  // 𝄞 repeated 4 times: len=8, cp=4
  const ASTRAL4 = '𝄞😀𝄞😀';

  // satisfiesMinimumLength m=4: len=8 >= 2*4=8 → fast-path true
  void it('four astral chars, m=4 — fast-path true (len == 2*m)', () => {
    assertMinLength(ASTRAL4, 4);
  });

  // satisfiesMinimumLength m=5: len=8 < 2*5=10, len >= m=5 → residual; cp=4 < 5 → false
  void it('four astral chars, m=5 — residual returns false', () => {
    assertMinLength(ASTRAL4, 5);
  });

  // satisfiesMaximumLength M=4: len=8 > M=4 → scan; cp=4 <= M → true
  void it('four astral chars, M=4 — scan returns true (cp == M)', () => {
    assertMaxLength(ASTRAL4, 4);
  });

  // satisfiesMaximumLength M=3: len=8 > M=3 → scan; cp=4 > M=3 → false
  void it('four astral chars, M=3 — scan returns false (cp > M)', () => {
    assertMaxLength(ASTRAL4, 3);
  });
});

// ---------------------------------------------------------------------------
// Exhaustive cross-check: compare against reference for a matrix of inputs
// ---------------------------------------------------------------------------

void describe('exhaustive cross-check against reference spread-based implementation', () => {
  const strings = [
    '',
    'a',
    'ab',
    'abc',
    'abcd',
    'abcde',
    '𝄞',
    '𝄞😀',
    '𝄞😀𝄞',
    '𝄞😀𝄞😀',
    'ab𝄞',
    'a😀b',
    '𝄞a😀',
    '𝄞𝄞𝄞😀😀😀'
  ];
  const limits = [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7
  ];

  for (const str of strings) {
    for (const limit of limits) {
      void it(`satisfiesMinimumLength(${JSON.stringify(str)}, ${limit})`, () => {
        assertMinLength(str, limit);
      });
      void it(`satisfiesMaximumLength(${JSON.stringify(str)}, ${limit})`, () => {
        assertMaxLength(str, limit);
      });
    }
  }
});
