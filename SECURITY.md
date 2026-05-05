# Security policy

## Reporting a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/Studnicky/json-tology/security/advisories/new) for any security issue. Reports are private until a fix ships.

Do not open public issues for vulnerabilities.

## Supported versions

Pre-1.0: only the latest minor on `main` is supported. Patch releases land against the most recent `0.x` minor.

## Scope

In scope:
- Validation bypass: input that should fail `validate()` / `instantiate()` but does not.
- Coercion confusion: input that produces a typed value the consumer cannot reasonably anticipate.
- Reasoning soundness: TBox/SHACL output that an OWL/SHACL conformant tool would reject as inconsistent for an input the schema accepts.
- Prototype pollution, ReDoS, supply chain.

Out of scope:
- Issues in dependencies that have not yet released a fix (open the upstream issue first).
- Misuse patterns documented as anti-patterns in the docs.
