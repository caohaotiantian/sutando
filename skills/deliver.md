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

## Mode Scaling

Read mode from `.sutando/config.json` and follow the matching path.

### Mode A: Quick Delivery
- **DO:** Run test suite. Write brief summary (1 paragraph). Single accept/reject gate.
- **SKIP:** Interactive walkthrough, goal-backward verification (TRUE/EXIST/WIRED), architecture decisions documentation, post-delivery recommendations
- **Verification:** Test suite only (skip lint/types unless they exist and run fast)
- **SUMMARY.md:** Brief — What Was Built (1 paragraph), Files Changed, Test Coverage, How to Run

### Mode B: Standard Delivery
- **DO:** Run tests + lint/types if available. Full SUMMARY.md. Abbreviated walkthrough (2-3 grouped items). Verification gate with accept/revisions/major options.
- **SKIP:** Goal-backward TRUE/EXIST/WIRED analysis, architecture decisions section
- **SUMMARY.md:** Full — all sections except Architecture Decisions

### Mode C: Full Delivery
- **DO:** All verification (tests + lint + types + e2e). Full SUMMARY.md with architecture decisions. Goal-backward verification. Full interactive walkthrough (1 item per goal). Post-delivery recommendations.
- **SKIP:** Nothing

## Iron Law

**No delivery claims without passing verification evidence.**

If the test suite fails: do NOT present the delivery. Go back to execution, fix the issue, then retry delivery.

## Goal-Backward Verification

Before presenting delivery, verify goals are achieved — not just that tasks were completed. Task completion is necessary but not sufficient. A task can be "done" while the goal it serves remains unmet (wrong wiring, missing glue code, integration gap).

For each goal listed in SPEC.md, work backward through three levels:

- **Level 1: TRUE** — What observable behaviors prove the goal works from the user's perspective?
- **Level 2: EXIST** — What concrete artifacts (files, endpoints, functions, DB tables) must be present?
- **Level 3: WIRED** — Is the data flow between artifacts connected end-to-end?

For each goal: write the three levels, verify EXIST artifacts in the codebase, trace WIRED data flow through code, and run TRUE verification. If any level fails, the goal is NOT achieved — go back to execution.

> **Goal-backward verification examples** — See `references/deliver-advanced.md` for full TRUE/EXIST/WIRED examples.

## Process

At the start of delivery, set the phase:

```bash
SUTANDO_ROOT="$HOME/.claude/skills/sutando"
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase deliver
```

### Step 1: Generate SUMMARY.md

Read `.sutando/STATE.md` and the git log to produce `docs/sutando/SUMMARY.md`:

1. **What Was Built** — Summarize the feature in 2-3 paragraphs. What does it do? How does it work? What's the user-facing impact?

2. **Key Decisions** — Pull from STATE.md's "Decisions Made During Execution" table. These are decisions the agent made autonomously — the user should know about them.

3. **Architecture Decisions** — Document structural choices made during implementation:
   - What architecture pattern was chosen and why (e.g., "Used repository pattern for data access to keep controllers thin")
   - Trade-offs acknowledged (e.g., "Chose SQLite over Postgres for simplicity — limits concurrent writes but eliminates deployment dependency")
   - Technical debt introduced and justification (e.g., "Auth tokens don't expire yet — acceptable for MVP, tracked as future work")
   - Alternatives considered and why they were rejected
   - Recommendations for future work (e.g., "When adding real-time features, consider migrating from polling to WebSocket")

4. **Files Changed** — Generate from `git diff --stat` between the starting commit and HEAD. List each file with its action (Created/Modified) and a brief purpose.

5. **Test Coverage** — Count passing tests from the test suite output.

6. **Issues Encountered & Resolved** — Pull from STATE.md's "Issues Encountered" section. Brief descriptions of problems hit and how they were solved.

7. **How to Run** — Concrete commands to start, test, and use the feature. Derived from the project's existing scripts (package.json scripts, Makefile targets, etc.).

### Step 2: Run Fresh Verification

**This is mandatory. No shortcuts.**

#### 2a: Identify All Verification Commands

Scan the project for every verification tool available:

| Type | Where to find it |
|------|-------------------|
| Test suite | `package.json` scripts (`test`, `test:unit`, `test:e2e`), `Makefile`, `pytest.ini`, `Cargo.toml` |
| Linter | `eslint`, `ruff`, `clippy`, `golint` — check package.json scripts, Makefile, CI config |
| Type checker | `tsc --noEmit`, `mypy`, `pyright` — check package.json scripts or CI |
| Formatter check | `prettier --check`, `black --check`, `rustfmt --check` |
| E2E tests | `playwright`, `cypress`, `selenium` — check package.json, test directories |

Also check CLAUDE.md and CI config (`.github/workflows/*.yml`, `.gitlab-ci.yml`) for project-specific verification commands.

#### 2b: Run ALL Verification

Run every applicable verification command. Order:

1. **Type checking** (fastest feedback, catches structural errors)
2. **Linting** (catches style and correctness issues)
3. **Unit tests** (FULL suite — not partial, not cached, not just the new tests)
4. **Integration tests** (if they exist)
5. **E2E tests** (if they exist)

Read the COMPLETE output of each. Check:
- Exit code is 0
- All tests pass (count matches expected)
- No warnings that indicate real issues
- No type errors
- No lint errors (warnings are acceptable if they existed before)

#### 2c: Handle Failures

**If ANY verification fails:**
> Do NOT proceed to Step 3. Return to the execution phase:
> 1. Identify which check(s) failed
> 2. Apply TDD to fix (write/update test -> verify fail -> fix -> verify pass)
> 3. Re-run the FULL verification suite (not just the fixed check)
> 4. Return to Step 2 of delivery

**If a check is flaky:**
> Run it three times. If it passes 2/3 times, note the flakiness as a concern.
> If it fails 2/3 times, treat it as a real failure.

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

If additional verification was run (lint, types, e2e), include those results too:

> "**Additional verification:**
> - Type check: clean (0 errors)
> - Lint: clean (0 errors, 2 pre-existing warnings)
> - E2E: 5/5 passing"

### Step 4: Interactive Walkthrough

Walk the user through key behaviors, one at a time. **Derive walkthrough items from goals in SPEC.md** — not from tasks in PLAN.md. The number of walkthrough items should match the number of goals, not the number of tasks.

Each walkthrough item must be concrete and verifiable — show actual commands for APIs, describe what to look for in UI, show system state for infrastructure. Show BEFORE/AFTER when applicable. Wait for user response before moving to the next item.

> **Walkthrough templates & post-delivery detail** — See `references/deliver-advanced.md`.

**If the user reports an issue during walkthrough:**
1. Note which item failed
2. Complete the rest of the walkthrough (collect all feedback)
3. After walkthrough: fix all reported issues using TDD
4. Re-run full verification suite (not just tests — lint, types, everything)
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
- Fix each using TDD (test -> fail -> implement -> pass -> commit)
- Re-run full verification suite
- Re-present only the changed items in a mini-walkthrough
- Return to verification gate

**If Major issues:**
- Discuss with the user which phase to return to
- Update state via `node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase <target-phase>` to reflect the rollback
- Transition to the appropriate phase

### Step 6: Finalize

1. Ensure all changes are committed with clean, atomic history
2. Commit SUMMARY.md to `.sutando/`:
   ```bash
   git add docs/sutando/SUMMARY.md && git commit -m "docs: add Sutando delivery summary"
   ```

3. Use sutando-tools.cjs for state operations — provides lockfile safety and atomic writes:

   At delivery start:
   ```bash
   SUTANDO_ROOT="$HOME/.claude/skills/sutando"
   node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase deliver
   ```

   After user accepts:
   ```bash
   node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase complete
   ```

4. Present final status:
   > "**Done.** All work committed on branch `[current branch]`.
   > - [N] tasks, [M] tests passing
   > - Summary: `docs/sutando/SUMMARY.md`
   > - State: `.sutando/STATE.md`
   >
   > Need anything else? (push, create PR, etc.)"

**Do NOT auto-push or auto-create PRs** unless the user explicitly asks.

### Step 7: Post-Delivery Recommendations

After the user accepts, proactively offer relevant next steps: PR creation, known issues from STATE.md, out-of-scope items from SPEC.md, and technical debt introduced. Only offer what is relevant.

> **Post-delivery recommendation templates** — See `references/deliver-advanced.md`.

## Red Flags

| Thought | Reality |
|---------|---------|
| "Tests passed earlier, no need to re-run" | Run them FRESH. Always. |
| "The walkthrough is tedious, I'll summarize" | One item at a time. User verifies each. |
| "The user seems happy, skip verification gate" | Always ask. Always gate. |
| "I'll push to save the user time" | Never push without being asked. |
| "Minor test failure, probably flaky" | A failure is a failure. Fix it. |

> **Extended red flags (5 more)** — See `references/deliver-advanced.md`.
