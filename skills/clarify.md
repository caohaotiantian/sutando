---
name: sutando-clarify
description: >
  Phase 1 of Sutando workflow. Adaptive requirement clarification
  with three modes (Quick/Structured/Deep). Produces .sutando/SPEC.md.
---

# Sutando Phase 1: Clarification

> The Human Zone — collaborate deeply to understand what we're building.

## Overview

This phase adapts its depth to the project's complexity. The mode was already selected by the orchestrator (SKILL.md) and is available in `.sutando/config.json`.

Read `.sutando/config.json` to determine the mode, then follow the corresponding section below.

## Shared Rules (All Modes)

These rules apply regardless of mode:

1. **One question at a time** — Never ask multiple questions in one message.
2. **Multiple-choice preferred** — When possible, present options (A/B/C/D) rather than open-ended questions. Include a "Something else" option.
3. **Explain why you're asking** — Brief context helps the user give better answers. "I'm asking because this affects whether we need a database migration."
4. **Codebase-first** — Before asking, check if the answer is discoverable by reading existing code, CLAUDE.md, package.json, or recent commits. Don't ask what you can learn.
5. **Lock decisions** — Once answered, record in the Decisions table. Don't re-ask.
6. **No implementation** — This phase produces a SPEC, not code. Do not write any code.

## Mode A: Quick (3-5 Questions)

For clear, small-scope requests where the user knows what they want.

### Process

1. **Read context** (silent — don't narrate):
   - Project files: `ls`, check for CLAUDE.md, package.json, README
   - Recent commits: `git log --oneline -5`
   - Existing patterns: Scan for testing framework, file structure conventions

2. **Ask 3-5 targeted questions** — Only about genuine ambiguities. Skip if everything is clear from context. Examples:
   - "Should this endpoint return JSON or HTML?" (if not obvious from existing routes)
   - "Any auth requirements for this feature?" (if auth exists but coverage is unclear)
   - "Where should this live — new file or extend [existing file]?" (if conventions don't dictate)

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

---

## Mode B: Structured (Design Dialogue)

For moderate features with design decisions to make.

### Process

1. **Context exploration** (silent — don't narrate):
   - All Mode A reads, plus:
   - Architecture patterns: How are features organized? MVC? Modules?
   - Similar features: Does anything like this already exist?
   - Test patterns: How are existing features tested?

2. **Clarifying questions** — One at a time. Cover:
   - **Purpose & success criteria** — "What does success look like for this feature?"
   - **Constraints** — "Any performance requirements? Compatibility needs?"
   - **Edge cases** — "What should happen when [boundary condition]?"
   - **Error handling** — "How should failures be surfaced to the user?"
   - Stop when you have enough to propose approaches (typically 4-8 questions).

3. **Propose 2-3 approaches** — With trade-offs and your recommendation:
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
   > "Spec written to `.sutando/SPEC.md`. Please review — any changes before we move to planning?"

   Wait for approval or revision requests. If revisions: update SPEC.md, re-present for review.

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
   - **Vision & goals** — "What's the long-term vision for this? Just v1 or ongoing evolution?"
   - **Non-goals** — "What should this explicitly NOT do?"
   - **UX expectations** — "How should users interact with this?"
   - **Integration points** — "Does this connect to any external systems?"
   - **Phasing** — "Should this be built all at once or in stages?"
   - Typically 8-15 questions.

3. **Research phase** — Investigate based on dialogue:
   - Existing codebase patterns that the feature must follow
   - Library/framework options for unknowns (if the user is undecided on a tool)
   - Potential pitfalls based on the tech stack and requirements
   - Write findings to `.sutando/phases/research/RESEARCH.md`

4. **Propose 2-3 approaches** — With research-backed reasoning. Include architecture diagrams (text-based) if helpful.

5. **User selects approach.**

6. **Write SPEC.md** — 150-400 lines. Full spec including:
   - Project overview and goals
   - Requirements: must-have / nice-to-have / out-of-scope
   - Architecture and component design
   - Phased roadmap (if multi-phase)
   - Testing strategy
   - Risk assessment

7. **User reviews SPEC.md:**
   > "Full spec written to `.sutando/SPEC.md`. This is a substantial document — please review carefully. Any changes before we move to planning?"

   Wait for approval or revision requests.

---

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

**Mode B:** All sections filled. Architecture includes component breakdown.

**Mode C:** All sections filled in detail. Architecture includes data flow diagrams. Adds Requirements (must/nice/out) and Risk Assessment sections.

## After Writing SPEC.md

Update `.sutando/STATE.md`:

```markdown
---
phase: clarify
updated: [timestamp]
---

# Sutando State

## Configuration
- Mode: [A/B/C]
- Interruption: [setting]
- Parallelism: adaptive

## Progress
- [x] Clarification complete — SPEC.md written
- [ ] Planning
- [ ] Execution
- [ ] Delivery
```

Then transition to the planning phase (the orchestrator handles routing).
