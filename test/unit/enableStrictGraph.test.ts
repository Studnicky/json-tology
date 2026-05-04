/**
 * enableInlineWarnings, enableDuplicateDetection, enableStrictGraph — unit tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { SchemaError } from '../../src/errors/SchemaError.js';

const InlineObjectSchema = {
  '$id': 'urn:test:InlineObj',
  'properties': {
    'nested': {
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    }
  },
  'type': 'object'
} as const;

const InlinePrimitiveSchema = {
  '$id': 'urn:test:InlinePrim',
  'properties': {
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    }
  },
  'type': 'object'
} as const;

const CleanSchema = {
  '$id': 'urn:test:Clean',
  'properties': { 'name': { 'type': 'string' } },
  'type': 'object'
} as const;

void describe('enableInlineWarnings flag', () => {
  void it('emits warn via logger when inline-object found', () => {
    const warns: string[] = [];
    const registry = new SchemaRegistry({
      'enableInlineWarnings': true,
      'logger': {
        'debug': (msg: string) => {
          warns.push(msg);
        },
        'error': (msg: string) => {
          warns.push(msg);
        },
        'fatal': (msg: string) => {
          warns.push(msg);
        },
        'info': (msg: string) => {
          warns.push(msg);
        },
        'trace': (msg: string) => {
          warns.push(msg);
        },
        'warn': (msg: string) => {
          warns.push(msg);
        }
      }
    });

    registry.register(InlineObjectSchema as unknown as Record<string, unknown>);
    assert.ok(warns.length > 0, 'warning emitted');
    assert.ok(warns.some((msg) => {
      return msg.includes('inline');
    }), 'warning mentions inline');
  });

  void it('is silent by default (no flags)', () => {
    const warns: string[] = [];
    const registry = new SchemaRegistry({
      'logger': {
        'debug': (msg: string) => {
          warns.push(msg);
        },
        'error': (msg: string) => {
          warns.push(msg);
        },
        'fatal': (msg: string) => {
          warns.push(msg);
        },
        'info': (msg: string) => {
          warns.push(msg);
        },
        'trace': (msg: string) => {
          warns.push(msg);
        },
        'warn': (msg: string) => {
          warns.push(msg);
        }
      }
    });

    registry.register(InlineObjectSchema as unknown as Record<string, unknown>);
    const inlineWarns = warns.filter((msg) => {
      return msg.includes('inline');
    });

    assert.strictEqual(inlineWarns.length, 0, 'no inline warnings in default mode');
  });
});

void describe('enableStrictGraph flag', () => {
  void it('throws SchemaError for inline-object', () => {
    const registry = new SchemaRegistry({ 'enableStrictGraph': true });

    assert.throws(
      () => {
        registry.register(InlineObjectSchema as unknown as Record<string, unknown>);
      },
      (err: unknown) => {
        return err instanceof SchemaError && err.code === 'SCHEMA_STRUCTURE_INVALID';
      }
    );
  });

  void it('throws SchemaError for inline-primitive', () => {
    const registry = new SchemaRegistry({ 'enableStrictGraph': true });

    assert.throws(
      () => {
        registry.register(InlinePrimitiveSchema as unknown as Record<string, unknown>);
      },
      (err: unknown) => {
        return err instanceof SchemaError && err.code === 'SCHEMA_STRUCTURE_INVALID';
      }
    );
  });

  void it('passes for clean schema with no inline shapes', () => {
    const registry = new SchemaRegistry({ 'enableStrictGraph': true });

    assert.doesNotThrow(() => {
      registry.register(CleanSchema as unknown as Record<string, unknown>);
    });
  });

  void it('implies enableInlineWarnings (promotes warn to throw)', () => {
    // With strict, both inline-object and inline-primitive throw
    const strictRegistry = new SchemaRegistry({ 'enableStrictGraph': true });

    assert.throws(() => {
      strictRegistry.register(InlineObjectSchema as unknown as Record<string, unknown>);
    });
    assert.throws(() => {
      strictRegistry.register(InlinePrimitiveSchema as unknown as Record<string, unknown>);
    });
  });

  void it('passes schema with allOf+$ref produced by Compose.extend', async () => {
    const { Compose } = await import('../../src/modules/composition/Compose.js');

    const ParentSchema = {
      '$id': 'urn:test:StrictParent',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const ChildSchema = Compose.extend(ParentSchema, { 'role': { 'type': 'string' } } as const, 'urn:test:StrictChild') as unknown as Record<string, unknown>;

    const registry = new SchemaRegistry({ 'enableStrictGraph': true });

    assert.doesNotThrow(() => {
      registry.register(ParentSchema as unknown as Record<string, unknown>);
      registry.register(ChildSchema);
    });
  });
});

void describe('enableDuplicateDetection flag', () => {
  void it('emits warn when duplicate shape detected at registration', () => {
    const IsbnSchema = {
      '$id': 'urn:test:DupIsbn',
      'pattern': '^\\d{13}$',
      'type': 'string'
    };

    const BookSchema = {
      '$id': 'urn:test:DupBook',
      'properties': {
        'isbn': {
          'pattern': '^\\d{13}$',
          'type': 'string'
        }
      },
      'type': 'object'
    };

    const warns: string[] = [];
    const registry = new SchemaRegistry({
      'enableDuplicateDetection': true,
      'logger': {
        'debug': (msg: string) => {
          warns.push(msg);
        },
        'error': (msg: string) => {
          warns.push(msg);
        },
        'fatal': (msg: string) => {
          warns.push(msg);
        },
        'info': (msg: string) => {
          warns.push(msg);
        },
        'trace': (msg: string) => {
          warns.push(msg);
        },
        'warn': (msg: string) => {
          warns.push(msg);
        }
      }
    });

    registry.register(IsbnSchema);
    registry.register(BookSchema);

    const dupWarns = warns.filter((msg) => {
      return msg.toLowerCase().includes('duplicate');
    });

    assert.ok(dupWarns.length > 0, 'duplicate warning emitted');
  });
});
