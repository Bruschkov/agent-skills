# backlog-handoff

Pi extension for cross-project handoffs inside one meta-project.

## What it does
- discovers current project via `.backlog-handoff/config.json`
- discovers sibling projects via `<metaRoot>/.backlog-handoff/projects/*.json`
- injects target project summaries into prompt context
- creates handoff files in target repo landing zone
- validates registry via `/backlog-handoff-check`
- bootstraps current repo via `/backlog-handoff-init`

## Local config
In each repo:

```json
{
  "projectId": "frontend",
  "metaRoot": ".."
}
```

Path: `.backlog-handoff/config.json`

## Meta-project registry
In meta root:

`<metaRoot>/.backlog-handoff/projects/<projectId>.json`

Example:

```json
{
  "id": "backend",
  "path": "./app-backend",
  "description": "REST backend. Owns routes, auth, business logic, validation, and persistence.",
  "owns": ["routes", "auth", "business logic"]
}
```

Optional:
- `handoffDir`: override default `.backlog-handoff/inbox`

## Landing zone
Default target location:

```text
<target-repo>/.backlog-handoff/inbox/
```

`backlog-handoff` writes markdown handoff files there. Target project can later review and convert them into real `backlog-md` tickets.

## Commands
- `/backlog-handoff-init` — initialize current repo and register project in meta registry
- `/backlog-handoff-check` — validate config and registry

## Example
See `examples/generic-fullstack/`.
