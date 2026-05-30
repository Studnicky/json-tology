# `JsonTology.validate` <Badge type="tip" text="Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** Validates data against a registered schema and returns a `ValidationErrors` collection. The collection is empty (`.ok === true`) when the data is valid. Does not mutate the input. Does not throw on validation failure.


**Use this when** you need programmatic access to the structured error list - paths, keywords, params - without wanting an exception. This is the right method for API validation where you collect errors, then decide what to do with them (return a 422, log, display in a form). The collection is iterable with `for...of`.

**Don't use this when** you only need a boolean (use [`is`](/validation/is)). Don't use it when you want the coerced typed value on success (use [`instantiate`](/validation/instantiate)).

## Examples

### Example 1: Basic valid and invalid cases

<RunnableExample src="examples/docs/validation/04-validate-basic" />

### Example 2: Nested schema errors with JSON Pointer paths

`OrderSchema` contains `items: [OrderLine]` via `$ref`. Errors on nested fields include the full JSON Pointer path.

<RunnableExample src="examples/docs/validation/33-validate-nested-errors" />

### Example 3: Use as a lightweight form validator

Validate on blur before attempting a full instantiate.

<RunnableExample src="examples/docs/validation/34-validate-form-validator" />

## Bad examples - what NOT to do

### Anti-pattern 1: Checking the return length and then re-instantiating

<RunnableExample src="examples/docs/validation/35-validate-antipattern-double-work" />

### Anti-pattern 2: Re-parsing message strings to extract field paths

<RunnableExample src="examples/docs/validation/36-validate-antipattern-string-parsing" />

## Comparison

::: code-group

```ts [json-tology]
const errs = jt.validate(CustomerSchema.$id, data);
// ValidationErrors  - .ok, .length, iterable, .items, .aggregate(), .report()
// does not throw, does not coerce
```

```ts [Zod]
const result = CustomerSchema.safeParse(data);
if (!result.success) {
  const messages = result.error.issues.map(i => `${i.path.join('/')}: ${i.message}`);
}
// safeParse doesn't throw; parse() throws ZodError
```

```ts [Valibot]
import * as v from 'valibot';
const result = v.safeParse(CustomerSchema, data);
if (!result.success) {
  const messages = result.issues.map(i =>
    `${i.path?.map(p => p.key).join('/') ?? ''}: ${i.message}`,
  );
}
// { success, output, issues } - parallels ValidationErrors but no .aggregate/.report views.
```

```ts [io-ts]
import { isLeft } from 'fp-ts/Either';
import { PathReporter } from 'io-ts/PathReporter';
const result = CustomerCodec.decode(data); // Either<Errors, Customer>
const messages = isLeft(result) ? PathReporter.report(result) : [];
// Limitation: Errors are typed io-ts ValidationError nodes; PathReporter
// flattens them into strings but provides no .aggregate / .report / RFC 7807
// views.
```

```ts [TypeBox + Value]
import { TypeCompiler } from '@sinclair/typebox/compiler';
const C = TypeCompiler.Compile(CustomerSchema);
const errors = [...C.Errors(data)].map(e => `${e.path}: ${e.message}`);
```

```ts [AJV]
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);
const valid = ajv.validate(customerSchema, data);
const messages = valid ? [] : ajv.errors!.map(e => `${e.instancePath}: ${e.message}`);
```

```py [Pydantic]
from pydantic import ValidationError

try:
    Customer(**data)
    messages = []
except ValidationError as e:
    messages = [f"{'/'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()]
```


```ts [Yup]
import * as yup from 'yup';

const Customer = yup.object({
  id: yup.string().uuid().required(),
  email: yup.string().email().required(),
  name: yup.string().required(),
});

try {
  Customer.validateSync(data, { abortEarly: false });
} catch (err) {
  const messages = (err as yup.ValidationError).inner.map(i => `${i.path}: ${i.message}`);
}
```

```ts [Joi]
import Joi from 'joi';

const Customer = Joi.object({
  id: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  name: Joi.string().required(),
});

const { error } = Customer.validate(data, { abortEarly: false });
const messages = error?.details.map(d => `${d.path.join('/')}: ${d.message}`) ?? [];
```

```ts [Effect Schema]
import { Schema as S, Either } from 'effect';

const Customer = S.Struct({
  id: S.UUID,
  email: S.String.pipe(S.pattern(/^[^@]+@[^@]+$/)),
  name: S.String,
});

const result = S.decodeUnknownEither(Customer)(data);
const messages = Either.isLeft(result)
  ? S.TreeFormatter.formatErrorSync(result.left).split('\n')
  : [];
```

```ts [ArkType]
import { type } from 'arktype';

const Customer = type({
  id: 'string.uuid',
  email: 'string.email',
  name: 'string',
});

const result = Customer(data);
const messages = result instanceof type.errors
  ? result.map(e => `${e.path.join('/')}: ${e.message}`)
  : [];
```

```ts [Runtypes]
import { Object as RtObject, String, Email, Uuid } from 'runtypes';

const Customer = RtObject({
  id: Uuid,
  email: Email,
  name: String,
});

const result = Customer.validate(data);
const messages = result.success ? [] : [`${result.code}: ${result.message}`];
// Limitation: Runtypes surfaces one error at a time; no all-errors mode.
```

:::

## Related

- [`JsonTology.is`](/validation/is) - boolean type guard, no error data
- [`JsonTology.instantiate`](/validation/instantiate) - validate + apply defaults + return typed value
- [`JsonTology.subschemaAt`](/validation/subschemaAt) - validate against a sub-schema by JSON Pointer
- [`ValidationErrors`](/validation/errors) - the structured collection shape returned by `validate`

## See also

- [Error views](/errors/views) - `aggregate`, `report`, iteration over `ValidationErrors`
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
