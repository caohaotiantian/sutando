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

Execute all tasks from `docs/sutando/PLAN.md` using strict TDD. This phase runs autonomously — the agent works through tasks without human intervention (subject to interruption tolerance setting and checkpoint types).

Read `docs/sutando/PLAN.md` and `.sutando/config.json` before starting.

## Mode Scaling

Read mode from `.sutando/config.json` and follow the matching path.

### Mode A: Lean Execution
- **DO:** Sequential TDD loop only. One-line progress reporting per task.
- **SKIP:** Subagent dispatch, wave analysis, checkpoint protocol, context budget tracking, model profiling
- **Stuck handling:** 2 attempts then escalate (not 3)
- **Progress update:** `node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --task N --status done --plan-file docs/sutando/PLAN.md`

### Mode B: Standard Execution
- **DO:** Sequential or wave-based per plan. Subagent dispatch if wave-based. Full progress reporting. 3 attempts then escalate.
- **SKIP:** Model profiling per task (use balanced default)

### Mode C: Full Execution
- **DO:** Wave-based with subagents. Model profiling per task. Checkpoint types (auto/human-verify/decision/human-action). Context pressure management. Full progress reporting.
- **SKIP:** Nothing

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

## Checkpoint Protocol

Every task declares a checkpoint type: `auto` (silent, ~85% of tasks), `human-verify` (complete then present for approval), `decision` (present options, wait for choice), or `human-action` (automate what you can, present remaining manual steps).

> **Checkpoint protocol detail** — See `references/execute-advanced.md`.

## Execution Modes

### Sequential Mode

For plans with `parallelism: sequential`:

```
For each task in order:
    1. Read task from PLAN.md
    2. Check checkpoint type
    3. Execute TDD cycle (see below)
    4. Follow checkpoint protocol
    5. Self-review against SPEC.md
    6. Commit
    7. Update progress: `node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --task N --status done`
    8. Emit progress report
    9. Next task
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
    4. Run FULL test suite after the wave completes (not just new tests)
    5. Handle any human-verify or decision checkpoints in the wave
    6. Update progress for each task: `node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --task N --status done`
    7. Emit wave progress report
    8. Next wave
```

### Parallel Safety Rules

When dispatching subagents for wave-based execution, these rules prevent conflicts:

**Rule 1: No shared file modification.** Never have two subagents modify the same file in the same wave. Before dispatching, scan all task file lists. If two tasks in the same wave both modify `src/utils/helpers.ts`, make them sequential within the wave — run one first, then the other.

**Rule 2: No shared test file.** If two tasks add tests to the same test file, they will conflict. Either give each task its own test file, or make them sequential.

**Rule 3: Full test suite after each wave.** After all subagents in a wave complete, run the FULL test suite — not just the tests from this wave. Previous waves' tests must still pass. New tests must pass. Zero failures.

**Rule 4: Wave integration verification.** If the wave verifier reports a failure:
1. Identify which task's changes broke integration (check git blame on the failing lines)
2. Fix the integration issue inline (don't re-dispatch — the issue is at the boundary between tasks)
3. Re-run the full test suite
4. If the fix requires changing code from a different task's files, document the cross-task fix in STATE.md

**Rule 5: Checkpoint tasks execute inline.** Tasks with checkpoint types `human-verify`, `decision`, or `human-action` are NEVER dispatched to subagents. They execute inline after all `auto` tasks in the wave complete.

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
4. Use real code, not mocks — unless the dependency is an external service (database, API, filesystem)

**Good RED test:**
```typescript
test('hashPassword returns a bcrypt hash different from input', async () => {
  const hash = await hashPassword('secret123');
  expect(hash).not.toBe('secret123');
  expect(hash).toMatch(/^\$2[aby]\$/);  // bcrypt format
});
```

**Bad RED test:**
```typescript
test('it works', async () => {
  const result = await doThing();
  expect(result).toBeTruthy();  // What does "truthy" mean here?
});
```

**Rules for writing the test:**
- One behavior per test. If the test name contains "and", split it.
- The test name should describe the behavior, not the implementation: "rejects empty email" not "validates email field is not empty string".
- Assert the output, not the implementation. Test what, not how.
- If the plan specifies the expected failure message, your test should produce exactly that message.

### RUN: Verify Failure

1. Run the test command specified in the task
2. Read the FULL output — every line, not just the summary
3. Verify:
   - Test FAILS (not errors)
   - Failure is because the feature doesn't exist yet
   - Failure message makes sense

**Distinguishing failures from errors:**
- **FAIL** = test ran, assertion didn't match → `Expected: "Email required", Received: undefined` — This is correct. The feature is missing.
- **ERROR** = test couldn't run → `Cannot find module './hash'` or `SyntaxError: Unexpected token` — This is not a proper RED. Fix the error first.

4. If test passes: the behavior already exists — this task may be redundant. Log in STATE.md and skip.
5. If test errors (not fails): fix the error (import, syntax, etc.) and re-run. Common errors:
   - Missing import → add the import (the file may not exist yet — create an empty export)
   - Type error → fix the type (the interface may not be defined yet — create a minimal type)
   - Module not found → check the path matches the plan's file path exactly
6. Keep fixing errors and re-running until you get a proper FAIL (not ERROR). Only then proceed to GREEN.

### GREEN: Minimal Implementation

1. Write the MINIMUM code needed to make the test pass
2. Do not add:
   - Extra features not in the task
   - Error handling not required by the test
   - Comments explaining obvious code
   - Abstractions for "future flexibility"
   - Types/interfaces not needed by the test
   - Logging or monitoring
   - Performance optimizations

3. If you're tempted to add something "while you're here" — STOP. Log it in STATE.md and move on.

**The minimum test:**
Ask yourself: "If I remove any line of this code, does the test fail?" If the answer is "no" for any line, that line shouldn't be there.

**Common GREEN mistakes:**
- Adding error handling for cases the test doesn't cover → Remove it. A later task will test and add it.
- Making a function generic when the test only needs a specific type → Use the specific type.
- Adding JSDoc comments → Not needed for the test to pass.
- Creating a helper function "for later" → YAGNI. Add it when a test needs it.

### RUN: Verify Pass

1. Run the test command again
2. Verify ALL tests pass (not just the new one)
3. Read the full output — check for:
   - All tests passing (green)
   - No warnings
   - No console.error or console.warn in output
   - No skipped tests (unless intentionally skipped by a previous task)
4. If the new test fails: your implementation is wrong. Read the error. Fix the code, not the test.
5. If a previously passing test now fails: you broke something. This is a regression.
   - Read WHICH test failed and WHY
   - Your new code likely changed behavior that an earlier test depends on
   - Fix the regression WITHOUT breaking the new test
   - If you can't: you have a design conflict. Escalate.

### REFACTOR: Clean Up

1. Look at the code you just wrote — can it be cleaner?
2. Common refactorings to consider:
   - Extract duplicated code into a helper
   - Rename unclear variables
   - Simplify complex conditionals
   - Remove dead code
3. Apply refactoring ONLY if it improves readability without changing behavior
4. Re-run ALL tests after EVERY refactoring change — not after all refactoring, after EACH change
5. If any test fails after a refactoring: your refactoring changed behavior. Undo it and try differently.
6. Skip this step if the code is already clean (most tasks). REFACTOR is not mandatory — it's permitted.

### SELF-REVIEW: Check Against Spec

1. Re-read the task's "Verification" command and expected output
2. Run the verification command
3. Confirm the output matches
4. If it doesn't match: fix and re-verify

### COMMIT: Atomic Commit

1. Stage ONLY the files specified in the task
2. Use the exact commit message from the plan
3. Commit

### UPDATE STATE

Use sutando-tools.cjs for state operations — provides lockfile safety and atomic writes:

```bash
SUTANDO_ROOT="$HOME/.claude/skills/sutando"
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase execute
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --task N --status done
```

Add any decisions or issues encountered to STATE.md manually (the CLI handles phase and task progress atomically).

## Debugging Integration

When a test fails during GREEN or REFACTOR, follow this protocol — do NOT blindly retry.

### Step 1: Read the Error Completely

Read the FULL error output. Not just the first line. Not just the test name. The full stack trace, the assertion message, the expected vs actual values.

### Step 2: Classify the Failure

- **Assertion failure** — Test ran, but the output doesn't match expected. Root cause is in your implementation logic.
- **Runtime error** — Code crashed (TypeError, ReferenceError, null pointer). Root cause is a missing import, wrong type, or unhandled case.
- **Compilation error** — Code doesn't even compile (TypeScript error, syntax error). Root cause is in the code you just wrote.
- **Environment error** — Database not running, port in use, missing env var. Root cause is infrastructure, not code.
- **Flaky failure** — Test passes sometimes, fails sometimes. Root cause is timing, shared state, or test isolation.

### Step 3: Trace to Root Cause

- Read the stack trace bottom-to-top. The deepest frame in YOUR code (not library code) is usually where the bug is.
- If the error is in this task's code: fix it directly.
- If the error is in a previous task's code: DO NOT FIX IT DIRECTLY. Escalate to the controller. Log in STATE.md:

```markdown
## Blocked
Task [N] is blocked: test failure traces to `src/auth/hash.ts:23` which was written in Task [M].
Root cause: [description]
Proposed fix: [what needs to change]
```

### Step 4: Fix and Re-verify

After fixing, re-run ALL tests — not just the failing one. Confirm the fix didn't break anything else.

### Step 5: Reference debug.md for Complex Cases

If the failure is not straightforward (flaky test, race condition, environment issue), reference `skills/debug.md` for systematic debugging methodology. Do not guess-and-check more than twice.

### Common Failure Patterns and Fixes

**Pattern: "Cannot find module"**
- Check the import path matches the file path in the plan exactly
- Check the file was actually created (not just planned)
- Check for typos in the path (auth vs Auth, index vs Index)
- Check tsconfig.json path aliases are configured

**Pattern: "X is not a function"**
- The export name doesn't match the import name
- The module exports a default but you're importing a named export (or vice versa)
- The function exists but isn't exported

**Pattern: "Expected X, received undefined"**
- The function returns early before reaching the return statement
- The function is async but you forgot to await it
- The variable is declared but never assigned

**Pattern: Test passes immediately (no RED)**
- You're testing behavior that already exists from a previous task
- Your test assertions are too loose (`.toBeTruthy()` when you need `.toBe("specific value")`)
- You're testing the mock, not the real code

**Pattern: Test is flaky (passes sometimes, fails sometimes)**
- Shared state between tests (database, global variables, singletons)
- Timing-dependent assertions (setTimeout, race conditions)
- Order-dependent tests (test A sets up state that test B relies on)
- Fix: isolate state per test, use deterministic timing, add proper setup/teardown

**Pattern: All tests fail after installing a new dependency**
- The dependency has side effects on import
- The dependency requires configuration that isn't present in test env
- Jest module resolution conflicts with the dependency's ESM/CJS format
- Fix: check jest.config.js transformIgnorePatterns, moduleNameMapper

## Context Pressure Management

Monitor context usage after every 3 tasks. Summarize completed tasks at 60%, save state at 80%, dispatch subagents or hand off at 90%+. Never let context hit 95%.

> **Context pressure & rollback** — See `references/execute-advanced.md`.

## Progress Reporting

After each task completion, emit a structured progress report. This gives the human (and the orchestrator) visibility into execution progress.

### After Each Task

```
─── Task [N]/[M]: [Task Name] ✓ ───
Tests: [X] new, [Y] total, all passing
Files: [A] created, [B] modified
Decisions: [Any choices made, or "None"]
Issues: [Any problems logged, or "None"]
Next: Task [N+1] ([next task name])
────────────────────────────────────
```

### After Each Wave (Wave-Based Mode)

```
═══ Wave [W]/[X] Complete ═══
Tasks: [list of task names]
Tests: [total test count], all passing
Integration: [verified/issues found]
Time: [wall clock since wave started]
Next wave: [W+1] — [theme]
═════════════════════════════════
```

### On Completion

```
╔═══════════════════════════════════════════════════════╗
║  EXECUTION COMPLETE                                    ║
╠═══════════════════════════════════════════════════════╣
║  Tasks: [M]/[M] complete                               ║
║  Tests: [total] passing, 0 failing                     ║
║  Files: [created] created, [modified] modified         ║
║  Decisions: [count] recorded in STATE.md               ║
║  Issues: [count] logged (if any)                       ║
╚═══════════════════════════════════════════════════════╝
```

## Rollback Protocol

If a task corrupts the codebase, use `git stash` to isolate current work, test the clean state, and diagnose whether the issue is yours or pre-existing. Never `git reset --hard` without explicit human approval.

> **Rollback detail** — See `references/execute-advanced.md`.

## Stuck Handling

Read the interruption setting from `.sutando/config.json`:

### Minimal Interruption

Only interrupt the user for:
- Missing credentials or API keys needed to proceed
- Requirements that are impossible or contradictory
- External services that are down and required
- `decision` and `human-action` checkpoints (these always interrupt, regardless of setting)

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

## Edge Cases in Execution

Covers: redundant tasks (test passes on RED), contradicting tasks, unavailable external services, and plan bugs. In all cases: log in STATE.md, do not silently deviate, escalate when scope/architecture is affected.

> **Edge cases, walkthrough, & extended anti-patterns** — See `references/execute-advanced.md`.

## Anti-Rationalization Protocol

These are the lies agents tell themselves to skip discipline. If you catch yourself thinking any of these, STOP and do the right thing.

### The Classics

| Excuse | Reality |
|--------|---------|
| "I wrote code before the test, but I'll keep it as reference" | Delete it. Write the test. Re-implement from scratch. "Reference" = testing after. |
| "The test framework isn't set up yet, I'll skip tests for now" | Set up the framework. That IS the task. If the plan didn't include it, it's Task 0 — do it before anything else. |
| "This test is trivial, it's obviously correct" | Run it anyway. Obvious things break. "Obviously correct" code has bugs too. The test takes 30 seconds to run. |
| "I'll write all the tests at the end" | TDD means test FIRST. If you're writing tests at the end, you're not doing TDD. Delete the code, start over. |
| "The implementation is different from the plan but better" | Follow the plan. If the plan is wrong, ESCALATE — don't silently deviate. The plan was approved by the human. Changing it unilaterally breaks trust. |
| "I'll just quickly fix this other thing I noticed" | NO. Log it in STATE.md. Stay on task. "Quickly" is how 5-minute detours become 2-hour rabbit holes. |

> **Extended anti-rationalization (7 more)** — See `references/execute-advanced.md`.

> **Complete task walkthrough (password hashing example)** — See `references/execute-advanced.md`.

## After All Tasks Complete

Use sutando-tools.cjs for state operations — provides lockfile safety and atomic writes:

```bash
SUTANDO_ROOT="$HOME/.claude/skills/sutando"
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase execute
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --summary
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" status
```

The `state progress --summary` command outputs the full progress overview. The `status` command provides a quick confirmation of overall state.

Also update `.sutando/STATE.md` with any decisions made and issues logged during execution (the CLI handles phase and task progress, but decisions and issues are recorded manually in STATE.md).

Then transition to delivery (the orchestrator handles routing).

## Verification Depth

Before marking any task as done, verify at four levels: (1) Exists — file at expected path, (2) Substantive — real implementation not stubs, (3) Wired — connected to the system, (4) Functional — works when invoked.

> **Verification depth detail** — See `references/execute-advanced.md`.

## Commit Hygiene

Use the exact commit message from the plan. Stage only the files listed in the task. One commit per task.

> **Commit hygiene detail** — See `references/execute-advanced.md`.

## Test Suite Health

Run the FULL test suite after every task. Track test count (must be monotonically increasing) and pass count (must equal total). Investigate if count drops or stays flat.

> **Test suite health detail** — See `references/execute-advanced.md`.

## Final Checklist Before Transitioning to Delivery

Before marking execution as complete, verify:

- [ ] ALL tasks in PLAN.md are marked as done in STATE.md
- [ ] Full test suite passes with 0 failures
- [ ] No skipped tests (unless explicitly documented with reason)
- [ ] All `human-verify` checkpoints were approved by the human
- [ ] All `decision` checkpoints have decisions recorded in STATE.md
- [ ] All `human-action` checkpoints were completed and verified
- [ ] No TODO/FIXME comments were introduced (check with `grep -r "TODO\|FIXME" src/`)
- [ ] All commits follow the messages specified in the plan
- [ ] STATE.md accurately reflects all decisions, issues, and progress
- [ ] Git log shows clean, atomic commits (one per task)

If any item fails, fix it before transitioning. Do not hand off incomplete work.
