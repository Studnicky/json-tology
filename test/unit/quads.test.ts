/**
 * toQuads / fromQuads — v2 iriFor / graphIRI / deskolemize integration tests.
 *
 * Covers the full skolemization design landed in feat/skolemizer-v2:
 *   - iriFor as string (root-only override)
 *   - iriFor as 'blank-node' (every subject is _:b<n>)
 *   - iriFor as Skolemize.fromProperty / Skolemize.wellKnownGenid
 *   - iriFor function ctx + memoization
 *   - registry-level iriFor / defaultGraphIRI / defaultDeskolemize
 *   - fromQuads round-trip with deskolemize
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  JsonTology, Skolemize
} from '../../src/index.js';
// SkolemizeFnType is the function-shape contract for IRI minting; consumed via the public iriFor option but the type alias itself is internal.
import type { SkolemizeFnType } from '../../src/types/Skolemize.js';

const UserSchema = {
  '$id': 'https://example.com/User',
  'properties': {
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const TeamSchema = {
  '$defs': {
    'Member': {
      'properties': {
        'name': { 'type': 'string' },
        'role': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    }
  },
  '$id': 'https://example.com/Team',
  'properties': {
    'lead': { '$ref': '#/$defs/Member' },
    'members': {
      'items': { '$ref': '#/$defs/Member' },
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'lead',
    'name'
  ],
  'type': 'object'
} as const;

const noopSkolemize: SkolemizeFnType = () => {
  return;
};

void describe('toQuads — iriFor strategies — Good/Bad/Ugly', () => {
  void it('iriFor string overrides root subject; nested subjects fall through to default', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    const quads = jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }, { 'iriFor': 'https://example.com/teams/platform' });

    const rootHits = quads.filter((quad) => {
      return quad.subject === 'https://example.com/teams/platform';
    });

    assert.ok(rootHits.length > 0, 'root override should be applied');
    assert.equal(rootHits[0].subject, 'https://example.com/teams/platform');

    const nestedSubjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    nestedSubjects.delete('https://example.com/teams/platform');
    for (const subject of nestedSubjects) {
      assert.match(subject, /\/instances\//u, `nested subject should fall through, got ${subject}`);
    }
  });

  void it("iriFor 'blank-node' emits _:b<n> for every subject; counter resets per call", () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    const quads = jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'members': [
        { 'name': 'Eve' },
        { 'name': 'Finn' }
      ],
      'name': 'Platform'
    }, { 'iriFor': 'blank-node' });

    const subjects = new Set(quads.map((quad) => {
      return quad.subject;
    }));

    for (const subject of subjects) {
      assert.match(subject, /^_:b\d+$/u, `subject should be a blank node: ${subject}`);
    }

    const jtUser = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [UserSchema]
    });
    const quadsA = jtUser.toQuads(UserSchema, { 'name': 'Alice' }, { 'iriFor': 'blank-node' });
    const quadsB = jtUser.toQuads(UserSchema, { 'name': 'Bob' }, { 'iriFor': 'blank-node' });

    assert.equal(quadsA[0].subject, '_:b0');
    assert.equal(quadsB[0].subject, '_:b0');
  });

  void it('Skolemize.fromProperty + wellKnownGenid strategies', () => {
    const DocSchema = {
      '$id': 'https://example.com/Doc',
      'properties': {
        'id': { 'type': 'string' },
        'title': { 'type': 'string' }
      },
      'required': ['id'],
      'type': 'object'
    } as const;
    const jtDoc = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [DocSchema]
    });
    const docQuads = jtDoc.toQuads(DocSchema, {
      'id': 'doc-42',
      'title': 'Hello'
    }, { 'iriFor': Skolemize.fromProperty('id', { 'baseIRI': 'https://example.com/docs' }) });
    const docSubjects = new Set(docQuads.map((quad) => {
      return quad.subject;
    }));

    assert.equal(docSubjects.has('https://example.com/docs/doc-42'), true);

    // fromProperty: fallback called for nodes missing the property
    const jtTeam = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    let fallbackCalls = 0;
    const fallback: SkolemizeFnType = () => {
      fallbackCalls++;

      return;
    };

    jtTeam.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }, {
      'iriFor': Skolemize.fromProperty('id', {
        'baseIRI': 'https://example.com/by-id',
        fallback
      })
    });
    assert.equal(fallbackCalls, 2, 'fallback called once per object lacking id: root + lead');

    // wellKnownGenid: every subject contains /.well-known/genid/
    const wkQuads = jtTeam.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'members': [{ 'name': 'Eve' }],
      'name': 'Platform'
    }, { 'iriFor': Skolemize.wellKnownGenid('https://example.com') });

    for (const subject of new Set(wkQuads.map((quad) => {
      return quad.subject;
    }))) {
      assert.match(subject, /\/\.well-known\/genid\//u);
    }
  });
});

void describe('toQuads — iriFor function ctx + registry-level config — Good/Bad/Ugly', () => {
  void it('ctx receives correct path/depth/value; memoizes per reference', () => {
    const recorded: Array<{ 'depth': number;
      'path': string;
      'value': unknown }> = [];
    const recorder: SkolemizeFnType = (ctx) => {
      recorded.push({ ...ctx });

      return;
    };
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });

    jt.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'members': [{ 'name': 'Eve' }],
      'name': 'Platform'
    }, { 'iriFor': recorder });

    assert.equal(recorded.length, 3, 'recorder called once per object: root + lead + member');
    const root = recorded.find((entry) => {
      return entry.depth === 0;
    });

    assert.notEqual(root, undefined, 'root call has depth 0');
    assert.equal(root.path, '');
    const lead = recorded.find((entry) => {
      return entry.path === '/lead';
    });

    assert.notEqual(lead, undefined, 'lead path observed');
    assert.equal(lead.depth, 1, 'lead depth is 1');

    // memoization: 4 distinct object subjects → 4 calls
    const data = {
      'lead': { 'name': 'Dana' },
      'members': [
        { 'name': 'Eve' },
        { 'name': 'Finn' }
      ],
      'name': 'Platform'
    };
    let calls = 0;
    const counter: SkolemizeFnType = () => {
      calls++;

      return;
    };

    jt.toQuads(TeamSchema, data, { 'iriFor': counter });
    assert.equal(calls, 4);
  });

  void it('registry-level iriFor / defaultGraphIRI / blank-node config; noopSkolemize fallback', () => {
    const jtBase = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [UserSchema]
    });

    // inherits registry iriFor
    const jt1 = JsonTology.create({
      'baseIRI': 'https://example.com',
      'iriFor': 'https://example.com/registry-default',
      'schemas': [UserSchema]
    });

    assert.equal(new Set(jt1.toQuads(UserSchema, { 'name': 'Alice' }).map((quad) => {
      return quad.subject;
    })).has('https://example.com/registry-default'), true);

    // per-call overrides registry
    const q2 = jt1.toQuads(UserSchema, { 'name': 'Alice' }, { 'iriFor': 'https://example.com/per-call' });
    const s2 = new Set(q2.map((quad) => {
      return quad.subject;
    }));

    assert.equal(s2.has('https://example.com/per-call'), true);
    assert.equal(s2.has('https://example.com/registry-default'), false);

    // inherits registry defaultGraphIRI
    const jt3 = JsonTology.create({
      'baseIRI': 'https://example.com',
      'defaultGraphIRI': 'https://example.com/g/default',
      'schemas': [UserSchema]
    });

    for (const quad of jt3.toQuads(UserSchema, { 'name': 'Alice' })) {
      assert.equal(quad.graph, 'https://example.com/g/default');
    }

    // per-call graphIRI overrides registry
    for (const quad of jt3.toQuads(UserSchema, { 'name': 'Alice' }, { 'graphIRI': 'https://example.com/g/override' })) {
      assert.equal(quad.graph, 'https://example.com/g/override');
    }

    // blank-node registry-level config produces fresh counters per call
    const jt5 = JsonTology.create({
      'baseIRI': 'https://example.com',
      'iriFor': 'blank-node',
      'schemas': [UserSchema]
    });

    assert.equal(jt5.toQuads(UserSchema, { 'name': 'A' })[0].subject, '_:b0');
    assert.equal(jt5.toQuads(UserSchema, { 'name': 'B' })[0].subject, '_:b0');

    // noopSkolemize falls back to default IRI minter
    const jtTeam = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    const noopQuads = jtTeam.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }, { 'iriFor': noopSkolemize });
    const instanceSubjects = new Set(noopQuads.filter((quad) => {
      return quad.subject.includes('/instances/');
    }).map((quad) => {
      return quad.subject;
    }));

    assert.equal(instanceSubjects.size, 2, 'noopSkolemize falls through to default minter for root + lead');

    void jtBase;
  });
});

void describe('fromQuads — deskolemize round-trip — Good/Bad/Ugly', () => {
  void it('reproduces input via wellKnownGenid; registry-level defaultDeskolemize; passthrough', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [UserSchema]
    });
    const input = {
      'email': 'a@x.com',
      'name': 'Alice'
    };

    // Good: reproduces input when paired with wellKnownGenid
    const quads = jt.toQuads(UserSchema, input, { 'iriFor': Skolemize.wellKnownGenid('https://example.com') });
    const lifted = jt.fromQuads(UserSchema.$id, quads, { 'deskolemize': true });

    assert.ok(lifted.length > 0);
    const first = lifted[0] as Record<string, unknown>;

    assert.equal(first.name, 'Alice');
    assert.equal(first.email, 'a@x.com');

    // Good: registry-level defaultDeskolemize is honored
    const jt2 = JsonTology.create({
      'baseIRI': 'https://example.com',
      'defaultDeskolemize': true,
      'schemas': [UserSchema]
    });
    const quads2 = jt2.toQuads(UserSchema, input, { 'iriFor': Skolemize.wellKnownGenid('https://example.com') });
    const lifted2 = jt2.fromQuads(UserSchema.$id, quads2);

    assert.ok(lifted2.length > 0);
    assert.equal((lifted2[0] as Record<string, unknown>).name, 'Alice');

    // Ugly: noopSkolemize falls back to default IRI minter (2 instance subjects: root + lead)
    const jtTeam = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [TeamSchema]
    });
    const noopQuads = jtTeam.toQuads(TeamSchema, {
      'lead': { 'name': 'Dana' },
      'name': 'Platform'
    }, { 'iriFor': noopSkolemize });
    const instanceSubjects = new Set(noopQuads.filter((quad) => {
      return quad.subject.includes('/instances/');
    }).map((quad) => {
      return quad.subject;
    }));

    assert.equal(instanceSubjects.size, 2, 'noopSkolemize falls through to default minter for root + lead');
  });
});
