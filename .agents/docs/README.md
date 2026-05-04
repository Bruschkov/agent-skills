# Agent Docs

Repo operating manual for future coding agents.

## Read when
- Starting work in this repo.
- Adding or changing skills, prompt templates, Pi extensions, tests, or agent docs.

## Map
- Root entrypoint: [`../../AGENTS.md`](../../AGENTS.md)
- ADR index: [`decisions/README.md`](decisions/README.md)
- Repo overview and install notes: [`../../README.md`](../../README.md)
- Backlog handoff extension docs: [`../../pi-extensions/backlog-handoff/README.md`](../../pi-extensions/backlog-handoff/README.md)
- Backlog handoff example: [`../../pi-extensions/backlog-handoff/examples/generic-fullstack/README.md`](../../pi-extensions/backlog-handoff/examples/generic-fullstack/README.md)

## Rules / workflow
- Keep root `AGENTS.md` short; put durable task docs here.
- Keep agent-facing docs under `.agents/docs/`, except root `AGENTS.md`.
- Update this map when adding/removing docs.
- ADRs live in `.agents/docs/decisions/`.
- If using `adr-skill`, pass `--dir .agents/docs/decisions`.
- Verify changed commands before documenting them, or mark unverified.
- Do not store secrets, scratch notes, generated dumps, or generic framework advice.

## Verification
- Test extension contracts: `node --test tests/pi-extensions/backlog-handoff/contract.test.mjs`
- Check links after doc changes: inspect all relative links in touched markdown.
