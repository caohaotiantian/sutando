---
name: sutando-deliver
description: >
  Phase 4 of Sutando workflow. Generates delivery summary, runs fresh verification,
  presents interactive walkthrough, and gates on user acceptance before completing.
---

# Sutando Phase 4: Delivery

> The Delivery Zone — present results, verify together, complete.

## Overview

Generate a summary of what was built, run fresh verification, walk the user through key behaviors one-by-one, and gate on their acceptance before declaring done.

## Iron Law

**No delivery claims without passing verification evidence.**

If the test suite fails: do NOT present the delivery. Go back to execution, fix the issue, then retry delivery.

## Process

### Step 1: Generate SUMMARY.md

Read `.sutando/STATE.md` and the git log to produce `.sutando/SUMMARY.md`:

1. **What Was Built** — Summarize the feature in 2-3 paragraphs. What does it do? How does it work? What's the user-facing impact?

2. **Key Decisions** — Pull from STATE.md's "Decisions Made During Execution" table. These are decisions the agent made autonomously — the user should know about them.

3. **Files Changed** — Generate from `git diff --stat` between the starting commit and HEAD. List each file with its action (Created/Modified) and a brief purpose.

4. **Test Coverage** — Count passing tests from the test suite output.

5. **Issues Encountered & Resolved** — Pull from STATE.md's "Issues Encountered" section. Brief descriptions of problems hit and how they were solved.

6. **How to Run** — Concrete commands to start, test, and use the feature. Derived from the project's existing scripts (package.json scripts, Makefile targets, etc.).

### Step 2: Run Fresh Verification

**This is mandatory. No shortcuts.**

1. Identify the project's test command (from package.json, Makefile, CLAUDE.md, or existing patterns)
2. Run the FULL test suite — not partial, not cached, not just the new tests
3. Read the COMPLETE output
4. Check:
   - Exit code is 0
   - All tests pass (count matches expected)
   - No warnings that indicate real issues

**If any test fails:**
> Do NOT proceed to Step 3. Return to the execution phase:
> 1. Identify which test(s) failed
> 2. Apply TDD to fix (write/update test → verify fail → fix → verify pass)
> 3. Re-run full suite
> 4. Return to Step 2 of delivery

### Step 3: Present Summary

Show the user the summary with test evidence:

> "All **[N] tasks** complete. Here's what I built:"
>
> [SUMMARY.md content inline — What Was Built, Key Decisions, Files Changed]
>
> "**Test results:** [N] tests, all passing. Full output:"
> ```
> [Paste actual test output — not summarized, the real thing]
> ```

### Step 4: Interactive Walkthrough

Walk the user through key behaviors, one at a time. Derive walkthrough items from each task's **Verification** command in PLAN.md.

For each item:

> "**[N]/[Total]: [Feature name]**
>
> [Instructions for the user to verify — a command to run, a URL to visit, or a behavior to observe]
>
> Does this look right?"

Wait for user response before moving to the next item.

**If the user reports an issue during walkthrough:**
1. Note which item failed
2. Complete the rest of the walkthrough (collect all feedback)
3. After walkthrough: fix all reported issues using TDD
4. Re-run full test suite
5. Re-present ONLY the changed/fixed items

### Step 5: Verification Gate

After the walkthrough:

> "That covers everything in the spec. How does it look?
>
> - **Accept** — I'll finalize and clean up
> - **Revisions needed** — Tell me what needs changing, I'll fix and re-deliver
> - **Major issues** — We'll go back to the relevant phase"

**If Accept:**
- Proceed to Step 6

**If Revisions needed:**
- Collect all revision requests
- Fix each using TDD (test → fail → implement → pass → commit)
- Re-run full test suite
- Re-present only the changed items in a mini-walkthrough
- Return to verification gate

**If Major issues:**
- Discuss with the user which phase to return to
- Update STATE.md to reflect the rollback
- Transition to the appropriate phase

### Step 6: Finalize

1. Ensure all changes are committed with clean, atomic history
2. Commit SUMMARY.md to `.sutando/`:
   ```bash
   git add .sutando/SUMMARY.md
   git commit -m "docs: add Sutando delivery summary"
   ```

3. Update STATE.md:
   ```markdown
   ---
   phase: complete
   updated: [timestamp]
   ---

   # Sutando State
   ...
   ## Status: COMPLETE
   All tasks delivered and accepted.
   ```

4. Present final status:
   > "**Done.** All work committed on branch `[current branch]`.
   > - [N] tasks, [M] tests passing
   > - Summary: `.sutando/SUMMARY.md`
   > - State: `.sutando/STATE.md`
   >
   > Need anything else? (push, create PR, etc.)"

**Do NOT auto-push or auto-create PRs** unless the user explicitly asks.

## Red Flags

| Thought | Reality |
|---------|---------|
| "Tests passed earlier, no need to re-run" | Run them FRESH. Always. |
| "The walkthrough is tedious, I'll summarize" | One item at a time. User verifies each. |
| "The user seems happy, skip verification gate" | Always ask. Always gate. |
| "I'll push to save the user time" | Never push without being asked. |
| "Minor test failure, probably flaky" | A failure is a failure. Fix it. |
