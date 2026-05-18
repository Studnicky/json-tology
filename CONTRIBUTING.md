# Contributing

## Branching

- `main` is protected. All work lands via pull request.
- Use feature branches: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`, `release/<version>`.
- Squash merge into `main`. Fast-forward only on the local merge of release branches.

## Commits

Conventional Commits. The first line is the imperative summary; the body explains the *why*.

```
feat(scope): short summary

Longer explanation of the why and the consequences. Wrap at ~72 cols.
```

## Local checks

```bash
npm ci
npm run build
npm run type-check
npm run lint
npm test
```

The `publish.yml` workflow runs the same checks under the `Validate Before Publish` job: build, type-check, lint, and test. All are required before the publish step proceeds.

## Docs

The docs live under `docs/`. To preview locally:

```bash
npm run docs:dev
```

Doc pages must be in current tense, em-dash free, and emoji free. See [References](https://studnicky.github.io/json-tology/references) for the conventions and outbound-link policy.

## Releases

Patch (`0.8.x`) and minor (`0.x`) releases are cut from `main`:

1. Bump `package.json#version`.
2. Date the `[Unreleased]` section in `CHANGELOG.md` to `## [<version>] - YYYY-MM-DD`.
3. Open a `release/<version>` PR.
4. After merge, `publish.yml` triggers on the `main` push: it builds, validates, and publishes to npm if the version is not already present.
5. After a successful publish, `publish.yml` creates a GitHub release with changelog notes as a post-publish artifact. No manual tag push is required.

Tags `v*` are protected against deletion and force-update by repository ruleset.
