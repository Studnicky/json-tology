# Custom format validators

JSON Schema `format` keywords are pluggable. json-tology ships built-in validators for the standard formats (`date`, `email`, `uri`, `uuid`, `int32`, and so on) and lets you register your own through the `formats` constructor option.

A format validator is a function `(value: unknown) => boolean`. It receives the raw value (string, number, anything) and returns `true` when the value matches the format. The registry composes custom validators with the built-ins, so you can extend without redefining the standard set.

The bookstore domain in the [Bookstore Domain](/bookstore-domain) is the running example. The book schema declares an ISBN with a regex; below we replace that with a real ISBN-10 format validator and add a `slug` format for review URLs.

---

## Defining custom formats

Pass a `formats` map to `JsonTology.create`. Keys are format names; values are predicates.

<<< ../../examples/docs/usage-examples/36-custom-formats-define.ts

`isIsbn10` and `isSlug` accept `unknown` because `FormatRegistry` calls them with the raw value. Always check the type before doing format-specific work - the same validator can be reached for non-string fields if a schema misuses the format.

## Composing with bookstore schemas

The standard `BookSchema` declares ISBN with a 13-digit pattern. Swap the pattern for the new format on a refined schema and reuse the rest of the bookstore registration:

<<< ../../examples/docs/usage-examples/37-custom-formats-compose.ts

## Replacing a built-in format

Built-ins live under the same names (`date`, `email`, `uuid`, ...). Registering a custom validator under one of those names replaces the built-in for this `JsonTology` instance only. Other instances retain the built-ins.

<<< ../../examples/docs/usage-examples/38-custom-formats-override-builtin.ts

## Number formats

The `formats` map handles number formats too. The validator receives the number.

<<< ../../examples/docs/usage-examples/39-custom-formats-number.ts

## Related

- [Schemas overview](/schemas) - where the `format` keyword fits in the broader keyword catalogue
- [JT keyword reference](/schemas/jt-keywords) - json-tology specific keywords
- [`validate`](/validation/validate) - the entry point that runs format checks

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
