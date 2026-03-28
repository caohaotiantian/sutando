# Sutando

> Named after JoJo's Bizarre Adventure "Stands" — your Stand fights on your behalf with its own power.

Sutando is an agent skill for Claude Code that combines collaborative requirement clarification with autonomous TDD-driven implementation and interactive delivery.

## How It Works

```
HUMAN ZONE (you + agent collaborate)
  Clarify requirements → Approve implementation plan

STAND ZONE (agent works autonomously)
  TDD: test → fail → implement → pass → commit → repeat

DELIVERY ZONE (agent presents, you verify)
  Summary → Walkthrough → Accept
```

## Install

```bash
git clone <repo-url> ~/.claude/skills/sutando
cd ~/.claude/skills/sutando
./setup
```

## Usage

Start a new Claude Code session and ask for any development task:

- "Build a REST API for user authentication"
- "Add pagination to the products endpoint"
- "Fix the race condition in the job queue"

Sutando activates automatically and guides you through:

1. **Mode selection** — Agent suggests Quick (A), Structured (B), or Deep (C) clarification based on your request complexity
2. **Clarification** — Collaborative Q&A to nail down requirements
3. **Planning** — Agent creates a detailed task-by-task implementation plan
4. **Approval gate** — You review and approve the plan (last checkpoint before autonomy)
5. **Execution** — Agent implements using strict TDD, autonomously
6. **Delivery** — Agent presents results with an interactive walkthrough for your verification

## Modes

| Mode | Depth | Best For |
|------|-------|----------|
| **A (Quick)** | 3-5 questions | Clear, small-scope tasks |
| **B (Structured)** | Design dialogue + spec | Features with design decisions |
| **C (Deep)** | Full research pipeline | Ambitious multi-phase projects |

## Interruption Settings

Control how much the agent checks in during autonomous execution:

- **Minimal** — Only stops for true blockers
- **Normal** (default) — Tries 2-3 times, then asks for help
- **Checkpoint** — Pauses after each task for your approval

## Project State

Sutando creates a `.sutando/` directory in your project root:

```
.sutando/
├── config.json    # Your preferences
├── STATE.md       # Progress tracking
├── SPEC.md        # Requirements spec
├── PLAN.md        # Implementation plan
└── SUMMARY.md     # Delivery summary
```

## Design Lineage

Sutando synthesizes the best patterns from three agent skill systems:

| Source | Contribution |
|--------|-------------|
| **Superpowers** | TDD iron laws, checklist discipline, subagent isolation, verification gates |
| **Get-Shit-Done** | File-based state, fresh context per agent, wave parallelism, atomic commits |
| **gstack** | Adaptive complexity, transparent mode suggestion, builder philosophy |

## License

MIT
