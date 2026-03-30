---
name: sutando-ship
description: >
  Post-delivery skill for shipping completed work. Creates PRs with
  auto-generated descriptions from SUMMARY.md, offers merge options,
  and handles cleanup. Called after deliver.md acceptance or manually.
---

# Sutando Ship

> The last mile — get your work from branch to production-ready.

## Overview

Shipping is what happens after delivery is accepted. The code is done, the tests pass,
the user has walked through the feature and given the green light. Now it needs to go
somewhere — a pull request, a local merge, or just left as a branch for manual handling.

**What shipping means:**

1. **Creating a PR** with a well-crafted description auto-generated from the delivery summary
2. **Merging locally** into the base branch for projects that don't use PRs
3. **Keeping the branch** for manual handling when the user wants control
4. **Discarding** when the work is no longer needed (with confirmation)
5. **Cleaning up** worktrees, state files, and temporary artifacts

**Core principle:** Verify one more time, present options, execute the choice, clean up.

## When This Skill Runs

### Automatic Invocation

Called by `deliver.md` after the user accepts delivery (Step 6: Finalize). When the user
says "accept" during the verification gate, deliver.md completes its finalization and then
hands off to this skill.

### Manual Invocation

Can be invoked directly at any time with phrases like:

- "ship this"
- "create a PR"
- "push and create a pull request"
- "merge this into main"
- "I'm done, ship it"

### Prerequisites

Before shipping can proceed, the following must be true:

- All changes are committed (no uncommitted work)
- A feature branch exists (not on main/master directly)
- Tests are passing (will be re-verified in pre-ship checks)

If any prerequisite is missing, stop and address it before continuing.

## Pre-Ship Verification

**This is not optional. Even if tests passed during delivery, run them again.**

Merges, rebases, and time itself can introduce failures. A test that passed 10 minutes
ago can fail now if the base branch moved.

### Step 1: Check for Uncommitted Changes

```bash
git status --porcelain
```

If there is any output, there are uncommitted changes. Stop and address them:

> "There are uncommitted changes. Please commit or stash them before shipping:
> [list of files from git status]"

Do NOT proceed with uncommitted changes. Do NOT auto-commit them.

### Step 2: Identify Verification Commands

Scan the project for every verification tool available:

| Type | Where to find it |
|------|-------------------|
| Test suite | `package.json` scripts (`test`, `test:unit`, `test:e2e`), `Makefile`, `pytest.ini`, `Cargo.toml` |
| Linter | `eslint`, `ruff`, `clippy`, `golint` — check package.json, Makefile, CI config |
| Type checker | `tsc --noEmit`, `mypy`, `pyright` — check package.json or CI |
| Formatter check | `prettier --check`, `black --check`, `rustfmt --check` |

Also check `CLAUDE.md` and CI config (`.github/workflows/*.yml`) for project-specific
verification commands.

### Step 3: Run FULL Verification Suite

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
- No lint errors

### Step 4: Handle Failures

**If ANY verification fails:**

> "Pre-ship verification failed. Cannot ship until this is resolved:
>
> [Show the failure output]
>
> Fix the issue and re-run ship when ready."

**STOP. Do not ship.** Do not offer to "ship anyway." Do not present ship options.
Failed verification means the work is not ready. Return to execution or debugging
to fix the issue first.

## Ship Options

Once pre-ship verification passes, present exactly these 4 options:

```
Work is complete and verified. How would you like to ship?

1. **Create Pull Request** — Push branch, create PR with auto-generated description
2. **Merge locally** — Merge into [base branch], delete feature branch
3. **Keep as-is** — Branch stays, you handle integration manually
4. **Discard** — Delete branch and all work (requires confirmation)
```

Replace `[base branch]` with the actual detected base branch (main, master, develop, etc.).

**Do not add explanation or recommendations.** Present the options and wait for
the user's choice. The user knows their workflow better than you do.

### Detecting the Base Branch

```bash
# Try common base branches in order of likelihood
git merge-base HEAD main 2>/dev/null && echo "main" || \
git merge-base HEAD master 2>/dev/null && echo "master" || \
git merge-base HEAD develop 2>/dev/null && echo "develop"
```

Or check `.sutando/config.json` if it records the base branch from project setup.

If uncertain, ask: "This branch appears to have split from `main` — is that correct?"

---

## Option 1: Create Pull Request

This is the most common ship path. Push the branch and create a PR with an
auto-generated description derived from the delivery summary.

### Step 1a: Push the Branch

```bash
git push -u origin <branch-name>
```

If the push fails due to remote rejection or auth issues, report the error and stop.
Do not force push. Do not retry with different flags.

### Step 1b: Generate PR Description from SUMMARY.md

Read `docs/sutando/SUMMARY.md` and construct the PR description using this template:

```markdown
## Summary
[What Was Built section from SUMMARY.md — condensed to 2-3 bullet points]

## Changes
[Files Changed table from SUMMARY.md — file, action, purpose]

## Testing
- [X] All unit tests passing ([N] tests)
- [X] All integration tests passing ([N] tests)
- [X] Manual verification via interactive walkthrough

## Key Decisions
[Key Decisions table from SUMMARY.md — decision, rationale, alternatives considered]

---
*Generated by [Sutando](https://github.com/caohaotiantian/sutando)*
```

**Formatting rules:**

- The Summary section should be concise. No more than 3 bullet points. Each bullet
  should describe a user-visible behavior or capability, not an implementation detail.
- The Changes section should be a markdown table with columns: File, Action, Purpose.
  Action is one of: Created, Modified, Deleted, Renamed.
- The Testing section should reflect actual test counts from the pre-ship verification.
  If integration tests or E2E tests were not run (because they don't exist), omit those
  lines rather than marking them as passing.
- The Key Decisions section should only include decisions that a reviewer would care about.
  Skip trivial choices like variable naming or import ordering.

### Step 1c: Determine PR Title

Derive the PR title from the feature name or the first line of SUMMARY.md's
"What Was Built" section. Keep it under 70 characters.

Good PR titles:
- "Add user authentication with JWT tokens"
- "Fix race condition in order processing queue"
- "Refactor database layer to use connection pooling"

Bad PR titles:
- "Sutando delivery" (says nothing about the content)
- "Feature branch work" (says nothing about what was built)
- "Updates" (the most useless title possible)

### Step 1d: Create the PR

```bash
gh pr create --title "<feature name>" --body "<generated description>"
```

If `gh` is not installed or not authenticated, report the error and provide the
manual alternative:

> "Could not create PR automatically (`gh` not found/not authenticated).
> Branch has been pushed to `origin/<branch-name>`.
> Create the PR manually at: https://github.com/<owner>/<repo>/compare/<branch-name>"

### Step 1e: Report

After successful PR creation:

> "PR created: [URL]
> Branch: [branch name]
> Base: [base branch]
>
> The PR description was auto-generated from your delivery summary."

### Step 1f: Clean Up Worktree (if applicable)

If the work was done in a Sutando worktree:

```bash
# First, move out of the worktree directory
cd <original project directory>

# Then remove the worktree
git worktree remove <worktree path>
```

If worktree removal fails (uncommitted changes, locks), report the issue:

> "Could not auto-remove worktree at `<path>`. You can remove it manually:
> `git worktree remove <path>` (or `git worktree remove --force <path>`)"

---

## Option 2: Merge Locally

For projects that don't use PRs or when the user wants to merge directly.

### Step 2a: Switch to Base Branch and Pull Latest

```bash
git checkout <base-branch>
git pull origin <base-branch>
```

If the pull fails or there are conflicts with the current state, report and stop.

### Step 2b: Merge the Feature Branch

```bash
git merge <feature-branch>
```

If merge conflicts occur:

> "Merge conflicts detected in [N] files:
> [list of conflicting files]
>
> Resolve the conflicts and run ship again, or choose a different ship option."

Do NOT attempt to auto-resolve merge conflicts. The user should handle these.

### Step 2c: Run Tests After Merge

**This is critical.** Tests must pass on the merged result, not just on the feature
branch. Merges can introduce subtle breakage even without conflicts.

```bash
# Run the same verification suite from pre-ship
<test command>
<lint command>
<type check command>
```

**If tests fail after merge:**

```bash
# Abort the merge — do not leave a broken merge in place
git merge --abort
```

> "Tests failed after merging into [base branch]. The merge has been aborted.
> Your feature branch is intact. Consider creating a PR instead so the
> conflicts can be resolved with review."

### Step 2d: Delete Feature Branch

Only after tests pass on the merged result:

```bash
git branch -d <feature-branch>
```

Use `-d` (lowercase), not `-D`. If git refuses because the branch is not fully
merged, something went wrong — investigate rather than force-deleting.

### Step 2e: Clean Up Worktree

Same as Step 1f above. Remove the worktree if one was used.

### Step 2f: Report

> "Merged `<feature-branch>` into `<base-branch>`. Feature branch deleted.
> [N] tests passing on the merged result."

---

## Option 3: Keep As-Is

The lightest option. The user wants the branch to exist but will handle
integration themselves.

### What to Do

1. Report the branch name and its location
2. Do NOT clean up the worktree
3. Do NOT push the branch (unless the user asks)

### Report

> "Branch `<feature-branch>` is ready at `<worktree path or repo path>`.
>
> When you're done, you can clean up with:
> ```
> git worktree remove <worktree path>
> ```
>
> Or to push later:
> ```
> git push -u origin <feature-branch>
> ```"

If no worktree was used, simplify the report:

> "Branch `<feature-branch>` is ready. All tests passing, all changes committed.
> Handle integration whenever you're ready."

---

## Option 4: Discard

**Destructive operation. Requires explicit confirmation.**

This deletes the branch, all commits on it, and the worktree. There is no undo.

### Step 4a: Show What Will Be Lost

```bash
# Show the commits that will be deleted
git log --oneline <base-branch>..<feature-branch>
```

> "This will permanently delete:
> - Branch: `<feature-branch>`
> - Commits: [list from git log]
> - Worktree: `<worktree path>` (if applicable)
> - All code changes from this work
>
> **Type 'discard' to confirm deletion of all work.**"

### Step 4b: Wait for Confirmation

The user must type the word "discard" (case-insensitive). Anything else aborts:

- "discard" or "DISCARD" -> proceed with deletion
- "yes", "ok", "confirm", "y" -> NOT accepted. Require "discard" specifically.
- Anything else -> "Discard cancelled. Your work is safe."

### Step 4c: Delete Everything

```bash
# Switch to base branch first
git checkout <base-branch>

# Delete the feature branch (force because it's not merged)
git branch -D <feature-branch>

# Remove worktree if applicable
git worktree remove <worktree path> --force
```

### Step 4d: Report

> "Work discarded. Branch `<feature-branch>` and worktree removed.
> You are now on `<base-branch>`."

---

## Post-Ship Recommendations

After shipping via Option 1 (PR) or Option 2 (Merge), offer relevant next-step
recommendations. Only include items that actually apply — do not pad with generic advice.

### Check STATE.md for Open Issues

Read `.sutando/STATE.md` and look for the "Issues Encountered" section. If there
are unresolved items or items marked as deferred:

> "There are [N] items worth addressing:
> - [Issue description from STATE.md]
> - [Issue description from STATE.md]
> These are non-blocking but worth tracking."

### Check SPEC.md for Out-of-Scope Items

Read `docs/sutando/SPEC.md` and look for the "Out of Scope" section. If there are
deferred features:

> "Features deferred to future work:
> - [Out-of-scope item]: [brief recommendation for when/how to tackle it]
> - [Out-of-scope item]: [brief recommendation]"

### Check for Technical Debt

If STATE.md records technical debt introduced during implementation:

> "Technical debt introduced:
> - [Debt item]: [what it is and why it was deferred]
> Consider addressing these before the next feature."

### PR-Specific Recommendation

If a PR was created (Option 1):

> "Consider requesting a human code review on the PR before merging.
> AI-generated code benefits from human review for:
> - Business logic correctness
> - Security implications
> - Naming and API design choices"

### Full Post-Ship Message Template

Combine applicable sections into a single message:

> "Shipped! A few recommendations:
>
> [Issues section — only if there are open issues]
>
> [Out-of-scope section — only if there are deferred features]
>
> [Technical debt section — only if debt was introduced]
>
> [PR review section — only if a PR was created]"

If none of the sections apply, keep it simple:

> "Shipped! No outstanding issues or deferred work. Clean delivery."

---

## Integration with Other Skills

### deliver.md Integration

The deliver.md skill's Step 6 (Finalize) should hand off to this skill when the user
accepts delivery. The handoff looks like:

1. deliver.md completes its finalization (commit SUMMARY.md, update STATE.md)
2. deliver.md presents the final status with the note: "Need anything else? (push, create PR, etc.)"
3. If the user says yes to shipping, read and follow `skills/ship.md`

### SUMMARY.md Dependency

This skill reads `docs/sutando/SUMMARY.md` for PR description generation. The SUMMARY.md
must exist and contain at minimum:

- **What Was Built** — for the PR summary section
- **Files Changed** — for the PR changes section
- **Key Decisions** — for the PR key decisions section
- **Test Coverage** — for the PR testing section

If SUMMARY.md is missing or incomplete, generate a basic PR description from
`git log` and `git diff --stat` instead. Do not fail — degrade gracefully.

### config.json Dependency

This skill reads `.sutando/config.json` for:

- Base branch information
- Project metadata (name, repo URL)
- Worktree path (if applicable)

If config.json is missing, detect these values from git and the environment.

### STATE.md Dependency

This skill reads `.sutando/STATE.md` for:

- Open issues to report in post-ship recommendations
- Technical debt items
- Phase status (to verify delivery was accepted)

---

## Red Flags

These are thoughts you might have that indicate you are about to make a mistake.
Catch them and correct course.

| Thought | Reality |
|---------|---------|
| "Tests passed earlier, skip pre-ship check" | Run them AGAIN. Merges can break things. |
| "Force push to fix the PR" | Never force push. Create a new commit. |
| "I'll push to main directly" | Always use a PR or explicit merge. Never push directly to main. |
| "The PR description is good enough" | Use SUMMARY.md. Auto-generated from delivery data beats hastily written. |
| "I'll auto-commit these uncommitted changes" | Never auto-commit. Tell the user about uncommitted changes and stop. |
| "The user said 'yes' to discard, close enough" | Require the exact word 'discard'. Safety matters for destructive ops. |
| "Worktree cleanup failed, that's fine" | Report the failure. Don't swallow errors silently. |
| "I'll resolve these merge conflicts myself" | Don't. Report them and let the user decide how to handle conflicts. |
| "Tests after merge are redundant" | They are not. Merge introduces new code combinations. Always test. |
| "Skip the PR description, it takes too long" | The description takes 5 seconds to generate. A reviewer spends 30 minutes without one. |

---

## Quick Reference

| Option | Push | Merge | PR | Keep Worktree | Delete Branch | Requires Confirmation |
|--------|------|-------|----|---------------|---------------|-----------------------|
| 1. Create PR | Yes | No | Yes | No | No | No |
| 2. Merge locally | No | Yes | No | No | Yes (soft) | No |
| 3. Keep as-is | No | No | No | Yes | No | No |
| 4. Discard | No | No | No | No | Yes (force) | Yes ("discard") |

## Error Recovery

### Push Rejected

If `git push` is rejected:

```bash
# Pull and rebase, then retry
git pull --rebase origin <branch-name>
git push -u origin <branch-name>
```

If rebase causes conflicts, report them and stop. Do not force push.

### gh CLI Not Available

If `gh` is not installed or not authenticated:

1. Still push the branch (the push is useful even without a PR)
2. Provide the URL for manual PR creation
3. Report what happened clearly

### Worktree Lock

If worktree removal fails due to a lock:

```bash
# Check what's locking it
git worktree list
ls <worktree-path>/.git
```

Report the lock and provide the manual removal command. Do not force-remove
without the user's consent.

### Merge Abort Failure

If `git merge --abort` fails after a failed post-merge test:

```bash
# Last resort — reset to pre-merge state
git reset --hard HEAD~1
```

Report that the abort required a hard reset and verify the state is clean.
