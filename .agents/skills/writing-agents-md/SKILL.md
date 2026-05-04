---
name: writing-agents-md
description: Creates, reviews, and optimises AGENTS.md files for coding agent projects. Use when the user wants to write a new AGENTS.md, audit an existing one, or improve agent entrypoint files. For full agent documentation systems, use agent-docs.
---

# Writing a Good AGENTS.md

## Relationship to agent docs
Cross-skill references are routing hints, not hard dependencies. This skill works alone.

- `AGENTS.md` is the concise root entrypoint and index.
- All other agent-facing documentation belongs in `.agents/docs/`.
- ADRs must be linked from the docs map when present.
- If `agent-docs` is installed, use it when asked to initialize, organize, or maintain the broader docs system. If not, still follow the `.agents/docs/` convention below.

## Core rules
- Keep it under 60 lines (hard limit: 300)
- Only include what Claude doesn't already know: tech stack, build/test commands, pointers to deeper docs
- Every instruction must be universal — if it only applies to one task type, move it to a separate linked file
- No directory listings, no code style rules (use linter configs), no auto-generated content
- Link docs; do not duplicate them
- Keep `AGENTS.md` as the only root-level agent doc

## What to include
- Tech stack + versions
- Build and test commands (explicit: `uv run pytest`, not just "run tests")
- One-sentence project purpose
- Pointers to separate docs under `.agents/docs/` for task-specific guidance
- Pointer to ADR/index location, if repo has ADRs

## Template
```markdown
# <Project Name>
<One sentence: what this does.>

## Stack
- <Language + version>, <Framework + version>

## Build & Test
- Tests: `<command>`
- Lint: `<command>`

## Docs
- Docs map: `.agents/docs/README.md`
- <Topic>: `.agents/docs/<file>.md`
- ADRs: `.agents/docs/decisions/README.md` (ADR tools: use `.agents/docs/decisions/` as dir)
```

## Review checklist
When asked to review an existing AGENTS.md, check:
- [ ] Under 300 lines?
- [ ] No auto-generated content?
- [ ] No directory tree or file listings?
- [ ] No code style rules duplicated from linter configs?
- [ ] Every instruction applies to every task?
- [ ] Task-specific instructions moved to separate files under `.agents/docs/`?
- [ ] Linked docs and ADR indexes exist?
