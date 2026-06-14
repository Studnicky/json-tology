import type { CurieInterface } from '../interfaces/Curie.js';
import type { QuadInterface } from '../interfaces/Quad.js';

/** Shared base for emit-helper arg types that accumulate quads with an optional CURIE expander. */
export type QuadEmitBaseType = {
  readonly 'curie': CurieInterface | undefined;
  readonly 'quads': QuadInterface[];
};
