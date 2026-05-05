# backlog-handoff OpenCode plugin

OpenCode port of `pi-extensions/backlog-handoff` for cross-project handoffs inside one meta-project.

## What it does
- discovers current project via `.backlog-handoff/config.json`
- discovers sibling projects via `<metaRoot>/.backlog-handoff/projects/*.json`
- injects target project summaries into OpenCode system prompt context
- creates markdown handoff files in target repo landing-zone inbox
- validates registry with `backlog-handoff-check` tool
- bootstraps current repo with non-interactive `backlog-handoff-init` tool

OpenCode plugins cannot add slash commands, so the Pi commands are ported as tools:
- Pi `/backlog-handoff-check` → OpenCode `backlog-handoff-check` tool
- Pi `/backlog-handoff-init` → OpenCode `backlog-handoff-init` tool

## Install from this repo

Add plugin path to OpenCode config:

```jsonc
{
  "plugin": [
    "file:///absolute/path/to/practical-agent-stuff/opencode-plugins/backlog-handoff/index.ts"
  ]
}
```

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

## Init tool

Ask OpenCode to use `backlog-handoff-init`, or call with:

```json
{
  "projectId": "frontend",
  "metaRoot": "..",
  "description": "Frontend app. Owns UI flows, forms, and presentation logic.",
  "owns": ["UI flows", "forms"],
  "overwrite": false
}
```

The tool creates:

```text
<repo>/.backlog-handoff/config.json
<metaRoot>/.backlog-handoff/projects/<projectId>.json
<repo>/.backlog-handoff/inbox/.gitkeep
<repo>/.backlog-handoff/processed/.gitkeep
```

Unlike the Pi extension, this OpenCode port does not open an interactive editor or draft descriptions with a nested Pi invocation.
