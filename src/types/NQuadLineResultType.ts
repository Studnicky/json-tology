import type { QuadInterface } from '../interfaces/QuadInterface.js';

/** A parsed N-Quad line result — a single RDF quad, or undefined for empty/comment lines. */
export type NQuadLineResultType = QuadInterface | undefined;
