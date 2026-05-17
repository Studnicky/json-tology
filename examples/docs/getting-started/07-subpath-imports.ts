// Everything
import type {
  Compose, JsonTology, Transform, Value
} from '../../../src/index.js';

// Value operations only (no validation graph or ontology)
import type {
  Changeset, Hash, Value as V
} from '../../../src/index.js';

// Schema registry and format validators
import type {
  FormatRegistry, SchemaRegistry
} from '../../../src/schema.js';

// Types and interfaces only (compile-time, no runtime cost)
import type { InferType } from '../../../src/types/index.js';
import type { LoggerInterface } from '../../../src/interfaces/index.js';

void 0 as unknown as [JsonTology, Compose, Transform, Value, V, Hash, Changeset, SchemaRegistry, FormatRegistry, InferType, LoggerInterface];
