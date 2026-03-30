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

Every question must pass four tests:
1. **Answerable** — User can give a concrete answer (not "what's your vision?")
2. **Consequential** — The answer changes the implementation (not style preferences discoverable from code)
3. **Non-obvious** — Can't be learned from code, config, or context (read first, ask second)
4. **Non-redundant** — Not already implied by a previous answer

> **Detailed BAD/GOOD examples** — See `references/clarify-advanced.md`.

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

   > **Mode C: Parallel Research** — For subagent dispatch templates, see `references/clarify-advanced.md`.

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

Each approach must include: (1) Architecture, (2) Key Libraries, (3) Testing Strategy, (4) Main Trade-off, (5) Rough Scope.

**Principles:** Lead with your recommendation. Alternatives should be genuinely different, not variations. Include a "do less" option when appropriate. Reference research findings in Mode C.

> **Detailed requirements, principles, and examples** — See `references/clarify-advanced.md`.

## SPEC.md Quality Gate

Before presenting SPEC.md to the user, run these self-checks. If any fails, fix before presenting.

1. **Decision Completeness** — All questions answered in Decisions table. No "TBD."
2. **Architecture-Decision Alignment** — Architecture reflects the chosen approach, not a generic version.
3. **Testing Strategy Specificity** — Specific test cases named, not "write appropriate tests."
4. **Out of Scope Clarity** — Names specific excluded items, not "advanced features."
5. **Internal Consistency** — No contradictions between Goal, Architecture, Constraints, and Testing.
6. **Completeness (Mode B/C)** — All sections filled. Mode C includes Requirements tiers, Risk Assessment, Phased Roadmap.

> **Detailed self-check examples** — See `references/clarify-advanced.md`.

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

**Mode B:** All sections filled. Architecture includes component breakdown. Testing Strategy is specific to the feature. Out of Scope prevents future scope creep.

**Mode C:** All sections filled in detail. Architecture includes data flow diagrams. Adds: Requirements (Must Have / Nice to Have / Out of Scope), Risk Assessment table, Phased Roadmap.

> **SPEC examples and Mode C templates** — See `references/clarify-advanced.md`.

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
SUTANDO_ROOT="$HOME/.claude/skills/sutando"
node "$SUTANDO_ROOT/bin/sutando-tools.cjs" state set phase clarify
```

Then transition to the planning phase (the orchestrator handles routing).

> **Edge cases & anti-patterns** — See `references/clarify-advanced.md`.

## Timing Guidelines

Clarification should not take forever. Here are rough time targets to keep the conversation productive:

| Mode | Target Questions | Target Duration | SPEC Length |
|------|-----------------|-----------------|-------------|
| Mode A | 0-5 | 2-5 minutes | 10-30 lines |
| Mode B | 4-8 | 10-20 minutes | 50-150 lines |
| Mode C | 8-15 + research | 20-45 minutes | 150-400 lines |

If you're significantly exceeding these targets, you're either asking too many questions (tighten your Question Quality Standards) or the project needs to be decomposed into sub-projects.

**Respect the user's time.** Every question has a cost — the user's attention. Make each one count.
