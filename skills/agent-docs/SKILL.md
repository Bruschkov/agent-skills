---
name: agent-docs
description: Initialize and maintain agent-facing project documentation: AGENTS.md as concise root entrypoint, .agents/docs/ as base directory for all other agent-facing documentation, ADR placement/indexing, doc audits, and link hygiene. Use when bootstrapping, reorganizing, or updating docs meant to guide coding agents across future tasks.
---

# Agent Docs

Agent docs are the repo operating manual for future coding agents. They must be short, navigable, current, and actionable.

## Skill boundaries

Skills must remain useful when installed alone. Cross-skill references are routing hints, not hard dependencies.

- If `writing-agents-md` is installed, use it for focused `AGENTS.md` creation/review. If not, use the `AGENTS.md minimum` section below.
- Use this skill for full agent-docs init, structure, audit, and maintenance.
- If `adr-skill` is installed, use it for ADR creation/lifecycle details. If not, place ADRs here and follow existing repo ADR conventions.

Do not merge these skills: `AGENTS.md` is the root entrypoint/index; `.agents/docs/` is the broader documentation system.

## Directory convention

All agent-facing project documentation lives under `.agents/docs/`, except root `AGENTS.md`.

```text
AGENTS.md                 # tiny root entrypoint, universal rules only
.agents/docs/             # base dir for all other agent-facing docs
  README.md               # map/index when docs exceed ~3 files
  workflows/              # task-specific procedures
  architecture/           # system shape, module boundaries, data flow
  decisions/              # ADRs, if no prior ADR convention exists
  runbooks/               # ops/debug/release procedures
  domain/                 # glossary, business rules, data semantics
```

Create subfolders only when needed. Prefer flat `.agents/docs/*.md` until docs become hard to scan.

## ADR integration

`agent-docs` owns placement; external `adr-skill` owns ADR content/workflow.

Treat `adr-skill` as an unmodified external dependency. Do not assume its defaults know this repo convention.

When both are installed:
- Store ADRs in `.agents/docs/decisions/`.
- Use `adr-skill` for when-to-write, interviews, templates, status changes, implementation plans, and verification.
- Always pass `--dir .agents/docs/decisions` to ADR scripts.

Examples:
```bash
node ~/.agents/skills/adr-skill/scripts/bootstrap_adr.js --dir .agents/docs/decisions
node ~/.agents/skills/adr-skill/scripts/new_adr.js --dir .agents/docs/decisions --title "Choose database" --status proposed --update-index
```

Also write the ADR location into `AGENTS.md` and `.agents/docs/README.md`; that project context is the compatibility layer for direct ADR requests.

## `AGENTS.md` minimum

Keep root `AGENTS.md` tiny and universal:

```markdown
# <Project Name>
<One sentence: what this does.>

## Stack
- <Language/runtime + versions, framework>

## Build & Test
- Tests: `<command>`
- Lint: `<command>`

## Docs
- Docs map: `.agents/docs/README.md`
- ADRs: `.agents/docs/decisions/README.md` (ADR tools: use `.agents/docs/decisions/` as dir)
```

## What belongs in `.agents/docs/`

Include only durable, repo-specific knowledge that helps an agent act correctly:

- exact build/test/lint/dev commands and prerequisites
- repo-specific workflows that span multiple files/tools
- architecture boundaries, invariants, and approved patterns
- domain glossary, business rules, data semantics
- integration contracts and local mock/test setup
- runbooks for release, migration, incident/debug paths
- ADRs explaining important irreversible or architectural choices
- pointers to generated docs, API references, schemas, or external sources

Do not include:

- generic language/framework advice
- code style duplicated from formatters/linters
- exhaustive directory trees or file listings
- generated content pasted into markdown
- task scratch notes, stale roadmaps, TODO dumps
- secrets, credentials, private operational data

## Init workflow

1. **Scan repo first**
   - Read root instructions: `AGENTS.md` if present.
   - Find existing docs: `.agents/docs/`, `docs/`, `contributing/`, `adr/`, `decisions/`.
   - Find commands/configs: package/build files, CI config, test config.
   - Find existing ADR references in code/docs.

2. **Choose docs root**
   - Use `.agents/docs/` as base dir for all agent-facing docs except `AGENTS.md`.
   - If agent docs already exist elsewhere, preserve content but migrate or link into `.agents/docs/`.
   - Keep root `AGENTS.md` as the only root-level agent doc.

3. **Bootstrap minimal docs**
   - Root `AGENTS.md`: short project purpose, stack, exact commands, links to `.agents/docs/`, ADR dir hint.
   - `.agents/docs/README.md`: doc map, update rules, ADR location and `adr-skill --dir .agents/docs/decisions` hint.
   - Add only pages with real content. Empty scaffold folders rot.

4. **Place ADRs**
   - If repo already has ADRs elsewhere, migrate or link them into `.agents/docs/decisions/` during cleanup.
   - If no ADR convention exists, create `.agents/docs/decisions/`.
   - Add `.agents/docs/decisions/README.md` as ADR index.
   - If `adr-skill` is available, use it with `--dir .agents/docs/decisions`.
   - If `adr-skill` is unavailable, use existing repo ADR style or a simple template: status, context, decision, consequences, implementation notes, verification.

5. **Update entrypoint**
   - Keep `AGENTS.md` under 60 lines when possible; hard limit 300.
   - It should link docs, not duplicate them.
   - Every linked doc must exist and have a clear title/purpose.

## Maintenance workflow

Run this when commands, architecture, dependencies, workflows, or ADRs change:

1. Update affected doc near the code change.
2. Update `.agents/docs/README.md` if file set or ADR index changes.
3. Update `AGENTS.md` only if entrypoint links, commands, stack, or universal rules changed.
4. Remove or rewrite stale docs; do not leave contradictory guidance.
5. Verify links and commands.

## Page pattern

For each non-trivial doc, prefer:

```markdown
# <Topic>

## Read when
- <task/situation that requires this doc>

## Rules / workflow
- <agent-actionable guidance>

## Verification
- <commands/checks proving work correct>

## Related
- <AGENTS.md, ADRs, code paths, external docs>
```

Omit sections that add no value. Keep pages focused; split when a page covers unrelated tasks.

## Audit checklist

- [ ] `AGENTS.md` exists, short, and links deeper docs.
- [ ] `.agents/docs/README.md` exists when docs exceed ~3 files.
- [ ] Exact commands are current and verified or clearly marked unverified.
- [ ] No duplicated linter/style/generated content.
- [ ] Task-specific instructions live outside `AGENTS.md`.
- [ ] Agent-facing docs live under `.agents/docs/`, except `AGENTS.md`.
- [ ] ADR location exists or intentional absence documented.
- [ ] ADR index updated and linked from doc map.
- [ ] Docs have clear “read when” or purpose.
- [ ] Cross-links are valid.
- [ ] Stale or contradictory docs removed.
- [ ] Secrets absent.

## Output when reporting audit

Keep report compact:

```text
Status: pass|needs work
Changed: <files>
Gaps:
- <gap> -> <fix>
Next:
- <smallest useful follow-up>
```
