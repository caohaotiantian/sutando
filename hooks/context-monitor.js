#!/usr/bin/env node
// Sutando Context Monitor — PostToolUse Hook
// Warns when context window is running low.
//
// Thresholds:
//   NOTICE   (usage >= 60%): Be mindful of context usage
//   WARNING  (usage >= 75%): Summarize and free context
//   CRITICAL (usage >= 90%): Save state and consider fresh session
//
// Debounce: 5 tool uses between warnings to avoid spam

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEBOUNCE_CALLS = 5;

// Timeout guard: if stdin doesn't close within 10s, exit silently
// to avoid hanging the session.
const stdinTimeout = setTimeout(() => process.exit(0), 10000);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
        const event = JSON.parse(input);
        handleEvent(event);
    } catch (e) {
        // Silent fail — don't break the session
        console.log('{}');
    }
});

function handleEvent(event) {
    // Extract context metrics if available
    const session = event.session || {};
    const contextUsed = session.context_tokens_used || 0;
    const contextMax = session.context_tokens_max || 200000;
    const usage = contextMax > 0 ? contextUsed / contextMax : 0;

    // Track tool call count for debouncing
    const bridgePath = path.join(os.tmpdir(), 'sutando-context-bridge.json');
    let bridge = { callCount: 0, lastWarning: 0, lastLevel: null };
    try {
        bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
    } catch (e) { /* first call */ }

    bridge.callCount++;
    const callsSinceWarn = bridge.callCount - bridge.lastWarning;

    // Determine current severity level
    let currentLevel = null;
    if (usage >= 0.90) {
        currentLevel = 'critical';
    } else if (usage >= 0.75) {
        currentLevel = 'warning';
    } else if (usage >= 0.60) {
        currentLevel = 'notice';
    }

    // No warning needed
    if (!currentLevel) {
        fs.writeFileSync(bridgePath, JSON.stringify(bridge));
        console.log('{}');
        return;
    }

    // Severity escalation bypasses debounce
    const levelOrder = { notice: 1, warning: 2, critical: 3 };
    const severityEscalated = bridge.lastLevel &&
        levelOrder[currentLevel] > (levelOrder[bridge.lastLevel] || 0);

    // Debounce: only warn every DEBOUNCE_CALLS tool uses (unless severity escalated)
    if (callsSinceWarn < DEBOUNCE_CALLS && !severityEscalated) {
        fs.writeFileSync(bridgePath, JSON.stringify(bridge));
        console.log('{}');
        return;
    }

    // Build warning message
    const usedPct = Math.round(usage * 100);
    let warning;

    if (currentLevel === 'critical') {
        warning = `[Sutando CRITICAL] Context window is ${usedPct}% full. Save state to .sutando/STATE.md NOW and consider starting a fresh session with /sutando to resume.`;
    } else if (currentLevel === 'warning') {
        warning = `[Sutando WARNING] Context window is ${usedPct}% full. Summarize completed work and drop detailed history to free context. Consider dispatching remaining tasks as subagents.`;
    } else {
        warning = `[Sutando NOTICE] Context window is ${usedPct}% full. Be mindful of context usage — avoid reading large files unnecessarily.`;
    }

    // Update debounce state
    bridge.lastWarning = bridge.callCount;
    bridge.lastLevel = currentLevel;
    fs.writeFileSync(bridgePath, JSON.stringify(bridge));

    console.log(JSON.stringify({
        hookSpecificOutput: {
            additionalContext: warning
        }
    }));
}
