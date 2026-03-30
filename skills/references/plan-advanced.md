# Plan Phase — Advanced Reference

> This file contains worked examples, anti-patterns, and detailed guidance extracted from plan.md.
> Read this when: creating complex plans (Mode C), or encountering decomposition challenges.

## Checkpoint Examples in Task Format

`auto` task (most common):
```markdown
### Task 3: Password hashing utility
**Checkpoint:** auto
**Files:**
- Create: `src/auth/hash.ts`
- Create: `tests/auth/hash.test.ts`
**Steps:**
1. RED — Write test: hashPassword("test123") returns a bcrypt hash, verifyPassword("test123", hash) returns true
2. RUN — Expected: "hashPassword is not defined"
3. GREEN — Implement hashPassword and verifyPassword using bcrypt
4. RUN — All tests pass
5. REFACTOR — Extract salt rounds to constant
6. COMMIT — `feat(auth): add password hashing utility`
**Depends on:** none
**Verification:** `npm test -- tests/auth/hash.test.ts` → 2 tests passing
```

`human-verify` task:
```markdown
### Task 8: Login page UI
**Checkpoint:** human-verify
**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/LoginForm.tsx`
**Steps:**
1. RED — Write test: LoginForm renders email input, password input, and submit button
2. RUN — Expected: "LoginForm is not defined"
3. GREEN — Implement LoginForm with Tailwind styling
4. RUN — All tests pass
5. REFACTOR — Extract input component if repeated
6. COMMIT — `feat(auth): add login page`
**Depends on:** Task 6 (auth API routes)
**Verification:** `npm test -- tests/components/LoginForm.test.ts` → 3 tests passing
**Human verification:** Start dev server, visit /login, verify: form centered, inputs styled, responsive on mobile, error states visible
```

`decision` task:
```markdown
### Task 1: Select authentication library
**Checkpoint:** decision
**Options:**
- A) `jose` — ESM-native, lightweight, no native dependencies. Good for edge runtimes.
- B) `jsonwebtoken` — Battle-tested, huge ecosystem, but CJS-only. Requires ESM workarounds.
- C) `@auth/core` — Full auth framework, handles more than JWT. Heavier, more opinionated.
**Depends on:** none
**Impact:** Affects Tasks 3-7 (all token handling code)
```

`human-action` task:
```markdown
### Task 2: Configure Stripe API key
**Checkpoint:** human-action
**Automated steps:** Create `.env` file with placeholder, add STRIPE_SECRET_KEY to .env.example
**Human action:** Provide your Stripe secret key (starts with sk_test_ or sk_live_)
**After human provides key:** Agent writes it to .env, verifies with `stripe whoami`
**Depends on:** none
```

## Task Dependency Visualization

Include a text-based dependency graph in the plan so the execution agent and the human can see the shape of the work at a glance:

```
Task 1 (DB schema) ──┬── Task 2 (User model)
                      ├── Task 3 (Session model)
                      └── Task 4 (Auth middleware) ── Task 5 (Login endpoint) ── Task 6 (Protected routes)
                                                     └── Task 7 (Logout endpoint)
```

**Rules for the graph:**
- Every task must appear exactly once
- Arrows flow left-to-right (dependency → dependent)
- Tasks at the same horizontal level with no arrow between them can run in parallel
- Keep it simple — if the graph is too complex to draw in ASCII, the plan needs to be split

**Deriving waves from the graph:**

The dependency graph directly determines wave composition. Each wave contains tasks whose dependencies are ALL satisfied by previous waves.

```
Wave 1: [Tasks with no dependencies]
  Task 1 (DB schema)

Wave 2: [Tasks depending only on Wave 1]
  Task 2 (User model) ─── depends on Task 1
  Task 3 (Session model) ─ depends on Task 1
  Task 4 (Auth middleware) ─ depends on Task 1

Wave 3: [Tasks depending on Wave 1 + 2]
  Task 5 (Login endpoint) ─── depends on Tasks 2, 4
  Task 7 (Logout endpoint) ── depends on Task 4

Wave 4: [Tasks depending on Wave 1 + 2 + 3]
  Task 6 (Protected routes) ── depends on Task 5
```

Notice that Wave 2 has three tasks that can all run in parallel — they all depend only on Task 1 and don't depend on each other.

**Common dependency patterns:**

- **Linear chain:** Task 1 → 2 → 3 → 4. Each depends on the previous. Execution is fully sequential. This is common for tightly coupled features.
- **Fan-out:** Task 1 → [Tasks 2, 3, 4, 5]. One foundation task enables many independent tasks. Great for parallelism.
- **Fan-in:** [Tasks 1, 2, 3] → Task 4. Multiple independent tasks feed into an integration task. The integration task is the wave after all prerequisites complete.
- **Diamond:** Task 1 → [Tasks 2, 3] → Task 4. Fork and rejoin. Tasks 2 and 3 run in parallel, then Task 4 integrates them.

## Scope Estimation Heuristics

**Estimation heuristics:**
- Trivial tasks: 2-5 minutes each (boilerplate, config, wiring)
- Moderate tasks: 5-15 minutes each (CRUD endpoints, model definitions, straightforward tests)
- Complex tasks: 15-30 minutes each (auth flows, payment integration, real-time features, complex queries)
- Task 0 (test infrastructure): 10-20 minutes if setting up from scratch
- `decision` checkpoints: Add 5-10 minutes for user review time
- `human-verify` checkpoints: Add 5-15 minutes for user testing time

**Don't over-estimate.** The agent executes faster than a human, so these estimates are for human context only. If total estimated human time exceeds 3 hours, the plan is probably too big — check the decomposition rules.

**Don't under-estimate.** If a task involves unfamiliar APIs, external service integration, or complex state management, round up. Surprises always add time, never subtract it.

## Anti-Pattern Gallery

Review the plan against these known anti-patterns. If you find any, fix them before presenting.

### Tasks Too Large

**Bad:**
```markdown
### Task 3: Build the entire auth system
Files: Create src/auth/*, tests/auth/*
Steps:
1. RED — Write tests for registration, login, logout, password reset, email verification
2. GREEN — Implement all auth flows
```

**Why bad:** This is 5-7 tasks crammed into one. Each auth flow is a separate testable behavior. If login breaks, you can't tell if it's login or registration that's the problem.

**Fix:** Split into: Task 3 (registration), Task 4 (login), Task 5 (logout), Task 6 (password reset), Task 7 (email verification). Each with its own RED-GREEN-REFACTOR cycle.

### Tasks Too Small

**Bad:**
```markdown
### Task 5: Create the user model file
Files: Create src/models/user.ts
Steps: 1. Create the empty file

### Task 6: Add the User interface
Files: Modify src/models/user.ts
Steps: 1. Add the interface definition

### Task 7: Add the validation function
Files: Modify src/models/user.ts
Steps: 1. Add validateUser()
```

**Why bad:** These are three steps of one task. No individual task produces a testable behavior. Task 5 creates an empty file — what test could possibly verify that?

**Fix:** Merge into one task: "Task 5: User model with validation" — RED: test that validateUser rejects invalid input, GREEN: implement User interface + validateUser, COMMIT.

### Missing Test Step

**Bad:**
```markdown
### Task 4: Database connection helper
Files: Create src/db/connection.ts
Steps:
1. Implement the connection pool
2. Add retry logic
3. COMMIT
```

**Why bad:** No RED step. No failing test. No verification. This violates the iron law. Without a test, how do you know the retry logic works? "It looks right" is not verification.

**Fix:** RED: test that connection retries 3 times on failure. RUN: verify failure. GREEN: implement connection pool with retry. RUN: verify pass. REFACTOR. COMMIT.

### Vague Verification

**Bad:**
```markdown
**Verification:** Check that it works correctly
```

**Why bad:** "Works correctly" is not a verification command. What command do you run? What output do you expect? "It works" is the most dangerous phrase in software.

**Fix:**
```markdown
**Verification:** `npm test -- --grep "user registration"` → 3 tests passing, 0 failing
```

### Hidden Dependencies

**Bad:**
```markdown
### Task 5: Login endpoint
Depends on: Task 1 (DB schema)
Steps:
1. RED — Write test that POST /login returns a JWT for valid credentials
2. GREEN — Implement login handler using hashPassword() and generateToken()
```

**Why bad:** `hashPassword()` is defined in Task 3 (registration) and `generateToken()` is defined in Task 4 (token utilities). But the dependency only lists Task 1. If Tasks 3-5 run in parallel (they look independent from the dependency graph), Task 5 will fail because those functions don't exist yet.

**Fix:**
```markdown
### Task 5: Login endpoint
Depends on: Task 1 (DB schema), Task 3 (hashPassword), Task 4 (generateToken)
```

### Circular Dependencies

**Bad:**
```markdown
### Task 3: User service
Depends on: Task 5 (Auth middleware — needs currentUser())

### Task 5: Auth middleware
Depends on: Task 3 (User service — needs findUserById())
```

**Why bad:** Neither task can start. This is a design problem, not a planning problem.

**Fix:** Extract the shared interface into its own task: Task 3 (User types/interfaces), Task 4 (User service, depends on 3), Task 5 (Auth middleware, depends on 3).

### "Same as Task N"

**Bad:**
```markdown
### Task 7: Delete endpoint
Same pattern as Task 5 (Create endpoint) but for deletion.
```

**Why bad:** The execution agent reads tasks independently. It may not have Task 5 in context. Every task must be self-contained.

**Fix:** Write out the full task with all files, steps, and verification — even if it looks repetitive.

## Verification Command Design

Every task needs a concrete verification command. Good verification commands are:

**Specific:**
```markdown
# GOOD — specific test with expected output
**Verification:** `npm test -- tests/auth/hash.test.ts` → 2 tests passing, 0 failing

# BAD — vague
**Verification:** Run the tests and make sure they pass
```

**Deterministic:**
```markdown
# GOOD — always produces the same output for the same code
**Verification:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health` → 200

# BAD — depends on timing or external state
**Verification:** Check that the API responds quickly
```

**Composable:**
```markdown
# GOOD — test command covers exactly this task's scope
**Verification:** `npm test -- --grep "password hashing"` → 3 tests passing

# BAD — runs everything, hard to isolate this task's contribution
**Verification:** `npm test` → all tests pass
```

**For different artifact types:**

| Artifact | Verification Pattern |
|----------|---------------------|
| Pure function | Unit test with specific input → expected output |
| API endpoint | `curl` or test that hits the endpoint, checks status + body |
| React component | Component test that renders and asserts DOM content |
| Database migration | `npx prisma migrate status` shows no pending migrations |
| Config file | Test that loads config and asserts expected values |
| CLI command | Run with test args, check exit code + stdout |
| WebSocket handler | Integration test that connects, sends message, asserts response |

## Complete Worked Example

Here's a complete mini-plan showing all the concepts in action.

**Spec summary:** Add JWT authentication to an existing Express API. Users can register, log in, and access protected routes.

```markdown
---
mode: A
model_profile: balanced
parallelism: wave
total_tasks: 7
waves: 4
created: 2026-03-28
status: draft
---

# Implementation Plan: JWT Authentication

## Overview
**Goal:** Add user registration, login, and route protection using JWT tokens.
**Approach:** bcrypt for password hashing, jose for JWT (ESM-compatible), middleware pattern for route protection. Test-first with supertest for HTTP assertions.
**Execution:** Wave-based (4 waves)
**Interruption:** normal
**Model Profile:** balanced — standard auth patterns, no novel architecture

## Dependency Graph
```
Task 1 (test setup) ──┬── Task 2 (password hashing)
                       ├── Task 3 (JWT tokens)
                       │
                       ├── Task 4 (register) ── depends on 2
                       ├── Task 5 (login) ──── depends on 2, 3
                       │
                       └── Task 6 (middleware) ── depends on 3
                            └── Task 7 (protected route) ── depends on 6
```

## Scope Estimate
| Wave | Tasks | Files Touched | Complexity | Est. Human Time |
|------|-------|---------------|------------|-----------------|
| 1 | 1 | 2 create, 1 modify | Trivial | ~5 min |
| 2 | 2-3 | 4 create | Moderate | ~20 min |
| 3 | 4-6 | 6 create | Moderate | ~30 min |
| 4 | 7 | 2 create | Trivial | ~10 min |
| **Total** | **7** | **14 create, 1 modify** | | **~65 min** |

## File Map
| File | Action | Responsibility |
|------|--------|---------------|
| `jest.config.js` | Create | Jest configuration for the project |
| `package.json` | Modify | Add jest, supertest, @types as devDependencies |
| `src/auth/hash.ts` | Create | hashPassword(), verifyPassword() with bcrypt |
| `src/auth/token.ts` | Create | generateToken(), verifyToken() with jose |
| `src/auth/middleware.ts` | Create | Express auth middleware (verify JWT, attach user) |
| `src/routes/auth.ts` | Create | POST /register, POST /login |
| `src/routes/protected.ts` | Create | GET /me (protected endpoint) |
| `tests/setup.ts` | Create | Test database setup/teardown |
| `tests/auth/hash.test.ts` | Create | Password hashing tests |
| `tests/auth/token.test.ts` | Create | JWT token tests |
| `tests/auth/middleware.test.ts` | Create | Auth middleware tests |
| `tests/routes/auth.test.ts` | Create | Registration and login integration tests |
| `tests/routes/protected.test.ts` | Create | Protected route integration tests |

## Wave 1: Foundation

### Task 1: Test infrastructure setup
**Checkpoint:** auto
**Files:**
- Create: `jest.config.js`
- Create: `tests/setup.ts`
- Modify: `package.json` (add devDependencies and test script)
**Steps:**
1. RED — Write a smoke test: `test('test framework works', () => expect(1 + 1).toBe(2))`
2. RUN — Expected: jest not found or no test script
3. GREEN — Install jest, ts-jest, supertest. Create jest.config.js. Add "test" script to package.json.
4. RUN — Smoke test passes
5. REFACTOR — n/a
6. COMMIT — `chore: set up jest test infrastructure`
**Depends on:** none
**Verification:** `npm test` → 1 test passing, 0 failing

## Wave 2: Crypto Utilities (parallel)

### Task 2: Password hashing
**Checkpoint:** auto
**Files:**
- Create: `src/auth/hash.ts`
- Create: `tests/auth/hash.test.ts`
**Steps:**
1. RED — Write tests: hashPassword("secret") returns string != "secret"; verifyPassword("secret", hash) returns true; verifyPassword("wrong", hash) returns false
2. RUN — Expected: "Cannot find module '../src/auth/hash'"
3. GREEN — Implement using bcrypt with 12 salt rounds
4. RUN — 3 tests passing
5. REFACTOR — Extract SALT_ROUNDS constant
6. COMMIT — `feat(auth): add password hashing with bcrypt`
**Depends on:** Task 1
**Verification:** `npm test -- tests/auth/hash.test.ts` → 3 tests passing

### Task 3: JWT token utilities
**Checkpoint:** auto
**Files:**
- Create: `src/auth/token.ts`
- Create: `tests/auth/token.test.ts`
**Steps:**
1. RED — Write tests: generateToken({ userId: "123" }) returns string; verifyToken(token) returns payload with userId; verifyToken("garbage") throws
2. RUN — Expected: "Cannot find module '../src/auth/token'"
3. GREEN — Implement using jose with HS256, 24h expiry
4. RUN — 3 tests passing
5. REFACTOR — Extract JWT_SECRET and EXPIRY to constants
6. COMMIT — `feat(auth): add JWT token generation and verification`
**Depends on:** Task 1
**Verification:** `npm test -- tests/auth/token.test.ts` → 3 tests passing

## Wave 3: Endpoints and Middleware (parallel: 4+5, then 6)

### Task 4: Registration endpoint
**Checkpoint:** auto
**Files:**
- Create: `src/routes/auth.ts` (register handler only)
- Create: `tests/routes/auth.test.ts` (register tests only)
**Steps:**
1. RED — Write test: POST /register with {email, password} returns 201 and user object without password field
2. RUN — Expected: 404 (route doesn't exist)
3. GREEN — Implement register handler: validate input, hash password, store user, return 201
4. RUN — Test passes
5. REFACTOR — Extract input validation
6. COMMIT — `feat(auth): add user registration endpoint`
**Depends on:** Task 1, Task 2
**Verification:** `npm test -- tests/routes/auth.test.ts --grep "register"` → 1 test passing

### Task 5: Login endpoint
**Checkpoint:** auto
**Files:**
- Modify: `src/routes/auth.ts` (add login handler)
- Modify: `tests/routes/auth.test.ts` (add login tests)
**Steps:**
1. RED — Write tests: POST /login with valid credentials returns 200 + JWT; POST /login with wrong password returns 401
2. RUN — Expected: 404 (login route doesn't exist)
3. GREEN — Implement login handler: find user, verify password, generate token, return 200
4. RUN — All auth tests pass (register + login)
5. REFACTOR — n/a
6. COMMIT — `feat(auth): add login endpoint with JWT`
**Depends on:** Task 1, Task 2, Task 3
**Verification:** `npm test -- tests/routes/auth.test.ts` → 3 tests passing

### Task 6: Auth middleware
**Checkpoint:** auto
**Files:**
- Create: `src/auth/middleware.ts`
- Create: `tests/auth/middleware.test.ts`
**Steps:**
1. RED — Write tests: request with valid Bearer token calls next(); request without token returns 401; request with expired token returns 401
2. RUN — Expected: "Cannot find module '../src/auth/middleware'"
3. GREEN — Implement requireAuth middleware: extract Bearer token, verify with verifyToken, attach user to req
4. RUN — 3 tests passing
5. REFACTOR — Extract token parsing helper
6. COMMIT — `feat(auth): add JWT auth middleware`
**Depends on:** Task 1, Task 3
**Verification:** `npm test -- tests/auth/middleware.test.ts` → 3 tests passing

## Wave 4: Integration

### Task 7: Protected route
**Checkpoint:** auto
**Files:**
- Create: `src/routes/protected.ts`
- Create: `tests/routes/protected.test.ts`
**Steps:**
1. RED — Write tests: GET /me with valid token returns user data; GET /me without token returns 401
2. RUN — Expected: 404 (route doesn't exist)
3. GREEN — Implement GET /me using requireAuth middleware, return current user
4. RUN — All tests pass (full suite)
5. REFACTOR — n/a
6. COMMIT — `feat(auth): add protected /me endpoint`
**Depends on:** Task 6
**Verification:** `npm test` → 13 tests passing, 0 failing
```

This example demonstrates: frontmatter, dependency graph, scope estimation, file map, wave grouping, checkpoint types (all `auto` in this case), concrete verification commands, and exact commit messages. A real plan with UI tasks would include `human-verify` checkpoints; one with technology choices would include `decision` checkpoints.
