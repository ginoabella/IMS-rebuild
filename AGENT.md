## Application Building Context

Read the following files in order before implementing
or making any architectural decision:

1. `context/project-overview.md` - Defines what we are building and why. Goals, core user flow, features, scope boundaries, and success criteria.

2. `context/Implementation-plan.md` - Defines the current staged delivery plan, MVP priorities, early goals, and which major capabilities are deferred until later phases.

3. `context/architecture.md` - Defines the full technology stack, system boundaries, storage model, auth model, and the invariants the codebase must never violate.

4. `context/ui-context.md` - Defines the visual language - color tokens, typography, border radius scale, component library conventions, layout
patterns, and icon usage.

5. `context/code-standards.md` - Defines TypeScript conventions, framework patterns, API route structure, file organization, and styling rules.

6. `context/ai-workflow-rules.md` - Defines how the agent should behave while building - scoping rules, when to split work, how to handle missing requirements, and verification before moving on.

7. `context/progress-tracker.md` - Tracks the current phase, what's complete, what's in progress, what's coming next, open questions, architecture decisions, and session notes.


Update `context/progress-tracker.md` after each
meaningful implementation change.

If implementation changes the architecture, scope, or
standards documented in the context files, update the
relevant file before continuing.
