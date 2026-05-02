---                                                                                       
description: Refine backlog handoff into one or more backlog-md tickets, ask user if unclear, split into parallelizable meaningful work packages, then move handoff to processed
argument-hint: "<handoff-file>"
---

Treat `$1` as the handoff file path. If it starts with `@`, treat the leading `@` as path
syntax only, not as part of the real filesystem path.

Read handoff file `$1`.

Refine the requirement before creating tickets. Do not copy the handoff verbatim.

If anything material is unclear, incomplete, or ambiguous:
- stop
- ask the user targeted clarification questions
- do not create tickets yet
- do not move the handoff file yet

If the requirement is clear enough:
- split it into multiple backlog-md tickets only where the work can be done meaningfully  
  and as independently as possible
- maximize parallelizable work packages where reasonable
- keep tickets large enough to be meaningful, not tiny implementation chores
- prefer splits by vertical slice, ownership boundary, or independently deliverable       
  outcome
- avoid splitting tightly coupled work into separate tickets unless there is a clear      
  benefit
- if one ticket is the best shape, keep it as one ticket

For each ticket:
- write a clear problem / goal
- define concrete scope
- include solid acceptance criteria
- note dependencies only if truly needed

Then create the backlog-md ticket(s) using the normal local workflow in this repo.

Only after all intended ticket creation succeeds:
1. ensure `.backlog-handoff/processed/` exists
2. move `$1` to `.backlog-handoff/processed/`

If ticket creation fails or remains incomplete, do not move the handoff file.

Be concise. Report created ticket ids/paths and moved handoff path.
