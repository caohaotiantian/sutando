#!/usr/bin/env bash
# Sutando Safety Guard — PreToolUse Hook
# Warns before destructive operations.
# Returns {"permissionDecision":"ask","message":"..."} to warn, or {} to allow.
set -euo pipefail

# Read stdin (JSON with tool_name and tool_input)
INPUT=$(cat)

TOOL_NAME=$(printf '%s' "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || true)
TOOL_INPUT=$(printf '%s' "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('tool_input',{})))" 2>/dev/null || true)

# --- Check Bash commands for dangerous patterns ---
if [ "$TOOL_NAME" = "Bash" ]; then
    COMMAND=$(printf '%s' "$TOOL_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null || true)

    if [ -z "$COMMAND" ]; then
        echo '{}'
        exit 0
    fi

    # Normalize for case-insensitive SQL matching
    COMMAND_LOWER=$(printf '%s' "$COMMAND" | tr '[:upper:]' '[:lower:]')

    DANGEROUS=""

    # rm -rf / rm -r (recursive delete)
    if printf '%s' "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*r|--recursive)' 2>/dev/null; then
        DANGEROUS="recursive delete (rm -rf)"
    fi

    # git reset --hard
    if [ -z "$DANGEROUS" ] && printf '%s' "$COMMAND" | grep -qE 'git\s+reset\s+--hard' 2>/dev/null; then
        DANGEROUS="discard all changes (git reset --hard)"
    fi

    # git push --force / git push -f
    if [ -z "$DANGEROUS" ] && printf '%s' "$COMMAND" | grep -qE 'git\s+push\s+.*(-f\b|--force)' 2>/dev/null; then
        DANGEROUS="force push"
    fi

    # git checkout . / git restore .
    if [ -z "$DANGEROUS" ] && printf '%s' "$COMMAND" | grep -qE 'git\s+(checkout|restore)\s+\.' 2>/dev/null; then
        DANGEROUS="discard all working changes"
    fi

    # git clean -f
    if [ -z "$DANGEROUS" ] && printf '%s' "$COMMAND" | grep -qE 'git\s+clean\s+.*-f' 2>/dev/null; then
        DANGEROUS="delete untracked files (git clean -f)"
    fi

    # DROP TABLE / DROP DATABASE
    if [ -z "$DANGEROUS" ] && printf '%s' "$COMMAND_LOWER" | grep -qE 'drop\s+(table|database)' 2>/dev/null; then
        DANGEROUS="SQL destruction (DROP TABLE/DATABASE)"
    fi

    # chmod 777
    if [ -z "$DANGEROUS" ] && printf '%s' "$COMMAND" | grep -qE 'chmod\s+777' 2>/dev/null; then
        DANGEROUS="insecure permissions (chmod 777)"
    fi

    # > /dev/null at end of command (suppressing potentially important output)
    if [ -z "$DANGEROUS" ] && printf '%s' "$COMMAND" | grep -qE '>\s*/dev/null\s*$' 2>/dev/null; then
        DANGEROUS="output suppression (> /dev/null)"
    fi

    if [ -n "$DANGEROUS" ]; then
        python3 -c "
import json
msg = '[Sutando Safety] Destructive command detected: ${DANGEROUS}. Proceed?'
print(json.dumps({'permissionDecision': 'ask', 'message': msg}))
"
        exit 0
    fi
fi

# --- Check Edit/Write to files outside the project ---
if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
    FILE_PATH=$(printf '%s' "$TOOL_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('file_path',''))" 2>/dev/null || true)

    if [ -n "$FILE_PATH" ]; then
        CWD=$(pwd)
        HOME_CLAUDE="$HOME/.claude/"
        HOME_CONFIG="$HOME/.config/"

        # Allow files in ~/.claude/ and ~/.config/
        case "$FILE_PATH" in
            "${HOME_CLAUDE}"*|"${HOME_CONFIG}"*)
                # Allowed exceptions
                ;;
            "${CWD}"*)
                # Inside project directory — allowed
                ;;
            *)
                # Outside project directory — warn
                python3 -c "
import json
msg = '[Sutando Safety] File outside project: ${FILE_PATH} is not within the working directory. Proceed?'
print(json.dumps({'permissionDecision': 'ask', 'message': msg}))
"
                exit 0
                ;;
        esac
    fi
fi

# Allow everything else
echo '{}'
