---                                                                                       
description: Refine a manual requirement into one or more backlog-md tickets, ask user if unclear, split into parallelizable meaningful work packages                                 
argument-hint: "<requirement>"
---                                                                                       
Refine this requirement into backlog-md ticket(s):

$ARGUMENTS

First, understand and refine the requirement.

If anything material is unclear, incomplete, or ambiguous:
- stop
- ask the user targeted clarification questions
- do not create tickets yet

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

Be concise. Report created ticket ids/paths.  
