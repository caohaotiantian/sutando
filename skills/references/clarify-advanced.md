# Clarify Phase — Advanced Reference

> This file contains Mode C content, edge cases, and anti-patterns extracted from clarify.md.
> Read this when: using Mode C, or encountering unusual clarification scenarios.

## Question Quality Standards — Detailed Examples

**1. Answerable** — The user must be able to give a concrete answer.
- BAD: "What's your vision for this feature?" (too vague, invites rambling)
- GOOD: "Should this feature be accessible to all users, or only admins?" (concrete, answerable)
- BAD: "How should we handle errors?" (too broad)
- GOOD: "When the API returns a 429 rate limit, should we retry automatically or show the user an error?" (specific scenario)

**2. Consequential** — The answer must change the implementation. If both answers lead to the same code, don't ask.
- BAD: "Do you prefer camelCase or snake_case?" (the codebase already uses one — read it)
- GOOD: "Should failed payments retry automatically, or require manual retry?" (completely different implementation)
- BAD: "Should we use a try-catch here?" (that's an implementation detail, not a requirement)
- GOOD: "If the import file has invalid rows, should we skip them and import the rest, or reject the entire file?" (different UX, different code)

**3. Non-obvious** — Don't ask what you can learn from the code, config, or context.
- BAD: "What testing framework do you use?" (read package.json)
- GOOD: "I see you use Jest but have no integration tests. Should this feature include integration tests, or stick with unit tests?" (builds on what you learned)
- BAD: "What database are you using?" (read the config or dependencies)
- GOOD: "I see you're using PostgreSQL. This feature needs full-text search — should we use pg_trgm (simpler, already available) or set up Elasticsearch (more powerful, new dependency)?" (informed question)

**4. Non-redundant** — Don't ask what a previous answer already implied.
- If the user said "this is an internal admin tool," don't ask "who are the target users?"
- If the user chose "simple file-based storage," don't ask "should we set up a database?"

**Examples of excellent questions:**
- "The existing auth system uses session cookies. This new API endpoint will be called by a mobile app. Should we add JWT support alongside sessions, or require the mobile app to use cookie-based auth?" (Answerable, consequential, informed by codebase research, non-obvious)
- "I see three webhook handlers that each implement their own retry logic. Should this new webhook follow the same pattern, or should we extract a shared retry utility as part of this work?" (Informed, consequential, gives the user a choice about scope)

## Approach Proposal Quality — Detailed

### What Each Approach Must Include

1. **Architecture** — How the code is structured. Not "we'll build an API" but "a REST endpoint in `/api/auth/` that accepts POST with email/password, validates against the users table, and returns a JWT in the response body with a refresh token in an httpOnly cookie."

2. **Key Libraries** — What dependencies are involved. Not "we'll use an auth library" but "jose for JWT signing (already in the project), bcrypt for password hashing (new dependency, ~50KB)."

3. **Testing Strategy** — How this approach gets verified. Not "we'll write tests" but "unit tests for token signing/verification, integration test for the full auth flow via supertest, and a specific test for token expiration handling."

4. **Main Trade-off** — The one thing you give up by choosing this approach. Not "there are some trade-offs" but "This approach stores sessions server-side, which means we need Redis or similar for multi-server deployments. If we stay single-server, this is simpler than JWT."

5. **Rough Scope** — An approximate task count so the user understands the commitment. "~5 tasks, about 1-2 hours of agent execution" vs "~15 tasks, about 4-6 hours of agent execution."

### Approach Proposal Principles

- **Lead with the recommendation.** Present your recommended approach first and say why it's recommended. Don't bury the lead in option C.
- **If one approach is clearly superior, say so.** Don't artificially create alternatives to appear balanced. "Approach A is the clear winner here because [reasons]. I'm including B and C for completeness, but I'd be surprised if you chose them."
- **Alternatives should be genuinely different, not variations.** "JWT with cookies" and "JWT with localStorage" are variations of the same approach. "JWT-based stateless auth" and "session-based stateful auth" are genuinely different approaches.
- **Include a "do less" option when appropriate.** Sometimes the best approach is a simpler version of what the user asked for. "You asked for full RBAC, but your current user base is 3 admins. Approach C is simple boolean `isAdmin` — you can upgrade to RBAC later if needed."
- **Reference research findings (Mode C).** Each approach should connect to something you learned during research: "Approach A builds on the existing middleware pattern I found in `src/middleware/auth.ts`."

## Approach Proposal Examples

### Bad Approach Proposal Example

> **A) Build it with a library** — Use an auth library. Pro: faster. Con: dependency.
> **B) Build it from scratch** — Write our own auth. Pro: no dependency. Con: slower.

This is useless. No architecture, no specifics, no testing strategy, no scope.

### Good Approach Proposal Example

> **A) Extend existing session auth (Recommended)** — Add a `/api/auth/login` POST endpoint that validates credentials against the `users` table (bcrypt), creates a server-side session via the existing `express-session` middleware, and returns user profile JSON. Session stored in the existing Redis instance. Add `requireAuth` middleware that checks `req.session.userId`. ~5 tasks, ~1 hour.
> Testing: Unit test password validation, integration test full login/logout flow, test session expiration.
> Trade-off: Server-side sessions mean every request hits Redis. Fine at your current scale (<1000 users). Would need rethinking at 100K+ concurrent users.
>
> **B) JWT-based stateless auth** — New `/api/auth/login` returns a signed JWT (access token, 15min) and sets an httpOnly refresh token cookie (7 days). Add JWT verification middleware. Token refresh endpoint at `/api/auth/refresh`. ~8 tasks, ~2 hours.
> Testing: Unit test token signing/verification/expiration, integration test full auth flow including refresh, test token revocation edge cases.
> Trade-off: More complex (refresh rotation, revocation list), but fully stateless — no Redis dependency for auth. Better for multi-region deployment.
>
> **C) Third-party auth (Auth0/Clerk)** — Integrate Auth0's Express SDK. Offload all auth logic to Auth0. ~4 tasks, ~45 min.
> Testing: Integration test that Auth0 callback works, test user profile sync.
> Trade-off: Fastest to build, but adds a $23/month SaaS dependency and you lose control over the auth flow. Vendor lock-in risk.
>
> I'd recommend **A** because you already have Redis and express-session set up, and your user base is small. It's the least new code and plugs into existing infrastructure.

## Parallel Research Pattern for Mode C

After the dialogue, dispatch 3 research threads in parallel. Each investigates a different dimension of the problem. The goal is to arrive at approach proposals backed by evidence, not intuition.

**Stack Researcher** — Analyze the existing technology landscape of the project:
```
Research scope:
- Map all dependencies and their versions. Flag anything outdated or deprecated.
- Identify the project's architectural patterns (MVC, hexagonal, microservices, etc.)
- Check for existing abstractions that the new feature should reuse (base classes, shared utilities, middleware)
- Note the testing infrastructure: framework, coverage tools, CI integration
- Check for build/deploy pipeline constraints that affect the feature

Output: Stack analysis section in RESEARCH.md
- "The project uses [framework] v[X] with [pattern]. Relevant existing abstractions: [list].
  Testing uses [framework] with [coverage]% coverage. CI runs [commands]."
```

**Feature Researcher** — Find similar features in the codebase and learn from them:
```
Research scope:
- Search for features similar to what we're building. How are they structured?
- Identify the conventions: file organization, naming, error handling, validation patterns
- Check for shared infrastructure the new feature should plug into (auth middleware, logging, event bus)
- Look at recent PRs/commits for the area we're modifying — any ongoing work that might conflict?
- If the feature involves a UI: check existing component patterns, state management, styling approach

Output: Feature patterns section in RESEARCH.md
- "Similar feature [X] is structured as [description]. It uses [patterns].
  The new feature should follow [conventions] and plug into [infrastructure]."
```

**Pitfall Researcher** — Identify risks before they become problems:
```
Research scope:
- Performance: Will this feature hit database N+1 queries? Large payload sizes? Slow API calls?
- Security: Does this involve user input? Authentication? Authorization? File uploads?
- Compatibility: Does this need to work with existing API consumers? Mobile apps? Third-party integrations?
- Migration: Does this require database migrations? Data backfill? Feature flags for rollout?
- Dependencies: If new libraries are needed, check: maintenance status, bundle size, license, security advisories

Output: Risk assessment section in RESEARCH.md
- "Key risks: [list with severity]. Mitigation strategies: [for each risk]."
```

**Synthesize into RESEARCH.md:**

Write findings to `.sutando/phases/research/RESEARCH.md` with this structure:
```markdown
# Research Findings

## Stack Analysis
[Stack Researcher output]

## Feature Patterns
[Feature Researcher output]

## Risk Assessment
[Pitfall Researcher output]

## Implications for Approach
- [Synthesis point 1 — what the research tells us about how to build this]
- [Synthesis point 2]
- [Synthesis point 3]
```

Use the research to inform the approach proposals. Every recommendation should reference a specific finding: "I recommend approach A because the existing auth middleware (found in Feature Research) already handles JWT validation, so we can extend it rather than building from scratch."

**If research reveals the task is simpler than expected:** Tell the user. "After researching, I found that [framework] has built-in support for this. We might be able to drop from Mode C to Mode B — the main work is configuration, not implementation. Want to simplify?"

**If research reveals the task is harder than expected:** Tell the user. "Research uncovered a complication: [specific finding]. This affects our approach because [reason]. We may need to add [thing] to the scope or choose a different approach."

**If research reveals a blocking issue:** Stop and surface it. "Research found that [library] doesn't support [needed feature] as of v[X]. This blocks the approach we were considering. We need to either find an alternative library or build this capability ourselves."

## SPEC.md Examples and Templates

### Example Mode A SPEC (total ~20 lines):
```markdown
# Add /health endpoint

## Goal
Add a health check endpoint that returns the app version and basic service status.

## Constraints
- Must respond in <100ms
- Must work without authentication

## Decisions
| Question | Decision | Rationale |
|----------|----------|-----------|
| Response format | JSON `{"status":"ok","version":"1.2.3"}` | Consistent with existing API endpoints |
| Include DB check | Yes, basic connectivity check | Catches the most common failure mode |

## Architecture
New route in `src/routes/health.ts`. Imports version from `package.json`. Pings DB with a simple `SELECT 1` query. Returns 200 on success, 503 if DB is unreachable.
```

### Mode C Additional Sections Template

```markdown
## Requirements

### Must Have (v1)
- [Specific, testable requirement]
- [Specific, testable requirement]

### Nice to Have (v1 if time permits)
- [Requirement with lower priority]

### Out of Scope (future work)
- [Explicitly excluded item]

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Specific risk] | Low/Med/High | Low/Med/High | [Specific mitigation strategy] |

## Phased Roadmap (if multi-phase)
### Phase 1: [Name] — [Estimated scope]
- [What's included]
### Phase 2: [Name] — [Estimated scope]
- [What's included]
- [Dependency on Phase 1]
```

## SPEC.md Quality Gate — Detailed Self-Checks

### Self-Check 1: Decision Completeness
Are all questions answered in the Decisions table? Every question asked during clarification must appear with a decision and rationale. No empty cells, no "TBD", no "will decide later."

If a question was asked but the answer was ambiguous, the Decisions table should record your best interpretation and flag it: "Decision: JWT auth (user said 'tokens' — confirmed this means JWT, not opaque tokens)."

### Self-Check 2: Architecture-Decision Alignment
Does the Architecture section match the chosen approach? If the user chose Approach A (session-based auth) but the Architecture section describes JWT flows, something is wrong. The Architecture must reflect the specific approach selected, not a generic version.

### Self-Check 3: Testing Strategy Specificity
Is the Testing Strategy specific enough to guide the planning phase? It should NOT say:
- "Write tests for the feature" (what tests?)
- "Unit and integration tests" (for what specifically?)
- "Ensure adequate coverage" (what's adequate?)

It SHOULD say:
- "Unit test each API endpoint: POST /login (valid creds, invalid creds, locked account), POST /logout (valid session, expired session), GET /me (authenticated, unauthenticated)"
- "Integration test: full login -> access protected route -> logout -> verify access revoked"
- "Edge case tests: concurrent login from two devices, token expiration mid-request, malformed JWT"

### Self-Check 4: Out of Scope Clarity
Is the Out of Scope section explicit enough to prevent scope creep during execution? It should name specific things the user might expect but that are NOT included.

BAD: "Advanced features are out of scope."
GOOD: "Out of scope: password reset flow, email verification, OAuth/social login, rate limiting on auth endpoints, admin user management UI. These can be added in future Sutando sessions."

### Self-Check 5: Internal Consistency
Scan the entire SPEC.md for contradictions:
- Does the Goal mention something not covered in Architecture?
- Do the Constraints conflict with the chosen approach?
- Does the Testing Strategy reference components not in the Architecture?

### Self-Check 6: Completeness (Mode B and C only)
Is every section filled? For Mode B, all standard sections must have content. For Mode C, additional sections (Requirements tiers, Risk Assessment, Phased Roadmap) must also be complete.

**Only after all self-checks pass, present the SPEC.md to the user.**

## Clarification Anti-Patterns

These are common failure modes during clarification. If you catch yourself doing any of these, stop and correct course.

### Interrogation Mode

**Symptom:** Firing questions without building on answers. Each question feels disconnected from the last.

**Fix:** After each answer, briefly reflect what you learned before asking the next question. The conversation should feel like a dialogue, not a questionnaire.

### The Premature Solution

**Symptom:** You already know how you'd build this, so your questions are really just confirming your solution rather than exploring the problem space.

**Fix:** Ask at least one question that could change your approach entirely. "Is there a reason you couldn't use [simpler alternative]?" If every answer confirms your preconception, you're probably not asking hard enough questions.

### Analysis Paralysis

**Symptom:** You keep asking questions because you're not sure when you have enough information. The conversation goes 15+ questions in Mode B.

**Fix:** After each answer, ask yourself: "Could I write a SPEC from what I know now?" If yes, propose approaches. You can always clarify more during approach selection. Perfect information is not the goal — sufficient information is.

### The Leading Question

**Symptom:** Your questions telegraph the "right" answer. "Given that JWT is more scalable, should we use JWT or sessions?"

**Fix:** Present options neutrally with real trade-offs. "JWT gives us stateless auth but requires refresh token management. Sessions are simpler but require server-side storage. Which trade-off fits better?"

### Asking the User to Design

**Symptom:** Questions that require architectural knowledge. "Should we use a pub/sub pattern or direct method calls?"

**Fix:** This is your job, not the user's. Ask about requirements and constraints. "When an order is placed, does anything else need to happen? Email confirmation? Inventory update? Analytics event?" Then YOU decide the implementation pattern.

### Ignoring Codebase Signals

**Symptom:** Asking questions that the codebase already answers. "What database should we use?" when there's a Prisma schema right there.

**Fix:** Read first, ask second. Every question should be something you genuinely cannot determine from the code. When you do ask, show what you already know: "I see you're using PostgreSQL with Prisma. This feature needs full-text search — should we use Prisma's built-in search or set up a dedicated search index?"

## Edge Cases in Clarification

### The User Provides a Full Spec

Sometimes the user arrives with a detailed specification. They don't need clarification — they need validation.

**Mode A response:** Read their spec, verify it against the codebase (are their assumptions correct?), and ask only about gaps or contradictions. "Your spec looks thorough. Two things I noticed: (1) you reference a `UserService` but I see it's called `AuthService` in the code — should I use the existing class? (2) You didn't mention error handling for the webhook timeout case — what should happen there?"

**Mode B/C response:** Same as above, but also verify the approach is sound. "Your spec describes a polling-based approach, but I notice the project already has a WebSocket connection for the dashboard. Would it make sense to use that instead of polling? It would reduce server load and give real-time updates."

### The User Doesn't Know What They Want

Sometimes the user has a vague idea but hasn't thought it through. "Make the app better" or "add some kind of notification system."

**Don't:** Ask "what do you mean by better?" — too vague, breeds more vagueness.
**Do:** Make it concrete. "I looked at the app and noticed three things that might affect user experience: (1) the search takes 3 seconds on large datasets, (2) there's no feedback when a background job completes, (3) error messages show raw technical details. Which of these bothers you most, or is it something else entirely?"

Ground vague requests in observable specifics. Help the user discover what they want by showing them what exists.

### The User Wants Everything

"Build a full CRM with email, calendar, task management, contact management, reporting, and integrations with Slack, Salesforce, and HubSpot."

**Response:** This is an ocean, not a lake. Help decompose.
1. "This is a multi-month project if built completely. Let's identify the smallest valuable piece. Which of these would give you the most value in isolation?"
2. "If you could only have one of these working by next week, which would it be?"
3. Scope the first Sutando session to that one piece. Note the full vision in the SPEC's "Future Work" section.

### Conflicting Requirements

The user says they want it "fast and comprehensive" or "simple but with all the features."

**Response:** Name the conflict. "Fast development and comprehensive coverage are in tension — comprehensive means more tasks and more testing. Would you prefer: (A) Build the core flow quickly, add comprehensive edge case handling later, or (B) Build it comprehensively from the start, which takes longer but needs less follow-up?" Don't silently resolve the tension — make the trade-off visible.

### The User Keeps Changing Answers

A previously locked decision gets contradicted by a new answer.

**Response:** Surface the contradiction immediately. "Earlier you said we should use file-based storage (Decision 3), but your answer about handling 10,000 concurrent users suggests we'll need a database. Should I update that decision? The implications are: we'd need to add a database dependency, write migration scripts, and the task count would increase by ~3."

Don't accumulate contradictions silently. Each one compounds into a more confused SPEC.

### Multi-stakeholder Projects

The user says "my team wants X" or "my boss wants Y" — and it contradicts what they personally want.

**Response:** Clarify whose requirements take priority. "You mentioned your team wants real-time sync, but earlier you said you'd prefer simpler polling. For this SPEC, which should I optimize for? I can note the alternative as a future enhancement."

Don't try to satisfy everyone in v1. The SPEC should have one clear direction.
