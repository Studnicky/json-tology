import type { GraphEngineOptionsInterface } from '../interfaces/GraphEngine.js';

export type EffectiveOptionsType = Pick<GraphEngineOptionsInterface, 'lookupSchema'> & Required<Omit<GraphEngineOptionsInterface, 'formatRegistry' | 'keywords' | 'lookupSchema'>>;
