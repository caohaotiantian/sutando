---
name: sutando-debug
description: >
  Systematic debugging methodology for Sutando execution phase.
  Invoked when tests fail, implementation doesn't work, or unexpected behavior occurs.
  Four mandatory phases: investigate, analyze, hypothesize, fix.
---

# Sutando Systematic Debugging

> Root cause first. Always. No exceptions.

## Overview

When something breaks during execution, the temptation is to "just try changing X." This is the single most expensive mistake in software development. Random fixes waste time, introduce new bugs, and mask the real problem.

This skill provides a mandatory four-phase debugging methodology. It integrates with the execution phase (skills/execute.md) and is invoked whenever a test fails, implementation produces unexpected behavior, or a subagent reports BLOCKED.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

This is non-negotiable. There are no exceptions. There are no rationalizations.

- If you are tempted to "just try changing X" -- STOP -- Go to Phase 1.
- If you are on Fix #3 for the same bug -- STOP -- You do not understand the problem.
- If you think "this is probably the issue" -- STOP -- Prove it before touching code.

## When to Invoke This Skill

Use this methodology for ANY technical issue during execution:

- A test you wrote fails for the wrong reason
- Your implementation does not make the test pass
- A previously passing test now fails (regression)
- Build or compilation errors you do not immediately understand
- Integration failures between components
- Unexpected runtime behavior
- Environment or configuration problems
- Subagent reports BLOCKED with a technical issue

**Use this ESPECIALLY when:**
- You are under pressure to finish the plan quickly
- The fix seems "obvious" (obvious fixes are often wrong)
- You have already tried one fix that did not work
- You do not fully understand why something is failing
- The error message does not match your expectations

**Do NOT skip this when:**
- The bug seems simple (simple bugs have root causes too)
- You are in a hurry (systematic debugging is faster than thrashing)
- You think you already know the answer (prove it first)

---

## Phase 1: Investigation (NEVER SKIP)

This phase is mandatory. You cannot propose fixes until you complete it. Skipping Phase 1 is the root cause of most debugging time waste.

### Step 1.1: Read Error Messages COMPLETELY

Do not skim. Do not skip. Read every line.

```
For each error message:
  1. Read the error TYPE (TypeError, AssertionError, ConnectionRefused, etc.)
  2. Read the error MESSAGE (the human-readable description)
  3. Read the STACK TRACE (every frame, top to bottom)
  4. Note LINE NUMBERS and FILE PATHS
  5. Note ERROR CODES if present
  6. Read any CONTEXT provided (variable values, state descriptions)
```

Common mistakes:
- Reading only the first line of a multi-line error
- Ignoring the stack trace because it is long
- Assuming you know what the error means without reading it literally
- Ignoring warnings that precede the error

### Step 1.2: Reproduce Consistently

Before investigating further, confirm you can trigger the bug reliably.

```
Reproduction checklist:
  [ ] Can you trigger the failure every time you run the test?
  [ ] What are the EXACT steps to reproduce?
  [ ] Does it fail the same way each time (same error, same line)?
  [ ] If intermittent: what conditions correlate with failure?
```

If you cannot reproduce the bug:
- Do NOT proceed to fixing. You cannot verify a fix for a bug you cannot trigger.
- Gather more data: add logging, check for race conditions, check environment state.
- Run the test in isolation vs. with other tests (test pollution).

### Step 1.3: Check Recent Changes

What changed that could have caused this?

```bash
# What files changed recently?
git diff

# What were the last 5 commits?
git log --oneline -5

# What changed in the specific file that is failing?
git diff HEAD -- path/to/failing/file

# What changed since the last known-good state?
git diff <last-good-commit>..HEAD
```

Check for:
- New dependencies or version changes
- Configuration changes
- Environment variable changes
- File permission changes
- New code that touches the same modules as the failure

### Step 1.4: Gather Evidence in Multi-Component Systems

When the system has multiple layers (API -> service -> database, CLI -> build -> deploy, etc.), you must identify WHICH layer fails before attempting fixes.

```
For EACH component boundary:
  1. Log what data ENTERS the component
  2. Log what data EXITS the component
  3. Verify configuration propagation across boundaries
  4. Check state at each layer independently

Run once to gather evidence.
THEN analyze evidence to identify the failing component.
THEN investigate that specific component.
```

Example diagnostic approach:
```
Layer 1 (Entry):     Input received: X     Output produced: Y     -- OK
Layer 2 (Transform): Input received: Y     Output produced: Z     -- OK
Layer 3 (Storage):   Input received: Z     Output produced: ERROR -- FAILURE HERE
```

Now you know Layer 3 is where the problem manifests. But is Z the correct input? Trace backward.

### Step 1.5: Trace Data Flow Backward from Error to Source

This is the most powerful debugging technique. Start at the error and work backward.

```
Start at the ERROR (the symptom):
  "TypeError: Cannot read property 'name' of undefined at line 42"

Ask: What variable is undefined? → user object
Ask: Where does user come from? → passed as argument to processUser()
Ask: What calls processUser()? → handleRequest() at line 28
Ask: Where does handleRequest() get user? → from database query result
Ask: What does the database query return? → null (user not found)
Ask: Why is user not found? → wrong ID passed to query
Ask: Where does the ID come from? → parsed from request URL
Ask: Is the URL parsing correct? → NO — missing parseInt(), string "42" !== number 42

ROOT CAUSE: URL parameter not parsed as integer before database query.
```

The symptom was at line 42. The root cause was in URL parsing. Fixing line 42 (adding a null check) would mask the bug, not fix it.

**Key principle:** At each layer, ask "What called this? What data did it receive?" Keep tracing backward until you find where correct data became incorrect. THAT is the root cause.

---

## Phase 2: Pattern Analysis

After gathering evidence in Phase 1, find patterns that explain the behavior.

### Step 2.1: Find Working Examples

Look for similar code that works correctly.

```
Search strategy:
  1. Same codebase: is there similar functionality that works?
  2. Same pattern: is this pattern used elsewhere successfully?
  3. Same API: are other callers of this API working?
  4. Same test style: are similar tests structured differently?
```

### Step 2.2: Compare Against References

If implementing against a specification, API docs, or example:

```
Comparison checklist:
  [ ] Re-read the relevant documentation completely (do not skim)
  [ ] Compare your implementation line-by-line with working examples
  [ ] Check API signatures (argument order, types, required vs optional)
  [ ] Check return value handling (sync vs async, wrapped vs unwrapped)
  [ ] Check error handling expectations (throws vs returns error)
```

### Step 2.3: List ALL Differences

Between the working example and the broken code, enumerate every difference. Do not assume any difference is irrelevant.

```
Difference log:
  1. [Working uses X, broken uses Y] — could matter because: ...
  2. [Working has step A before step B, broken reverses order] — could matter because: ...
  3. [Working passes 3 arguments, broken passes 2] — could matter because: ...
  ...
```

Even "trivial" differences can be root causes. A missing `await`, a wrong import path, a subtle type mismatch.

### Step 2.4: Check Environment and Dependencies

```
Environment checklist:
  [ ] Node/Python/runtime version matches expected?
  [ ] Dependency versions match (check lock file)?
  [ ] Environment variables set correctly?
  [ ] File paths resolve correctly (relative vs absolute)?
  [ ] Permissions correct (read/write/execute)?
  [ ] Working directory is what you expect?
  [ ] No conflicting global installations?
```

---

## Phase 3: Hypothesis and Testing

Now — and ONLY now — form a hypothesis about the root cause.

### Step 3.1: Form ONE Clear Hypothesis

State it explicitly:

```
HYPOTHESIS: [The root cause is X]
EVIDENCE: [I believe this because of Y, which I observed in Phase 1/2]
PREDICTION: [If this hypothesis is correct, then changing Z should fix the test]
```

Requirements for a valid hypothesis:
- It must explain ALL observed symptoms (not just some)
- It must be consistent with all evidence gathered
- It must be testable with a minimal change
- It must be specific (not "something is wrong with the config")

Bad hypotheses:
- "It is probably a timing issue" (vague, untestable)
- "The config might be wrong" (which config? which value? why?)
- "Let me try updating the dependency" (no causal reasoning)

Good hypotheses:
- "The database query returns null because the ID parameter is a string instead of a number, which I can see from the log output showing id='42' instead of id=42"
- "The test fails because beforeEach runs after the variable is accessed at module scope, as shown by the empty string in the trace log"

### Step 3.2: Design a MINIMAL Test

The smallest possible change that proves or disproves the hypothesis.

```
Test design:
  CHANGE: [Exactly one thing you will change]
  EXPECT: [What you expect to happen if hypothesis is correct]
  EXPECT: [What you expect to happen if hypothesis is wrong]
```

Do NOT:
- Change multiple things at once (you will not know which fixed it)
- Make large changes "just to be safe"
- Add unrelated improvements alongside the test

### Step 3.3: Test ONE Variable at a Time

Execute the minimal test. Observe the result.

```
RESULT: [What actually happened]
MATCHES PREDICTION: [Yes/No]
CONCLUSION: [Hypothesis confirmed / Hypothesis rejected]
```

If confirmed: proceed to Phase 4.
If rejected: return to Phase 1 with the NEW information this test revealed. Form a new hypothesis.

### Step 3.4: Record Results

Keep a log of hypotheses tested. This prevents going in circles.

```
Hypothesis log:
  #1: [hypothesis] — REJECTED because [what happened instead]
  #2: [hypothesis] — REJECTED because [what happened instead]
  #3: [hypothesis] — CONFIRMED, proceeding to fix
```

---

## Phase 4: Implementation

You have a confirmed hypothesis and a clear root cause. Now fix it.

### Step 4.1: Write a Failing Test That Reproduces the Bug

Before writing the fix, write a test that demonstrates the bug. This is TDD for bugs.

```
Bug reproduction test:
  1. Set up the conditions that trigger the bug
  2. Assert the CORRECT behavior (which currently fails)
  3. Run the test — it should FAIL
  4. This test becomes your regression guard
```

If you cannot write a failing test:
- The bug may be environmental (not a code bug)
- You may not fully understand the bug yet (return to Phase 1)
- The testing framework may not support this kind of test (document why)

### Step 4.2: Implement the SINGLE Smallest Fix

Fix the root cause identified in your confirmed hypothesis. Nothing more.

```
Fix requirements:
  [ ] Addresses the ROOT CAUSE, not a symptom
  [ ] Is the smallest change that fixes the issue
  [ ] Does not include "while I'm here" improvements
  [ ] Does not include unrelated refactoring
  [ ] Does not change behavior beyond fixing the bug
```

### Step 4.3: Verify the Fix

```
Verification checklist:
  [ ] The bug reproduction test now PASSES
  [ ] ALL other tests still pass (regression check)
  [ ] The original failing test/behavior is now correct
  [ ] Run the full test suite, not just the affected test
```

### Step 4.4: If the Fix Does Not Work

Do NOT try another fix immediately. Return to Phase 1 with new information.

```
After a failed fix:
  1. What did the fix change about the behavior?
  2. What NEW information did this reveal?
  3. Was the hypothesis wrong, or was the fix wrong?
  4. Return to Phase 1 — gather more evidence with this new knowledge
```

---

## The "3 Fixes" Rule

This rule exists because repeated failed fixes are a signal that you do not understand the problem.

### Fix Attempt #1 Fails

This is normal. Return to Phase 1 with what you learned from the attempt.

```
After fix #1 fails:
  - What new information did the attempt reveal?
  - Was the hypothesis wrong, or was the implementation wrong?
  - Gather more evidence. Form a new hypothesis.
```

### Fix Attempt #2 Fails

This is a warning sign. Question your assumptions.

```
After fix #2 fails:
  - Re-read the original error message from scratch
  - Question your mental model of how this code works
  - Are you looking at the right component?
  - Are you making an assumption that is wrong?
  - Read the code more carefully — do not trust your memory of what it does
```

### Fix Attempt #3 Fails — FULL STOP

Three failed fixes means you fundamentally do not understand the problem. More fixing will not help.

```
MANDATORY actions after 3 failed fixes:

  1. STOP attempting fixes immediately

  2. Re-read the error from scratch
     - Pretend you are seeing it for the first time
     - Read every word literally
     - Do not let previous hypotheses color your reading

  3. Question whether you are fixing the right thing
     - Is the failing test correct? (Maybe the test is wrong)
     - Is the requirement correct? (Maybe the spec is ambiguous)
     - Is this the right component? (Maybe the bug is elsewhere)

  4. Consider: is this a design problem, not a bug?
     - Does the architecture support what you are trying to do?
     - Is the pattern fundamentally wrong?
     - Would this require significant restructuring to fix properly?

  5. Escalate to human
     - If in execution phase: report to the orchestrator
     - Use status code DESIGN_ISSUE if architectural
     - Use status code BLOCKED if you need human input
     - Provide ALL evidence gathered across all 3 attempts
```

**This is NOT failure. This is the correct response to insufficient understanding.**

---

## Root Cause Tracing Technique (Detailed)

This is the expanded version of the backward tracing from Phase 1, Step 1.5.

### The Process

```
1. START at the error (the symptom)
   - Note the exact error message, line, and file

2. IDENTIFY the immediate cause
   - What variable/state/condition directly causes this error?
   - Example: "user is undefined"

3. TRACE one level back
   - Where does that variable come from?
   - Who set it? What function returned it? What assigned it?
   - Example: "user comes from getUserById() return value"

4. TRACE another level back
   - What input did that function receive?
   - Was the input correct?
   - Example: "getUserById received id='42' (string, not number)"

5. REPEAT until you find the TRANSITION POINT
   - The transition point is where correct data becomes incorrect
   - Example: "request.params.id is a string, but the code expects a number"

6. THAT is the root cause
   - Fix at the transition point
   - Not at the symptom (adding null checks)
   - Not at intermediate layers (converting types mid-flow)
```

### Recognizing the Root Cause

You have found the root cause when:
- Fixing at this point would prevent the entire chain of errors
- The code at this point has a clear logical error (not just a missing guard)
- Moving the fix one level earlier would not make sense (the input to this level IS correct)

You have NOT found the root cause when:
- Your fix is a null check or guard clause (that is a bandaid)
- Your fix converts types mid-flow (the types should have been right from the start)
- Your fix adds retry logic (something upstream should not have failed)
- Removing your fix would bring back the exact same bug in a different place

### Defense-in-Depth After Root Cause Fix

After fixing the root cause, add validation at multiple layers to make the bug structurally impossible to recur:

```
Layer 1 — Entry Point Validation:
  Reject invalid input at the API/function boundary.
  Example: validate that ID is a number before calling getUserById()

Layer 2 — Business Logic Validation:
  Verify data makes sense for the operation.
  Example: getUserById() throws if id is not a positive integer

Layer 3 — Environment Guards:
  Prevent dangerous operations in specific contexts.
  Example: refuse to delete files outside the project directory

Layer 4 — Debug Instrumentation:
  Log context for future forensics.
  Example: log the full call context before database queries
```

Not every bug needs all four layers. Use judgment. But consider each one.

---

## Common Bug Categories and Strategies

### Type Errors

```
Symptoms: TypeError, "undefined is not a function", "cannot read property of null"
Strategy:
  1. Identify the null/undefined variable
  2. Trace backward: where should it have been set?
  3. Check: was it set but then lost? (scope issue, async timing, reassignment)
  4. Check: was it never set? (missing initialization, wrong code path)
  5. Check: type mismatch? (string vs number, object vs array)
```

### Async Bugs

```
Symptoms: intermittent failures, "undefined" values that should be set, timeout errors
Strategy:
  1. Check every async call: is it awaited?
  2. Check promise chains: are errors handled?
  3. Check for race conditions: do two operations depend on shared state?
  4. Check callback order: are callbacks firing in expected sequence?
  5. Add timing logs to verify execution order
  6. Look for missing await keywords (the #1 async bug)
```

### State Bugs

```
Symptoms: works first time but not second, stale data, incorrect accumulation
Strategy:
  1. Identify all places where the relevant state is read and written
  2. Check for unintended mutation (object passed by reference, then modified)
  3. Check for stale closures (closure captures variable, variable later changes)
  4. Check initialization: is state reset between uses?
  5. Check for shared mutable state between tests (test pollution)
```

### Integration Bugs

```
Symptoms: works in isolation but fails together, serialization errors, contract mismatches
Strategy:
  1. Verify the API contract: what does each side expect?
  2. Log the actual data crossing the boundary (not what you think it is)
  3. Check serialization/deserialization: JSON.parse/stringify, encoding, escaping
  4. Check HTTP details: headers, content-type, status codes
  5. Check version compatibility: are both sides using the same API version?
```

### Environment Bugs

```
Symptoms: "works on my machine", CI failures, path-related errors
Strategy:
  1. Compare environments: OS, runtime version, installed packages
  2. Check environment variables: set? correct value? exported?
  3. Check file paths: absolute vs relative, OS-specific separators
  4. Check permissions: read, write, execute on relevant files/directories
  5. Check working directory: is it what you expect?
  6. Check for hardcoded paths or assumptions about filesystem layout
```

---

## Red Flags -- Return to Phase 1

If you catch yourself thinking any of these, STOP and return to Phase 1.

| Thought | Reality |
|---------|---------|
| "Let me just try this" | Form a hypothesis first. "Trying" is not debugging. |
| "I'll investigate after I fix it" | Investigate BEFORE fixing. Always. |
| "It's probably a timing issue" | Prove it. Add a log. Check the timeline. |
| "The error message is misleading" | Read it again, literally. Error messages are usually accurate. |
| "It works on my machine" | Identify the environmental difference. That IS the bug. |
| "One more fix attempt" (after 2 failed) | STOP. Re-investigate from scratch. |
| "This is a quick fix" | Quick fixes create slow debugging sessions. |
| "I don't need to reproduce it" | You cannot verify a fix for a bug you cannot reproduce. |
| "The test must be wrong" | Maybe. But prove it. Do not assume. |
| "Let me add a try/catch" | That masks the bug. Find and fix the root cause. |
| "I'll just add a null check" | Null checks are bandaids. Why is it null? |
| "Multiple changes to be safe" | One change at a time. Otherwise you learn nothing. |

---

## Integration with Execution Phase

This skill integrates directly with the Sutando execution cycle (skills/execute.md).

### When to Enter Debug Mode

During the TDD cycle, enter debug mode when:

1. **RED phase**: Test fails but for the WRONG reason (unexpected error instead of expected assertion failure)
2. **GREEN phase**: Implementation written but test still fails
3. **REFACTOR phase**: Previously passing test now fails after refactoring
4. **Verification phase**: Verification command does not produce expected output
5. **Regression**: A test from a previous task suddenly fails

### Returning from Debug Mode

After debugging succeeds:

1. The immediate bug is fixed and verified
2. Return to the TDD cycle at whatever step you were in
3. If you were in GREEN: the test should now pass. Run ALL tests.
4. If you were in RED: the test should now fail for the RIGHT reason. Proceed to GREEN.
5. If you were in REFACTOR: tests should all pass again. Proceed to commit.

### Commit Protocol for Bug Fixes

All debugging work should be committed as a separate fix commit, not mixed with feature work.

```
Commit message format for bug fixes:
  fix: [brief description of what was wrong]

  Root cause: [one line explaining the actual root cause]

Example:
  fix: parse URL parameters as integers before database query

  Root cause: request.params.id was string '42' but getUserById expects number
```

### Logging Bugs in STATE.md

After resolving a bug, record it in the STATE.md Issues section:

```markdown
## Issues

### Bug: [Brief description]
- **Symptom:** [What was observed]
- **Root cause:** [What was actually wrong]
- **Fix:** [What was changed]
- **Task:** [Which task this occurred during]
- **Attempts:** [How many fix attempts before resolution]
```

This creates a debugging history that helps identify patterns (e.g., repeated issues with the same component suggest a design problem).

---

## Debugging Checklist (Quick Reference)

Use this checklist to ensure you are not skipping steps.

```
PHASE 1: INVESTIGATION
  [ ] Read the complete error message (every line, every frame)
  [ ] Reproduce the bug consistently
  [ ] Check recent changes (git diff, git log)
  [ ] In multi-component systems: identify which layer fails
  [ ] Trace data flow backward from error to source

PHASE 2: PATTERN ANALYSIS
  [ ] Find working examples of similar code
  [ ] Compare against references/documentation
  [ ] List ALL differences between working and broken
  [ ] Check environment and dependency versions

PHASE 3: HYPOTHESIS AND TESTING
  [ ] State ONE clear hypothesis with evidence
  [ ] Design a minimal test (one change only)
  [ ] Execute the test and record the result
  [ ] If rejected: return to Phase 1 with new information

PHASE 4: IMPLEMENTATION
  [ ] Write a failing test that reproduces the bug
  [ ] Implement the single smallest fix
  [ ] Verify: reproduction test now passes
  [ ] Verify: no other tests broke (full suite)
  [ ] If fix fails: return to Phase 1 (respect the 3 Fixes Rule)
  [ ] Commit as a separate fix commit
  [ ] Log in STATE.md Issues section
```

---

## Quick Reference Table

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Investigation** | Read errors, reproduce, check changes, trace data flow | Understand WHAT is failing and WHERE |
| **2. Pattern Analysis** | Find working examples, compare, list differences | Understand HOW it differs from working code |
| **3. Hypothesis** | Form theory, test minimally, record results | Confirmed hypothesis with evidence |
| **4. Implementation** | Write failing test, minimal fix, verify, commit | Bug fixed, all tests pass, no regressions |

## When Investigation Reveals "No Code Bug"

Sometimes systematic investigation reveals the issue is not a code bug:

- **Environmental**: wrong runtime version, missing dependency, incorrect permissions
- **Specification**: the spec is ambiguous or contradictory
- **Design**: the architecture does not support the requirement
- **External**: third-party service is down, API changed, network issue

In these cases:
1. You have completed the process (investigation IS the work)
2. Document what you investigated and what you found
3. Report the appropriate status (NEEDS_CONTEXT, BLOCKED, or DESIGN_ISSUE)
4. Do not force a code fix for a non-code problem

**But:** 95% of "no code bug" conclusions are the result of incomplete investigation. Double-check before giving up.
