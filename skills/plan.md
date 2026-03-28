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

## Process

### Step 1: Read and Internalize SPEC.md

Read `.sutando/SPEC.md` completely. Understand:
- What we're building (Goal)
- What constraints exist
- What decisions were made
- What's out of scope (do NOT plan for out-of-scope items)

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
- If the project has no test files yet, include test infrastructure setup as Task 1

### Step 3: Task Decomposition

Break the work into atomic tasks. Each task is ONE TDD cycle:

```markdown
### Task N: [Component Name]

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

### Step 4: Dependency Analysis

For each task, identify what it depends on:
- Does it use types/functions defined in another task?
- Does it need infrastructure (DB, test setup) from another task?
- Can it run in parallel with others?

Draw the dependency graph mentally. Independent tasks can run in parallel.

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

### Step 6: Write PLAN.md

Write to `.sutando/PLAN.md`:

```markdown
---
mode: [from config.json]
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

### Step 7: Zero Placeholder Self-Check

Before presenting the plan, verify EVERY task has:
- [ ] Exact file paths (no "appropriate location", no "similar to Task N")
- [ ] Specific test behavior described (no "write appropriate tests")
- [ ] Concrete verification command with expected output
- [ ] Explicit commit message
- [ ] Dependencies stated (or "none")

**If any placeholder is found:** Fix it. If you can't be specific, the SPEC has a gap — go back to the user and ask.

### Step 8: Present Plan and Request Approval

Present the plan inline, then:

> "Here's the implementation plan: **[N] tasks in [M] waves**. After you approve, I enter autonomous mode and work through these using TDD. I'll follow your interruption preference (**[setting]**).
>
> This is the **last required checkpoint** until delivery. Review the plan above — approve, or want changes?"

**If the user requests changes:** Revise the plan, re-present for approval.
**If approved:** Update PLAN.md status to `approved`, update STATE.md, transition to execution.

## After Approval

Update `.sutando/STATE.md`:

```markdown
---
phase: plan
updated: [timestamp]
---

# Sutando State

## Configuration
- Mode: [A/B/C]
- Interruption: [setting]
- Parallelism: [sequential/wave]

## Progress
- [x] Clarification complete
- [x] Planning complete — PLAN.md approved
- [ ] Execution (0/[N] tasks)
- [ ] Delivery
```

Then transition to execution (the orchestrator handles routing).

## Red Flags

| Thought | Reality |
|---------|---------|
| "This task is obvious, I'll skip the test step" | Every task gets RED-GREEN-REFACTOR. No exceptions. |
| "I'll figure out the details during execution" | The plan IS the details. Be specific now. |
| "Tasks 3 and 7 are similar, I'll say 'same as Task 3'" | Repeat the content. Each task must be self-contained. |
| "I can't specify the exact error message" | Then you don't understand the test well enough. Think harder. |
| "The user seems eager to start, I'll skip approval" | Hard gate. No exceptions. |
