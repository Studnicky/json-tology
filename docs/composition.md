# Schema Composition

`Compose` provides static methods for building new schemas from existing ones. All methods return new schema objects and never mutate input. Import from `'json-tology'` or `'json-tology/schema'`.

## Simple

`Compose.extend()` adds properties to a schema. `Compose.pick()` selects a subset of fields.

```ts
import { Compose, type InferType } from 'json-tology';

const UserSchema = {
  $id: 'https://app.io/User',
  type: 'object',
  properties: {
    id:    { type: 'string' },
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['id', 'name', 'email'],
} as const;

// extend — add properties, inherit required
const AdminSchema = Compose.extend(
  UserSchema,
  { role: { type: 'string', enum: ['admin', 'superadmin'] } } as const,
  'https://app.io/Admin',
);
type Admin = InferType<typeof AdminSchema>;
// { id: string; name: string; email: string; role: 'admin' | 'superadmin' }

// pick — keep only listed properties
const UserSummarySchema = Compose.pick(
  UserSchema,
  ['id', 'name'] as const,
  'https://app.io/UserSummary',
);
type UserSummary = InferType<typeof UserSummarySchema>;
// { id: string; name: string }

// omit — remove listed properties
const PublicUserSchema = Compose.omit(
  UserSchema,
  ['email'] as const,
  'https://app.io/PublicUser',
);
type PublicUser = InferType<typeof PublicUserSchema>;
// { id: string; name: string }
```

## Typical

`Compose` builds CRUD variants from a base schema. `discriminatedUnion()` creates polymorphic types.

```ts
import { JsonTology, Compose, type InferType } from 'json-tology';

const UserSchema = {
  $id: 'https://app.io/User',
  type: 'object',
  properties: {
    id:    { type: 'string' },
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
    bio:   { type: 'string' },
  },
  required: ['id', 'name'],
} as const;

// CreateUser — all properties required
const CreateUserSchema = Compose.required(
  UserSchema,
  'https://app.io/CreateUser',
);
type CreateUser = InferType<typeof CreateUserSchema>;
// { id: string; name: string; email: string; bio: string }

// UpdateUser — all properties optional (PATCH semantics)
const UpdateUserSchema = Compose.partial(
  UserSchema,
  'https://app.io/UpdateUser',
);
type UpdateUser = InferType<typeof UpdateUserSchema>;
// { id?: string; name?: string; email?: string; bio?: string }

// UserSummary — subset for list views
const UserSummarySchema = Compose.pick(
  UserSchema,
  ['id', 'name'] as const,
  'https://app.io/UserSummary',
);
type UserSummary = InferType<typeof UserSummarySchema>;

// Discriminated union — polymorphic shapes
const CircleSchema = {
  $id: 'https://app.io/Circle',
  type: 'object',
  properties: {
    kind:   { type: 'string', const: 'circle' },
    radius: { type: 'number' },
  },
  required: ['kind', 'radius'],
} as const;

const RectSchema = {
  $id: 'https://app.io/Rect',
  type: 'object',
  properties: {
    kind:   { type: 'string', const: 'rect' },
    width:  { type: 'number' },
    height: { type: 'number' },
  },
  required: ['kind', 'width', 'height'],
} as const;

const ShapeSchema = Compose.discriminatedUnion(
  'kind',
  [CircleSchema, RectSchema] as const,
  'https://app.io/Shape',
);
type Shape = InferType<typeof ShapeSchema>;

// Narrow a discriminated union value
function area(shape: Shape): number {
  if (Compose.narrow(shape, 'kind', 'circle')) {
    return Math.PI * shape.radius ** 2;
  }
  if (Compose.narrow(shape, 'kind', 'rect')) {
    return shape.width * shape.height;
  }
  return 0;
}

// Register and validate composed schemas
const jt = JsonTology.create({
  baseIRI: 'https://app.io',
  schemas: [
    UserSchema,
    CreateUserSchema,
    UpdateUserSchema,
    CircleSchema,
    RectSchema,
    ShapeSchema,
  ] as const,
});

const errors = jt.validate(UpdateUserSchema.$id, { name: 42 });
console.log(errors); // ['... type must be string ...']

const valid = jt.is(ShapeSchema.$id, { kind: 'circle', radius: 5 });
console.log(valid); // true
```

## Advanced

`intersection()` merges multiple schemas with `allOf`. `getDefaults()` extracts declared defaults for form initialization.

```ts
import { JsonTology, Compose, type InferType } from 'json-tology';

// Intersection — merge multiple schemas with allOf
const TimestampedSchema = {
  $id: 'https://app.io/Timestamped',
  type: 'object',
  properties: {
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['createdAt', 'updatedAt'],
} as const;

const SoftDeleteSchema = {
  $id: 'https://app.io/SoftDelete',
  type: 'object',
  properties: {
    deletedAt: { type: 'string', format: 'date-time' },
    isDeleted: { type: 'boolean', default: false },
  },
} as const;

const ArticleSchema = {
  $id: 'https://app.io/Article',
  type: 'object',
  properties: {
    title: { type: 'string' },
    body:  { type: 'string' },
  },
  required: ['title', 'body'],
} as const;

const FullArticleSchema = Compose.intersection(
  [ArticleSchema, TimestampedSchema, SoftDeleteSchema] as const,
  'https://app.io/FullArticle',
);
type FullArticle = InferType<typeof FullArticleSchema>;
// { title: string; body: string; createdAt: string; updatedAt: string;
//   deletedAt?: string; isDeleted?: boolean }

// getDefaults — extract declared default values without building an instance
// Useful for form initialization where you want explicit defaults only
const FormSchema = {
  $id: 'https://app.io/Form',
  type: 'object',
  properties: {
    name:     { type: 'string' },
    country:  { type: 'string', default: 'US' },
    currency: { type: 'string', default: 'USD' },
    settings: {
      type: 'object',
      properties: {
        notifications: { type: 'boolean', default: true },
        theme:         { type: 'string', default: 'light' },
      },
    },
  },
  required: ['name'],
} as const;

const defaults = Compose.getDefaults(FormSchema);
console.log(defaults);
// {
//   country: 'US',
//   currency: 'USD',
//   settings: { notifications: true, theme: 'light' }
// }
// Note: 'name' is absent — it has no declared default

// Register composed schemas and validate against them
const jt = JsonTology.create({
  baseIRI: 'https://app.io',
  schemas: [
    ArticleSchema,
    TimestampedSchema,
    SoftDeleteSchema,
    FullArticleSchema,
    FormSchema,
  ] as const,
});

const article = jt.coerce(FullArticleSchema.$id, {
  title: 'Composition',
  body: 'Schemas compose.',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
});
console.log(article);

// Validate the intersection — all constituent schemas must pass
const errors = jt.validate(FullArticleSchema.$id, {
  title: 'Missing timestamps',
  body: 'This will fail validation.',
});
console.log(errors.length > 0); // true — createdAt and updatedAt are required

// Build new schemas dynamically from existing registered schemas
const retrieved = jt.get(ArticleSchema.$id);
if (retrieved) {
  const ReadOnlyArticle = Compose.omit(
    { ...retrieved, $id: ArticleSchema.$id } as typeof ArticleSchema,
    ['body'] as const,
    'https://app.io/ArticleHeader',
  );
  jt.register(ReadOnlyArticle);

  const header = jt.coerce(ReadOnlyArticle.$id, { title: 'Just a title' });
  console.log(header); // { title: 'Just a title' }
}
```
