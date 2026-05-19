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

Patch (`0.x.y`) and minor (`0.x`) releases are cut from `main`:

1. Bump `package.json#version`.
2. Date the `[Unreleased]` section in `CHANGELOG.md` to `## [<version>] - YYYY-MM-DD`.
3. Run `npm run stamp-version` to stamp the version into `docs/public/readme-header.svg` and `docs/public/og-image.svg`.
4. Open a `release/<version>` PR.
5. After merge, `publish.yml` triggers on the `main` push: it verifies the stamped SVGs match the version, builds, type-checks, lints, and publishes to npm and GitHub Packages if the version is not already present.
6. Push the `v<version>` tag. `release.yml` fires on the tag: it verifies the stamped SVGs again, extracts the matching `## [<version>]` section from `CHANGELOG.md`, and creates or updates the GitHub release with the changelog notes embedded in the body.

Tags `v*` are protected against deletion and force-update by repository ruleset.
