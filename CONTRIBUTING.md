# Contributing

This repository is an independently maintained fork of Dockge. Open issues and pull requests against
`Lorwell/dockge`; do not send fork-specific changes to the upstream project.

## Before opening a pull request

- Keep each change focused and avoid unrelated refactors.
- Discuss large features or breaking changes in a repository issue first.
- Add user-facing English text to `frontend/src/lang/en.json`. Do not update unrelated translations in the same
  change.
- Include screenshots stored on GitHub for visible UI changes.
- Describe manual coverage for affected UI, Socket.IO, database, and Docker Compose behavior.

## Local development

Requirements:

- Node.js 22.14 or newer
- npm
- Git
- Docker Engine with Docker Compose V2 for integration testing

Install dependencies and start the frontend and backend development servers:

```bash
npm install
npm run dev
```

The frontend runs on <http://localhost:5000> and waits for the backend on port `5001`. The processes can also be
started independently:

```bash
npm run dev:frontend
npm run dev:backend
```

Both applications share the root `package.json`. Frontend-only packages belong in `devDependencies`; runtime
backend packages belong in `dependencies`.

## Project layout

- `backend/`: Node.js server, models, migrations, and Socket.IO handlers
- `common/`: utilities shared by the frontend and backend
- `frontend/src/`: Vue 3 components, pages, layouts, styles, and translations
- `frontend/public/`: static frontend assets
- `docker/`: production image definitions
- `extra/`: maintenance and release scripts

## Code style

- Use four-space indentation for TypeScript and Vue, and two spaces for YAML.
- Use double quotes and semicolons in TypeScript.
- Use `camelCase` for TypeScript identifiers, `snake_case` for SQLite fields, and `kebab-case` for CSS classes.
- Add JSDoc to methods and functions.
- Preserve existing behavior unless the change explicitly requires otherwise.

## Required checks

Run the same validation used by CI before submitting:

```bash
npm run lint
npm run check-ts
npm run build:frontend
```

There is no dedicated unit-test suite yet. Add focused automated tests when introducing independently testable
logic, and document the manual tests performed for the rest.

## Docker releases

Stable Docker images are published from `master` with the `Build and push Docker image` workflow. The release
version is read from `package.json`; version changes must keep `package.json` and `package-lock.json` synchronized.
Publishing requires the repository's Docker Hub secrets and is a maintainer operation.
