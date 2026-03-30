# Deliver Phase — Advanced Reference

> This file contains goal-backward verification examples, walkthrough templates, and post-delivery detail extracted from deliver.md.
> Read this when: using Mode C, or performing thorough delivery verification.

## Goal-Backward Verification — Full Examples

For each goal listed in SPEC.md, work backward through three levels:

### Level 1: What must be TRUE?

State the observable behaviors that prove this goal works from the user's perspective.

Example — Goal: "User can log in via email"
- User can submit email + password on a login form
- Valid credentials return an auth token / session
- Invalid credentials return a clear error message
- Authenticated user can access protected routes
- Unauthenticated user is redirected to login

### Level 2: What must EXIST?

List the concrete artifacts (files, endpoints, functions, DB tables) that make those truths possible.

Example:
- `/api/auth/login` endpoint accepting POST with email + password
- Password hashing utility (bcrypt, argon2, etc.)
- JWT signing function or session store
- Login form component with email and password fields
- Auth middleware for protected routes
- User table with email and hashed_password columns

### Level 3: What must be WIRED?

Trace the data flow between artifacts. This is where most delivery failures hide — everything exists but nothing connects.

Example:
- Login form POSTs to `/api/auth/login` (not `/api/login`, not `GET`)
- Endpoint reads email/password from request body (not query params)
- Endpoint queries User table by email (not by id)
- Endpoint compares hashed password (not plaintext)
- Endpoint signs JWT with correct secret (from env, not hardcoded)
- Response sets cookie / returns token in body
- Frontend stores token and sends on subsequent requests
- Auth middleware reads token from correct header/cookie
- Protected routes actually use the middleware

### Verification Protocol

For each goal in SPEC.md:

1. Write down the three levels (TRUE / EXIST / WIRED)
2. For EXIST: verify each artifact exists in the codebase (`find`, `grep`)
3. For WIRED: trace data flow through the code — follow imports, function calls, API routes
4. For TRUE: run the verification command or describe the manual test
5. If any level fails: the goal is NOT achieved. Go back to execution.

**Do not skip this.** "All tasks done" is not the same as "all goals achieved." A goal can fail even when every task that contributes to it individually passes its own tests — because the integration between tasks is where goals live.

## Walkthrough Quality Standards

Each walkthrough item must be concrete and verifiable. Tailor the format to the feature type:

**For API features — show actual commands:**
> "**1/3: User authentication**
>
> Try this:
> ```bash
> curl -X POST http://localhost:3000/api/auth/login \
>   -H 'Content-Type: application/json' \
>   -d '{"email": "test@example.com", "password": "password123"}'
> ```
> Expected: 200 response with `token` field.
>
> Then verify the token works:
> ```bash
> curl http://localhost:3000/api/protected \
>   -H 'Authorization: Bearer <token from above>'
> ```
> Expected: 200 response with user data.
>
> Does this work?"

**For UI features — describe what to look for:**
> "**2/3: Login form**
>
> Visit http://localhost:3000/login
>
> You should see:
> - Email and password fields
> - A "Sign In" button
> - A "Forgot password?" link
>
> Try entering invalid credentials — you should see an error message.
> Try valid credentials — you should be redirected to the dashboard.
>
> Does this look and work right?"

**For infrastructure features — show the system running:**
> "**3/3: Database migrations**
>
> The migration ran automatically on startup. You can verify:
> ```bash
> npx prisma migrate status
> ```
> Expected: All migrations applied, none pending.
>
> Check the logs show successful connection:
> ```bash
> grep 'Connected to database' logs/app.log
> ```
>
> Does this check out?"

**For each item, show BEFORE and AFTER when applicable:**
> "**Before:** Login page returned 404
> **After:** Login page renders form, authenticates against DB, sets session cookie"

## Post-Delivery Recommendations

After the user accepts, proactively offer next steps:

1. **PR creation:**
   > "Would you like me to create a PR for this work?"

2. **Known issues from STATE.md:**
   > "I noticed [N] items worth addressing later:
   > - [Issue 1 from STATE.md issues section]
   > - [Issue 2]
   > These are non-blocking but worth tracking."

3. **Out-of-scope items from SPEC.md:**
   > "The spec mentioned these as out-of-scope. Here's what I'd recommend as next steps:
   > - [Out-of-scope item 1]: [brief recommendation]
   > - [Out-of-scope item 2]: [brief recommendation]"

4. **Technical debt introduced:**
   > "I introduced [N] pieces of technical debt during implementation:
   > - [Debt item 1]: [what and why]
   > I'd recommend addressing these before the next feature."

Only offer these if they are relevant. Don't pad with empty recommendations.

## Extended Red Flags

| Thought | Reality |
|---------|---------|
| "Lint warnings are fine, they were there before" | Verify they were there before. Don't add new ones. |
| "Type errors don't matter, tests pass" | Type errors are real bugs waiting to happen. Fix them. |
| "All tasks complete, so goals are met" | Tasks != Goals. Verify goals independently. |
| "I'll skip the curl examples, user knows how to test" | Show concrete commands. Don't assume. |
| "E2E tests are slow, unit tests are enough" | Run everything. Slow is better than broken in prod. |
