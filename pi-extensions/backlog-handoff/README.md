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
<target-repo>/.backlog-handoff/
├── inbox/
└── processed/
```

`backlog-handoff` writes markdown handoff files to `inbox/`. `/backlog-handoff-init` bootstraps both directories with `.gitkeep` files. Target project can later move reviewed items to `processed/` or convert them into real `backlog-md` tickets.

## Commands
- `/backlog-handoff-init` — initialize current repo and register project in meta registry
- `/backlog-handoff-check` — validate config and registry

## Tool payload shape
`backlog-handoff` accepts flat top-level arguments. Do **not** wrap them in `{ "input": ... }`.

```json
{
  "targetProject": "backend",
  "title": "Add webhook retry endpoint",
  "rationale": "Retry behavior belongs in backend and was discovered while wiring frontend error handling.",
  "requestedChange": "Expose a retry endpoint and persist retry metadata for failed deliveries.",
  "constraints": "Keep existing webhook payload shape. No frontend changes in this task.",
  "acceptanceCriteria": [
    "Retry endpoint exists and is authenticated.",
    "Failed deliveries can be retried without duplicating successful ones."
  ]
}
```

## Example
See `examples/generic-fullstack/`.
