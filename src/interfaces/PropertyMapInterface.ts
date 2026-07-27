import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';

/** An immutable map from property name to the resolved schema graph node. */
export interface PropertyMapInterface extends ReadonlyMap<string, SchemaGraphNodeInterface> {}
