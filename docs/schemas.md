# Schema Management

json-tology provides schema registration, introspection, file loading, and custom format validators. Schemas require a `$id` URI and at least one structural keyword (`type`, `properties`, `$ref`, etc.).

## Simple

The registry accepts schemas at construction and exposes `has()`, `get()`, and `list()` for lookup.

```ts
import { JsonTology } from 'json-tology';

const TagSchema = {
  $id: 'https://example.com/Tag',
  type: 'object',
  properties: {
    label: { type: 'string' },
    color: { type: 'string', default: '#000000' },
  },
  required: ['label'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [TagSchema] as const,
});

// has() checks if a schema is registered
console.log(jt.has('https://example.com/Tag')); // true

// get() retrieves the raw schema object
const raw = jt.get('https://example.com/Tag');
console.log(raw?.type); // 'object'

// list() returns all registered $id strings
console.log(jt.list()); // ['https://example.com/Tag']
```

## Typical

`$ref` relationships link schemas together. `toSchema()` reconstructs a schema from the canonical graph. `SchemaLoader` loads schemas from files and directories.

```ts
import { JsonTology } from 'json-tology';

const AddressSchema = {
  $id: 'https://example.com/Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city: { type: 'string' },
    zip: { type: 'string', pattern: '^\\d{5}$' },
  },
  required: ['street', 'city'],
} as const;

const PersonSchema = {
  $id: 'https://example.com/Person',
  type: 'object',
  properties: {
    name: { type: 'string' },
    address: { $ref: 'https://example.com/Address' },
  },
  required: ['name'],
} as const;

// Constructor-time registration
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [AddressSchema, PersonSchema] as const,
});

// register() also works after construction (returns `this` for chaining)
const EventSchema = {
  $id: 'https://example.com/Event',
  type: 'object',
  properties: {
    title: { type: 'string' },
    venue: { $ref: 'https://example.com/Address' },
  },
  required: ['title'],
} as const;

jt.register(EventSchema);

// register() accepts arrays
jt.register([AddressSchema, PersonSchema]);

// registerAnonymous() handles schemas without $id
const syntheticId = jt.registerAnonymous({
  type: 'object',
  properties: { x: { type: 'number' } },
});
console.log(syntheticId); // 'urn:json-tology:hash:<content-hash>'

// toSchema() reconstructs JSON Schema from the canonical graph
const reconstructed = jt.toSchema('https://example.com/Person');
console.log(JSON.stringify(reconstructed, null, 2));
```

`SchemaLoader` loads schemas from the file system.

```ts
import { SchemaLoader } from 'json-tology/schema';

const loader = new SchemaLoader();

// Load a single file
const schema = loader.loadSchema('./schemas/user.json');

// Load an entire directory (recursive)
const [schemas, result] = loader.loadDirectory('./schemas', {
  filePattern: /\.schema\.json$/,
  stopOnError: false,
});

console.log(result.successful); // number loaded
console.log(result.failed);     // number failed
console.log(result.errors);     // { file, reason, message }[]

// Register all loaded schemas
const jt = JsonTology.create({ baseIRI: 'https://example.com' });
jt.register(schemas);
```

## Advanced

`FormatRegistry` registers custom format validators. `SchemaRegistry` provides fine-grained control with strict mode and coercion.

```ts
import { FormatRegistry } from 'json-tology/schema';
import { SchemaRegistry } from 'json-tology/schema';
import { JsonTology } from 'json-tology';

// FormatRegistry — extend built-in format validators
const formats = FormatRegistry.builtin();

// Register a custom format
formats.register('hex-color', (value) => {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
});

console.log(formats.has('hex-color')); // true
console.log(formats.has('email'));     // true (built-in)

// Pass custom formats through JsonTology.create()
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  formats: {
    'hex-color': (value) =>
      typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
  },
});

const ColorSchema = {
  $id: 'https://example.com/Color',
  type: 'object',
  properties: {
    name: { type: 'string' },
    value: { type: 'string', format: 'hex-color' },
  },
  required: ['name', 'value'],
} as const;

jt.register(ColorSchema);
console.log(jt.validate(ColorSchema.$id, { name: 'red', value: '#ff0000' })); // []
console.log(jt.validate(ColorSchema.$id, { name: 'bad', value: 'nope' }));    // ["..."]

// SchemaRegistry — direct usage without the JsonTology facade
const registry = new SchemaRegistry({
  formatRegistry: formats,
  strict: true,   // requires draft 2020-12 $schema
  castTypes: true,    // coerce() coerces types (e.g. "42" -> 42)
  // vocabularies: [myPlugin],  // custom RDF vocabulary plugins
  // prefixes: { ex: 'https://example.com/' },  // additional prefix declarations
});

const ItemSchema = {
  $id: 'https://example.com/Item',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    name: { type: 'string' },
    count: { type: 'integer' },
  },
  required: ['name', 'count'],
};

registry.register(ItemSchema);

// Registry exposes the same validate/coerce/is/errors methods
const errors = registry.validate('https://example.com/Item', { name: 'Bolt', count: 10 });
console.log(errors); // []

// coerce() with castTypes mode converts compatible types
const parsed = registry.coerce('https://example.com/Item', { name: 'Bolt', count: '10' });
console.log(parsed); // { name: 'Bolt', count: 10 }
```
