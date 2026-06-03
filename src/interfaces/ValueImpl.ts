import type { ParseOutputType } from '../types/Transform.js';

export interface ValueInterface<TRefs = Record<never, never>> {
  cast<K extends keyof TRefs & string>(schemaId: K, data: unknown): ParseOutputType<TRefs[K], TRefs>;
  cast(schemaId: string, data: unknown): unknown;
  clean<K extends keyof TRefs & string>(schemaId: K, data: unknown): ParseOutputType<TRefs[K], TRefs>;
  clean(schemaId: string, data: unknown): unknown;
  convert<K extends keyof TRefs & string>(schemaId: K, data: unknown): ParseOutputType<TRefs[K], TRefs>;
  convert(schemaId: string, data: unknown): unknown;
  create<K extends keyof TRefs & string>(schemaId: K): ParseOutputType<TRefs[K], TRefs>;
  create(schemaId: string): unknown;
  instantiate<K extends keyof TRefs & string>(schemaId: K, data: unknown): ParseOutputType<TRefs[K], TRefs>;
  instantiate(schemaId: string, data: unknown): unknown;
}
