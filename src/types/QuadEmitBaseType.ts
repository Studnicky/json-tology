import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';

/** Shared base for emit-helper arg types that accumulate quads with an optional CURIE expander. */
export type QuadEmitBaseType = {
  'curie': CurieInterface | undefined;
  'quads': QuadInterface[];
};
