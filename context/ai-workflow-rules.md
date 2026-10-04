# AI Workflow Rules

Defines the process the AI agent must follow when building or modifying the project.

These rules govern how the agent scopes work, resolves missing requirements, decides when work should be split, executes changes, verifies results, and determines when it is safe to proceed.

This document defines the development process, not the technical implementation standards or system design. Code quality requirements belong in Code Standards, while structural and design decisions belong in the Architecture documentation.

## Approach

Build the project incrementally using a spec-driven workflow.
Project context files define:
- What needs to be built
- Current system architecture
- Feature requirements
- Implementation constraints
- Current project state
- Completed and remaining work
Always implement against the available project context.
Do not assume undocumented product behavior or expand the project beyond the defined requirements.
Work from the current project state rather than treating each request as an isolated task.

## Build, Review, Improve

Use this agreed collaboration process for application development:

1. The agent builds one working step at a time.
2. The agent handles routine technical choices.
3. The user reviews the result and requests changes.
4. The agent asks a short question only when a feature needs the user's decision.

Keep implementation units, dependency checks and decision records as internal
working structure. Present the user with the working result, a simple way to try
it, the checks performed and the next step. Verify the step before presenting it
as complete, and incorporate review feedback into the relevant scope.

Continue authorized work without requiring separate approval of every plan item
or routine technical choice. Resolve choices using the established architecture
and conventions. When a product decision is needed, ask one focused question with
a recommended option at the point it affects the feature. Pause only work that
needs the answer and continue independent authorized work. Do not treat missing
answers as approval of proposed product behavior.

## Resolve Context and Conflicts

- Follow applicable instruction precedence; explicit user decisions take precedence over project guidance within that authority.
- Identify the project's authoritative sources for product scope, architecture and invariants, implementation standards, and any applicable interface conventions. This file owns workflow; the project's progress tracker records observed delivery state and open decisions.
- Use the documentation locations and tracking mechanism established by the project. References to the progress tracker in these rules mean that designated document or system; no particular file layout, framework, or technology stack is required.
- Apply framework-specific standards only to the framework used by the affected application. Generic examples do not authorize a stack change.
- Distinguish intended behavior in specifications from observed behavior in code and verification. Neither stale documentation nor existing code silently overrides an approved requirement.
- Resolve material contradictions affecting scope, contracts, security, or architecture before implementing dependent work. Record the conflict and seek a decision when existing instructions do not resolve it; continue independent work where safe.
- Record the resolved decision in its authoritative document and reference it from the tracker rather than maintaining competing definitions.

## Establish Context Before Implementation

Before starting an implementation unit:
- Identify the requirement being implemented.
- Identify the relevant context files.
- Identify the existing implementation related to the requirement.
- Determine the system boundaries affected.
- Determine what must be true for the unit to be considered complete.
- Determine how the unit will be verified.
- Identify applicable architecture invariants, required checks, and any known baseline failures.
Do not begin implementation until the scope of the unit is clear.

## Scoping Rules

- Work on one implementation unit at a time.
- Keep each unit focused on one clear outcome.
- Prefer small, verifiable increments over broad implementation batches.
- Do not combine unrelated requirements into one implementation unit.
- Do not expand the unit beyond what is required to complete its defined objective.
- Complete the current unit before moving to another feature area, except for a documented switch under Handling Blocked Work or an explicit user reprioritization.
- Preserve clearly identified follow-up work for later units.

A unit should have a clear:
- Starting state
- Requirement
- Implementation boundary
- Expected result
- Verification method

## Implementation Unit Definition

Each implementation unit should answer:
- Goal
What specific capability or behavior is being added, changed, or completed?
- Scope
Which parts of the system are allowed to change?
- Dependencies
What existing components, configuration, or previous units does this work depend on?
- Expected Result
What should be true when the unit is complete?
- Verification
How will completion be proven?
- Acceptance Criteria
Which observable success and applicable failure outcomes must pass, and which checks are required?
- Unit Identity and State
What tracker ID identifies this unit, and what is its starting state and current status?
- If these cannot be clearly identified, the unit should be refined before implementation begins.

## When to Split Work

Split an implementation unit when it includes:
- Multiple unrelated features
- Multiple independent system boundaries
- Several unrelated API routes
- Independent UI and backend behaviors
- Database changes unrelated to the main feature
- Infrastructure work unrelated to the feature
- Multiple independent migrations
- Work that cannot be verified as one clear outcome
If a change cannot be verified end to end as a single logical unit, split it.
A cohesive outcome may span API, workers, database, shared contracts, and UI; crossing boundaries alone does not require splitting.
Foundation units such as schema, shared contracts, or deployment setup may be completed against their own explicit acceptance criteria. Their completion does not imply completion of dependent features.
Undefined behavior requires clarification before dependent implementation; splitting work does not resolve a missing requirement.

## Stay Within the Current Unit

While implementing a unit:
- Do not start future units early while the current unit is active. A documented switch changes which unit is active.
- Do not implement optional features unless they are part of the current requirement.
- Do not perform unrelated cleanup
- Do not resolve unrelated technical debt.
- Do not introduce future architecture that is not currently required.
- Do not modify neighboring features simply because they are discovered during implementation
Record unrelated findings for later work instead of expanding the current scope.

## Use Existing Project State

Before creating something new:
- Check whether the capability already exists.
- Check whether a similar implementation already exists.
- Check whether configuration already supports the requirement.
- Check whether previous units established a pattern that should be continued.
Extend the existing project rather than creating parallel implementations unnecessarily.

## Handling Missing Requirements

Do not invent product behavior that is not defined by the project context.
If a requirement is unclear:
- Check existing project documentation.
- Check architecture and feature context.
- Determine whether the ambiguity affects product behavior or only implementation detail.
If product behavior, an external contract, or a consequential architectural decision is missing, record an open question in the project's progress tracker and pause only the work dependent on its answer. Recording a question does not authorize inventing the answer.
Resolve routine implementation details using existing conventions and constraints without requesting approval for each choice. Document consequential implementation decisions and any assumptions that affect verification.

## Handling Blocked Work

If the current unit depends on missing configuration, external access, unavailable infrastructure, unresolved requirements, or another incomplete unit:
- Do not simulate completion.
- Do not bypass the dependency.
- Complete all work that can safely be completed.
- Clearly identify the remaining blocker.
- Record what is required to continue.
A blocked unit remains incomplete until its required condition is satisfied.
After completing safe independent portions, record the unit as blocked with its unfinished work, dependency, required decision or access, and resume condition. Then another independent unit may become active; units dependent on the blocker must not proceed.
On resumption, recheck the dependency and current project state before continuing. User reprioritization may also defer a unit; preserve its actual incomplete status and resume notes.

## Protected Files

Do not modify the following unless explicitly instructed:

- Generator-owned source files
- Any third-party library internals

Identify protected paths from repository metadata, generation headers, package ownership, or documented conventions before editing. Third-party internals include dependency-managed library source. Generator-owned files are outputs maintained by a generation tool, rather than ordinary project-owned source.
Prefer application wrappers or configuration outside protected files. Use the supported generation process to change protected files only when explicitly instructed to make that change. If ownership is unclear and an edit is necessary, resolve that ambiguity first. Record any authorized exception and how it survives regeneration or dependency updates.

## Respect Project Boundaries

Implementation must remain within the architecture and boundaries defined by the project context.
Do not introduce a new:
- Service
- Database
- Queue
- Storage mechanism
- Runtime
- Deployment component
- External integration
- Major dependency
unless it is necessary for the current unit and compatible with the defined architecture, or an explicit architectural decision authorizes the expansion for that unit.
An architecture entry or future roadmap feature alone does not authorize implementation. Distinguish a new deployment service from ordinary application service classes within an existing boundary.
Architectural expansion should be treated as a separate decision, not an incidental implementation detail.

## Dependency on Previous Units

When a unit depends on previous work:
- Verify the required previous capability exists.
- Reuse its established interfaces and contracts.
- Do not reimplement completed functionality.
- Do not silently change previously completed behavior to make the new unit easier.
If a previous unit must change, treat that change as part of the current scope only when required.
Update the unit boundary and acceptance criteria before making such a change, preserve contract compatibility or explicitly resolve breaking changes, and verify affected existing behavior.

## Verification During Implementation

Verify work as each meaningful portion of the unit is completed.
Do not wait until a large group of changes has accumulated before checking whether the implementation works.
Use verification appropriate to the unit, such as:
- Build validation
- Type checking
- Automated tests
- API checks
- Integration checks
- Database validation
- Runtime verification
- Manual end-to-end checks
Verification should prove the requirement, not merely prove that the code compiles.
Define required checks before implementation and adjust them when authorized scope changes. Record the commands or procedures, results, environment, and material limitations so the evidence can be reproduced without exposing secrets.
Derive verification from the affected project's requirements, architecture invariants, and risks. Where applicable, cover invalid input, duplicate operations, retries, interruption and recovery, data integrity, unavailable dependencies, access control, and protection of sensitive data. These examples apply only when relevant to the unit and do not introduce new product requirements.
Use focused regression tests for critical behavior and meaningful bug fixes as required by code standards. Scale verification to the change; documentation-only changes require consistency review rather than application runtime tests.
Development simulators and test doubles may verify defined contracts, but record that boundary. They do not prove live external integration or satisfy a required live check.

## End-to-End Completion

A feature unit is complete only when its defined path works from its starting point to its expected result.
For example:
Input or trigger
-> applicable validation and processing
-> required state change or output
-> expected user/system behavior
The exact path depends on the feature.
Completion is relative to the declared unit boundary and acceptance criteria, not the entire product flow. Required external verification that is unavailable keeps the unit blocked; independently verified foundation units can still be complete.
Do not mark a unit complete when only one internal layer has been implemented if the requirement depends on additional layers.

## Handling Verification Failures

If verification fails:
- Stop declaring the current unit complete while a required check is failing.
- Determine whether the failure was introduced by the current work.
- Correct failures introduced by the current work within its scope.
- Run the relevant verification again.
Do not bypass required checks merely to mark the unit complete.
If the failure is pre-existing and unrelated, record it separately and verify that the current unit did not introduce it.
An unrelated baseline failure may remain as documented follow-up only when required unit checks pass and evidence shows no regression. If it prevents proving an acceptance criterion or invariant, the unit remains blocked; do not reclassify a necessary check as optional merely because it fails.
Use Handling Blocked Work to switch to independent work when a required check cannot be completed.


## Keep Project Context in Sync

Update the relevant project context whenever implementation changes something that future work must understand.
Examples include:
- Feature scope
- Architecture boundaries
- API contracts
- Data relationships
- Configuration requirements
- Integration behavior
- Deployment requirements
- Important implementation decisions
Update the document responsible for that information.
Document authorized decisions; do not use documentation edits to retroactively approve scope or architecture changes. Resolve required decisions before dependent implementation and synchronize affected documentation before dependent work continues.

## Progress Tracking

Update the project's progress tracker after each meaningful implementation change and whenever a unit starts, completes, becomes blocked, is deferred, or resumes. Group related edits into a meaningful checkpoint rather than logging every file edit.
Before relying on the tracker, reconcile placeholders or stale entries against existing code and verification. Record unverified capabilities as unverified; do not infer completion from file existence.
For each unit, record:
- Unit ID, requirement reference, scope, acceptance criteria, and status (`planned`, `in progress`, `blocked`, `deferred`, or `complete`)
- What was completed
- What remains
- Verification evidence and limitations, including relevant baseline failures
- Important decisions
- Current blockers
- Resume conditions for blocked or deferred work
- Required follow-up work
- Timestamp each update with an explicit timezone or offset, using the project's agreed timezone or UTC when none is specified.
The tracker should describe the real project state.
Do not mark work complete when required verification or dependencies remain unresolved.

## Before Moving to the Next Unit

For normal progression after completion, confirm that:
- The current unit satisfies its defined requirement.
- The implementation remains within the approved scope.
- The expected behavior within the declared unit boundary works.
- Required verification passes.
- No project architecture invariant was violated.
- Required context documentation is updated.
- The project's progress tracker reflects the current state.
- Remaining blockers or follow-up work are explicitly recorded.
Only then mark the unit complete and proceed normally. A blocked or explicitly deferred unit may be left incomplete under the documented switching rules above; confirm the next unit does not depend on unfinished work.
