---
name: sutando-quick
description: >
  Fast path for trivial tasks: typo fixes, renames, small config changes,
  one-line bug fixes. Skips planning and state management. Still enforces
  TDD for code changes. Use when task is clearly trivial and well-understood.
---

# Quick Mode

> The lightest path through Sutando. Four steps. No planning overhead. TDD still applies.

Quick mode exists because not every task needs a SPEC.md, a PLAN.md, a .sutando/ directory, and a walkthrough. Some tasks are obvious, mechanical, and small. Quick mode handles those without ceremony — but without cutting corners on verification.

## When to Use Quick Mode

Quick mode is appropriate when **all** of these criteria are met:

1. **Small scope** — The task affects 1-3 files. If you need to touch more than three files, this is not a quick task.
2. **No design decisions** — The change is mechanical, not creative. There is exactly one obvious way to do it, and that way is correct.
3. **Well-understood change** — You can describe the exact change before making it. "Fix the typo on line 47" is well-understood. "Make the app faster" is not.
4. **No dependencies on other changes** — The change is self-contained. It does not require coordinating with other files, other features, or other people.
5. **Low risk** — If the change is wrong, the blast radius is small. A renamed variable is low risk. A database migration is not.

### Examples of Quick Mode Tasks

- Fix a typo in a string literal, comment, or documentation
- Rename a variable or function (within a single file or 2-3 files with find-and-replace)
- Update a configuration value (version number, timeout, feature flag)
- Add a missing import statement
- Fix an off-by-one error where the correct logic is obvious
- Remove dead code that is clearly unused
- Fix a broken link in documentation
- Add a missing null check where the pattern is established elsewhere in the codebase
- Correct an incorrect type annotation
- Update a dependency version in a manifest file

### The Quick Mode Litmus Test

Ask yourself: "Can I describe the exact change in one sentence?"

- "Change `userNmae` to `userName` on line 34 of auth.ts" — Yes, quick mode.
- "Fix the authentication flow" — No. That requires investigation. Use full Sutando.
- "Add `import { useState } from 'react'` to Header.tsx" — Yes, quick mode.
- "Add state management to the app" — No. That requires design decisions. Use full Sutando.

## When NOT to Use Quick Mode

Quick mode has clear boundaries. If any of these apply, do not use quick mode — escalate to the appropriate Sutando mode or skill.

### Escalation Triggers

| Situation | Why It Disqualifies Quick Mode | Escalate To |
|-----------|-------------------------------|-------------|
| Task turns out more complex than expected | Complexity requires planning to manage | Full Sutando (Mode A/B) |
| Multiple files need coordinated changes | Coordination needs a plan to avoid partial states | Full Sutando (Mode A/B) |
| Design decisions are needed | Decisions need the Human Zone clarification process | Full Sutando (Mode B/C) |
| Bug root cause is unclear | Unknown root cause needs systematic investigation | `skills/debug.md` |
| Change affects public API | API changes need careful consideration of consumers | Full Sutando (Mode B) |
| Change involves data migration | Data migrations are inherently high-risk | Full Sutando (Mode B/C) |
| User's request is ambiguous | Ambiguity needs clarification, not assumptions | Full Sutando — start with clarify |
| Change requires new dependencies | New dependencies need evaluation (license, size, maintenance) | Full Sutando (Mode A/B) |
| Refactoring across many files | Large refactors need a plan and incremental verification | Full Sutando (Mode B) |

### The Escalation Mindset

Quick mode is optimistic — it assumes the task is as simple as it looks. But reality often disagrees. The moment you realize the task is not as simple as it appeared, **stop and escalate**. Do not try to force a complex task through the quick mode pipeline. The time you "save" by avoiding full Sutando is lost tenfold when you ship a half-broken change.

**The rule:** It is always better to escalate a simple task to full Sutando than to force a complex task through quick mode. Sutando Mode A is already lightweight. Quick mode is for tasks that are even lighter than Mode A.

## The Quick Process

Four steps. That is all.

```
Understand → Test First → Fix + Verify → Commit + Report
```

No .sutando/ directory. No config.json. No SPEC.md. No PLAN.md. No STATE.md. No SUMMARY.md. No subagents. No walkthrough. Just the work.

---

### Step 1: Understand

**Time budget: 30 seconds.**

Read the relevant code. Confirm that the fix is obvious. Verify your understanding before touching anything.

**What to do:**
- Open the file(s) mentioned in the request
- Read the surrounding context (not just the one line)
- Confirm the change is what you think it is
- Check if similar patterns exist elsewhere that also need the same fix

**Decision point:** After reading the code, is the fix still obvious?

- **Yes, it is obvious** — Proceed to Step 2.
- **No, it is more complex than expected** — STOP. Escalate to full Sutando. Tell the user: "This is more involved than expected — [specific reason]. Want me to switch to full Sutando mode?"
- **The root cause is unclear** — STOP. Escalate to debug mode. Tell the user: "The root cause is not obvious. I'd recommend using debug mode to investigate systematically. Want me to switch?"

**Do NOT:**
- Skip reading the code because "I know what the fix is"
- Read only the single line mentioned — context matters
- Assume the user's description is the complete picture
- Start making changes during this step

---

### Step 2: Test First

**TDD still applies for code changes.** Quick mode skips planning, not discipline.

#### For Code Changes (logic, behavior, bug fixes):

1. **Write a failing test** that exposes the issue or verifies the desired behavior.
   - The test should be minimal — test the specific thing being fixed, not the entire module.
   - Follow the project's existing test patterns (naming, location, assertion style).
   - If the project has no tests, write one anyway. Create the test file following language conventions.

2. **Run the test.** Verify it fails for the right reason.
   - If the test passes already, the bug may not be what you think. Investigate before proceeding.
   - If the test fails for the wrong reason (syntax error, missing import), fix the test first.

3. **Confirm the test failure matches the bug.** The test should fail because of the issue you are about to fix, not because of an unrelated problem.

#### For Non-Code Changes (config, docs, comments, formatting):

- Skip the test step entirely. There is nothing to TDD for a typo in a README.
- Proceed directly to Step 3.

#### For Renames and Type Changes:

- If the rename affects runtime behavior (e.g., a serialized field name, an API parameter name), write a test.
- If the rename is purely cosmetic (local variable, internal function), skip the test — but still run existing tests in Step 3 to catch anything you missed.

---

### Step 3: Fix + Verify

Make the minimal change. Then verify everything.

**What to do:**

1. **Make the change.** Only the change. Nothing else.
   - Do not "fix" other things you noticed while reading the code.
   - Do not refactor surrounding code.
   - Do not update unrelated documentation.
   - One task, one change, one commit.

2. **Run ALL tests.** Not just the new test. Not just the tests in the affected file. The entire test suite.
   - If the project has a standard test command (from CLAUDE.md, package.json scripts, Makefile), use it.
   - If you are unsure how to run tests, check the project's configuration before guessing.

3. **Verify the results:**
   - New test (if written) now passes — confirms the fix works.
   - All existing tests still pass — confirms no regressions.
   - If any test fails, STOP. Do not commit broken code. Investigate.

**If a test fails:**

- **Your new test fails:** The fix is wrong. Re-examine your understanding (go back to Step 1).
- **An existing test fails:** Your change broke something. This means the task is more complex than expected. Either fix the regression if it is trivial, or escalate to full Sutando.
- **A test fails that was already failing before your change:** Note it but do not fix it — that is a separate task. Confirm it was pre-existing by checking the base state.

---

### Step 4: Commit + Report

Wrap up cleanly.

**Commit:**
- Create a single atomic commit with a descriptive message.
- The commit message should describe what was changed and why.
- Follow the project's commit message conventions if they exist (conventional commits, prefixes, etc.).
- Examples:
  - `fix: correct typo in authentication error message`
  - `refactor: rename userNmae to userName in auth module`
  - `chore: update Node.js version in .nvmrc to 20.11.0`

**Report:**
- One or two lines to the user. That is all.
- Format: "Fixed [what] in [file]. Tests passing."
- Examples:
  - "Fixed the typo in `src/auth/login.ts` line 34. All 127 tests passing."
  - "Renamed `userNmae` to `userName` in `auth.ts` and `auth.test.ts`. Tests passing."
  - "Updated Node version in `.nvmrc` to 20.11.0. No tests affected."

**No SUMMARY.md. No walkthrough. No delivery phase.** The user asked for a trivial fix and they got a trivial fix, verified and committed.

---

## Escalation Protocol

Quick mode is a privilege, not a right. The moment the task exceeds quick mode's boundaries, escalate. Here are the specific escalation paths:

### "This is more complex than expected"

You discover during Step 1 or Step 3 that the change is not as simple as it appeared.

**What to say:**
> "This is more involved than expected — [specific reason]. The [thing] depends on [other thing], which means we need to [coordinate/design/investigate]. Want me to switch to full Sutando mode?"

**What to do:** Stop making changes. Do not leave the codebase in a half-modified state. If you have already made changes, revert them before escalating.

### "The fix breaks other tests"

Your change causes existing tests to fail.

**What to say:**
> "My change to [file] broke [N] existing tests. The failures are in [area]. This suggests the change has wider impact than expected. Want me to investigate with debug mode, or switch to full Sutando to plan a proper fix?"

**What to do:** Revert your change. Do not try to "fix forward" by modifying the failing tests — that is how cascading breakage happens.

### "Multiple files need coordinated changes"

The rename or fix needs to be applied across more files than expected.

**What to say:**
> "This touches [N] files with coordinated changes — [list the files]. That is beyond quick mode scope. Switching to full Sutando so we can plan the change properly."

**What to do:** If the user agrees, transition to full Sutando Mode A. The work you did in Step 1 (understanding the codebase) is not wasted — it feeds directly into clarification.

### "I am not sure about the root cause"

The bug is not what it appeared to be on the surface.

**What to say:**
> "The root cause is not what I expected. The symptom is [X] but the underlying issue appears to be [Y], which needs investigation. Want me to switch to debug mode?"

**What to do:** Do not guess. Escalate to `skills/debug.md` for systematic root cause analysis.

---

## What Quick Mode Skips

Quick mode deliberately omits the following Sutando artifacts and processes:

- **No `.sutando/` directory creation** — No state management overhead
- **No `config.json`** — No configuration to track
- **No `SPEC.md`** — The task is too small for a specification
- **No `PLAN.md`** — The task is too small for a plan
- **No `STATE.md`** — No phases to track progress through
- **No `SUMMARY.md`** — The one-line report replaces the summary
- **No walkthrough** — The change is self-evident
- **No subagent dispatch** — One agent, one task, one commit
- **No mode detection dialog** — Quick mode is the mode
- **No preference capture** — No interruption tolerance to configure
- **No phase boundaries** — Four steps, linear, no backtracking (except escalation)

## What Quick Mode Keeps

Quick mode is lighter, not lazier. These remain non-negotiable:

- **TDD for code changes** — Write the failing test first. This is not optional. Quick mode is not an excuse to skip tests. If the task changes code behavior, write a test that proves the behavior changed correctly.
- **Verification before claiming done** — Run ALL tests, not just the new one. "I made the change" is not the same as "the change works and nothing else broke."
- **Atomic commits** — One logical change per commit. Descriptive message. No "fix stuff" commits.
- **Escalation when complexity exceeds expectations** — The moment the task outgrows quick mode, stop and escalate. Do not force it.
- **Builder philosophy** — Search Before Building, Boil the Lake, and Evidence Over Intuition still apply. Quick mode scales down the process, not the principles.

---

## Red Flags

If you catch yourself thinking any of these during quick mode, stop and reconsider.

| Thought | Reality |
|---------|---------|
| "This is quick, skip the test" | TDD still applies. Write the test. The test takes 2 minutes. The regression it prevents takes 2 hours to debug. |
| "I'll just change this other file too" | One task, one commit. Do not scope-creep. If the other file needs changes, that is a separate task. |
| "The test failure is probably unrelated" | Run ALL tests. Investigate failures. "Probably unrelated" is not evidence. Check if it was failing before your change. |
| "This is getting complicated but I'm almost done" | Escalate NOW, not after you have made a mess. Sunk cost is not a reason to continue down the wrong path. Revert and escalate. |
| "I don't need to read the surrounding code" | Context matters. The line above and below your change might depend on the current behavior. Read the context. |
| "Quick mode means I can be sloppy" | Quick mode means fewer artifacts, not lower quality. The code you commit should be indistinguishable from code produced by full Sutando. |
| "Let me just skip straight to the fix" | Step 1 (Understand) exists for a reason. 30 seconds of reading prevents 30 minutes of rework. |
| "The user said it's simple so it must be" | Users are often wrong about complexity. Verify with your own eyes before trusting the characterization. |
| "I'll run just the relevant tests to save time" | Run ALL tests. The test suite exists to catch unexpected regressions. You cannot predict which tests will fail. |
| "This rename is safe, no test needed" | If the rename touches serialization, API boundaries, or database fields, it is not safe. Write a test. |

---

## Quick Mode vs. Mode A

Quick mode is lighter than Mode A. Here is how they differ:

| Aspect | Quick Mode | Mode A |
|--------|-----------|--------|
| Clarification | None — task is self-evident | 3-5 focused questions |
| Planning | None | 3-7 tasks, linear plan |
| State management | None — no .sutando/ directory | Full .sutando/ with config, state, spec, plan |
| Testing | TDD for code changes only | Full TDD for all tasks |
| Delivery | One-line report | Verification + summary + walkthrough |
| Escalation path | To Mode A/B/C or debug | Within Sutando (to Mode B/C) |
| Typical duration | 2-10 minutes | 30-90 minutes |
| Typical file count | 1-3 files | 3-10 files |

**The decision boundary:** If you need to ask the user even one clarifying question, the task is not trivial enough for quick mode. Use Mode A instead.

---

## Examples

### Example 1: Fix a Typo

**User:** "Fix the typo in the login error message — it says 'authetication' instead of 'authentication'."

**Step 1 (Understand):** Open the file, find the string, confirm the typo.
**Step 2 (Test First):** Non-code change (string literal, not logic). Skip test.
**Step 3 (Fix + Verify):** Fix the string. Run all tests. All pass.
**Step 4 (Commit + Report):** Commit: `fix: correct 'authetication' typo in login error message`. Report: "Fixed the typo in `src/auth/login.ts`. All tests passing."

### Example 2: Fix an Off-by-One

**User:** "The pagination shows 11 items instead of 10 per page."

**Step 1 (Understand):** Open the pagination code. Find `items.slice(0, pageSize + 1)` — the `+ 1` is wrong.
**Step 2 (Test First):** Write a test: `expect(paginate(items, 10)).toHaveLength(10)`. Run it. It fails (returns 11).
**Step 3 (Fix + Verify):** Change to `items.slice(0, pageSize)`. Run all tests. New test passes. All existing tests pass.
**Step 4 (Commit + Report):** Commit: `fix: correct off-by-one in pagination slice`. Report: "Fixed the off-by-one in `src/utils/paginate.ts`. Pagination now returns exactly `pageSize` items. All 84 tests passing."

### Example 3: Escalation Mid-Task

**User:** "Rename the `userId` field to `user_id` in the User model."

**Step 1 (Understand):** Open the User model. See that `userId` is used in the API response serialization, three controllers, two middleware files, the database migration, and the frontend API client.
**Escalation:** "This rename touches 8+ files across the API, database, and frontend, with serialization and migration implications. That is beyond quick mode scope. Want me to switch to full Sutando to plan this properly?"
