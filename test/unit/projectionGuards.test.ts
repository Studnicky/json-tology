/**
 * Projection guards — ABox projection rejects values that would otherwise emit
 * an invalid or unsafe quad:
 *
 *   - x-jt-iriRef values must be syntactically safe absolute IRIs
 *     (MaterializationError INVALID_IRI_VALUE) — guards against control
 *     characters, whitespace, and dangerous schemes (e.g. `javascript:`).
 *   - numeric values must be finite (MaterializationError NON_FINITE_NUMBER) —
 *     NaN/Infinity have no valid XSD literal form. Exercised through the
 *     low-level `Projection.abox` because instance validation rejects non-finite
 *     numbers before they reach the public `toQuads` path; the projection guard
 *     is defense-in-depth on the canonical-graph projector itself.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';
import { Projection } from '../../src/modules/rdf/Projection.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { MaterializationError } from '../../src/errors/MaterializationError.js';

// ---------------------------------------------------------------------------
// Fix #2 — x-jt-iriRef value validation (INVALID_IRI_VALUE)
// ---------------------------------------------------------------------------

// type: string + x-jt-iriRef true, WITHOUT format: uri, so the dangerous value
// passes instance validation and reaches the projection-time IRI guard.
const LinkSchema = {
  '$id': 'https://example.com/Link',
  'properties': {
    'href': {
      'type': 'string',
      'x-jt-iriRef': true
    }
  },
  'required': ['href'],
  'type': 'object'
} as const;

void describe('Projection guard — x-jt-iriRef value validation', () => {
  const jt = JsonTology.create({
    'baseIri': 'https://example.com',
    'schemas': [LinkSchema]
  });

  void it('emits a NamedNode for a valid absolute https IRI', () => {
    const quads = jt.toQuads(LinkSchema, { 'href': 'https://example.com/resource/1' });
    const hrefQuad = quads.find((quad) => {
      return quad.object.value === 'https://example.com/resource/1';
    });

    assert.ok(hrefQuad, 'href quad emitted');
    assert.equal(hrefQuad.object.termType, 'NamedNode', 'valid IRI emitted as NamedNode');
  });

  const unsafe: Array<{ 'href': string;
    'label': string }> = [
    {
      'href': 'javascript:alert(1)',
      'label': 'javascript: scheme rejected'
    },
    {
      'href': 'data:text/html,<script>',
      'label': 'data: scheme rejected'
    },
    {
      'href': 'not-an-iri',
      'label': 'scheme-less value rejected'
    },
    {
      'href': 'https://example.com/a b',
      'label': 'embedded space rejected'
    },
    {
      'href': 'https://example.com/a\tb',
      'label': 'embedded control character rejected'
    }
  ];

  for (const scenario of unsafe) {
    void it(scenario.label, () => {
      assert.throws(
        () => {
          jt.toQuads(LinkSchema, { 'href': scenario.href });
        },
        (error: unknown) => {
          assert.ok(error instanceof MaterializationError, 'throws MaterializationError');
          assert.equal(error.code, 'INVALID_IRI_VALUE', 'code is INVALID_IRI_VALUE');

          return true;
        },
        `${scenario.label}: expected INVALID_IRI_VALUE`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Fix #3 — non-finite numeric rejection (NON_FINITE_NUMBER)
// ---------------------------------------------------------------------------

const MeasurementSchema = {
  '$id': 'https://example.com/Measurement',
  'properties': { 'value': { 'type': 'number' } },
  'required': ['value'],
  'type': 'object'
} as const;

void describe('Projection guard — non-finite numeric rejection', () => {
  const nonFinite: Array<{ 'label': string;
    'value': number }> = [
    {
      'label': 'NaN rejected',
      'value': Number.NaN
    },
    {
      'label': 'Infinity rejected',
      'value': Number.POSITIVE_INFINITY
    },
    {
      'label': '-Infinity rejected',
      'value': Number.NEGATIVE_INFINITY
    }
  ];

  for (const scenario of nonFinite) {
    void it(scenario.label, () => {
      // Bypass instance validation (which already rejects non-finite numbers)
      // and exercise the projector's own defense-in-depth guard directly.
      const graph = new SchemaGraph(MeasurementSchema);

      assert.throws(
        () => {
          Projection.abox(graph, { 'value': scenario.value }, 'https://example.com');
        },
        (error: unknown) => {
          assert.ok(error instanceof MaterializationError, 'throws MaterializationError');
          assert.equal(error.code, 'NON_FINITE_NUMBER', 'code is NON_FINITE_NUMBER');

          return true;
        },
        `${scenario.label}: expected NON_FINITE_NUMBER`
      );
    });
  }

  void it('emits an xsd literal for a finite number', () => {
    const graph = new SchemaGraph(MeasurementSchema);
    const quads = Projection.abox(graph, { 'value': 42.5 }, 'https://example.com');
    const valueQuad = quads.find((quad) => {
      return quad.object.value === '42.5';
    });

    assert.ok(valueQuad, 'finite numeric value emitted as a literal');
    assert.equal(valueQuad.object.termType, 'Literal', 'finite number emitted as Literal');
  });
});
