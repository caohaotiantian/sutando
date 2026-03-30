---
name: sutando-plan
description: >
  Phase 2 of Sutando workflow. Reads SPEC.md, decomposes into atomic TDD tasks,
  analyzes dependencies, decides parallelism strategy, produces docs/sutando/PLAN.md.
  Ends with hard approval gate before autonomous execution.
---

# Sutando Phase 2: Planning

> The last human gate — once the plan is approved, the Stand takes over.

## Overview

Read `docs/sutando/SPEC.md`, decompose into atomic tasks (each one TDD cycle), analyze dependencies, decide sequential vs wave-based execution, and write `docs/sutando/PLAN.md`. The user MUST approve the plan before execution begins.

## Mode Scaling

Read mode from `.sutando/config.json` and follow the matching path.

### Mode A: Minimal Planning
- **DO:** File map, task decomposition, zero-placeholder check, approval gate
- **SKIP:** Model profiling, scope estimation tables, dependency visualization, checkpoint type classification
- **ASSUME:** Sequential execution, balanced model profile
- **Max tasks:** 5 (if more needed, suggest escalating to Mode B)

### Mode B: Standard Planning
- **DO:** All steps. Parallelism decision. Scope estimation.
- **SKIP:** Model profiling (use balanced default)
- **Checkpoint types:** auto and human-verify only

### Mode C: Full Planning
- **DO:** All steps including model profiling, full dependency graphs, checkpoint type classification for every task
- **SKIP:** Nothing

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

Read `docs/sutando/SPEC.md` completely. Understand:
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

> **Checkpoint examples in task format** — See `references/plan-advanced.md`.

### Step 4: Dependency Analysis

For each task, identify what it depends on:
- Does it use types/functions defined in another task?
- Does it need infrastructure (DB, test setup) from another task?
- Can it run in parallel with others?

Draw the dependency graph mentally. Independent tasks can run in parallel.

### Task Dependency Visualization

Include a text-based dependency graph in the plan. Every task must appear exactly once. Arrows flow left-to-right. Tasks at the same level with no arrow between them can run in parallel.

> **Dependency graph examples and common patterns** (fan-out, fan-in, diamond, wave derivation) — See `references/plan-advanced.md`.

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

> **Estimation heuristics** (per-task time ranges, over/under-estimation guidance) — See `references/plan-advanced.md`.

### Step 7: Write PLAN.md

Write to `docs/sutando/PLAN.md`:

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
2. Create `docs/sutando/PLAN-01-[name].md`, `docs/sutando/PLAN-02-[name].md`, etc.
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

Review the plan against these anti-patterns: tasks too large (multiple behaviors crammed in one), tasks too small (no testable behavior), missing test step, vague verification, hidden dependencies, circular dependencies, "same as Task N" references.

> **Anti-pattern gallery with bad/good examples** — See `references/plan-advanced.md`.

### Step 11: Verification Command Design

Every task needs a concrete verification command that is specific (exact test file + expected output), deterministic (same code = same result), and composable (covers this task's scope, not the whole suite).

> **Verification patterns by artifact type and examples** — See `references/plan-advanced.md`.

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

Commit the PLAN immediately after writing it:

```bash
git add docs/sutando/PLAN.md && git commit -m "docs: add Sutando implementation plan"
```

Use sutando-tools.cjs for state operations — provides lockfile safety and atomic writes:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/sutando-tools.cjs" state set phase approved
```

This records that the user approved the plan, enabling the transition to execution.

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

> **Worked example** — For a complete multi-task plan walkthrough (JWT auth, 7 tasks, 4 waves), see `references/plan-advanced.md`.

