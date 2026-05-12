/**
 * HtmlRenderer — GBU test suite
 *
 * Good:  renders a basic graph payload to an HTML string with expected elements
 * Bad:   renders gracefully with empty/null-like graph data
 * Ugly:  renders large graphs, unusual node types, custom metadata
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import type { VizPayloadInterface } from '../../src/interfaces/Viz.js';
import { HtmlRenderer } from '../../src/modules/viz/HtmlRenderer.js';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

function makePayload(overrides?: Partial<VizPayloadInterface>): VizPayloadInterface {
  return {
    'edges': [],
    'nodes': [],
    'schemas': [],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Good paths — happy path rendering
// ---------------------------------------------------------------------------

void describe('HtmlRenderer good paths', () => {
  void it('render returns a non-empty string', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload());

    assert.ok(typeof html === 'string');
    assert.ok(html.length > 0);
  });

  void it('render output starts with <!DOCTYPE html>', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload());

    assert.ok(
      html.trim().startsWith('<!DOCTYPE html>'),
      'output should be a DOCTYPE HTML document'
    );
  });

  void it('render embeds nodes JSON in a script tag', () => {
    const renderer = new HtmlRenderer();
    const payload = makePayload({
      'nodes': [{
        'id': 'https://example.io/User',
        'label': 'User',
        'propertyCount': 3,
        'schemaTypes': ['object']
      }]
    });
    const html = renderer.render(payload);

    assert.ok(html.includes('"https://example.io/User"'), 'node id should appear in output');
    assert.ok(html.includes('"User"'), 'node label should appear in output');
    assert.ok(html.includes('"propertyCount"'), 'propertyCount key should appear');
  });

  void it('render embeds edges JSON in a script tag', () => {
    const renderer = new HtmlRenderer();
    const payload = makePayload({
      'edges': [{
        'label': 'address',
        'source': 'https://example.io/User',
        'target': 'https://example.io/Address'
      }]
    });
    const html = renderer.render(payload);

    assert.ok(html.includes('"address"'), 'edge label should appear');
    assert.ok(html.includes('"https://example.io/User"'), 'edge source should appear');
    assert.ok(html.includes('"https://example.io/Address"'), 'edge target should appear');
  });

  void it('render embeds schemas JSON in a script tag', () => {
    const renderer = new HtmlRenderer();
    const payload = makePayload({
      'schemas': [{
        'id': 'https://example.io/User',
        'jsonSchema': {
          '$id': 'https://example.io/User',
          'type': 'object'
        },
        'owl': [],
        'shacl': [],
        'typescript': 'type User = { name: string; }'
      }]
    });
    const html = renderer.render(payload);

    assert.ok(html.includes('https://example.io/User'), 'schema id should appear');
    assert.ok(html.includes('type User'), 'typescript content should appear');
  });

  void it('render produces valid HTML structure (html, head, body)', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload());

    assert.ok(html.includes('<html'), 'should contain <html');
    assert.ok(html.includes('<head>'), 'should contain <head>');
    assert.ok(html.includes('<body>'), 'should contain <body>');
    assert.ok(html.includes('</html>'), 'should contain </html>');
  });

  void it('render includes meta charset tag', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload());

    assert.ok(html.includes('charset'), 'should include charset meta');
    assert.ok(html.includes('<meta'), 'should include meta tag');
  });

  void it('render includes script tag with const assignments for nodes, edges, schemas', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload());

    assert.ok(html.includes('<script>'), 'should include script tag');
    assert.ok(html.includes('const nodes'), 'should assign nodes');
    assert.ok(html.includes('const edges'), 'should assign edges');
    assert.ok(html.includes('const schemas'), 'should assign schemas');
  });

  void it('render with multiple nodes and edges is consistent', () => {
    const renderer = new HtmlRenderer();
    const payload = makePayload({
      'edges': [
        {
          'label': 'address',
          'source': 'https://example.io/User',
          'target': 'https://example.io/Address'
        },
        {
          'label': 'order',
          'source': 'https://example.io/User',
          'target': 'https://example.io/Order'
        }
      ],
      'nodes': [
        {
          'id': 'https://example.io/User',
          'label': 'User',
          'propertyCount': 3,
          'schemaTypes': ['object']
        },
        {
          'id': 'https://example.io/Address',
          'label': 'Address',
          'propertyCount': 2,
          'schemaTypes': ['object']
        },
        {
          'id': 'https://example.io/Order',
          'label': 'Order',
          'propertyCount': 5,
          'schemaTypes': ['object']
        }
      ]
    });
    const html = renderer.render(payload);

    // All three nodes present
    assert.ok(html.includes('"User"'));
    assert.ok(html.includes('"Address"'));
    assert.ok(html.includes('"Order"'));
    // Both edges present
    assert.ok(html.includes('"address"'));
    assert.ok(html.includes('"order"'));
  });
});

// ---------------------------------------------------------------------------
// Bad paths — empty / degenerate input
// ---------------------------------------------------------------------------

void describe('HtmlRenderer bad paths', () => {
  void it('render with empty payload produces valid HTML (no throw)', () => {
    const renderer = new HtmlRenderer();

    assert.doesNotThrow(() => {
      const html = renderer.render({
        'edges': [],
        'nodes': [],
        'schemas': []
      });

      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('const nodes = []'));
      assert.ok(html.includes('const edges = []'));
      assert.ok(html.includes('const schemas = []'));
    });
  });

  void it('render with empty nodes serializes as empty array in script', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload({ 'nodes': [] }));

    assert.ok(html.includes('const nodes = []'));
  });

  void it('render with empty edges serializes as empty array in script', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload({ 'edges': [] }));

    assert.ok(html.includes('const edges = []'));
  });

  void it('render with empty schemas serializes as empty array in script', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload({ 'schemas': [] }));

    assert.ok(html.includes('const schemas = []'));
  });

  void it('render with node that has zero properties produces valid output', () => {
    const renderer = new HtmlRenderer();
    const html = renderer.render(makePayload({
      'nodes': [{
        'id': 'https://example.io/Empty',
        'label': 'Empty',
        'propertyCount': 0,
        'schemaTypes': []
      }]
    }));

    assert.ok(html.includes('"propertyCount":0'));
    assert.ok(html.includes('"schemaTypes":[]'));
  });
});

// ---------------------------------------------------------------------------
// Ugly paths — large graphs, unusual content
// ---------------------------------------------------------------------------

void describe('HtmlRenderer ugly paths', () => {
  void it('render with 50 nodes produces valid output without throwing', () => {
    const renderer = new HtmlRenderer();
    const nodes = Array.from({ 'length': 50 }, (_, i) => {
      return {
        'id': `https://example.io/Schema${i}`,
        'label': `Schema${i}`,
        'propertyCount': i,
        'schemaTypes': ['object']
      };
    });
    const payload = makePayload({ 'nodes': nodes });

    assert.doesNotThrow(() => {
      const html = renderer.render(payload);

      assert.ok(html.includes('"Schema0"'));
      assert.ok(html.includes('"Schema49"'));
      assert.ok(html.length > 1000, 'large graph should produce substantial output');
    });
  });

  void it('render with 100 edges does not throw', () => {
    const renderer = new HtmlRenderer();
    const edges = Array.from({ 'length': 100 }, (_, i) => {
      return {
        'label': `prop${i}`,
        'source': 'https://example.io/Source',
        'target': `https://example.io/Target${i}`
      };
    });
    const payload = makePayload({ 'edges': edges });

    assert.doesNotThrow(() => {
      const html = renderer.render(payload);

      assert.ok(html.includes('"prop0"'));
      assert.ok(html.includes('"prop99"'));
    });
  });

  void it('render with node having unusual schema types (non-standard values)', () => {
    const renderer = new HtmlRenderer();
    const payload = makePayload({
      'nodes': [{
        'id': 'https://example.io/Mixed',
        'label': 'Mixed',
        'propertyCount': 1,
        'schemaTypes': [
          'object',
          'null'
        ]
      }]
    });
    const html = renderer.render(payload);

    assert.ok(html.includes('"object"'));
    assert.ok(html.includes('"null"'));
  });

  void it('render with node id containing special URI characters is JSON-safe', () => {
    const renderer = new HtmlRenderer();
    const weirdId = 'https://example.io/schema?version=1&type=object#/definitions/Foo';
    const payload = makePayload({
      'nodes': [{
        'id': weirdId,
        'label': 'WeirdSchema',
        'propertyCount': 0,
        'schemaTypes': []
      }]
    });

    // JSON.stringify should handle URI chars safely
    assert.doesNotThrow(() => {
      const html = renderer.render(payload);

      assert.ok(html.includes('WeirdSchema'));
    });
  });

  void it('render produces different HTML for different payloads (not constant output)', () => {
    const renderer = new HtmlRenderer();
    const html1 = renderer.render(makePayload({
      'nodes': [{
        'id': 'https://a.io/A',
        'label': 'A',
        'propertyCount': 1,
        'schemaTypes': ['object']
      }]
    }));
    const html2 = renderer.render(makePayload({
      'nodes': [{
        'id': 'https://b.io/B',
        'label': 'B',
        'propertyCount': 2,
        'schemaTypes': ['object']
      }]
    }));

    assert.notEqual(html1, html2, 'different payloads should produce different HTML');
  });

  void it('render is deterministic for the same payload', () => {
    const renderer = new HtmlRenderer();
    const payload = makePayload({
      'nodes': [{
        'id': 'https://example.io/Stable',
        'label': 'Stable',
        'propertyCount': 2,
        'schemaTypes': ['object']
      }]
    });
    const html1 = renderer.render(payload);
    const html2 = renderer.render(payload);

    assert.equal(html1, html2, 'same payload should produce identical HTML each time');
  });

  void it('render with typescript content containing special characters does not throw', () => {
    const renderer = new HtmlRenderer();
    const tsContent = 'type Widget = { name: string; price: number; tags: string[] }';
    const payload = makePayload({
      'schemas': [{
        'id': 'https://example.io/Widget',
        'jsonSchema': { '$id': 'https://example.io/Widget' },
        'owl': [],
        'shacl': [],
        'typescript': tsContent
      }]
    });

    assert.doesNotThrow(() => {
      const html = renderer.render(payload);

      assert.ok(html.includes('Widget'), 'schema id fragment should appear');
      assert.ok(html.includes('type Widget'), 'typescript content should appear');
    });
  });
});
