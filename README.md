<p align="center"><a href="https://studnicky.github.io/json-tology/"><img src="https://raw.githubusercontent.com/Studnicky/json-tology/main/docs/public/readme-header.svg" alt="json-tology" width="720" /></a></p>

# json-tology

> One source of truth for TypeScript types, runtime validation, coercion, and OWL ontology output. Author in JSON Schema; share with any backend; reason over the graph.

## Documentation

The full documentation is published at **https://studnicky.github.io/json-tology/**.

- [Getting Started](https://studnicky.github.io/json-tology/getting-started)
- [Picking a method](https://studnicky.github.io/json-tology/picking-a-method)
- [Argument conventions](https://studnicky.github.io/json-tology/argument-conventions)
- [Bookstore domain](https://studnicky.github.io/json-tology/bookstore-domain) - the running example used throughout the docs
- [Validation](https://studnicky.github.io/json-tology/validation/instantiate), [Composition](https://studnicky.github.io/json-tology/composition/extend), [Serialization](https://studnicky.github.io/json-tology/serialization/dump)
- [OWL 2 TBox import (`fromTbox`)](https://studnicky.github.io/json-tology/advanced/owl-import) - import existing OWL ontologies; generate compile-time TypeScript types via `owl-gen`
- [Ontology and Graphs](https://studnicky.github.io/json-tology/advanced/ontology) - OWL TBox, SHACL, JSON-LD, ABox projection
- [Usage Examples](https://studnicky.github.io/json-tology/usage-examples/transforms-recipes) - transforms cookbook, custom format validators

## Requirements

Node.js >= 24 (matches `engines.node` in `package.json`).

## Install

```bash
npm install json-tology
```

`jsonld` is a peer dependency required for OWL import and codegen (`fromTbox`, `owl-gen`):

```bash
npm install json-tology jsonld
```

The package is also mirrored to GitHub Packages as `@studnicky/json-tology`:

```bash
echo '@studnicky:registry=https://npm.pkg.github.com' >> .npmrc
npm install @studnicky/json-tology
```

## License

MIT - see [LICENSE](./LICENSE).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) and the [GitHub releases](https://github.com/Studnicky/json-tology/releases).
