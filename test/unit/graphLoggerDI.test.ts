/**
 * Graph-layer logger DI.
 *
 * Verifies that SchemaGraph (instance), GraphArtifact (static), and RefDecoder
 * (static) emit `[Component.operation]`-scoped log messages at their notable
 * failure branches when a logger is supplied, and that the silent default keeps
 * those paths working when no logger is given (including graphs built via the
 * constructor-bypassing `fromNormIR` factory).
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  JsonTology, Transform
} from '../../src/index.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { GraphArtifact } from '../../src/modules/graph/GraphArtifact.js';
import { GraphError } from '../../src/errors/GraphError.js';
import type { LoggerInterface } from '../../src/interfaces/Logger.js';

type CapturedType = {
  'level': string;
  'msg': string;
};

function capturingLogger(): {
  'logger': LoggerInterface;
  'messages': CapturedType[];
} {
  const messages: CapturedType[] = [];
  const record = (level: string): ((msg: string) => void) => {
    return (msg: string): void => {
      messages.push({
        level,
        msg
      });
    };
  };

  return {
    'logger': {
      'debug': record('debug'),
      'error': record('error'),
      'fatal': record('fatal'),
      'info': record('info'),
      'trace': record('trace'),
      'warn': record('warn')
    },
    messages
  };
}

const ObjectSchema = {
  '$id': 'https://example.io/Obj',
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void describe('SchemaGraph logger DI', () => {
  void it('logs a debug scope on a pointer-not-found resolution', () => {
    const {
      logger, messages
    } = capturingLogger();
    const graph = new SchemaGraph(ObjectSchema, { logger });

    assert.throws(
      () => {
        return graph.resolvePointer('/nonexistent');
      },
      (error: unknown) => {
        return error instanceof GraphError;
      }
    );
    assert.ok(
      messages.some((m) => {
        return m.level === 'debug' && m.msg.includes('[SchemaGraph.resolvePointer]') && m.msg.includes('not found');
      }),
      'expected a debug log scoped to SchemaGraph.resolvePointer'
    );
  });

  void it('logs a debug scope on an invalid JSON Pointer', () => {
    const {
      logger, messages
    } = capturingLogger();
    const graph = new SchemaGraph(ObjectSchema, { logger });

    assert.throws(() => {
      return graph.resolvePointer('no-leading-slash');
    });
    assert.ok(messages.some((m) => {
      return m.level === 'debug' && m.msg.includes('[SchemaGraph.resolvePointer]') && m.msg.includes('invalid');
    }));
  });

  void it('logs a debug scope on an unknown anchor', () => {
    const {
      logger, messages
    } = capturingLogger();
    const graph = new SchemaGraph(ObjectSchema, { logger });

    assert.throws(() => {
      return graph.resolveFragment('missing-anchor');
    });
    assert.ok(messages.some((m) => {
      return m.level === 'debug' && m.msg.includes('[SchemaGraph.resolveFragment]');
    }));
  });

  void it('defaults to a silent logger and does not throw on construction', () => {
    const graph = new SchemaGraph(ObjectSchema);

    assert.throws(() => {
      return graph.resolvePointer('/nonexistent');
    });
  });
});

void describe('GraphArtifact logger DI', () => {
  void it('warns on a stale schema-hash mismatch and still throws ARTIFACT_STALE', () => {
    const graph = new SchemaGraph(ObjectSchema);
    const artifact = GraphArtifact.toArtifact(graph);
    const stale = {
      ...artifact,
      'metadata': {
        ...artifact.metadata,
        'schemaHash': 'DEFINITELY_WRONG_HASH'
      }
    };
    const {
      logger, messages
    } = capturingLogger();

    assert.throws(
      () => {
        return GraphArtifact.fromArtifact(stale, logger);
      },
      (error: unknown) => {
        return error instanceof GraphError && error.code === 'ARTIFACT_STALE';
      }
    );
    assert.ok(
      messages.some((m) => {
        return m.level === 'warn' && m.msg.includes('[GraphArtifact.fromArtifact]') && m.msg.includes('hash mismatch');
      }),
      'expected a warn log scoped to GraphArtifact.fromArtifact'
    );
  });

  void it('round-trips a valid artifact through fromArtifact (fromNormIR sets a silent logger)', () => {
    const graph = new SchemaGraph(ObjectSchema);
    const artifact = GraphArtifact.toArtifact(graph);
    const rebuilt = GraphArtifact.fromArtifact(artifact);

    // The rebuilt graph went through fromNormIR (constructor-bypassing); a
    // resolution failure must not crash on an undefined logger.
    assert.throws(() => {
      return rebuilt.resolvePointer('/nonexistent');
    });
  });
});

const ThrowingDecodeSchema = Transform.create(
  {
    '$id': 'https://example.io/Throwing',
    'type': 'string'
  } as const,
  {
    'decode': (): string => {
      throw new Error('decode boom');
    },
    'encode': (value): string => {
      return value;
    }
  }
);

const HostSchema = {
  '$id': 'https://example.io/Host',
  'properties': { 'token': { '$ref': 'https://example.io/Throwing' } },
  'required': ['token'],
  'type': 'object'
} as const;

void describe('RefDecoder logger DI (end-to-end through the registry)', () => {
  void it('logs an error scope when a $ref decoder throws during instantiate', () => {
    const {
      logger, messages
    } = capturingLogger();
    const jt = JsonTology.create({
      'baseIRI': 'https://example.io',
      logger,
      'schemas': [
        ThrowingDecodeSchema,
        HostSchema
      ] as const
    });

    assert.throws(() => {
      return jt.instantiate(HostSchema.$id, { 'token': 'anything' });
    });
    assert.ok(
      messages.some((m) => {
        return m.level === 'error' && m.msg.includes('[RefDecoder.run]');
      }),
      'expected an error log scoped to RefDecoder.run, proving registry -> RefDecoder logger wiring'
    );
  });
});
