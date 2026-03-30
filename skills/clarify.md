---
name: sutando-clarify
description: >
  Phase 1 of Sutando workflow. Adaptive requirement clarification
  with three modes (Quick/Structured/Deep). Produces docs/sutando/SPEC.md.
---

# Sutando Phase 1: Clarification

> The Human Zone — collaborate deeply to understand what we're building.

## Overview

This phase adapts its depth to the project's complexity. The mode was already selected by the orchestrator (SKILL.md) and is available in `.sutando/config.json`.

Read `.sutando/config.json` to determine the mode, then follow the corresponding section below.

## Mode Scaling

Read mode from `.sutando/config.json` and follow the matching path below. This determines which parts of this skill to execute.

### Mode A: Quick (3-5 questions)
- **DO:** Read context silently, batch 3-5 questions in one message, write brief SPEC
- **SKIP:** One-question-at-a-time rule (batching is OK for Mode A), approach proposals, spec review gate
- **SPEC size:** 10-30 lines
- **After SPEC:** Transition directly to planning (no user review gate)

### Mode B: Structured
- **DO:** All steps. One question at a time. Propose 2-3 approaches. User reviews SPEC.
- **SKIP:** Parallel research subagents
- **SPEC size:** 50-150 lines

### Mode C: Deep
- **DO:** All steps including parallel research subagents. Thorough dialogue. Full SPEC with requirements and risks.
- **SKIP:** Nothing
- **SPEC size:** 150-400 lines

**The goal of clarification is not to ask questions — it is to build a shared understanding.** Questions are just the tool. The real output is a SPEC.md that the planning phase can act on without ambiguity. Every question should bring you closer to that SPEC. If it doesn't, don't ask it.

**Clarification is collaborative, not extractive.** You are a thinking partner, not an interviewer. The user often has a fuzzy idea. Your job is to help them sharpen it. Ask questions that make them think "oh, I hadn't considered that" or "yes, that's exactly what I mean." Don't interrogate — collaborate. Don't follow a script — follow the thread of the conversation.

**The cost of bad clarification compounds.** A vague SPEC forces the planning phase to guess. Bad guesses in the plan cause wrong implementations. Wrong implementations require rework. One good question here saves hours of execution time. Conversely, one unnecessary question wastes the user's time and erodes trust. Every question must earn its place.

## Shared Rules (All Modes)

These rules apply regardless of mode:

1. **One question at a time** — Never ask multiple questions in one message. Each question gets its own message and its own response.
2. **Multiple-choice preferred** — When possible, present options (A/B/C/D) rather than open-ended questions. Include a "Something else" option. This reduces cognitive load and speeds up the conversation.
3. **Explain why you're asking** — Brief context helps the user give better answers. "I'm asking because this affects whether we need a database migration."
4. **Codebase-first** — Before asking, check if the answer is discoverable by reading existing code, CLAUDE.md, package.json, or recent commits. Don't ask what you can learn.
5. **Lock decisions** — Once answered, record in the Decisions table. Don't re-ask. See the Decision Locking Protocol below.
6. **No implementation** — This phase produces a SPEC, not code. Do not write any code.

### Question Quality Standards

Not all questions are equal. A bad question wastes the user's time and provides no useful signal. Every question you ask must pass these four tests:

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

### Decision Locking Protocol

Decisions, once made, are locked. This prevents the clarification phase from becoming an endless loop.

**How locking works:**

1. User answers a question.
2. Agent summarizes the decision AND its implications:
   > "You chose JWT auth. This means we'll need: token signing, refresh token rotation, httpOnly cookie storage for the refresh token, and a token revocation endpoint. The auth middleware will check JWT on every request. Correct?"
3. User confirms the implication summary. Only then is the decision locked.
4. The decision is recorded in the Decisions table of SPEC.md with the question, the decision, and the rationale.

**Why implications matter:** A user might say "JWT" without realizing it implies refresh token rotation. By surfacing implications before locking, you catch misunderstandings early. If the user says "wait, I don't need refresh tokens — these are short-lived API tokens," that changes the implementation significantly.

**Unlocking a decision:**

Once locked, a decision should not be silently changed during later phases. If planning or execution reveals a locked decision was wrong:

1. **Stop.** Don't quietly work around it.
2. **Explain what you found:** "During planning, I realized the JWT approach won't work with the existing session middleware without significant refactoring. The session middleware assumes server-side state."
3. **Propose the change:** "I'd recommend switching to extending the existing session system with API keys instead. This is simpler and compatible with the current middleware."
4. **Wait for the user to explicitly unlock:** "Want me to update this decision in the spec?"
5. **Update SPEC.md** with the revised decision, noting it was changed and why.

**Never silently change a locked decision.** That's a violation of the Human Zone contract.

## Mode A: Quick (3-5 Questions)

For clear, small-scope requests where the user knows what they want.

**When Mode A is right:** The user gave a specific request ("add a /health endpoint that returns 200 with the app version"), the codebase is understood, and there are few design decisions to make. Think of Mode A as a focused conversation, not a shortcut.

**When Mode A is wrong:** If you find yourself wanting to ask more than 5 questions, that's a signal to escalate to Mode B. See "Mode A: Escalation" below.

### Process

1. **Read context** (silent — don't narrate):
   - Project files: `ls`, check for CLAUDE.md, package.json, README
   - Recent commits: `git log --oneline -5`
   - Existing patterns: Scan for testing framework, file structure conventions
   - If CLAUDE.md exists: read it fully. Project conventions override defaults.
   - If `.editorconfig` or similar config exists: note the formatting rules.

2. **Ask 3-5 targeted questions** — Only about genuine ambiguities. Skip if everything is clear from context. If you can answer all your own questions from the codebase, you may ask 0 questions and go straight to writing the SPEC.

   Good Mode A questions target the gaps between what the user said and what you need to implement:
   - "Should this endpoint return JSON or HTML?" (if not obvious from existing routes)
   - "Any auth requirements for this feature?" (if auth exists but coverage is unclear)
   - "Where should this live — new file or extend [existing file]?" (if conventions don't dictate)
   - "I see this module has no tests yet. Should I add tests for the existing code while I'm here, or just test the new feature?" (scope question)
   - "The existing error handler returns 500 for all errors. Should this new endpoint follow that pattern, or return specific error codes (400, 404, 409)?" (convention vs improvement question)

3. **Write SPEC.md** — Brief, 10-30 lines.

4. **Transition** — "Spec ready. Moving to planning." (No review gate for Mode A — the questions themselves validated the spec.)

### Mode A: Question Selection

Only ask about things that:
- Cannot be determined from existing code
- Have multiple valid approaches
- Would cause rework if guessed wrong

Do NOT ask about:
- Tech stack (read package.json)
- File naming conventions (follow existing patterns)
- Testing framework (check existing tests)
- Coding style (read existing code)

### Mode A: Escalation

If during Mode A clarification you discover the task is more complex than expected — e.g., it touches multiple systems, requires design decisions the user hasn't considered, or has ambiguity that 3-5 questions can't resolve — escalate:

> "This looks more complex than I initially thought — [specific reason, e.g., 'the auth system touches both the API and the WebSocket layer, and they handle sessions differently']. Mind if I switch to Mode B for a more thorough clarification?"

The user can agree (switch to Mode B process) or decline ("no, keep it simple" — finish Mode A as-is, but note the complexity risk in SPEC.md's Constraints section).

**Escalation signals:**
- You've asked 3 questions and each answer raises 2 more questions
- The "simple change" touches 4+ files across different subsystems
- The user's answers reveal requirements they hadn't mentioned in the original request
- You discover the codebase has no tests for the area being changed (risk is higher than expected)

---

## Mode B: Structured (Design Dialogue)

For moderate features with design decisions to make.

**When Mode B is right:** The user wants to add a feature with components (API + UI + database), fix a bug that might have multiple root causes, or implement something where the "how" is as important as the "what."

### Process

1. **Context exploration** (silent — don't narrate):
   - All Mode A reads, plus:
   - Architecture patterns: How are features organized? MVC? Modules? Feature folders?
   - Similar features: Does anything like this already exist? How is it structured?
   - Test patterns: How are existing features tested? What's the test-to-code ratio?
   - Integration points: What does this feature need to connect to? Database? External APIs? Event system?
   - Recent changes in the relevant area: `git log --oneline -10 -- <relevant-path>` — who's been working here? Any recent refactors?

2. **Clarifying questions** — One at a time. Cover these domains, but only ask questions that pass the Quality Standards above:
   - **Purpose & success criteria** — "What does success look like for this feature?" (But make it concrete: "How will you verify this feature works correctly? Manual testing? Automated? Both?")
   - **Constraints** — "Any performance requirements? Compatibility needs?" (Be specific: "The current API responds in ~200ms. Does this new endpoint need to be similarly fast, or is 1-2 seconds acceptable since it's a batch operation?")
   - **Edge cases** — "What should happen when [boundary condition]?" (Name the specific boundary: "What happens when a user tries to upload a file larger than 10MB? What about an empty file?")
   - **Error handling** — "How should failures be surfaced to the user?" (Name the failure: "If the payment processor is down, should we queue the payment for retry, or tell the user to try again later?")
   - **Integration boundaries** — "Does this feature need to notify other parts of the system?" (Be precise: "When an order is completed, should we emit an event for the notification system, or is that a separate feature?")
   - Stop when you have enough to propose approaches (typically 4-8 questions).

   **Dialogue rhythm:** After each answer, briefly acknowledge what you learned before asking the next question. Don't just fire questions — build on the conversation.
   - "Got it — so the retry should be automatic, up to 3 attempts. That means we'll need a retry queue. Next question: ..."
   - This helps the user feel heard and ensures you've correctly understood before moving on.

3. **Propose 2-3 approaches** — With trade-offs and your recommendation. See "Approach Proposal Quality" below for detailed guidelines.
   > "Based on what we've discussed, I see three approaches:
   >
   > **A) [Name]** — [1-2 sentences]. Trade-off: [pro/con].
   > **B) [Name]** — [1-2 sentences]. Trade-off: [pro/con].
   > **C) [Name]** — [1-2 sentences]. Trade-off: [pro/con].
   >
   > I'd recommend **A** because [reasoning]. Which direction?"

4. **User selects approach.**

5. **Write SPEC.md** — 50-150 lines. Include architecture section based on selected approach.

6. **User reviews SPEC.md:**
   > "Spec written to `docs/sutando/SPEC.md`. Please review — any changes before we move to planning?"

   Wait for approval or revision requests. If revisions: update SPEC.md, re-present for review.

### Mode B: Escalation to Mode C

If during Mode B you discover the task requires research, has many integration points, or the dialogue keeps revealing new unknowns beyond the 4-8 question range:

> "This is turning out to have more moving parts than expected — [specific reason, e.g., 'it touches the payment system, the notification pipeline, and the user dashboard, each with different patterns']. Want me to switch to Mode C for a full research pipeline? It'll take longer but we'll have a much more solid foundation."

If the user agrees, transition to Mode C. Carry over all decisions already locked — don't re-ask them.

---

## Mode C: Deep (Full Research Pipeline)

For ambitious, multi-phase projects with many unknowns.

### Process

1. **Deep context exploration** (narrate briefly — "Let me explore the codebase first."):
   - All Mode B reads, plus:
   - Full directory structure analysis
   - Dependency audit (package.json/Cargo.toml/requirements.txt)
   - Integration points (APIs, databases, external services)
   - Tech debt or patterns that affect the new feature

2. **Thorough dialogue** — One question at a time. Cover all Mode B topics plus:
   - **Vision & goals** — "What's the long-term vision for this? Just v1 or ongoing evolution?" (Make it concrete: "If this succeeds, what's the next feature you'd build on top of it?")
   - **Non-goals** — "What should this explicitly NOT do?" (Help them articulate boundaries: "I notice the existing system also handles [related thing]. Should this feature integrate with that, or is that out of scope?")
   - **UX expectations** — "How should users interact with this?" (Ground it in specifics: "Walk me through the ideal flow — a user opens the app, what do they see first? What do they click? What happens next?")
   - **Integration points** — "Does this connect to any external systems?" (Be thorough: "I see the project uses Stripe for payments and SendGrid for email. Does this feature need either of those?")
   - **Phasing** — "Should this be built all at once or in stages?" (Offer a concrete split: "I could build the API first, then the UI in a second session. Or build both together. The API-first approach lets you start integration testing sooner.")
   - **Migration & rollout** — "How should this be deployed? Feature flag? Gradual rollout? Big-bang?" (Only ask if the project has existing users)
   - **Observability** — "How will you know this feature is working in production? Logs? Metrics? Alerts?" (Only ask if the project has monitoring infrastructure)
   - Typically 8-15 questions. Don't ask all of these — pick the ones that are relevant and consequential.

   **Dialogue pacing for Mode C:** This is a longer conversation. Check in periodically: "We've covered [topics]. Before I continue, anything you want to add or correct?" This prevents the user from feeling interrogated and gives them a chance to volunteer information you haven't asked about.

3. **Research phase** — Dispatch parallel research to build an evidence base for approach proposals.

   **Parallel Research Pattern:** After the dialogue, dispatch 3 research threads in parallel. Each investigates a different dimension of the problem. The goal is to arrive at approach proposals backed by evidence, not intuition.

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

4. **Propose 2-3 approaches** — With research-backed reasoning. Include architecture diagrams (text-based) if helpful. Each approach should reference specific research findings.

5. **User selects approach.**

6. **Write SPEC.md** — 150-400 lines. Full spec including:
   - Project overview and goals
   - Requirements: must-have / nice-to-have / out-of-scope
   - Architecture and component design
   - Phased roadmap (if multi-phase)
   - Testing strategy
   - Risk assessment

7. **User reviews SPEC.md:**
   > "Full spec written to `docs/sutando/SPEC.md`. This is a substantial document — please review carefully. Any changes before we move to planning?"

   Wait for approval or revision requests.

---

## Approach Proposal Quality

When proposing 2-3 approaches (in Mode B and C), each approach must be substantive enough for the user to make an informed choice. Vague approaches lead to vague decisions.

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

## SPEC.md Quality Gate

Before presenting SPEC.md to the user, run these self-checks. If any check fails, fix the issue before presenting.

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

## SPEC.md Output Format

All modes produce a SPEC.md following this structure (sections scale with mode):

```markdown
---
mode: [A/B/C]
created: [YYYY-MM-DD]
status: [draft/approved]
---

# [Feature/Project Name]

## Goal
[1-2 sentences — what are we building and why]

## Constraints
- [Tech stack requirements]
- [Performance requirements]
- [Compatibility requirements]

## Decisions
| Question | Decision | Rationale |
|----------|----------|-----------|
| [Each question asked] | [User's answer] | [Why this choice] |

## Architecture
[Component breakdown — what pieces exist and how they connect]
[Data flow — how data moves through the system]

## Testing Strategy
[What to test — unit, integration, e2e]
[How to verify — specific test approaches]

## Out of Scope
- [Explicitly excluded items — prevents scope creep during execution]
```

**Mode A:** Goal, Constraints, Decisions, brief Architecture. May omit Testing Strategy and Out of Scope if trivial.

Example Mode A SPEC (total ~20 lines):
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

**Mode B:** All sections filled. Architecture includes component breakdown. Testing Strategy is specific to the feature. Out of Scope prevents future scope creep.

**Mode C:** All sections filled in detail. Architecture includes data flow diagrams. Adds these additional sections:

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

## Transition to Planning

After SPEC.md is approved (or auto-approved in Mode A), present a brief transition summary:

**Mode A transition:**
> "Spec ready. Moving to planning."

**Mode B transition:**
> "Spec approved. Here's what we're building: [1-sentence summary from Goal]. Key decisions: [top 2-3 decisions]. Moving to planning."

**Mode C transition:**
> "Spec approved. Here's the scope: [1-sentence summary]. We identified [N] key risks with mitigations in place. The architecture follows the [chosen approach name] approach. Moving to planning — I'll create a detailed task breakdown."

The transition message serves two purposes: (1) it confirms the agent understood the spec correctly (a last chance for the user to catch misunderstandings), and (2) it resets context for the planning phase.

## After Writing SPEC.md

Commit the SPEC immediately after writing it:

```bash
git add docs/sutando/SPEC.md && git commit -m "docs: add Sutando spec"
```

Use sutando-tools.cjs for state operations — provides lockfile safety and atomic writes:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/sutando-tools.cjs" state set phase clarify
```

Then transition to the planning phase (the orchestrator handles routing).

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

## Timing Guidelines

Clarification should not take forever. Here are rough time targets to keep the conversation productive:

| Mode | Target Questions | Target Duration | SPEC Length |
|------|-----------------|-----------------|-------------|
| Mode A | 0-5 | 2-5 minutes | 10-30 lines |
| Mode B | 4-8 | 10-20 minutes | 50-150 lines |
| Mode C | 8-15 + research | 20-45 minutes | 150-400 lines |

If you're significantly exceeding these targets, you're either asking too many questions (tighten your Question Quality Standards) or the project needs to be decomposed into sub-projects.

**Respect the user's time.** Every question has a cost — the user's attention. Make each one count.
