# Generic Fullstack Example

Minimal example for `backlog-handoff`.

Structure:
- meta-project root keeps shared registry in `.backlog-handoff/projects/`
- each subproject repo keeps local `.backlog-handoff/config.json`
- `metaRoot` points from subproject repo root to meta-project root

Example layout:

```text
generic-fullstack/
├── .backlog-handoff/
│   └── projects/
│       ├── frontend.json
│       └── backend.json
├── app-frontend/
│   └── .backlog-handoff/
│       └── config.json
└── app-backend/
    └── .backlog-handoff/
        └── config.json
```

Copy this layout. Then adapt:
- project ids
- paths
- descriptions
- owns lists if useful
- optional `handoffDir` if you do not want default `.backlog-handoff/inbox`

Default behavior:
- `/backlog-handoff-init` bootstraps `.backlog-handoff/inbox/` and `.backlog-handoff/processed/` inside each project repo
- `backlog-handoff` writes landing-zone markdown files to `.backlog-handoff/inbox/` inside target repo
- target project can later review inbox items, move them to `processed/`, or convert them into real `backlog-md` tickets
