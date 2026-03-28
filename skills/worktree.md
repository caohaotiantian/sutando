---
name: sutando-worktree
description: >
  Creates an isolated git worktree before Sutando execution begins.
  Ensures work happens on a feature branch, not main/master.
  Called automatically by the orchestrator before execution phase.
---

# Worktree Management for Workspace Isolation

## Overview

When Sutando executes a plan, it makes commits, installs dependencies, modifies configs,
and potentially restructures files. Doing all of this directly on main/master is dangerous:

- **Protects main/master from in-progress commits.** Half-finished features, experimental
  refactors, and speculative changes never touch your default branch. If something goes
  wrong mid-execution, main stays clean.

- **Clean rollback.** If the entire feature direction is wrong, cleanup is trivial: delete
  the worktree and its branch. No need to revert a chain of commits on main or untangle
  an interactive rebase.

- **Parallel work.** Multiple Sutando sessions can run simultaneously on different features,
  each in its own worktree. One session building auth while another adds payment processing,
  with zero interference between them.

- **Clean PRs.** The feature branch contains only the feature commits. No unrelated changes,
  no "fix lint" commits from other work, no merge commits from syncing. The PR diff shows
  exactly what this feature does.

**Announce at start:** "Setting up an isolated worktree for this Sutando session."

---

## When This Skill Runs

| Condition | Action |
|-----------|--------|
| Full Sutando mode, user on main/master/develop | Create worktree |
| Full Sutando mode, user on a feature branch | Skip, use current branch |
| Quick mode (`sutando --quick`) | Skip entirely |
| Already inside a worktree | Skip, use current worktree |
| Plan not yet approved | Do NOT run — wait for approval |

**Trigger point:** Called by the SKILL.md orchestrator AFTER plan approval and BEFORE
the execution phase begins. This ensures:

1. The user has reviewed and approved the plan (no wasted worktree for rejected plans).
2. The execution phase has an isolated environment from its first command.
3. All execute.md work happens inside the worktree automatically.

---

## Process

### Step 1: Detect Current State

Determine the current branch and whether isolation is needed.

```bash
# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)

# Determine the repository default branch
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Check if we are already inside a worktree
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
```

**Decision logic:**

- If `GIT_DIR` differs from `GIT_COMMON_DIR`: we are already in a worktree. Report this
  and skip creation. Proceed with the current worktree.
- If `CURRENT_BRANCH` is empty (detached HEAD): warn the user. Offer to create a branch
  from the current commit before proceeding. Do not create a worktree from detached HEAD.
- If `CURRENT_BRANCH` matches `main`, `master`, or `develop`: proceed with worktree creation.
- If `CURRENT_BRANCH` is anything else (a feature branch): skip worktree creation. The user
  is already on an isolated branch. Report this and proceed directly to execution.

```
Already on feature branch 'feature/auth-system'. Skipping worktree creation.
Execution will proceed on this branch.
```

### Step 2: Check for Dirty Working Directory

Before creating a worktree, the working directory MUST be clean.

```bash
# Check for uncommitted changes (staged or unstaged)
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Uncommitted changes detected."
fi

# Check for untracked files that might matter
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED" ]; then
    echo "Untracked files detected."
fi
```

If the working directory is dirty, prompt:

```
You have uncommitted changes on <branch>:
  - 3 modified files
  - 1 untracked file

Options:
  1. Stash changes and proceed (git stash push -m "sutando: pre-worktree stash")
  2. Commit changes first, then create worktree
  3. Abort worktree creation

Which would you prefer? (1/2/3)
```

NEVER create a worktree with uncommitted changes without user confirmation. The changes
would not carry over to the new worktree, and the user might lose track of them.

### Step 3: Generate Branch Name

Derive a meaningful branch name from the project context.

```bash
# Extract feature name from SPEC.md project name or title
# Convert to lowercase, replace spaces with hyphens, strip special chars
FEATURE_NAME=$(head -5 SPEC.md | grep -i "project\|title\|name" | head -1 \
    | sed 's/.*: *//' \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9 ]//g' \
    | sed 's/ /-/g' \
    | sed 's/--*/-/g' \
    | sed 's/^-//;s/-$//')

# Fallback: use timestamp if no name can be derived
if [ -z "$FEATURE_NAME" ]; then
    FEATURE_NAME="session-$(date +%Y%m%d-%H%M%S)"
fi

BRANCH_NAME="sutando/${FEATURE_NAME}"
```

**Naming convention:**

| SPEC.md Project Name | Branch Name |
|----------------------|-------------|
| User Authentication | `sutando/user-authentication` |
| Payment Processing v2 | `sutando/payment-processing-v2` |
| Fix Login Bug | `sutando/fix-login-bug` |
| (no SPEC.md found) | `sutando/session-20260328-143022` |

The `sutando/` prefix makes it immediately clear which branches were created by Sutando
sessions, aiding cleanup and identification.

### Step 4: Choose Worktree Location

Worktrees are stored in a dedicated directory within the project root.

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)

# Check for existing worktree directories (priority order)
if [ -d "${PROJECT_ROOT}/.worktrees" ]; then
    WORKTREE_DIR="${PROJECT_ROOT}/.worktrees"
elif [ -d "${PROJECT_ROOT}/worktrees" ]; then
    WORKTREE_DIR="${PROJECT_ROOT}/worktrees"
else
    # Create new directory
    WORKTREE_DIR="${PROJECT_ROOT}/.worktrees"
    mkdir -p "${WORKTREE_DIR}"
fi

WORKTREE_PATH="${WORKTREE_DIR}/sutando-${FEATURE_NAME}"
```

**Verify .gitignore coverage:**

This is a critical safety check. Worktree directories MUST be ignored by git.

```bash
# Check if the worktree directory is already ignored
if ! git check-ignore -q "${WORKTREE_DIR}" 2>/dev/null; then
    echo "WARNING: ${WORKTREE_DIR} is not in .gitignore"

    # Determine the ignore entry to add
    IGNORE_ENTRY=$(basename "${WORKTREE_DIR}")/

    # Check if .gitignore exists
    if [ -f "${PROJECT_ROOT}/.gitignore" ]; then
        echo "" >> "${PROJECT_ROOT}/.gitignore"
        echo "# Sutando worktrees" >> "${PROJECT_ROOT}/.gitignore"
        echo "${IGNORE_ENTRY}" >> "${PROJECT_ROOT}/.gitignore"
    else
        echo "# Sutando worktrees" > "${PROJECT_ROOT}/.gitignore"
        echo "${IGNORE_ENTRY}" >> "${PROJECT_ROOT}/.gitignore"
    fi

    # Commit the .gitignore change immediately
    git add "${PROJECT_ROOT}/.gitignore"
    git commit -m "chore: add worktree directory to .gitignore"

    echo "Added ${IGNORE_ENTRY} to .gitignore and committed."
fi
```

MUST verify `.worktrees/` is in .gitignore BEFORE creating any worktree. If it is not
ignored, add it and commit the change first. This prevents worktree contents from being
accidentally tracked by git.

### Step 5: Create Worktree

```bash
# Attempt to create worktree with a new branch
if git worktree add "${WORKTREE_PATH}" -b "${BRANCH_NAME}" 2>/dev/null; then
    echo "Created worktree with new branch ${BRANCH_NAME}"
elif git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    # Branch already exists — attach worktree to existing branch
    git worktree add "${WORKTREE_PATH}" "${BRANCH_NAME}"
    echo "Created worktree using existing branch ${BRANCH_NAME}"
else
    # Something else went wrong
    echo "ERROR: Failed to create worktree."
    echo "Falling back to working on current branch."
    FALLBACK=true
fi
```

**Fallback behavior:** If `git worktree add` fails for any reason (permissions, sandbox
restrictions, disk space, git version too old), do NOT abort the entire Sutando session.
Instead:

1. Log the error clearly.
2. Warn the user that isolation is not available.
3. Proceed with execution on the current branch.
4. Note in the final delivery that worktree isolation was not used.

```
WARNING: Could not create worktree (permission denied).
Proceeding without isolation — work will happen on 'main'.
Consider committing or creating a branch manually before continuing.
```

### Step 6: Set Up Worktree Environment

After creation, the worktree needs to be ready for development.

```bash
cd "${WORKTREE_PATH}"

# Auto-detect and run project setup
if [ -f package.json ]; then
    echo "Detected Node.js project. Running npm install..."
    npm install
elif [ -f yarn.lock ]; then
    echo "Detected Yarn project. Running yarn install..."
    yarn install
elif [ -f pnpm-lock.yaml ]; then
    echo "Detected pnpm project. Running pnpm install..."
    pnpm install
elif [ -f requirements.txt ]; then
    echo "Detected Python project. Running pip install..."
    pip install -r requirements.txt
elif [ -f pyproject.toml ]; then
    echo "Detected Python project with pyproject.toml..."
    if command -v poetry &>/dev/null; then
        poetry install
    elif command -v uv &>/dev/null; then
        uv sync
    else
        pip install -e .
    fi
elif [ -f Cargo.toml ]; then
    echo "Detected Rust project. Running cargo build..."
    cargo build
elif [ -f go.mod ]; then
    echo "Detected Go project. Running go mod download..."
    go mod download
elif [ -f Gemfile ]; then
    echo "Detected Ruby project. Running bundle install..."
    bundle install
fi
```

### Step 7: Verify Clean Baseline

Run tests to confirm the worktree starts from a known-good state.

```bash
cd "${WORKTREE_PATH}"

# Auto-detect and run tests
if [ -f package.json ]; then
    npm test 2>&1 | tail -20
elif [ -f Cargo.toml ]; then
    cargo test 2>&1 | tail -20
elif [ -f pytest.ini ] || [ -f pyproject.toml ] || [ -d tests ]; then
    pytest 2>&1 | tail -20
elif [ -f go.mod ]; then
    go test ./... 2>&1 | tail -20
elif [ -f Gemfile ]; then
    bundle exec rspec 2>&1 | tail -20
fi

TEST_EXIT=$?
```

If tests fail:

```
Baseline tests failed in worktree (exit code: 1).
These failures exist on the base branch — they are not caused by Sutando.

Options:
  1. Proceed anyway (failures are known/expected)
  2. Investigate before proceeding
  3. Abort and return to main branch

Which would you prefer? (1/2/3)
```

If tests pass: continue to reporting.

### Step 8: Report

After successful setup, report the complete state to the user.

```
Created isolated workspace:
  - Branch: sutando/<slug>
  - Location: .worktrees/sutando-<slug>/
  - Base: <base branch name>
  - Tests: passing (N tests, 0 failures)

All execution will happen in this worktree. Your main branch is protected.
Proceeding to execution phase.
```

This report confirms:
- Which branch was created and where it lives.
- Which branch it was based on (for later merging).
- That the baseline is clean (or notes any pre-existing failures).
- That the user's default branch remains untouched.

---

## Cleanup After Delivery

After deliver.md completes and the user has reviewed the work, offer structured
cleanup options. This is typically invoked at the end of the full Sutando flow.

### Cleanup Options

Present these options to the user:

```
Sutando session complete. How would you like to handle the worktree?

  1. Merge back to <base branch> and remove worktree
     - Merges sutando/<slug> into <base>, deletes branch and worktree

  2. Push branch and create PR (keeps worktree until PR merged)
     - Pushes to origin, opens PR, worktree stays for any follow-up

  3. Keep worktree as-is (manual cleanup later)
     - No action taken. Clean up with:
       git worktree remove .worktrees/sutando-<slug>
       git branch -d sutando/<slug>

  4. Discard work and remove worktree
     - DESTRUCTIVE: deletes all work in this session

Which would you prefer? (1/2/3/4)
```

### Option 1: Merge and Remove

```bash
# Switch to base branch
cd "${PROJECT_ROOT}"
git checkout "${DEFAULT_BRANCH}"

# Merge the feature branch
git merge "${BRANCH_NAME}" --no-ff -m "feat: merge ${BRANCH_NAME}"

# Remove worktree and branch
git worktree remove "${WORKTREE_PATH}"
git branch -d "${BRANCH_NAME}"

echo "Merged to ${DEFAULT_BRANCH}, worktree and branch removed."
```

### Option 2: Push and PR

```bash
# Push from worktree
cd "${WORKTREE_PATH}"
git push -u origin "${BRANCH_NAME}"

# Create PR (using gh if available)
if command -v gh &>/dev/null; then
    gh pr create --title "feat: ${FEATURE_NAME}" --body "Created by Sutando session."
    echo "PR created. Worktree kept for follow-up work."
else
    echo "Branch pushed. Create PR manually at:"
    echo "  https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/compare/${BRANCH_NAME}"
fi
```

### Option 3: Keep As-Is

```bash
echo "Worktree preserved at: ${WORKTREE_PATH}"
echo "Branch: ${BRANCH_NAME}"
echo ""
echo "To clean up later:"
echo "  git worktree remove ${WORKTREE_PATH}"
echo "  git branch -d ${BRANCH_NAME}"
```

### Option 4: Discard Work

This is destructive and requires explicit confirmation.

```bash
# Require typed confirmation
echo "This will permanently delete all work from this session."
echo "Type 'discard sutando/<slug>' to confirm:"
read CONFIRM

if [ "$CONFIRM" = "discard ${BRANCH_NAME}" ]; then
    cd "${PROJECT_ROOT}"
    git worktree remove --force "${WORKTREE_PATH}"
    git branch -D "${BRANCH_NAME}"
    echo "Worktree and branch deleted. All session work discarded."
else
    echo "Confirmation did not match. No action taken."
fi
```

---

## Safety Checks

These checks are non-negotiable. Every worktree operation MUST follow them.

| Check | When | Action on Failure |
|-------|------|-------------------|
| `.worktrees/` in .gitignore | Before creating worktree dir | Add to .gitignore and commit |
| No uncommitted changes | Before `git worktree add` | Prompt: stash, commit, or abort |
| No uncommitted changes in worktree | Before `git worktree remove` | Warn user, require confirmation |
| Worktree exists | Before cd into worktree | Recreate or abort |
| Branch does not conflict | Before creating branch | Use existing branch or generate new name |
| Tests pass | After worktree setup | Report failures, ask user how to proceed |
| `git worktree add` succeeds | During creation | Fall back to current branch with warning |

**Critical invariants:**

- NEVER create a worktree if there are uncommitted changes on the current branch without
  user confirmation (stash or commit first).
- NEVER delete a worktree with uncommitted changes without explicit user confirmation and
  typed destructive-action confirmation.
- NEVER force-delete a branch (`-D`) unless the user chose the discard option with
  confirmation. Use `-d` (safe delete) for all other paths.
- If `git worktree add` fails due to permission error or sandbox restriction, fall back
  to working on the current branch with a clear warning. Do not abort the session.

---

## Integration with Other Skills

This skill is part of the Sutando execution pipeline and interacts with several other
skills at defined points.

### SKILL.md (Orchestrator)

The orchestrator calls this skill at a specific point in the pipeline:

```
Plan phase (plan.md)
  → User approves plan
  → worktree.md creates isolated workspace    ← THIS SKILL
  → execute.md runs inside the worktree
  → deliver.md presents results
  → worktree.md offers cleanup options         ← THIS SKILL (cleanup)
```

### execute.md

- Receives the worktree path as context.
- All file operations happen within the worktree directory.
- Commits are made to the worktree's branch, not main.
- If worktree creation was skipped (already on feature branch), execute.md
  works on the current branch as normal.

### deliver.md

- At delivery time, deliver.md triggers the cleanup options from this skill.
- Delivery report includes the worktree branch name and path.
- If the user chooses "Push and PR," deliver.md handles the PR description.

### ship.md (if present)

- Pushes from the worktree branch.
- Creates PR from the worktree branch to the base branch.
- Worktree remains available for addressing review feedback.

---

## Edge Cases

### Already Inside a Worktree

Detect this by comparing `git rev-parse --git-dir` with `git rev-parse --git-common-dir`.
If they differ, we are already in a worktree.

```bash
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)

if [ "$GIT_DIR" != "$GIT_COMMON_DIR" ]; then
    CURRENT_BRANCH=$(git branch --show-current)
    echo "Already in a worktree on branch '${CURRENT_BRANCH}'."
    echo "Skipping worktree creation. Execution will use this worktree."
fi
```

Do not create a worktree inside a worktree. Use the current one.

### Detached HEAD

If `git branch --show-current` returns empty, we are in detached HEAD state.

```bash
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    echo "WARNING: Detached HEAD at ${CURRENT_COMMIT}."
    echo "Cannot create worktree from detached HEAD safely."
    echo ""
    echo "Options:"
    echo "  1. Create a branch from current commit first"
    echo "  2. Checkout main/${DEFAULT_BRANCH} and create worktree from there"
    echo "  3. Proceed without worktree isolation"
fi
```

Always warn the user. Never silently proceed from detached HEAD.

### Worktree Path Already Exists

If the directory `.worktrees/sutando-<slug>/` already exists (from a previous session):

```bash
if [ -d "${WORKTREE_PATH}" ]; then
    # Check if it is a valid worktree
    if git worktree list | grep -q "${WORKTREE_PATH}"; then
        echo "Worktree already exists at ${WORKTREE_PATH}."
        echo "Options:"
        echo "  1. Reuse existing worktree"
        echo "  2. Remove and recreate"
        echo "  3. Create with a different name (append timestamp)"
    else
        # Directory exists but is not a valid worktree — stale
        echo "Stale worktree directory found. Cleaning up..."
        rm -rf "${WORKTREE_PATH}"
        git worktree prune
    fi
fi
```

### Branch Name Collision

If `sutando/<slug>` already exists as a branch:

```bash
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    echo "Branch ${BRANCH_NAME} already exists."

    # Check if it has been merged
    if git merge-base --is-ancestor "${BRANCH_NAME}" "${DEFAULT_BRANCH}" 2>/dev/null; then
        echo "Branch has been merged. Safe to delete and recreate."
        git branch -d "${BRANCH_NAME}"
        # Proceed with normal creation
    else
        echo "Branch has unmerged work. Options:"
        echo "  1. Resume work on existing branch"
        echo "  2. Create new branch: sutando/${FEATURE_NAME}-$(date +%s)"
        echo "  3. Abort"
    fi
fi
```

### Insufficient Disk Space

Worktrees share the git object database but duplicate the working tree files.
For large repositories, this can be significant.

```bash
# Check available disk space (rough check)
AVAILABLE_KB=$(df -k "$(git rev-parse --show-toplevel)" | tail -1 | awk '{print $4}')
REPO_SIZE_KB=$(du -sk "$(git rev-parse --show-toplevel)" 2>/dev/null | awk '{print $1}')

if [ "$AVAILABLE_KB" -lt "$REPO_SIZE_KB" ]; then
    echo "WARNING: Low disk space. Worktree may require ~${REPO_SIZE_KB}KB."
    echo "Available: ${AVAILABLE_KB}KB"
    echo "Proceed anyway? (y/n)"
fi
```

### Git Version Compatibility

Worktrees require git 2.5+. Check before attempting.

```bash
GIT_VERSION=$(git --version | sed 's/git version //')
GIT_MAJOR=$(echo "$GIT_VERSION" | cut -d. -f1)
GIT_MINOR=$(echo "$GIT_VERSION" | cut -d. -f2)

if [ "$GIT_MAJOR" -lt 2 ] || { [ "$GIT_MAJOR" -eq 2 ] && [ "$GIT_MINOR" -lt 5 ]; }; then
    echo "WARNING: git ${GIT_VERSION} does not support worktrees (requires 2.5+)."
    echo "Falling back to working on current branch."
    FALLBACK=true
fi
```

---

## Quick Reference

| Situation | Action |
|-----------|--------|
| On main/master/develop | Create worktree |
| On feature branch | Skip, use current branch |
| Already in worktree | Skip, use current worktree |
| Detached HEAD | Warn, offer options |
| Dirty working directory | Prompt: stash, commit, or abort |
| `.worktrees/` not in .gitignore | Add to .gitignore, commit, then proceed |
| `git worktree add` fails | Fall back to current branch with warning |
| Branch already exists (merged) | Delete old branch, create fresh |
| Branch already exists (unmerged) | Offer resume, rename, or abort |
| Worktree path already exists | Offer reuse, recreate, or rename |
| Tests fail in new worktree | Report, ask user how to proceed |
| Low disk space | Warn, ask to proceed |
| Git version < 2.5 | Fall back to current branch |
| Quick mode | Skip entirely |

---

## Common Mistakes

### Not verifying .gitignore

- **Problem:** Worktree directory contents get tracked, creating enormous diffs and
  polluting git status with thousands of files.
- **Fix:** Always run `git check-ignore` before creating. Add to .gitignore if missing.

### Creating worktree with dirty working directory

- **Problem:** User has uncommitted changes that do not transfer to the worktree.
  They may forget about these changes and lose work.
- **Fix:** Always check for clean state. Offer stash or commit before proceeding.

### Skipping baseline tests

- **Problem:** Cannot distinguish pre-existing test failures from new bugs introduced
  during execution. Leads to wasted debugging time.
- **Fix:** Always run tests after setup. Record baseline state.

### Force-deleting branches without checking merge status

- **Problem:** Unmerged work is permanently lost.
- **Fix:** Always use `git branch -d` (safe delete). Only use `-D` with explicit
  typed confirmation from the user.

### Nesting worktrees

- **Problem:** Creating a worktree inside an existing worktree leads to confusing
  git state and path issues.
- **Fix:** Detect existing worktree with `--git-dir` vs `--git-common-dir` check.
  If already in a worktree, skip creation.

### Hardcoding setup commands

- **Problem:** Assumes all projects use npm. Breaks on Python, Rust, Go, Ruby projects.
- **Fix:** Auto-detect from project files (package.json, Cargo.toml, requirements.txt, etc).

---

## Red Flags

**Never:**
- Create a worktree without verifying the directory is in .gitignore
- Create a worktree when there are uncommitted changes (without user consent)
- Delete a worktree with uncommitted changes without typed confirmation
- Force-delete a branch without merge verification
- Create a worktree inside another worktree
- Proceed silently from detached HEAD
- Skip baseline test verification
- Abort the entire Sutando session because worktree creation failed

**Always:**
- Check current state (branch, worktree, clean/dirty) before any action
- Verify .gitignore coverage for worktree directories
- Offer clear options when issues arise (never silently choose)
- Fall back gracefully if worktree creation is not possible
- Report the complete workspace state after setup
- Offer structured cleanup options after delivery
