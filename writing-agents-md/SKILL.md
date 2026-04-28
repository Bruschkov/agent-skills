---
name: writing-agents-md
description: Creates, reviews, and optimises AGENTS.md (or GEMINI.md) files for coding agent projects. Use when the user wants to write a new AGENTS.md, audit an existing one, or improve agent configuration files.
---

# Writing a Good AGENTS.md

## Core rules
- Keep it under 60 lines (hard limit: 300)
- Only include what Claude doesn't already know: tech stack, build/test commands, pointers to deeper docs
- Every instruction must be universal — if it only applies to one task type, move it to a separate linked file
- No directory listings, no code style rules (use linter configs), no auto-generated content

## What to include
- Tech stack + versions
- Build and test commands (explicit: `uv run pytest`, not just "run tests")
- One-sentence project purpose
- Pointers to separate docs for task-specific guidance

## Template
```markdown
# <Project Name>
<One sentence: what this does.>

## Stack
- <Language + version>, <Framework + version>

## Build & Test
- Tests: `mmand>`
- Lint: `mmand>`

## Docs
- <Topic>: `agent_docs/<file>.md`
```

## Review checklist
When asked to review an existing AGENTS.md, check:
- [ ] Under 300 lines?
- [ ] No auto-generated content?
- [ ] No directory tree or file listings?
- [ ] No code style rules duplicated from linter configs?
- [ ] Every instruction applies to every task?
- [ ] Task-specific instructions moved to separate linked files?
