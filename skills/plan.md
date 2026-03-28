---
name: sutando-plan
description: >
  Phase 2 of Sutando workflow. Reads SPEC.md, decomposes into atomic TDD tasks,
  analyzes dependencies, decides parallelism strategy, produces .sutando/PLAN.md.
  Ends with hard approval gate before autonomous execution.
---

# Sutando Phase 2: Planning

> The last human gate — once the plan is approved, the Stand takes over.

## Overview

Read `.sutando/SPEC.md`, decompose into atomic tasks (each one TDD cycle), analyze dependencies, decide sequential vs wave-based execution, and write `.sutando/PLAN.md`. The user MUST approve the plan before execution begins.

## Model Profiling

Before planning begins, assess the project's complexity and recommend a model profile. The profile controls which model tier each agent role uses during execution.

### Profile Definitions

| Profile | Planning Agent | Execution Agent | Review Agent |
|---------|---------------|-----------------|--------------|
| quality | Most capable | Most capable | Most capable |
| balanced | Most capable | Standard | Standard |
| budget | Standard | Fast/cheap | Fast/cheap |

### Complexity Assessment

Evaluate the project along these dimensions:

- **Architecture novelty** — Is this a well-understood pattern (CRUD app, REST API) or something unusual (custom protocol, novel algorithm)?
- **Integration surface** — How many external systems, APIs, or services are involved?
- **Concurrency/state complexity** — Are there race conditions, distributed state, or real-time requirements?
- **Domain complexity** — Does this require specialized knowledge (crypto, audio processing, compiler design)?

**Scoring:**
- All dimensions low → recommend `budget`
- Any dimension moderate → recommend `balanced`
- Any dimension high → recommend `quality`

Present the recommendation:

> "**Model profile: balanced** — This is a standard REST API with one external integration (Stripe). Execution agents can follow explicit plan instructions without needing top-tier reasoning. Override with `quality` or `budget` if you prefer."

Record the chosen profile in `.sutando/config.json` under `model_profile`. The user can override at any time.

### Design Rationale

- **Planning always gets the strongest model available** — Architecture decisions, goal decomposition, and task design have the highest leverage. Bad planning cascades into every task.
- **Execution can use standard models** — The plan already contains the reasoning. Executors follow explicit instructions.
- **Review needs reasoning, not just pattern matching** — Reviewers must check if code *delivers* what the task promised, not just confirm it compiles. Standard models handle this well; cheap models may miss subtle gaps.
- **Budget is for high-volume, low-stakes work** — Bulk file generation, simple transformations, mechanical refactors.

## Scope Check

Before diving into task decomposition, assess whether this spec belongs in a single plan.

If the spec covers multiple independent subsystems (auth + payments + notifications), it should have been broken into sub-project specs during clarification. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

**Signs you need multiple plans:**
- The spec has clearly separate sections with no shared data models
- Different subsystems use different technologies (e.g., REST API + WebSocket server)
- One subsystem could ship independently and provide value

**Signs a single plan is fine:**
- Everything shares a data model
- Changes are tightly coupled (A doesn't work without B)
- The scope is small enough to fit in 15 tasks or less

## Process

### Step 1: Read and Internalize SPEC.md

Read `.sutando/SPEC.md` completely. Understand:
- What we're building (Goal)
- What constraints exist
- What decisions were made
- What's out of scope (do NOT plan for out-of-scope items)

Also read the project itself:
- What framework/language is in use?
- What's the existing file structure and naming convention?
- What test framework is configured (or not)?
- What's the existing test coverage like?
- Are there any CI/CD pipelines that will run on commits?

**If the project has no test infrastructure at all** (no test framework, no test directory, no test scripts in package.json), your plan MUST start with "Task 0: Test Infrastructure Setup" that installs the test framework, creates the test directory structure, adds the test script to package.json, and writes one smoke test to verify the setup works.

### Step 2: File Structure Mapping

Before defining tasks, map ALL files that will be created or modified:

```markdown
## File Map
| File | Action | Responsibility |
|------|--------|---------------|
| `src/path/file.ts` | Create | [What this file does] |
| `src/path/existing.ts` | Modify | [What changes and why] |
| `tests/path/file.test.ts` | Create | [What this tests] |
```

**Rules:**
- Exact file paths (not "appropriate location")
- One clear responsibility per file
- Follow existing codebase conventions (read the project first)
- If the project has no test files yet, include test infrastructure setup as Task 0

**File Structure Design Principles:**
- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- Prefer smaller, focused files over large monoliths. Agents reason best about code they can hold in context at once, and edits are more reliable when files are focused.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure — but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.
- Test files mirror source files: `src/auth/login.ts` → `tests/auth/login.test.ts` (or whatever convention the project uses)

**File Map Example:**
```markdown
## File Map
| File | Action | Responsibility |
|------|--------|---------------|
| `src/db/schema.ts` | Create | Drizzle schema: User, Session tables |
| `src/auth/hash.ts` | Create | Password hashing with bcrypt |
| `src/auth/token.ts` | Create | JWT generation and verification |
| `src/auth/middleware.ts` | Create | Express auth middleware (verify JWT, attach user) |
| `src/routes/auth.ts` | Create | POST /register, POST /login, POST /logout |
| `src/routes/auth.ts` | Modify | Add password reset endpoint |
| `tests/auth/hash.test.ts` | Create | Tests for password hashing |
| `tests/auth/token.test.ts` | Create | Tests for JWT generation/verification |
| `tests/auth/middleware.test.ts` | Create | Tests for auth middleware |
| `tests/routes/auth.test.ts` | Create | Integration tests for auth routes |
```

### Step 3: Task Decomposition

Break the work into atomic tasks. Each task is ONE TDD cycle:

```markdown
### Task N: [Component Name]

**Checkpoint:** [auto | human-verify | decision | human-action]

**Files:**
- Create: `exact/path/to/file.ext`
- Create: `exact/path/to/file.test.ext`
- Modify: `exact/path/to/existing.ext` (what changes)

**Steps:**
1. RED — Write failing test for [specific behavior]
2. RUN — Verify failure (expected: [specific failure message])
3. GREEN — Implement minimal code to pass
4. RUN — Verify all tests pass
5. REFACTOR — Clean up if needed, re-verify green
6. COMMIT — `type(scope): description`

**Depends on:** [Task N or "none"]
**Verification:** [Concrete command + expected output]
```

**Granularity rules:**
- Each task produces ONE testable behavior
- Each task can be understood without reading other tasks
- Each task has a concrete verification command with expected output
- Each task specifies an exact commit message

### Checkpoint Type System

Every task MUST declare a checkpoint type. Default is `auto`.

#### `auto` — Autonomous completion (default, ~85% of tasks)

The agent completes the task, verifies it, and moves on. No human interaction needed.

Use for: Pure code tasks, test writing, refactoring, file creation, configuration changes — anything where verification is a command that returns pass/fail.

#### `human-verify` — Human confirms correctness (~10% of tasks)

The agent completes all work, then presents results for human review before marking done. The agent does NOT proceed until the human approves.

Use for: Visual UI work, interactive flows, UX polish, layout verification, anything where "does it look/feel right?" matters more than "does the test pass?"

#### `decision` — Human chooses between options (~4% of tasks)

The agent presents options with trade-offs and waits for the human to choose. No implementation happens until the decision is made.

Use for: Technology selection (which auth library?), design direction (tabs vs sidebar?), data model choices (SQL vs NoSQL?), any fork in the road where the spec didn't prescribe the answer.

#### `human-action` — Human must do something (~1% of tasks)

The agent cannot proceed without a human performing a physical action. This is rare — only use when there is genuinely no CLI/API alternative.

Use for: Entering API keys, clicking email verification links, completing OAuth flows in a browser, approving deployments in external dashboards that have no CLI.

**Rules:**
- If you're unsure, default to `auto`. Most tasks are `auto`.
- Never use `human-verify` for things that can be verified with a test command.
- Never use `human-action` for things the agent can do via CLI/API.
- `decision` checkpoints should appear early in the plan — before implementation that depends on the choice.
- Group `human-verify` checkpoints — don't interrupt the human after every UI task. Build several things, then verify the batch.

**Checkpoint Examples in Task Format:**

`auto` task (most common):
```markdown
### Task 3: Password hashing utility
**Checkpoint:** auto
**Files:**
- Create: `src/auth/hash.ts`
- Create: `tests/auth/hash.test.ts`
**Steps:**
1. RED — Write test: hashPassword("test123") returns a bcrypt hash, verifyPassword("test123", hash) returns true
2. RUN — Expected: "hashPassword is not defined"
3. GREEN — Implement hashPassword and verifyPassword using bcrypt
4. RUN — All tests pass
5. REFACTOR — Extract salt rounds to constant
6. COMMIT — `feat(auth): add password hashing utility`
**Depends on:** none
**Verification:** `npm test -- tests/auth/hash.test.ts` → 2 tests passing
```

`human-verify` task:
```markdown
### Task 8: Login page UI
**Checkpoint:** human-verify
**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/LoginForm.tsx`
**Steps:**
1. RED — Write test: LoginForm renders email input, password input, and submit button
2. RUN — Expected: "LoginForm is not defined"
3. GREEN — Implement LoginForm with Tailwind styling
4. RUN — All tests pass
5. REFACTOR — Extract input component if repeated
6. COMMIT — `feat(auth): add login page`
**Depends on:** Task 6 (auth API routes)
**Verification:** `npm test -- tests/components/LoginForm.test.ts` → 3 tests passing
**Human verification:** Start dev server, visit /login, verify: form centered, inputs styled, responsive on mobile, error states visible
```

`decision` task:
```markdown
### Task 1: Select authentication library
**Checkpoint:** decision
**Options:**
- A) `jose` — ESM-native, lightweight, no native dependencies. Good for edge runtimes.
- B) `jsonwebtoken` — Battle-tested, huge ecosystem, but CJS-only. Requires ESM workarounds.
- C) `@auth/core` — Full auth framework, handles more than JWT. Heavier, more opinionated.
**Depends on:** none
**Impact:** Affects Tasks 3-7 (all token handling code)
```

`human-action` task:
```markdown
### Task 2: Configure Stripe API key
**Checkpoint:** human-action
**Automated steps:** Create `.env` file with placeholder, add STRIPE_SECRET_KEY to .env.example
**Human action:** Provide your Stripe secret key (starts with sk_test_ or sk_live_)
**After human provides key:** Agent writes it to .env, verifies with `stripe whoami`
**Depends on:** none
```

### Step 4: Dependency Analysis

For each task, identify what it depends on:
- Does it use types/functions defined in another task?
- Does it need infrastructure (DB, test setup) from another task?
- Can it run in parallel with others?

Draw the dependency graph mentally. Independent tasks can run in parallel.

### Task Dependency Visualization

Include a text-based dependency graph in the plan so the execution agent and the human can see the shape of the work at a glance:

```
Task 1 (DB schema) ──┬── Task 2 (User model)
                      ├── Task 3 (Session model)
                      └── Task 4 (Auth middleware) ── Task 5 (Login endpoint) ── Task 6 (Protected routes)
                                                     └── Task 7 (Logout endpoint)
```

**Rules for the graph:**
- Every task must appear exactly once
- Arrows flow left-to-right (dependency → dependent)
- Tasks at the same horizontal level with no arrow between them can run in parallel
- Keep it simple — if the graph is too complex to draw in ASCII, the plan needs to be split

**Deriving waves from the graph:**

The dependency graph directly determines wave composition. Each wave contains tasks whose dependencies are ALL satisfied by previous waves.

```
Wave 1: [Tasks with no dependencies]
  Task 1 (DB schema)

Wave 2: [Tasks depending only on Wave 1]
  Task 2 (User model) ─── depends on Task 1
  Task 3 (Session model) ─ depends on Task 1
  Task 4 (Auth middleware) ─ depends on Task 1

Wave 3: [Tasks depending on Wave 1 + 2]
  Task 5 (Login endpoint) ─── depends on Tasks 2, 4
  Task 7 (Logout endpoint) ── depends on Task 4

Wave 4: [Tasks depending on Wave 1 + 2 + 3]
  Task 6 (Protected routes) ── depends on Task 5
```

Notice that Wave 2 has three tasks that can all run in parallel — they all depend only on Task 1 and don't depend on each other.

**Common dependency patterns:**

- **Linear chain:** Task 1 → 2 → 3 → 4. Each depends on the previous. Execution is fully sequential. This is common for tightly coupled features.
- **Fan-out:** Task 1 → [Tasks 2, 3, 4, 5]. One foundation task enables many independent tasks. Great for parallelism.
- **Fan-in:** [Tasks 1, 2, 3] → Task 4. Multiple independent tasks feed into an integration task. The integration task is the wave after all prerequisites complete.
- **Diamond:** Task 1 → [Tasks 2, 3] → Task 4. Fork and rejoin. Tasks 2 and 3 run in parallel, then Task 4 integrates them.

### Step 5: Parallelism Decision

Based on the dependency graph, decide execution strategy:

**Sequential** (use when):
- All tasks are dependent on the previous one
- Total tasks <= 3
- Single-file changes

**Wave-based** (use when):
- Groups of independent tasks exist
- Total tasks >= 4
- Multiple files being created in parallel

Document your reasoning:

> "**Execution: Wave-based (3 waves)** — Tasks 1-3 are independent foundation work (DB schema, user model, test setup). Tasks 4-5 both depend on the foundation but not each other. Tasks 6-7 are sequential integration."

### Step 6: Scope Estimation

For each wave (or for the plan as a whole if sequential), estimate:

```markdown
## Scope Estimate

| Wave | Tasks | Files Touched | Complexity | Est. Human Time |
|------|-------|---------------|------------|-----------------|
| 1 | 1-3 | 6 create, 0 modify | Moderate | ~30 min |
| 2 | 4-5 | 3 create, 2 modify | Complex | ~45 min |
| 3 | 6-7 | 2 create, 1 modify | Trivial | ~15 min |
| **Total** | **7** | **11 create, 3 modify** | | **~90 min** |
```

**Complexity definitions:**
- **Trivial** — Boilerplate, configuration, simple wiring. No real logic. (< 5 min per task for a human)
- **Moderate** — Straightforward logic, well-understood patterns, clear test cases. (5-15 min per task)
- **Complex** — Non-obvious logic, multiple edge cases, integration with external systems, concurrency. (15-30 min per task)

**Why estimate human time?** It gives the user a gut-check on scope. If the estimate says "4 hours" and they expected "30 minutes," either the spec is bigger than they thought or the plan is over-decomposed.

**Estimation heuristics:**
- Trivial tasks: 2-5 minutes each (boilerplate, config, wiring)
- Moderate tasks: 5-15 minutes each (CRUD endpoints, model definitions, straightforward tests)
- Complex tasks: 15-30 minutes each (auth flows, payment integration, real-time features, complex queries)
- Task 0 (test infrastructure): 10-20 minutes if setting up from scratch
- `decision` checkpoints: Add 5-10 minutes for user review time
- `human-verify` checkpoints: Add 5-15 minutes for user testing time

**Don't over-estimate.** The agent executes faster than a human, so these estimates are for human context only. If total estimated human time exceeds 3 hours, the plan is probably too big — check the decomposition rules.

**Don't under-estimate.** If a task involves unfamiliar APIs, external service integration, or complex state management, round up. Surprises always add time, never subtract it.

### Step 7: Write PLAN.md

Write to `.sutando/PLAN.md`:

```markdown
---
mode: [from config.json]
model_profile: [quality/balanced/budget]
parallelism: [sequential/wave]
total_tasks: [N]
waves: [N or 1 if sequential]
created: [YYYY-MM-DD]
status: draft
---

# Implementation Plan: [Feature Name]

## Overview
**Goal:** [From SPEC.md — one sentence]
**Approach:** [2-3 sentences about the architecture/strategy]
**Execution:** [Sequential / Wave-based (N waves)]
**Interruption:** [From config.json — minimal/normal/checkpoint]
**Model Profile:** [quality/balanced/budget — with one-line justification]

## Dependency Graph
```
[ASCII dependency graph]
```

## Scope Estimate
| Wave | Tasks | Files Touched | Complexity | Est. Human Time |
|------|-------|---------------|------------|-----------------|
[scope table]

## File Map
| File | Action | Responsibility |
|------|--------|---------------|
[Complete file listing]

## [Wave 1: Theme / Tasks (sequential)]
### Task 1: ...
### Task 2: ...

## [Wave 2: Theme]
### Task 3: ...
...
```

### Step 8: Plan Decomposition Rules

Before finalizing, check whether the plan should be split:

**Split if ANY of these are true:**
- **More than 15 tasks** — A single plan with 15+ tasks is hard to hold in context. Split at wave boundaries into sub-plans that can be executed independently.
- **Tasks span more than 3 independent subsystems** — If tasks touch the auth system, the payment system, AND the notification system with no shared code, create one plan per subsystem. Each plan should produce working, testable software on its own.
- **Plan would take more than ~2 hours of estimated human time** — Split at natural boundaries. Each sub-plan should be completable in one focused session.

**How to split:**
1. Identify natural boundaries (subsystems, layers, features)
2. Create `.sutando/PLAN-01-[name].md`, `.sutando/PLAN-02-[name].md`, etc.
3. Each sub-plan gets its own frontmatter, file map, and dependency graph
4. Define explicit interfaces between sub-plans: "Sub-plan 2 expects these types/functions to exist from Sub-plan 1"
5. Sub-plans execute in order — later plans can depend on earlier plans being complete

**Don't split if:**
- Tasks are tightly coupled (most tasks depend on most other tasks)
- The total is only slightly over the threshold (16 tasks is fine as one plan)
- Splitting would create sub-plans with only 1-2 tasks (merge them back)

### Step 9: Zero Placeholder Self-Check

Before presenting the plan, verify EVERY task has:
- [ ] Exact file paths (no "appropriate location", no "similar to Task N")
- [ ] Specific test behavior described (no "write appropriate tests")
- [ ] Concrete verification command with expected output
- [ ] Explicit commit message
- [ ] Dependencies stated (or "none")
- [ ] Checkpoint type declared (or defaults to `auto`)

**If any placeholder is found:** Fix it. If you can't be specific, the SPEC has a gap — go back to the user and ask.

### Step 10: Anti-Pattern Self-Check

Review the plan against these known anti-patterns. If you find any, fix them before presenting.

#### Tasks Too Large

**Bad:**
```markdown
### Task 3: Build the entire auth system
Files: Create src/auth/*, tests/auth/*
Steps:
1. RED — Write tests for registration, login, logout, password reset, email verification
2. GREEN — Implement all auth flows
```

**Why bad:** This is 5-7 tasks crammed into one. Each auth flow is a separate testable behavior. If login breaks, you can't tell if it's login or registration that's the problem.

**Fix:** Split into: Task 3 (registration), Task 4 (login), Task 5 (logout), Task 6 (password reset), Task 7 (email verification). Each with its own RED-GREEN-REFACTOR cycle.

#### Tasks Too Small

**Bad:**
```markdown
### Task 5: Create the user model file
Files: Create src/models/user.ts
Steps: 1. Create the empty file

### Task 6: Add the User interface
Files: Modify src/models/user.ts
Steps: 1. Add the interface definition

### Task 7: Add the validation function
Files: Modify src/models/user.ts
Steps: 1. Add validateUser()
```

**Why bad:** These are three steps of one task. No individual task produces a testable behavior. Task 5 creates an empty file — what test could possibly verify that?

**Fix:** Merge into one task: "Task 5: User model with validation" — RED: test that validateUser rejects invalid input, GREEN: implement User interface + validateUser, COMMIT.

#### Missing Test Step

**Bad:**
```markdown
### Task 4: Database connection helper
Files: Create src/db/connection.ts
Steps:
1. Implement the connection pool
2. Add retry logic
3. COMMIT
```

**Why bad:** No RED step. No failing test. No verification. This violates the iron law. Without a test, how do you know the retry logic works? "It looks right" is not verification.

**Fix:** RED: test that connection retries 3 times on failure. RUN: verify failure. GREEN: implement connection pool with retry. RUN: verify pass. REFACTOR. COMMIT.

#### Vague Verification

**Bad:**
```markdown
**Verification:** Check that it works correctly
```

**Why bad:** "Works correctly" is not a verification command. What command do you run? What output do you expect? "It works" is the most dangerous phrase in software.

**Fix:**
```markdown
**Verification:** `npm test -- --grep "user registration"` → 3 tests passing, 0 failing
```

#### Hidden Dependencies

**Bad:**
```markdown
### Task 5: Login endpoint
Depends on: Task 1 (DB schema)
Steps:
1. RED — Write test that POST /login returns a JWT for valid credentials
2. GREEN — Implement login handler using hashPassword() and generateToken()
```

**Why bad:** `hashPassword()` is defined in Task 3 (registration) and `generateToken()` is defined in Task 4 (token utilities). But the dependency only lists Task 1. If Tasks 3-5 run in parallel (they look independent from the dependency graph), Task 5 will fail because those functions don't exist yet.

**Fix:**
```markdown
### Task 5: Login endpoint
Depends on: Task 1 (DB schema), Task 3 (hashPassword), Task 4 (generateToken)
```

#### Circular Dependencies

**Bad:**
```markdown
### Task 3: User service
Depends on: Task 5 (Auth middleware — needs currentUser())

### Task 5: Auth middleware
Depends on: Task 3 (User service — needs findUserById())
```

**Why bad:** Neither task can start. This is a design problem, not a planning problem.

**Fix:** Extract the shared interface into its own task: Task 3 (User types/interfaces), Task 4 (User service, depends on 3), Task 5 (Auth middleware, depends on 3).

#### "Same as Task N"

**Bad:**
```markdown
### Task 7: Delete endpoint
Same pattern as Task 5 (Create endpoint) but for deletion.
```

**Why bad:** The execution agent reads tasks independently. It may not have Task 5 in context. Every task must be self-contained.

**Fix:** Write out the full task with all files, steps, and verification — even if it looks repetitive.

### Step 11: Verification Command Design

Every task needs a concrete verification command. Good verification commands are:

**Specific:**
```markdown
# GOOD — specific test with expected output
**Verification:** `npm test -- tests/auth/hash.test.ts` → 2 tests passing, 0 failing

# BAD — vague
**Verification:** Run the tests and make sure they pass
```

**Deterministic:**
```markdown
# GOOD — always produces the same output for the same code
**Verification:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health` → 200

# BAD — depends on timing or external state
**Verification:** Check that the API responds quickly
```

**Composable:**
```markdown
# GOOD — test command covers exactly this task's scope
**Verification:** `npm test -- --grep "password hashing"` → 3 tests passing

# BAD — runs everything, hard to isolate this task's contribution
**Verification:** `npm test` → all tests pass
```

**For different artifact types:**

| Artifact | Verification Pattern |
|----------|---------------------|
| Pure function | Unit test with specific input → expected output |
| API endpoint | `curl` or test that hits the endpoint, checks status + body |
| React component | Component test that renders and asserts DOM content |
| Database migration | `npx prisma migrate status` shows no pending migrations |
| Config file | Test that loads config and asserts expected values |
| CLI command | Run with test args, check exit code + stdout |
| WebSocket handler | Integration test that connects, sends message, asserts response |

### Step 12: Present Plan and Request Approval

Present the plan inline, then:

> "Here's the implementation plan: **[N] tasks in [M] waves**. After you approve, I enter autonomous mode and work through these using TDD. I'll follow your interruption preference (**[setting]**).
>
> **Model profile:** [profile] — [one-line justification]
>
> **Scope estimate:** ~[X] files across [Y] waves, estimated [Z] min of equivalent human work.
>
> This is the **last required checkpoint** until delivery. Review the plan above — approve, or want changes?"

**If the user requests changes:** Revise the plan, re-present for approval.
**If approved:** Update PLAN.md status to `approved`, then update state via the CLI, and transition to execution.

## After Approval

Use sutando-tools.cjs for state operations — provides lockfile safety and atomic writes:

```bash
SUTANDO_ROOT="$HOME/.claude/skills/sutando"
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase plan
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase approved
```

The first command records that planning is complete. The second records that the user approved the plan, enabling the transition to execution.

Then transition to execution (the orchestrator handles routing).

## Red Flags

| Thought | Reality |
|---------|---------|
| "This task is obvious, I'll skip the test step" | Every task gets RED-GREEN-REFACTOR. No exceptions. |
| "I'll figure out the details during execution" | The plan IS the details. Be specific now. |
| "Tasks 3 and 7 are similar, I'll say 'same as Task 3'" | Repeat the content. Each task must be self-contained. |
| "I can't specify the exact error message" | Then you don't understand the test well enough. Think harder. |
| "The user seems eager to start, I'll skip approval" | Hard gate. No exceptions. |
| "15 tasks is fine, no need to split" | Check the decomposition rules. If 3+ subsystems or 2+ hours, split. |
| "I'll let the execution agent figure out the checkpoint type" | Every task declares its checkpoint type at planning time. Default is `auto`. |
| "This task is complex but I'll mark it trivial" | Honest estimation protects the user's time expectations. Inflate slightly if uncertain. |
| "The dependency graph is too complex to draw" | Then the plan is too complex. Simplify the design or split the plan. |
| "I don't know the exact file paths yet" | Read the codebase. Look at existing conventions. If you can't determine exact paths, the SPEC is underspecified — ask the user. |

## Complete Worked Example

Here's a complete mini-plan showing all the concepts in action.

**Spec summary:** Add JWT authentication to an existing Express API. Users can register, log in, and access protected routes.

```markdown
---
mode: A
model_profile: balanced
parallelism: wave
total_tasks: 7
waves: 4
created: 2026-03-28
status: draft
---

# Implementation Plan: JWT Authentication

## Overview
**Goal:** Add user registration, login, and route protection using JWT tokens.
**Approach:** bcrypt for password hashing, jose for JWT (ESM-compatible), middleware pattern for route protection. Test-first with supertest for HTTP assertions.
**Execution:** Wave-based (4 waves)
**Interruption:** normal
**Model Profile:** balanced — standard auth patterns, no novel architecture

## Dependency Graph
```
Task 1 (test setup) ──┬── Task 2 (password hashing)
                       ├── Task 3 (JWT tokens)
                       │
                       ├── Task 4 (register) ── depends on 2
                       ├── Task 5 (login) ──── depends on 2, 3
                       │
                       └── Task 6 (middleware) ── depends on 3
                            └── Task 7 (protected route) ── depends on 6
```

## Scope Estimate
| Wave | Tasks | Files Touched | Complexity | Est. Human Time |
|------|-------|---------------|------------|-----------------|
| 1 | 1 | 2 create, 1 modify | Trivial | ~5 min |
| 2 | 2-3 | 4 create | Moderate | ~20 min |
| 3 | 4-6 | 6 create | Moderate | ~30 min |
| 4 | 7 | 2 create | Trivial | ~10 min |
| **Total** | **7** | **14 create, 1 modify** | | **~65 min** |

## File Map
| File | Action | Responsibility |
|------|--------|---------------|
| `jest.config.js` | Create | Jest configuration for the project |
| `package.json` | Modify | Add jest, supertest, @types as devDependencies |
| `src/auth/hash.ts` | Create | hashPassword(), verifyPassword() with bcrypt |
| `src/auth/token.ts` | Create | generateToken(), verifyToken() with jose |
| `src/auth/middleware.ts` | Create | requireAuth Express middleware |
| `src/routes/auth.ts` | Create | POST /register, POST /login |
| `src/routes/protected.ts` | Create | GET /me (protected endpoint) |
| `tests/setup.ts` | Create | Test database setup/teardown |
| `tests/auth/hash.test.ts` | Create | Password hashing tests |
| `tests/auth/token.test.ts` | Create | JWT token tests |
| `tests/auth/middleware.test.ts` | Create | Auth middleware tests |
| `tests/routes/auth.test.ts` | Create | Registration and login integration tests |
| `tests/routes/protected.test.ts` | Create | Protected route integration tests |

## Wave 1: Foundation

### Task 1: Test infrastructure setup
**Checkpoint:** auto
**Files:**
- Create: `jest.config.js`
- Create: `tests/setup.ts`
- Modify: `package.json` (add devDependencies and test script)
**Steps:**
1. RED — Write a smoke test: `test('test framework works', () => expect(1 + 1).toBe(2))`
2. RUN — Expected: jest not found or no test script
3. GREEN — Install jest, ts-jest, supertest. Create jest.config.js. Add "test" script to package.json.
4. RUN — Smoke test passes
5. REFACTOR — n/a
6. COMMIT — `chore: set up jest test infrastructure`
**Depends on:** none
**Verification:** `npm test` → 1 test passing, 0 failing

## Wave 2: Crypto Utilities (parallel)

### Task 2: Password hashing
**Checkpoint:** auto
**Files:**
- Create: `src/auth/hash.ts`
- Create: `tests/auth/hash.test.ts`
**Steps:**
1. RED — Write tests: hashPassword("secret") returns string != "secret"; verifyPassword("secret", hash) returns true; verifyPassword("wrong", hash) returns false
2. RUN — Expected: "Cannot find module '../src/auth/hash'"
3. GREEN — Implement using bcrypt with 12 salt rounds
4. RUN — 3 tests passing
5. REFACTOR — Extract SALT_ROUNDS constant
6. COMMIT — `feat(auth): add password hashing with bcrypt`
**Depends on:** Task 1
**Verification:** `npm test -- tests/auth/hash.test.ts` → 3 tests passing

### Task 3: JWT token utilities
**Checkpoint:** auto
**Files:**
- Create: `src/auth/token.ts`
- Create: `tests/auth/token.test.ts`
**Steps:**
1. RED — Write tests: generateToken({ userId: "123" }) returns string; verifyToken(token) returns payload with userId; verifyToken("garbage") throws
2. RUN — Expected: "Cannot find module '../src/auth/token'"
3. GREEN — Implement using jose with HS256, 24h expiry
4. RUN — 3 tests passing
5. REFACTOR — Extract JWT_SECRET and EXPIRY to constants
6. COMMIT — `feat(auth): add JWT token generation and verification`
**Depends on:** Task 1
**Verification:** `npm test -- tests/auth/token.test.ts` → 3 tests passing

## Wave 3: Endpoints and Middleware (parallel: 4+5, then 6)

### Task 4: Registration endpoint
**Checkpoint:** auto
**Files:**
- Create: `src/routes/auth.ts` (register handler only)
- Create: `tests/routes/auth.test.ts` (register tests only)
**Steps:**
1. RED — Write test: POST /register with {email, password} returns 201 and user object without password field
2. RUN — Expected: 404 (route doesn't exist)
3. GREEN — Implement register handler: validate input, hash password, store user, return 201
4. RUN — Test passes
5. REFACTOR — Extract input validation
6. COMMIT — `feat(auth): add user registration endpoint`
**Depends on:** Task 1, Task 2
**Verification:** `npm test -- tests/routes/auth.test.ts --grep "register"` → 1 test passing

### Task 5: Login endpoint
**Checkpoint:** auto
**Files:**
- Modify: `src/routes/auth.ts` (add login handler)
- Modify: `tests/routes/auth.test.ts` (add login tests)
**Steps:**
1. RED — Write tests: POST /login with valid credentials returns 200 + JWT; POST /login with wrong password returns 401
2. RUN — Expected: 404 (login route doesn't exist)
3. GREEN — Implement login handler: find user, verify password, generate token, return 200
4. RUN — All auth tests pass (register + login)
5. REFACTOR — n/a
6. COMMIT — `feat(auth): add login endpoint with JWT`
**Depends on:** Task 1, Task 2, Task 3
**Verification:** `npm test -- tests/routes/auth.test.ts` → 3 tests passing

### Task 6: Auth middleware
**Checkpoint:** auto
**Files:**
- Create: `src/auth/middleware.ts`
- Create: `tests/auth/middleware.test.ts`
**Steps:**
1. RED — Write tests: request with valid Bearer token calls next(); request without token returns 401; request with expired token returns 401
2. RUN — Expected: "Cannot find module '../src/auth/middleware'"
3. GREEN — Implement requireAuth middleware: extract Bearer token, verify with verifyToken, attach user to req
4. RUN — 3 tests passing
5. REFACTOR — Extract token parsing helper
6. COMMIT — `feat(auth): add JWT auth middleware`
**Depends on:** Task 1, Task 3
**Verification:** `npm test -- tests/auth/middleware.test.ts` → 3 tests passing

## Wave 4: Integration

### Task 7: Protected route
**Checkpoint:** auto
**Files:**
- Create: `src/routes/protected.ts`
- Create: `tests/routes/protected.test.ts`
**Steps:**
1. RED — Write tests: GET /me with valid token returns user data; GET /me without token returns 401
2. RUN — Expected: 404 (route doesn't exist)
3. GREEN — Implement GET /me using requireAuth middleware, return current user
4. RUN — All tests pass (full suite)
5. REFACTOR — n/a
6. COMMIT — `feat(auth): add protected /me endpoint`
**Depends on:** Task 6
**Verification:** `npm test` → 13 tests passing, 0 failing
```

This example demonstrates: frontmatter, dependency graph, scope estimation, file map, wave grouping, checkpoint types (all `auto` in this case), concrete verification commands, and exact commit messages. A real plan with UI tasks would include `human-verify` checkpoints; one with technology choices would include `decision` checkpoints.
