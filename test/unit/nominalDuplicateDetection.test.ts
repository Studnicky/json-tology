/**
 * Nominal-aware duplicate detection — unit tests.
 *
 * Covers the three behavioral contracts introduced by the nominal-aware
 * duplicate detection fix (designs/0005 §2):
 *
 *   (a) Two distinct top-level named schemas with identical stripped bodies
 *       do NOT trigger SCHEMA_DUPLICATE_SHAPE — they are nominally distinct.
 *
 *   (b) A transform-bearing primitive does not collide with a plain schema
 *       that has an identical JSON body.
 *
 *   (c) A genuinely duplicated anonymous inline sub-shape IS still reported.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';

import { JsonTology } from '../../src/JsonTology.js';
import { Transform } from '../../src/modules/transform/Transform.js';

// ---------------------------------------------------------------------------
// (a) Two distinct named primitives with identical stripped bodies
// ---------------------------------------------------------------------------

void describe('nominal duplicate detection — named primitive collision', { 'concurrency': true }, () => {
  void it('two top-level subClassOf primitives with identical bodies do not throw SCHEMA_DUPLICATE_SHAPE', () => {
    // Both schemas erase to { allOf: [{ $ref: 'urn:nd:StringValue' }] }
    // after $id is stripped. Under the old algorithm this was a contested hash;
    // under the new algorithm it is detected as nominally contested and removed
    // from the match cache so no SCHEMA_DUPLICATE_SHAPE is thrown.
    const StringValue = {
      '$id': 'urn:nd:StringValue',
      'type': 'string'
    } as const;

    const IriString = {
      '$id': 'urn:nd:IriString',
      'allOf': [{ '$ref': 'urn:nd:StringValue' }]
    } as const;

    const Slug = {
      '$id': 'urn:nd:Slug',
      'allOf': [{ '$ref': 'urn:nd:StringValue' }]
    } as const;

    assert.doesNotThrow(() => {
      const jt = JsonTology.create({ 'baseIRI': 'urn:nd' });

      jt.registry.set(StringValue);
      jt.registry.set(IriString);
      jt.registry.set(Slug);
    }, 'registering two subClassOf primitives with identical bodies must not throw');
  });

  void it('two plain top-level named string schemas with identical bodies do not throw', () => {
    // Simpler case: no allOf, just { type: 'string' } with different $ids.
    // Both stripped bodies are identical → would have been SCHEMA_DUPLICATE_SHAPE.
    const IriStr = {
      '$id': 'urn:nd2:IriStr',
      'type': 'string'
    } as const;

    const SlugStr = {
      '$id': 'urn:nd2:SlugStr',
      'type': 'string'
    } as const;

    assert.doesNotThrow(() => {
      const jt = JsonTology.create({ 'baseIRI': 'urn:nd2' });

      jt.registry.set(IriStr);
      jt.registry.set(SlugStr);
    }, 'two plain named string schemas with identical bodies must not throw');
  });

  void it('findDuplicates returns empty for two named primitives with identical bodies', () => {
    const A = {
      '$id': 'urn:nd3:A',
      'type': 'string'
    } as const;

    const B = {
      '$id': 'urn:nd3:B',
      'type': 'string'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'urn:nd3',
      'enableStrictGraph': false
    });

    jt.registry.set(A);
    jt.registry.set(B);

    const dups = jt.registry.findDuplicates();

    assert.equal(dups.length, 0, 'two top-level named schemas with identical bodies must not appear in findDuplicates');
  });
});

// ---------------------------------------------------------------------------
// (b) Transform-bearing primitive does not collide with a plain schema
// ---------------------------------------------------------------------------

void describe('nominal duplicate detection — transform identity', { 'concurrency': true }, () => {
  void it('a transform-bearing primitive does not collide with a plain schema of the same body', () => {
    const PlainToken = {
      '$id': 'urn:nd4:PlainToken',
      'type': 'string'
    } as const;

    // BearerToken has the same JSON body but carries a decoder transform.
    const BearerToken = {
      '$id': 'urn:nd4:BearerToken',
      'type': 'string' as const
    };

    Transform.create(BearerToken, {
      'decode': (raw: string) => {
        return raw;
      },
      'encode': (wire: string) => {
        return wire;
      }
    });

    assert.doesNotThrow(() => {
      const jt = JsonTology.create({ 'baseIRI': 'urn:nd4' });

      // Plain schema registered first so it wins the uncontested hash.
      jt.registry.set(PlainToken);
      // Transform-bearing schema: different nominal hash (TRANSFORM_SUFFIX)
      // so the two do NOT share a contested hash → no false positive.
      jt.registry.set(BearerToken);
    }, 'transform-bearing and plain schemas with identical bodies must not throw');
  });

  void it('findDuplicates does not report a transform-bearing schema as a duplicate of a plain one', () => {
    const PlainTag = {
      '$id': 'urn:nd5:PlainTag',
      'type': 'string'
    } as const;

    const TransformTag = {
      '$id': 'urn:nd5:TransformTag',
      'type': 'string' as const
    };

    Transform.create(TransformTag, {
      'decode': (raw: string) => {
        return raw;
      },
      'encode': (wire: string) => {
        return wire;
      }
    });

    const jt = JsonTology.create({
      'baseIRI': 'urn:nd5',
      'enableStrictGraph': false
    });

    jt.registry.set(PlainTag);
    jt.registry.set(TransformTag);

    const dups = jt.registry.findDuplicates();

    assert.equal(dups.length, 0, 'transform-bearing vs plain schema must not appear in findDuplicates');
  });
});

// ---------------------------------------------------------------------------
// (c) Genuine inline duplicate IS still detected
// ---------------------------------------------------------------------------

void describe('nominal duplicate detection — genuine inline duplicate preserved', { 'concurrency': true }, () => {
  void it('an anonymous inline sub-shape that matches a unique top-level schema is still flagged', () => {
    // EmailSchema is the only schema with { format: 'email', type: 'string' }.
    // PersonSchema embeds the same shape inline (no $id, no $ref) → real duplicate.
    const EmailSchema = {
      '$id': 'urn:nd6:Email',
      'format': 'email',
      'type': 'string'
    } as const;

    const PersonSchema = {
      '$id': 'urn:nd6:Person',
      'properties': {
        'email': {
          'format': 'email',
          'type': 'string'
        },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'urn:nd6',
      'enableStrictGraph': false
    });

    jt.registry.set(EmailSchema);
    jt.registry.set(PersonSchema);

    const dups = jt.registry.findDuplicates();

    assert.ok(dups.length > 0, 'inline email shape without $id must still be reported as duplicate');

    const emailDup = dups.find((entry) => {
      return entry.equivalentTo === EmailSchema.$id;
    });

    assert.ok(emailDup !== undefined, 'duplicate must reference EmailSchema as the canonical');
    assert.ok(emailDup.pointer.includes('email'), 'pointer must identify the email property path');
  });

  void it('strict graph throws SCHEMA_DUPLICATE_SHAPE for a genuine inline duplicate', () => {
    const TagSchema = {
      '$id': 'urn:nd7:Tag',
      'pattern': '^[a-z]+$',
      'type': 'string'
    } as const;

    const ArticleSchema = {
      '$id': 'urn:nd7:Article',
      'properties': {
        // Same shape as TagSchema — should be a $ref, not inlined
        'primaryTag': {
          'pattern': '^[a-z]+$',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;

    assert.throws(
      () => {
        const jt = JsonTology.create({ 'baseIRI': 'urn:nd7' });

        jt.registry.set(TagSchema);
        jt.registry.set(ArticleSchema);
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('Duplicate schema shapes') || err.message.includes('inline'),
          `unexpected error message: ${err.message}`
        );

        return true;
      },
      'strict graph must throw SCHEMA_DUPLICATE_SHAPE for a genuine inline duplicate'
    );
  });
});
