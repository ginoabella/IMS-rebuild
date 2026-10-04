# Code Standards

These standards define the engineering rules and conventions for implementing and maintaining the codebase.

They are implementation guardrails, not a workflow or sequence of steps. Apply the relevant rules based on the code being created or changed.

Technology-specific sections apply only where that technology is used. Project standards may refine this baseline; security and data-integrity requirements remain mandatory. Document justified exceptions and their tradeoffs.

Rules using "must" or "never" are mandatory. Rules using "prefer" are defaults that allow justified alternatives. Other rules describe expected practice within their stated scope.

## General

- Give each component a cohesive responsibility
- Fix causes, not symptoms
- Keep concerns and architectural layers separated
- Prefer simple, explicit, readable code
- Maintain one authoritative source of truth
- Validate untrusted data at boundaries before using it in business operations
- Keep core domain rules independent of framework APIs where practical
- Design operations for failure and partial completion
- Make errors, state, and operational behavior observable
- Keep changes focused and document non-obvious constraints and tradeoffs

## TypeScript

- Enable strict TypeScript
- Avoid `any`; prefer `unknown` with proper narrowing
- Minimize unsafe casts and non-null assertions; explain necessary type-check suppressions
- Use runtime validation for external data; TypeScript types do not establish runtime trust
- Use explicit domain types and union types for valid states
- Handle null and undefined explicitly
- Handle Promises, async errors, and timeouts deliberately
- Use ESLint and Prettier consistently

## Framework — Next.js

These rules assume the App Router.

- Default to Server Components
- Use Client Components where interactivity, browser APIs, effects, or client-dependent libraries require them
- Fetch data near its consumers while avoiding unnecessary waterfalls and duplicate requests
- Keep pages and layouts focused on composition
- Keep business logic outside pages, components, and route handlers
- Use Server Actions for application mutations when appropriate
- Use Route Handlers for external or HTTP-facing APIs
- Validate all external input at the server boundary
- Treat authentication and authorization as server-side concerns
- Use Next.js conventions before creating custom abstractions
- Make caching and revalidation intentional
- Keep server-only dependencies and secrets out of client code
- Enforce server-side access checks for Server Actions and Route Handlers

## Framework — NestJS

- Organize code by feature modules
- Keep controllers thin and focused on HTTP concerns
- Put application logic in services and core business rules in services or domain code
- Keep database access behind dedicated data-access code
- Use dependency injection for service and infrastructure dependencies
- Validate all incoming DTOs at the application boundary
- Use DTOs for external input and output contracts
- Keep modules loosely coupled
- Use guards for authentication and authorization
- Use pipes for input validation and transformation
- Use interceptors for concerns around handler execution, such as response transformation and instrumentation
- Use exception filters for consistent error handling
- Prefer NestJS conventions before creating custom abstractions

## Styling

- Use design tokens for shared visual values; allow justified component-specific values when no suitable token exists
- Follow the design scales where defined
- Reuse components before creating new styles
- Keep styling consistent across equivalent elements
- Prefer semantic tokens where a value expresses a design role
- Keep layout responsive by default
- Scope component styles locally; keep resets, themes, and shared utilities intentionally global
- Make interaction states explicit
- Preserve accessibility in visual design
- Extend the design system where one exists; keep additions consistent with its conventions

## Accessibility

- Use semantic structure and accessible names for interactive elements
- Support keyboard operation, visible focus, and deliberate focus management
- Maintain readable contrast and support zoom, reflow, and reduced-motion preferences
- Provide accessible validation errors and status feedback
- Do not rely on color alone to convey meaning

## API Routes

- Parse and validate untrusted request input before using it in business operations
- Authenticate requests before accessing protected resources
- Enforce authorization and applicable ownership or tenant boundaries before reading or modifying protected resources
- Keep route handlers thin and focused on HTTP concerns
- Move business logic into services or domain code
- Return consistent and predictable response shapes
- Use appropriate HTTP methods and status codes
- Never expose internal errors, secrets, or stack traces
- Handle expected failures explicitly
- Define duplicate-request behavior for writes that may be retried, including concurrent duplicates
- Bound request sizes and result sets; use pagination for potentially large collections
- Keep API contracts stable and version breaking changes deliberately
- Log important failures and security-relevant events

## Data and Storage

- Choose storage based on access patterns, size, durability, and lifecycle
- Prefer databases for structured application records and file or blob storage for files and large artifacts
- Store file references and metadata with the application records that own them
- Store large binary content in a database only with a justified requirement
- Keep database access behind dedicated data-access code
- Enforce data integrity with constraints and validation
- Use transactions for operations that must succeed or fail together
- Handle concurrent updates deliberately through constraints, locking, or conflict detection as appropriate
- Define consistency and recovery behavior for operations spanning databases, storage, queues, or external services
- Duplicate data only for a clear purpose, with defined ownership and synchronization behavior
- Keep migrations explicit and version-controlled, with a recovery strategy and rollback where safe and practical
- Define retention, cleanup, and deletion behavior for stored data

## Security and Sensitive Data

- Apply least privilege to application identities, data access, and infrastructure permissions
- Never commit secrets or expose them through client bundles, responses, logs, or diagnostics
- Keep deployment secrets in managed secret storage or protected runtime configuration
- Store passwords only as hashes produced by an appropriate password-hashing algorithm
- Encrypt persisted credentials that must be recoverable and restrict access to them and their encryption keys
- Minimize collection and exposure of sensitive data, including in caches and telemetry
- Use parameterized queries and context-appropriate output encoding
- Protect applicable boundaries against request forgery, unsafe outbound requests, and unsafe file uploads

## Reliability and Resource Use

- Set appropriate timeouts and concurrency limits for external calls and expensive operations
- Retry only eligible failures, with bounded attempts and backoff; ensure repeated side effects are safe
- Propagate cancellation where supported and release resources reliably
- Define failure and recovery behavior for background jobs and asynchronous messages
- Make caching behavior explicit, including expiration, invalidation, and isolation of protected data

## Observability

- Use structured diagnostics with enough context to identify the failing operation
- Carry correlation identifiers across request, job, and service boundaries where applicable
- Use metrics and traces where needed to understand reliability, latency, and resource use
- Distinguish expected failures from unexpected faults without exposing sensitive data
- Never log secrets; redact or omit unnecessary personal data

## Testing

- Test observable behavior rather than private implementation details
- Cover critical domain rules, boundary validation, authorization, and relevant failure paths
- Verify integration contracts where correctness depends on databases, external services, or framework behavior
- Include regression coverage for meaningful bug fixes where practical; document limitations when coverage is impractical
- Keep tests deterministic and independent of uncontrolled external state

## Dependencies and Configuration

- Keep dependency versions reproducible through the package manager's lockfile or equivalent mechanism
- Add dependencies only for a clear need, considering maintenance, compatibility, and security
- Keep configuration explicit and validate required values at initialization
- Avoid environment-specific constants in business logic
- Keep dependency and runtime updates intentional and compatible with supported environments
