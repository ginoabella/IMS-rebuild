## Application Building Context

Read the following files in order before implementing
or making any architectural decision:

1. `context/project-overview.md` - Defines what we are building and why. Goals, core user flow, features, scope boundaries, and success criteria.

2. `context/architecture.md` - Defines the full technology stack, system boundaries, storage model, auth model, and the invariants the codebase must never violate.

3. `context/ui-context.md` - Defines the visual language - color tokens, typography, border radius scale, component library conventions, layout
patterns, and icon usage.

4. `context/code-standards.md` - Defines TypeScript conventions, framework patterns, API route structure, file organization, and styling rules.

5. `context/ai-workflow-rules.md` - Defines how the agent should behave while building - scoping rules, when to split work, how to handle missing requirements, and verification before moving on.

6. `context/progress-tracker.md` - Tracks the current goal and implementation units, what's complete, what's in progress, what's coming next, open questions, architecture decisions, and session notes.


Update `context/progress-tracker.md` after each
meaningful implementation change.

If implementation changes the architecture, scope, or
standards documented in the context files, update the
relevant file before continuing.
