# Compile-time schema validation <Badge type="info" text="Compile-time" />

json-tology validates schema structure at the TypeScript level so cross-keyword consistency errors are caught by the compiler, not discovered at runtime.

See [Validation modes](/validation-modes) for the badge system used across this documentation.

## `ValidateSchemaType<T>`

`ValidateSchemaType<T>` (in `src/types/SchemaValidation.ts`) is a compile-time type that resolves to `T` when the schema is internally consistent and to `never` when a cross-keyword violation is detected.

Apply it as an assignment constraint to opt in for hand-written schemas:

<<< ../examples/docs/compile-time-validation/01-validate-schema-type.ts

Schemas passed to `Compose.subClassOf`, `Compose.complementOf`, `Compose.disjointWith`, and `Compose.extend` are validated automatically - correct-by-construction without a manual `_check` variable.

## Validated constraints

### `required` key presence <Badge type="info" text="Compile-time" />

Every key in `required` must appear in `properties`. A `required` entry that references a non-existent property surfaces a `RequiredKeyNotInPropertiesInterface` brand error at the call site.

<<< ../examples/docs/compile-time-validation/02-required-key-check.ts

### `dependentRequired` key presence <Badge type="info" text="Compile-time" />

Every trigger key and every entry in the dependent key arrays in `dependentRequired` must appear in `properties`. Violations surface a `DependentRequiredKeyNotInPropertiesInterface` brand error.

<<< ../examples/docs/compile-time-validation/03-dependent-required-check.ts

### `if.properties` discriminator presence <Badge type="info" text="Compile-time" />

Every property key in `if.properties` must appear in the parent schema's `properties`. Discriminator keys that are absent from `properties` surface an `IfDiscriminatorNotInPropertiesInterface` brand error.

<<< ../examples/docs/compile-time-validation/04-if-discriminator-check.ts

## Brand error types

The named error brand types live in `src/types/TypeErrors.ts` alongside the Compose argument validation brands:

| Type | Signals |
|------|---------|
| `RequiredKeyNotInPropertiesInterface` | A `required` entry names a key absent from `properties` |
| `DependentRequiredKeyNotInPropertiesInterface` | A `dependentRequired` key or dependent entry names a key absent from `properties` |
| `IfDiscriminatorNotInPropertiesInterface` | An `if.properties` key is absent from the parent `properties` |

IDE hovers on a failing assignment show the specific brand type and the offending key rather than a generic "not assignable to never" message.

## Compose integration

Compose methods that accept a schema body (`subClassOf`, `complementOf`, `disjointWith`, `extend`) apply `ValidateSchemaType` as a parameter constraint. This means any schema passed to these methods is validated automatically:

<<< ../examples/docs/compile-time-validation/05-compose-integration.ts

## Related

- [Compose argument validation](/composition/) - pick/omit/subClassOf/discriminatedUnion argument type checking
- [Constraint brands](/constraint-brands) - keyword-level phantom brands
- [Validation modes](/validation-modes) - enforcement layer reference
