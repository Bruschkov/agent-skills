# Agent Assets

Catch-all repo for versioned Pi assets.

Contains reusable but loosely related:
- skills
- extensions
- prompt templates

Not meant as one bulk-installable package. Pieces used selectively.

## What lives here
- `skills/writing-agents-md/` — skill for writing/reviewing `AGENTS.md`
- `skills/agent-docs/` — skill for initializing/maintaining `.agents/docs/` and ADR placement
- `pi-extensions/backlog-handoff/` — Pi extension for backlog handoff workflow
- `prompts/` — prompt templates tracked in git

## Skill installation
The `skills` CLI scans the repo for directories containing `SKILL.md`. `--skill` selects by frontmatter `name`, not by path.

List available skills:

```bash
npx skills add Bruschkov/practical-agent-stuff --list
```

Install all skills:

```bash
npx skills add Bruschkov/practical-agent-stuff
```

Install one skill:

```bash
npx skills add Bruschkov/practical-agent-stuff --skill "agent-docs"
npx skills add Bruschkov/practical-agent-stuff --skill "writing-agents-md"
```

After repo path changes, reinstall affected skills if old lock entries point at removed paths.

## Prompt workflow
Prompt templates in `prompts/` are source of truth.

They can be symlinked into `~/.pi/agent/prompts/` so Pi loads them from normal global location while files stay version-controlled here.

Current tracked prompts:
- `backlog-from-handoff.md`
- `backlog-from-requirement.md`
- `backlog-start-task.md`

## Usage model
Use this repo as curated storage for Pi-related tooling.

- reusable prompt/skill/extension worth versioning → put here
- personal scratch or temporary local prompt → keep out
- project-specific prompt → keep in that project
