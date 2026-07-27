import type { CurieInterface } from './CurieInterface.js';
import type { QuadInterface } from './QuadInterface.js';

/** Shared base for emit-helper arg types that accumulate quads with an optional CURIE expander. */
export interface QuadEmitBaseInterface {
  'curie': CurieInterface | undefined;
  'quads': QuadInterface[];
}
