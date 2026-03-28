---
name: sutando-execute
description: >
  Phase 3 of Sutando workflow. Autonomous TDD execution of the approved plan.
  Follows iron laws strictly. Dispatches subagents for wave-based parallelism.
  Respects user's interruption tolerance setting.
---

# Sutando Phase 3: Execution

> The Stand Zone — autonomous work with TDD discipline.

## Overview

Execute all tasks from `.sutando/PLAN.md` using strict TDD. This phase runs autonomously — the agent works through tasks without human intervention (subject to interruption tolerance setting).

Read `.sutando/PLAN.md` and `.sutando/config.json` before starting.

## Iron Laws

These are NON-NEGOTIABLE. No exceptions. No rationalizations.

### 1. No Production Code Without a Failing Test First

Write the test. Run it. Watch it FAIL. Only then write the code.

If you wrote production code before writing a test:
- **DELETE the production code.**
- Write the test first.
- Watch it fail.
- Re-implement.

"Keep it as reference" = rationalization = violation.

### 2. No Skipping RED Verification

After writing a test, you MUST run it and confirm:
- The test FAILS (not errors — fails)
- It fails because the feature is MISSING (not because of syntax/import errors)
- The failure message matches what you expected

If the test passes immediately: you're testing existing behavior, not new behavior. Fix the test.
If the test errors (import error, syntax error): fix the error, re-run until you get a proper FAIL.

### 3. No "Done" Without Running Verification

Every task has a verification command in the plan. You MUST:
- Run the exact command specified
- Read the FULL output
- Confirm it matches the expected output

"It should work" = not verified. Run the command.

### 4. No "While I'm Here" Changes

Only touch what the current task specifies. If you notice:
- A bug in unrelated code → Log it in STATE.md Issues section
- A refactoring opportunity → Log it
- An optimization → Log it

Do NOT fix, refactor, or optimize anything outside the current task.

## Execution Modes

### Sequential Mode

For plans with `parallelism: sequential`:

```
For each task in order:
    1. Read task from PLAN.md
    2. Execute TDD cycle (see below)
    3. Self-review against SPEC.md
    4. Commit
    5. Update STATE.md progress
    6. Next task
```

### Wave-Based Mode

For plans with `parallelism: wave`:

```
For each wave:
    1. Read all tasks in this wave from PLAN.md
    2. Assess tasks:
       - If 1 task in wave: execute inline (same as sequential)
       - If 2+ tasks in wave: dispatch subagents
    3. For subagent dispatch:
       a. For each task: create subagent with prompts/implementer.md + task text + SPEC context
       b. Wait for all subagents to complete
       c. For each completed task: dispatch reviewer subagent with prompts/reviewer.md
       d. If any reviewer says FAIL: re-dispatch implementer for that task
       e. After all tasks reviewed and passing: dispatch verifier with prompts/verifier.md
       f. If verifier says FAIL: fix integration issues inline
    4. Update STATE.md progress
    5. Next wave
```

### Subagent Dispatch Template

When dispatching an implementer subagent, use the Agent tool with:

```
Read the file at [absolute path to prompts/implementer.md] for your instructions.

TASK:
[Paste the complete task text from PLAN.md — every line, including Files, Steps, Depends on, Verification]

SPEC CONTEXT:
[Paste the Goal and Architecture sections from SPEC.md]

INTERRUPTION SETTING: [from config.json]
```

When dispatching a reviewer subagent, use the Agent tool with:

```
Read the file at [absolute path to prompts/reviewer.md] for your instructions.

TASK SPEC:
[Paste the task text — what was supposed to be built]

REVIEW SCOPE:
[git diff output for this task's commits]
```

When dispatching a verifier subagent after a wave, use the Agent tool with:

```
Read the file at [absolute path to prompts/verifier.md] for your instructions.

WAVE: [wave number]
TASKS COMPLETED: [list of task numbers and names]
TEST COMMAND: [project's test command]
```

## TDD Cycle (Per Task)

For each task, follow these steps exactly:

### RED: Write the Failing Test

1. Read the task's test file path and test description from PLAN.md
2. Write the test file (or add to existing test file)
3. The test should assert the SPECIFIC behavior described in the task

### RUN: Verify Failure

1. Run the test command specified in the task
2. Read the FULL output
3. Verify:
   - Test FAILS (not errors)
   - Failure is because the feature doesn't exist yet
   - Failure message makes sense
4. If test passes: the behavior already exists — this task may be redundant. Log in STATE.md and skip.
5. If test errors (not fails): fix the error (import, syntax, etc.) and re-run

### GREEN: Minimal Implementation

1. Write the MINIMUM code needed to make the test pass
2. Do not add:
   - Extra features not in the task
   - Error handling not required by the test
   - Comments explaining obvious code
   - Abstractions for "future flexibility"

### RUN: Verify Pass

1. Run the test command again
2. Verify ALL tests pass (not just the new one)
3. If any test fails: fix the issue, re-run
4. If a previously passing test now fails: you broke something — fix before continuing

### REFACTOR: Clean Up

1. Look at the code you just wrote — can it be clearer?
2. Apply refactoring only if it improves readability without changing behavior
3. Re-run ALL tests to confirm nothing broke
4. Skip this step if the code is already clean (most tasks)

### SELF-REVIEW: Check Against Spec

1. Re-read the task's "Verification" command and expected output
2. Run the verification command
3. Confirm the output matches
4. If it doesn't match: fix and re-verify

### COMMIT: Atomic Commit

1. Stage ONLY the files specified in the task
2. Use the exact commit message from the plan
3. Commit

### UPDATE STATE.MD

Mark the task as complete:

```markdown
- [x] Task N: [name] (DONE)
```

Add any decisions or issues encountered.

## Stuck Handling

Read the interruption setting from `.sutando/config.json`:

### Minimal Interruption

Only interrupt the user for:
- Missing credentials or API keys needed to proceed
- Requirements that are impossible or contradictory
- External services that are down and required

For everything else: make your best judgment, document the decision in STATE.md, and keep going.

### Normal Interruption (Default)

When stuck on a task:

**Attempt 1:** Try the obvious approach based on the plan and spec.

**Attempt 2:** Re-read the relevant SPEC.md sections and any docs/comments in the codebase. Try an alternative approach.

**Attempt 3:** Search the codebase for similar patterns. How was this done elsewhere?

**Still stuck after 3 attempts:** Escalate to the user:

> "**Stuck on Task [N] ([name]).**
>
> **Tried:**
> 1. [What attempt 1 was and why it failed]
> 2. [What attempt 2 was and why it failed]
> 3. [What attempt 3 was and why it failed]
>
> **The issue:** [Specific problem description]
>
> **Options I see:**
> - A) [Option with trade-off]
> - B) [Option with trade-off]
>
> Which direction, or do you have other input?"

### Checkpoint Interruption

After EVERY task completes:

> "**Task [N]/[M] done** — [one-line description]. Tests passing. Continue?"

Wait for user confirmation before proceeding to the next task.

## Handling Subagent Status Codes

When a subagent reports back:

- **`DONE`** — Proceed to review (dispatch reviewer subagent)
- **`DONE_WITH_CONCERNS`** — Read the concerns. If minor: proceed to review. If major: assess whether the task needs revision.
- **`NEEDS_CONTEXT`** — Read what context is needed. Provide it and re-dispatch the implementer.
- **`BLOCKED`** — Read the blocker. Options:
  1. Provide more context and re-dispatch
  2. Break the task into smaller sub-tasks
  3. Execute the task inline (skip subagent)
  4. Escalate to user (if interruption setting allows)

## After All Tasks Complete

Update `.sutando/STATE.md`:

```markdown
---
phase: execute
updated: [timestamp]
---

# Sutando State

## Progress
- [x] Task 1: [name] (DONE)
- [x] Task 2: [name] (DONE)
...
- [x] Task N: [name] (DONE)

## Execution Complete
All [N] tasks finished. Transitioning to delivery.
```

Then transition to delivery (the orchestrator handles routing).
