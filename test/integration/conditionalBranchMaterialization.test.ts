/**
 * Regression test: if/then/else conditional-branch property materialization parity.
 *
 * Materialization, RDF lift, and ABox projection share one effective-property
 * walk (collectEffectiveProperties), which follows if/then/else conditional
 * branches. Conditional-branch properties (e.g. epubVersion under the
 * then-branch) are therefore filled in the materialized value and agree with the
 * projected ABox.
 *
 * Guards:
 *   1. materialize() includes the active then-branch property in the output.
 *   2. execute() produces the then-branch property via fillImplicitProperties.
 *   3. The ABox projection (projectAbox) and the materialized value agree on the
 *      conditional property set — both include the then-branch property.
 *
 * Schema modelled on EBook (fileFormat === 'epub' → requires epubVersion).
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Materializer } from '../../src/modules/materialization/Materializer.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Projection } from '../../src/modules/rdf/Projection.js';

// ---------------------------------------------------------------------------
// Schema — mirrors EBook's if/then/else conditional pattern.
// When fileFormat === 'epub', the then-branch adds epubVersion.
// When fileFormat !== 'epub', the else-branch adds pdfVersion.
// ---------------------------------------------------------------------------

const ConditionalSchema = JSON.parse(`{
  "$id": "https://test.example/ConditionalDoc",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "fileFormat": { "type": "string" }
  },
  "required": ["title", "fileFormat"],
  "if": {
    "properties": { "fileFormat": { "const": "epub" } },
    "required": ["fileFormat"],
    "type": "object"
  },
  "then": {
    "type": "object",
    "properties": { "epubVersion": { "type": "string" } },
    "required": ["epubVersion"]
  },
  "else": {
    "type": "object",
    "properties": { "pdfVersion": { "type": "string" } },
    "required": ["pdfVersion"]
  }
}`) as Record<string, unknown> & { '$id': string };

function makeRegistry(): {
  'mat': Materializer;
  'reg': SchemaRegistry;
} {
  const reg = new SchemaRegistry({ 'enableStrictGraph': false });

  reg.set(ConditionalSchema);

  return {
    'mat': new Materializer(reg),
    'reg': reg
  };
}

void describe('if/then/else conditional-branch materialization parity', { 'concurrency': false }, () => {
  void it(
    'materialize() includes then-branch property (epubVersion) when condition is met — Wave B regression guard',
    () => {
      const { mat } = makeRegistry();

      const result = mat.materialize(ConditionalSchema, {
        'epubVersion': '3.0',
        'fileFormat': 'epub',
        'title': 'Test Doc'
      });

      // The shared effective-property walk follows the then-branch, so
      // epubVersion is seen in fillImplicitProperties and present in the result.
      assert.ok(
        result !== null && typeof result === 'object' && 'epubVersion' in (result as Record<string, unknown>),
        'materialize() must include the then-branch property epubVersion'
      );
      assert.equal(
        (result as Record<string, unknown>).epubVersion,
        '3.0',
        'epubVersion value must be preserved through materialization'
      );
    }
  );

  void it(
    'execute() fills then-branch property via fillImplicitProperties',
    () => {
      const { mat } = makeRegistry();
      const execResult = mat.execute(ConditionalSchema, {
        'data': {
          'epubVersion': '3.1',
          'fileFormat': 'epub',
          'title': 'Another Doc'
        }
      });

      assert.ok(execResult.valid, 'execute() must produce a valid result');
      const value = execResult.value as Record<string, unknown>;

      assert.ok(
        'epubVersion' in value,
        'execute() must include the then-branch property epubVersion in the materialized value'
      );
      assert.equal(value.epubVersion, '3.1', 'epubVersion must be preserved');
    }
  );

  void it(
    'else-branch property (pdfVersion) is also included when condition is not met',
    () => {
      const { mat } = makeRegistry();

      const result = mat.materialize(ConditionalSchema, {
        'fileFormat': 'pdf',
        'pdfVersion': '1.7',
        'title': 'PDF Doc'
      });

      assert.ok(
        result !== null && typeof result === 'object' && 'pdfVersion' in (result as Record<string, unknown>),
        'materialize() must include the else-branch property pdfVersion'
      );
      assert.equal(
        (result as Record<string, unknown>).pdfVersion,
        '1.7',
        'pdfVersion value must be preserved'
      );
    }
  );

  void it(
    'ABox projection and materialized value agree on then-branch conditional property set',
    () => {
      const {
        mat, reg
      } = makeRegistry();

      const data = {
        'epubVersion': '3.0',
        'fileFormat': 'epub',
        'title': 'Test Doc'
      };

      // Materialize and project ABox
      const materialized = mat.materialize(ConditionalSchema, data);
      const graph = reg.graph(ConditionalSchema.$id);

      assert.ok(graph, 'graph must be found in registry');

      const aboxQuads = Projection.abox(
        graph,
        materialized,
        'https://test.example/instances',
        {
          'lookupGraph': (schemaId: string) => {
            return reg.graph(schemaId);
          }
        }
      );

      // ABox quads must include epubVersion predicate
      const hasEpubVersionQuad = aboxQuads.some((quad) => {
        return quad.predicate.value.includes('epubVersion');
      });

      assert.ok(
        hasEpubVersionQuad,
        'ABox projection must include epubVersion predicate when then-branch is active'
      );

      // The materialized value must also carry epubVersion
      const mat2 = materialized as Record<string, unknown>;

      assert.ok('epubVersion' in mat2, 'materialized value must carry epubVersion');
      assert.equal(mat2.epubVersion, '3.0', 'materialized epubVersion matches input');
    }
  );
});
