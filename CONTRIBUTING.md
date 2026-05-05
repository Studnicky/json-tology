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

The publish workflow runs the same checks under the `Validate Before Publish` job, plus License Check, Security Audit, and Code Coverage. All four are required for `main` merges.

## Docs

The docs live under `docs/`. To preview locally:

```bash
npm run docs:dev
```

Doc pages must be in current tense, em-dash free, and emoji free. See [References](https://studnicky.github.io/json-tology/references) for the conventions and outbound-link policy.

## Releases

Patch (`0.3.x`) and minor (`0.x`) releases are cut from `main`:

1. Bump `package.json#version`.
2. Date the `[Unreleased]` section in `CHANGELOG.md` to `## [<version>] - YYYY-MM-DD`.
3. Open a `release/<version>` PR.
4. After merge, tag `v<version>` and push the tag.
5. Run `gh release create v<version> --prerelease --notes-file <notes>` (the `Publish Package` workflow auto-creates the release on tag push if `NPM_TOKEN` is set).

Tags `v*` are protected against deletion and force-update by repository ruleset.
