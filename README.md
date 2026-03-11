# json-tology

A JSON-Schema type system + ontology builder for TypeScript projects.

Extracts reusable validation and entity building patterns from the arcade-blaster VSCode extension into a standalone npm package.

## Features

- **Schema Registry**: Centralized AJV instance with smart duplicate detection (FNV-1a hashing)
- **Unified Register API**: Accept single schema or array - register() handles both
- **Entity Builder**: Build typed instances with schema defaults
- **Schema Loader**: Recursively load schemas from directories with error reporting
- **Ontology Builder**: Generate JSON-LD and N3 from parameterized configuration
- **CURIE Expander**: Expand compact URIs to full IRIs
- **TypeScript-first**: Full type safety with `json-schema-to-ts`

## Installation

```bash
npm install json-tology
```

## Quick Start

### Runtime Validation (Direct)

Use the same schemas for types and runtime validation:

```typescript
import { Validator } from 'json-tology/schema';
import type { FromSchema } from 'json-schema-to-ts';

// Declare schema as const for type derivation
const UserSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
  },
  required: ['id', 'name'],
} as const;

// Derive type from schema
type User = FromSchema<typeof UserSchema>;

const validator = new Validator();

// Validate I/O at runtime using the same schema as types
const result = validator.validateTyped<User>(UserSchema, incomingData);

if (result.valid) {
  const user: User = result.data;
  // ... use user with full type safety
} else {
  console.error('Invalid user:', result.errors);
}

// Other validation APIs
validator.isValid(UserSchema, data);           // boolean check
validator.assert(UserSchema, data, 'User');   // throw on invalid
```

### Schema Registry & Validation

For bulk validation with pre-registered schemas:

```typescript
import { SchemaRegistry } from 'json-tology/schema';

const registry = new SchemaRegistry();

// Register - accepts single schema or array
const UserSchema = {
  $id: 'https://example.io/user',
  type: 'object',
  properties: { name: { type: 'string' }, age: { type: 'number' } },
  required: ['name'],
};

const ProductSchema = {
  $id: 'https://example.io/product',
  type: 'object',
  properties: { sku: { type: 'string' }, price: { type: 'number' } },
};

registry.register(UserSchema);                    // Single
registry.register([ProductSchema]);               // Array
registry.register([...moreSchemas]);              // Batch

// Safe to call multiple times - idempotent registration
registry.register(UserSchema);  // No warning

// Validate data
const errors = registry.validate('https://example.io/user', {
  name: 'Alice',
  age: 30,
});

if (errors.length === 0) {
  console.log('Valid!');
}
```

**Features**:
- ✅ Unified `register()` accepts single schema or array
- ✅ Idempotent - safe to call multiple times with same schemas
- ✅ Smart duplicate detection using fast FNV-1a hashing
- ✅ Warns on structural duplicates or ID conflicts
- ✅ Configurable logger for warnings

### Loading Schemas from Files/Directories

Use `SchemaLoader` to load schemas from the file system with error reporting:

```typescript
import { SchemaLoader, consoleLogger } from 'json-tology/schema';
import { SchemaRegistry } from 'json-tology/schema';

// Load all schemas from a directory recursively
const loader = new SchemaLoader(consoleLogger); // or pass custom logger
const [schemas, result] = loader.loadDirectory('./schemas');

console.log(`Loaded ${result.successful}, failed ${result.failed}`);

if (result.errors.length > 0) {
  result.errors.forEach((err) => {
    console.error(`${err.file}: ${err.message}`);
  });
}

// Register loaded schemas
const registry = new SchemaRegistry();
registry.registerAll(schemas);

// Now validate using the registry
registry.validate('https://example.io/user', userData);
```

**SchemaLoader Features**:
- ✅ Recursively scans directories for `.json` files
- ✅ Validates schema structure (`$id` required, has type/properties/$defs)
- ✅ Detects duplicate schema IDs
- ✅ Reports all errors with file location and reason
- ✅ Customizable logger (console, silent, or your own)
- ✅ Optional stop-on-first-error mode
- ✅ File pattern filtering

### Entity Building with Defaults

```typescript
import { SchemaSystem } from 'json-tology/schema';
import type { FromSchema } from 'json-schema-to-ts';

const ConfigSchema = {
  $id: 'https://example.io/config',
  type: 'object',
  properties: {
    debug: { type: 'boolean', default: false },
    timeout: { type: 'number', default: 5000 },
    name: { type: 'string' },
  },
  required: ['name'],
} as const;

type ConfigType = FromSchema<typeof ConfigSchema>;

const system = new SchemaSystem();
system.register(ConfigSchema);

// Build with defaults
const config = system.build<ConfigType>(
  'https://example.io/config',
  { name: 'my-app' }
);

console.log(config);
// { name: 'my-app', debug: false, timeout: 5000 }
```

### Ontology Generation

```typescript
import { OntologyBuilder } from 'json-tology/ontology';

const ontology = new OntologyBuilder({
  baseIRI: 'https://my-project.io',
  prefixes: {
    ex: 'https://example.io/ns#',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  },
  graphBuilders: [
    (graph) => {
      graph.push({
        '@id': 'ex:Thing',
        '@type': 'owl:Class',
        'rdfs:label': 'Thing',
      });
    },
  ],
});

// Generate N3
console.log(ontology.n3());

// Generate JSON-LD
console.log(ontology.jsonLd());
```

### CURIE Expansion

```typescript
import { CurieExpander } from 'json-tology/ontology';

const expander = new CurieExpander({
  ex: 'https://example.io/ns#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
});

expander.expand('ex:Thing');
// → '<https://example.io/ns#Thing>'

expander.expandTokens('ex:Thing rdf:type owl:Class .');
// → '<https://example.io/ns#Thing> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> owl:Class .'
```

## API Reference

### SchemaLoader

Load schemas from the file system with error reporting:

- `loadSchema(filePath)` - Load single schema from file, returns schema or null
- `loadDirectory(dirPath, options?)` - Load all schemas from directory recursively, returns `[schemas, SchemaLoadResult]`

Options:
- `stopOnError?: boolean` - Stop on first error (default: false, continue loading)
- `filePattern?: RegExp` - Filter files to load (default: `/\.json$/i`)

Logging:
- Pass `consoleLogger` for console output
- Pass custom logger implementing `SchemaLogger` interface
- Default: silent (no output)

Error types: `'not-json'` | `'invalid-json'` | `'no-id'` | `'duplicate-id'` | `'invalid-schema'` | `'unknown'`

### Validator

Direct validation without pre-registration:

- `validate(schema, data)` - Validate, returns error strings array
- `validateTyped<T>(schema, data)` - Validate, returns `ValidationResult<T>`
- `isValid(schema, data)` - Check validity (boolean)
- `assert(schema, data, context?)` - Validate, throw on failure

### SchemaRegistry

Pre-register schemas for batch operations:

- `register(schema)` - Register a single schema by `$id`
- `registerAll(schemas)` - Register multiple schemas
- `get(schemaId)` - Retrieve a schema
- `validate(schemaId, data)` - Validate data, returns array of error strings
- `validateAt(schemaId, pointer, data)` - Validate at a JSON Pointer

### EntityBuilder

Build instances with schema defaults:

- `build<T>(schemaId, partial?)` - Build instance with defaults and merge partial

### SchemaSystem

Combined API for registry + builder convenience:

- `register()`, `registerAll()`, `get()`
- `validate()`, `validateAt()`
- `build<T>()`

### OntologyBuilder

- `context()` - Get prefix map
- `raw()` - Get raw graph data
- `jsonLdObject()` - Generate JSON-LD object
- `jsonLd()` - Generate JSON-LD string
- `n3()` - Generate N3 with prefix declarations

### CurieExpander

- `expand(value)` - Expand CURIE to full IRI
- `expandTokens(n3)` - Expand CURIEs in N3 text

## Types

Import base types from `json-tology/types`:

```typescript
import { BaseTypes } from 'json-tology/types';

type Response<T> = BaseTypes.ResponseInterface<T>;
type Result<T> = BaseTypes.ResultInterface<T>;
```

## Package Exports

```json
{
  ".": "Main entry point (all modules)",
  "./schema": "SchemaRegistry, EntityBuilder, SchemaSystem",
  "./ontology": "OntologyBuilder, CurieExpander",
  "./types": "BaseTypes"
}
```

## License

MIT
