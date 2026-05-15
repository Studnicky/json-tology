import type { CurieInterface } from './Curie.js';
import type { QuadInterface } from './Quad.js';
import type { SchemaGraphNodeInterface } from './SchemaGraph.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface IriMinterInterface {
  mint(classId: string, value: unknown, path: string, depth: number): string;
}

export interface ProjectInstanceArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'data': Record<string, unknown>;
  readonly 'depth': number;
  readonly 'graph': SchemaGraphInterface;
  readonly 'minter': IriMinterInterface;
  readonly 'node': SchemaGraphNodeInterface;
  readonly 'path': string;
  readonly 'quads': QuadInterface[];
  readonly 'visited': WeakSet<object>;
}

export interface ProjectPropertyArgs {
  readonly 'curie': CurieInterface | undefined;
  readonly 'depth': number;
  readonly 'graph': SchemaGraphInterface;
  readonly 'instanceIri': string;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'propertyIRI': string;
  readonly 'propertyNode': SchemaGraphNodeInterface;
  readonly 'propertySemantics': { 'format': string | undefined;
    'itemsNode': SchemaGraphNodeInterface | undefined };
  readonly 'quads': QuadInterface[];
  readonly 'value': unknown;
  readonly 'visited': WeakSet<object>;
}
