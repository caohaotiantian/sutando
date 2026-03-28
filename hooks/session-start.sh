#!/bin/bash
# Sutando SessionStart Hook
# Injects skill availability context into the session.

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_FILE="$PLUGIN_ROOT/SKILL.md"

if [ ! -f "$SKILL_FILE" ]; then
  echo '{"hookSpecificOutput":{"additionalContext":"[Sutando] SKILL.md not found at '"$SKILL_FILE"'. Installation may be broken."}}'
  exit 0
fi

# Read the skill description (first 5 lines after frontmatter)
DESCRIPTION=$(awk '/^---$/{n++; next} n==1{if(++i<=5) print}' "$SKILL_FILE")

# Escape for JSON
DESCRIPTION_JSON=$(printf '%s' "$DESCRIPTION" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")

cat <<HOOK_JSON
{
  "hookSpecificOutput": {
    "additionalContext": "Sutando (Stand skill) is available. Invoke with the Skill tool when the user wants to build a feature or fix a bug with autonomous execution.\n\nDescription:\n${DESCRIPTION_JSON}"
  }
}
HOOK_JSON
