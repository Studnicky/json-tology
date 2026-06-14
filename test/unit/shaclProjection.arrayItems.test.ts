/**
 * Regression tests for array-property range projection in ShaclProjection.
 *
 * Before the fix, an array property whose `items` is a $ref or a typed schema
 * produced two wrong outcomes:
 *  1. A phantom `#items` property shape on the class.
 *  2. The real array property shape emitted no sh:node / sh:datatype constraint.
 *
 * After the fix:
 *  - The array property shape carries the range constraint derived from its items schema.
 *  - No phantom `#items` property shape exists on the class.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { ShaclProjection } from '../../src/modules/rdf/ShaclProjection.js';
import { SH } from '../../src/constants/IRI.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function project(schema: Record<string, unknown>): QuadInterface[] {
  return ShaclProjection.graph(new SchemaGraph(schema));
}

/** Return the bnode IDs for all sh:property blank-node values on `classId`. */
function classPropertyBnodes(quads: QuadInterface[], classId: string): string[] {
  return quads
    .filter((quad) => {
      return quad.subject.value === classId
        && quad.predicate.value === SH.property
        && quad.object.termType === 'BlankNode';
    })
    .map((quad) => {
      return quad.object.value;
    });
}

/** Collect all quads whose subject is one of the given bnode IDs. */
function quadsForBnodes(quads: QuadInterface[], bnodeIds: string[]): QuadInterface[] {
  const idSet = new Set(bnodeIds);

  return quads.filter((quad) => {
    return idSet.has(quad.subject.value);
  });
}

/** Read the sh:path object IRI for a property-shape bnode. */
function pathIri(quads: QuadInterface[], bnodeId: string): string | undefined {
  const pathQuad = quads.find((quad) => {
    return quad.subject.value === bnodeId && quad.predicate.value === SH.path && quad.object.termType === 'NamedNode';
  });

  return pathQuad?.object.value;
}

/** Read the named-node object value for a predicate on a bnode. */
function namedNodeObject(quads: QuadInterface[], bnodeId: string, predicate: string): string | undefined {
  const found = quads.find((quad) => {
    return quad.subject.value === bnodeId && quad.predicate.value === predicate && quad.object.termType === 'NamedNode';
  });

  return found?.object.value;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLASS_ID = 'https://example.io/Catalog';
const ITEM_CLASS_ID = 'https://example.io/Dataset';
const STRING_ARRAY_PROP = 'keyword';
const REF_ARRAY_PROP = 'datasets';

const schema = {
  '$defs': {
    'Dataset': {
      '$id': ITEM_CLASS_ID,
      'type': 'object'
    }
  },
  '$id': CLASS_ID,
  'properties': {
    [REF_ARRAY_PROP]: {
      'items': { '$ref': ITEM_CLASS_ID },
      'type': 'array'
    },
    [STRING_ARRAY_PROP]: {
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('ShaclProjection: array property items constraint projection', { 'concurrency': true }, () => {
  const quads = project(schema);
  const bnodeIds = classPropertyBnodes(quads, CLASS_ID);
  const propShapeQuads = quadsForBnodes(quads, bnodeIds);

  void it('array-of-$ref property shape carries sh:node pointing to the referenced class', () => {
    const refArrayBnode = bnodeIds.find((id) => {
      return pathIri(propShapeQuads, id)?.endsWith(`#${REF_ARRAY_PROP}`) === true;
    });

    assert.ok(refArrayBnode !== undefined, `property shape for "${REF_ARRAY_PROP}" must exist`);

    const nodeValue = namedNodeObject(propShapeQuads, refArrayBnode, SH.node);

    assert.ok(
      nodeValue !== undefined,
      `property shape for "${REF_ARRAY_PROP}" must carry sh:node`
    );
    assert.equal(
      nodeValue,
      ITEM_CLASS_ID,
      `sh:node must point to ${ITEM_CLASS_ID}`
    );
  });

  void it('array-of-string property shape carries sh:datatype xsd:string', () => {
    const stringArrayBnode = bnodeIds.find((id) => {
      return pathIri(propShapeQuads, id)?.endsWith(`#${STRING_ARRAY_PROP}`) === true;
    });

    assert.ok(stringArrayBnode !== undefined, `property shape for "${STRING_ARRAY_PROP}" must exist`);

    const datatypeValue = namedNodeObject(propShapeQuads, stringArrayBnode, SH.datatype);

    assert.ok(
      datatypeValue !== undefined,
      `property shape for "${STRING_ARRAY_PROP}" must carry sh:datatype`
    );
    assert.ok(
      datatypeValue.endsWith('string'),
      `sh:datatype must be xsd:string, got ${datatypeValue}`
    );
  });

  void it('no property shape on the class has sh:path ending in #items', () => {
    const itemsPaths = bnodeIds.filter((id) => {
      return pathIri(propShapeQuads, id)?.endsWith('#items') === true;
    });

    assert.equal(
      itemsPaths.length,
      0,
      `phantom #items property shapes must not exist; found ${itemsPaths.length}`
    );
  });

  void it('class node has exactly the declared properties (no phantom items shape)', () => {
    // The class should have sh:property for "datasets" and "keyword" only — not "items".
    const paths = bnodeIds
      .map((id) => {
        return pathIri(propShapeQuads, id);
      })
      .filter((pathValue): pathValue is string => {
        return pathValue !== undefined;
      });

    const hasDatasets = paths.some((pathValue) => {
      return pathValue.endsWith(`#${REF_ARRAY_PROP}`);
    });
    const hasKeyword = paths.some((pathValue) => {
      return pathValue.endsWith(`#${STRING_ARRAY_PROP}`);
    });
    const hasItems = paths.some((pathValue) => {
      return pathValue.endsWith('#items');
    });

    assert.ok(hasDatasets, `property shape for "${REF_ARRAY_PROP}" must exist`);
    assert.ok(hasKeyword, `property shape for "${STRING_ARRAY_PROP}" must exist`);
    assert.ok(!hasItems, 'phantom "#items" property shape must not exist');
  });
});
