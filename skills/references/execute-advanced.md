# Execute Phase — Advanced Reference

> This file contains checkpoint protocols, context management, edge cases, and examples extracted from execute.md.
> Read this when: using Mode C, handling complex execution scenarios, or debugging stuck tasks.

## Checkpoint Protocol — Full Detail

Every task in the plan declares a checkpoint type. Follow the protocol for each type:

### `auto` Tasks — Silent Execution

Execute the full TDD cycle. Verify. Commit. Update progress via `node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --task N --status done`. Move to the next task. No human interaction.

This is the default and covers ~85% of tasks.

### `human-verify` Tasks — Complete Then Present

1. Execute the full TDD cycle as normal (RED → GREEN → REFACTOR → COMMIT)
2. Run all verification commands
3. If verification requires a running server, start it before presenting to the human
4. Present the results to the human:

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                    ║
╚═══════════════════════════════════════════════════════╝

Progress: [N]/[M] tasks complete
Task: [task name]

Built: [what was built]

How to verify:
  [specific steps — URLs to visit, things to click, what to look for]

────────────────────────────────────────────────────────
→ Type "approved" or describe issues
────────────────────────────────────────────────────────
```

5. **STOP.** Do not proceed until the human approves.
6. If the human reports issues: fix them, re-verify, re-present.

### `decision` Tasks — Present Options and Wait

1. Do NOT start any implementation.
2. Present the decision with trade-offs:

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                        ║
╚═══════════════════════════════════════════════════════╝

Progress: [N]/[M] tasks complete
Task: [task name]

Decision: [what needs to be decided]

Context: [why this matters, what depends on it]

Options:
  1. [Option A] — [pros/cons summary]
  2. [Option B] — [pros/cons summary]
  3. [Option C] — [pros/cons summary]

────────────────────────────────────────────────────────
→ Select an option (1/2/3) or propose an alternative
────────────────────────────────────────────────────────
```

3. **STOP.** Do not proceed until the human chooses.
4. Record the decision in STATE.md under Decisions.
5. Continue execution using the chosen option.

### `human-action` Tasks — Explain and Wait

1. Do everything that CAN be automated (file creation, config changes, CLI commands).
2. Present only the part that requires human action:

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: [N]/[M] tasks complete
Task: [task name]

Already done: [what the agent automated]

What you need to do:
  [specific human action — click a link, enter a key, approve something]

After you're done, I'll verify: [what the agent will check]

────────────────────────────────────────────────────────
→ Type "done" when complete
────────────────────────────────────────────────────────
```

3. **STOP.** Do not proceed until the human confirms.
4. Run the verification check specified in the task.
5. If verification fails: tell the human what went wrong, ask them to retry.

## Context Pressure Management

Long execution sessions can exhaust the context window. Monitor and manage it:

### After Every 3 Tasks

Assess context usage. Ask yourself: "Am I carrying detailed history from tasks 1-3 while working on task 7?"

### If Context is Above 60%

- Summarize completed tasks to one line each in your working memory: "Tasks 1-5 done: DB schema, User model, Session model, Auth middleware, Login endpoint — all tests passing"
- Drop detailed test output, file contents, and intermediate debugging from earlier tasks
- Keep only: current task details, SPEC.md goal, and STATE.md progress

### If Context is Above 80%

- Save detailed state using the CLI and STATE.md:
  ```bash
  node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --summary
  ```
  Also add a context checkpoint section to STATE.md with key decisions, known issues, and next task.
- Consider dispatching remaining tasks as subagents even in sequential mode — each subagent gets a fresh context
- If you cannot dispatch subagents: continue but be extra disciplined about keeping only current-task context

### Never Let Context Hit 95%

Always leave room for the current task's TDD cycle. If you're at 90% and there are 5 tasks remaining, you MUST either:
1. Dispatch remaining tasks as subagents with fresh context
2. Save state and ask the orchestrator to continue in a new session

Running out of context mid-task means lost work. Prevent it.

### Context Budgeting by Task Count

As a rough guide:
- 1-5 tasks: No context pressure. Keep full history.
- 6-10 tasks: Start summarizing after task 5. Drop detailed test output from tasks 1-3.
- 11-15 tasks: Aggressive summarization. One line per completed task. Only current task in full detail.
- 15+ tasks: This plan should have been split. If it wasn't, dispatch remaining tasks as subagents.

### What to Keep vs. Drop

**Always keep (never drop these):**
- Current task's full details from PLAN.md
- The SPEC.md goal and constraints
- STATE.md progress (which tasks are done)
- Any decisions made during execution (especially from `decision` checkpoints)
- Any issues logged (bugs found, things deferred)

**Drop when context is tight:**
- Full test output from completed tasks (summarize to "N tests passing")
- Full file contents you've already written and committed
- Detailed debugging traces from resolved issues
- The complete PLAN.md text for completed tasks (keep only task names and status)
- Raw git diff output from previous commits

## Rollback Protocol

If a task corrupts the codebase — tests that were passing now fail, and the cause isn't obvious:

### Step 1: Stash Current Work

```bash
git stash
```

Save the current task's uncommitted changes safely.

### Step 2: Test Clean State

Run the full test suite on the clean state (without your current work):

```bash
[project test command]
```

### Step 3: Diagnose

**If clean state tests PASS:** Your current task introduced the problem.
- `git stash pop` to restore your work
- Debug using the Debugging Integration protocol above
- The bug is in YOUR changes — find it and fix it

**If clean state tests FAIL:** A previous task left hidden damage that wasn't caught.
- Your current task didn't cause this
- Log the failure in STATE.md under Issues:
  ```markdown
  ## Issues
  - Pre-existing test failure found during Task [N]: `[test name]` fails with `[error]`
  - Likely introduced in Task [M] (based on file history)
  - Stashed current work for Task [N]
  ```
- Escalate to the controller/orchestrator
- Do NOT attempt to fix previous tasks' code — that violates "No While I'm Here Changes"

### Step 4: Never `git reset --hard` Without Approval

`git reset --hard` destroys uncommitted work permanently. NEVER run it during execution. If you believe a hard reset is necessary:
1. Log why in STATE.md
2. Present the situation to the human
3. Wait for explicit approval
4. Only then execute the reset

`git stash` is always the safer alternative. Use it.

## Edge Cases in Execution

### Task Becomes Redundant

If during RED, the test passes immediately — the behavior already exists. This happens when:
- A previous task accidentally implemented more than its scope
- The framework/library provides the behavior out of the box
- The SPEC changed during planning and the plan wasn't updated

**Protocol:**
1. Verify the test is actually testing the right thing (not a false positive)
2. Log in STATE.md: "Task N: Skipped — behavior already exists (test passes without new code)"
3. COMMIT the test anyway (it documents expected behavior and prevents regressions)
4. Move to the next task

### Task Contradicts Previous Task

If a task's requirements contradict what a previous task built (e.g., Task 7 says "users must be soft-deleted" but Task 3 implemented hard deletion):

**Protocol:**
1. Do NOT silently change the previous task's code
2. Log the contradiction in STATE.md
3. Check SPEC.md — which behavior is correct?
4. If SPEC.md is clear: follow the SPEC, note that the earlier task was wrong
5. If SPEC.md is ambiguous: escalate to the user (regardless of interruption setting — contradictions are blockers)

### External Service is Unavailable

If a task requires an external service (API, database, third-party service) that is not available:

**Protocol:**
1. Check if the service is down temporarily (retry once after 30 seconds)
2. Check if credentials are missing or expired
3. If the service needs credentials you don't have: create a `human-action` checkpoint dynamically
4. If the service is genuinely down: skip the task, log it, continue with independent tasks, come back later
5. If the task can be tested with a mock/stub as a temporary measure: do so, but log a follow-up to replace the mock with real integration

### Plan Has a Bug

If you discover during execution that the plan has a mistake (wrong file path, impossible dependency, incorrect expected output):

**Protocol:**
1. Do NOT silently fix the plan and continue
2. Log the issue in STATE.md
3. Make your best judgment about the correct fix
4. Apply the fix and document what you changed and why
5. If the fix changes the scope or architecture: escalate to the user

## Execution Example: Single Task Walkthrough

Here's what a complete execution of one task looks like, showing every step:

**Task from PLAN.md:**
```
### Task 3: Password hashing utility
Checkpoint: auto
Files:
- Create: src/auth/hash.ts
- Create: tests/auth/hash.test.ts
Steps:
1. RED — Write test: hashPassword("test123") returns bcrypt hash; verifyPassword("test123", hash) returns true
2. RUN — Expected: "Cannot find module '../src/auth/hash'"
3. GREEN — Implement using bcrypt with 12 salt rounds
4. RUN — All tests pass
5. REFACTOR — Extract salt rounds to constant
6. COMMIT — feat(auth): add password hashing with bcrypt
Depends on: Task 1
Verification: npm test -- tests/auth/hash.test.ts → 2 tests passing
```

**Execution:**

1. **RED** — Write `tests/auth/hash.test.ts`:
```typescript
import { hashPassword, verifyPassword } from '../../src/auth/hash';

test('hashPassword returns a bcrypt hash different from input', async () => {
  const hash = await hashPassword('test123');
  expect(hash).not.toBe('test123');
  expect(hash).toMatch(/^\$2[aby]\$/);
});

test('verifyPassword returns true for correct password', async () => {
  const hash = await hashPassword('test123');
  const result = await verifyPassword('test123', hash);
  expect(result).toBe(true);
});
```

2. **RUN** — Execute: `npm test -- tests/auth/hash.test.ts`
   Output: `Cannot find module '../../src/auth/hash'`
   This is an ERROR, not a FAIL. Create empty exports to get a proper FAIL:
   ```typescript
   // src/auth/hash.ts (temporary — just to get past the import error)
   export async function hashPassword(password: string): Promise<string> { return ''; }
   export async function verifyPassword(password: string, hash: string): Promise<boolean> { return false; }
   ```
   Re-run: `npm test -- tests/auth/hash.test.ts`
   Output: `FAIL — Expected: not "test123", Received: ""`
   This is a proper FAIL. The function exists but doesn't hash. Good RED.

3. **GREEN** — Implement the real code in `src/auth/hash.ts`:
```typescript
import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

4. **RUN** — Execute: `npm test -- tests/auth/hash.test.ts`
   Output: `PASS — 2 tests passing`
   Also run full suite: `npm test`
   Output: `PASS — 5 tests passing` (includes Task 1's smoke test and Task 2's tests)
   All green.

5. **REFACTOR** — Extract salt rounds:
```typescript
const SALT_ROUNDS = 12;
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}
```
   Re-run: `npm test` → Still 5 tests passing. Refactoring didn't break anything.

6. **SELF-REVIEW** — Run verification command: `npm test -- tests/auth/hash.test.ts` → 2 tests passing. Matches expected output.

7. **COMMIT** — `git add src/auth/hash.ts tests/auth/hash.test.ts && git commit -m "feat(auth): add password hashing with bcrypt"`

8. **PROGRESS REPORT:**
```
─── Task 3/7: Password hashing utility ✓ ───
Tests: 2 new, 5 total, all passing
Files: 2 created, 0 modified
Decisions: None
Next: Task 4 (Registration endpoint)
────────────────────────────────────────────
```

9. **UPDATE STATE** — `node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state progress --task 3 --status done`

## Anti-Rationalization — The Subtle Ones

| Excuse | Reality |
|--------|---------|
| "The test would be hard to write, so the design must be fine and I'll test it manually" | Hard to test = hard to use. The test is telling you the design is wrong. Listen to it. Fix the design. |
| "I need to explore the codebase first before I can write a test" | Fine — explore. But then throw away the exploration code and start with a test. Exploration is not implementation. |
| "The previous task's code has a bug that I can see and fix trivially" | You are not working on the previous task. Log it. Your "trivial fix" might break something you don't see. |
| "Running the full test suite is slow, I'll just run my new test" | Run the full suite. Slow tests are a problem, but skipping them is a bigger problem. If the suite is truly too slow, log it as an issue. |
| "I'm almost out of context, I'll skip the REFACTOR step" | REFACTOR is not optional. If you're out of context, save state and continue in a new session. Don't skip steps. |
| "This is a config file / boilerplate — TDD doesn't apply" | If it can break the system, it needs a test. Config errors are some of the hardest bugs to diagnose. Write a test that loads the config and asserts expected values. |
| "I already know what the error message will be, I don't need to read the full output" | Read it. Your assumption about the error might be wrong. The actual error might reveal a different problem than what you expected. |

## Verification Depth — Full Detail

Before marking any task as done, verify at multiple levels. Not all levels apply to every task, but consider each one:

### Level 1: Exists

The file exists at the expected path. Sounds obvious, but typos in file paths are real.

```bash
[ -f "src/auth/hash.ts" ] && echo "EXISTS" || echo "MISSING"
```

### Level 2: Substantive

The file contains real implementation, not stubs or placeholders.

**Red flags for stubs:**
- Functions that return empty values: `return {}`, `return []`, `return null`, `return ''`
- Functions that only log: `console.log('TODO')`
- Comment-only implementations: `// implement later`
- Hardcoded values where dynamic logic is expected

```bash
# Check for common stub patterns
grep -E "TODO|FIXME|PLACEHOLDER|implement later|not implemented" src/auth/hash.ts
```

### Level 3: Wired

The code is connected to the rest of the system. A standalone file that nothing imports is dead code.

```bash
# Is this module imported anywhere?
grep -r "from.*auth/hash" src/ --include="*.ts" | grep -v "hash.ts"
```

For tasks that create wiring (route registration, middleware attachment, component rendering), check that the wiring exists — not just the implementation.

### Level 4: Functional

The code actually works when invoked. This is what the test suite covers. But also consider:
- Does the test cover the happy path AND error cases?
- Does the test use realistic inputs (not just `"test"` and `123`)?
- If it's an API endpoint: does it return the right status codes, headers, and body?
- If it's a UI component: does it render without errors?

## Test Suite Health Tracking

### After Every Task

Run the FULL test suite, not just the new tests. Track:
- Total test count (should be monotonically increasing)
- Total pass count (should equal total test count)
- Any warnings or deprecation notices
- Test execution time (sudden spikes may indicate a problem)

### Test Count Tracking

Maintain a running count in your working memory:

```
After Task 1: 1 test
After Task 2: 4 tests
After Task 3: 6 tests
After Task 4: 9 tests
...
```

If the count goes DOWN, a test was deleted or renamed. Investigate before continuing.

If the count stays the SAME after a task that should add tests, the test file wasn't picked up by the test runner. Check the test file path matches the runner's pattern.

### Test Isolation

If tests start interfering with each other (passing individually but failing together), check for:
- Shared database state (add setup/teardown)
- Global variable mutation (use `beforeEach` to reset)
- Port conflicts (use random ports in tests)
- File system side effects (use temp directories)

Fix the isolation issue before continuing. Flaky tests are worse than no tests — they erode trust in the suite.

## Commit Hygiene — Full Detail

### Commit Message Format

Use the exact commit message from the plan. If the plan says `feat(auth): add password hashing with bcrypt`, that is the commit message. Do not "improve" it. Do not add a body. Do not add a scope that wasn't in the plan.

### What to Stage

Stage ONLY the files listed in the task. If you created a temporary file for debugging, do not stage it. If you fixed a linting error in an unrelated file, do not stage it.

```bash
# GOOD — stage specific files
git add src/auth/hash.ts tests/auth/hash.test.ts

# BAD — stage everything
git add .
git add -A
```

### Commit Size

Each commit should be exactly one task. If a task's commit touches 20 files, the task was probably too large — but commit it anyway and note the issue. Do not split a task's commit retroactively.

### Commit Verification

After committing, verify the commit looks right:

```bash
git log --oneline -1   # Verify commit message
git diff HEAD~1 --stat  # Verify files changed
```

If the commit includes files that shouldn't be there, or the message is wrong: `git commit --amend` immediately (before any further commits).
