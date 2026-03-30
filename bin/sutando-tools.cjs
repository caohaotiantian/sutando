#!/usr/bin/env node
'use strict';

/**
 * sutando-tools.cjs — State management CLI for Sutando
 *
 * Single-file CLI tool providing atomic state management, config CRUD,
 * template rendering, and status reporting. No external dependencies.
 *
 * Usage:
 *   node sutando-tools.cjs <command> [subcommand] [options]
 *
 * Commands:
 *   init                          Initialize .sutando/ directory
 *   state get [field]             Read state (full or specific field)
 *   state set <field> <value>     Update state atomically
 *   state progress                Update task progress
 *   config get [key]              Read config
 *   config set <key> <value>      Update config
 *   template render <name>        Render a template with variables
 *   status                        Quick status summary
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ─── Constants ──────────────────────────────────────────────────────────────

const SUTANDO_DIR = '.sutando';
const STATE_FILE = 'STATE.md';
const CONFIG_FILE = 'config.json';
const LOCK_STALE_MS = 30000; // 30 seconds

const VALID_CONFIG_KEYS = new Set([
  'mode', 'interruption', 'parallelism',
]);

// ─── Output helpers ─────────────────────────────────────────────────────────

function output(data) {
  process.stdout.write(JSON.stringify(data) + '\n');
  process.exit(0);
}

function errorOut(code, message) {
  process.stdout.write(JSON.stringify({ error: code, message }) + '\n');
  process.exit(1);
}

// ─── Argument parser ────────────────────────────────────────────────────────

/**
 * Parses process.argv into { positional: [], flags: {} }.
 * Supports --flag value and --flag=value forms.
 * Repeatable flags (e.g., --var) are collected into arrays.
 */
function parseArgs(argv) {
  const args = argv.slice(2); // drop node and script path
  const positional = [];
  const flags = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      let key, value;
      if (eqIdx !== -1) {
        key = arg.slice(2, eqIdx);
        value = arg.slice(eqIdx + 1);
      } else {
        key = arg.slice(2);
        // Peek ahead for value (if next arg doesn't start with --)
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          value = args[i + 1];
          i++;
        } else {
          value = true;
        }
      }
      // Collect repeatable flags into arrays
      if (flags[key] !== undefined) {
        if (!Array.isArray(flags[key])) {
          flags[key] = [flags[key]];
        }
        flags[key].push(value);
      } else {
        flags[key] = value;
      }
    } else {
      positional.push(arg);
    }
    i++;
  }

  return { positional, flags };
}

// ─── Path helpers ───────────────────────────────────────────────────────────

function sutandoRoot() {
  return path.resolve(SUTANDO_DIR);
}

function statePath() {
  return path.join(sutandoRoot(), STATE_FILE);
}

function configPath() {
  return path.join(sutandoRoot(), CONFIG_FILE);
}

function templatesDir() {
  // Templates live alongside the bin/ directory in the sutando package
  return path.join(path.dirname(__dirname), 'templates');
}

// ─── Frontmatter parser ────────────────────────────────────────────────────

/**
 * Parses YAML frontmatter from Markdown content.
 * Returns { frontmatter: {}, body: "" }.
 * Handles simple key: value pairs (no nested YAML).
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    // Auto-parse booleans, numbers, and inline JSON
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (value !== '' && !isNaN(value)) value = Number(value);
    else if (value.startsWith('[') || value.startsWith('{')) {
      try { value = JSON.parse(value); } catch { /* keep as string */ }
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Reconstructs Markdown with updated YAML frontmatter.
 * Only serializes scalar values (string, number, boolean).
 * Arrays and objects are serialized as JSON inline.
 */
function renderFrontmatter(data, body) {
  const lines = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) {
      lines.push(`${k}: `);
    } else if (typeof v === 'object') {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

// ─── Lockfile ───────────────────────────────────────────────────────────────

function lockPath(filePath) {
  return filePath + '.lock';
}

/**
 * Acquires a lockfile. Returns true on success.
 * Breaks stale locks older than LOCK_STALE_MS.
 * Retries up to `timeout` ms with a 50ms poll interval.
 */
function acquireLock(filePath, timeout) {
  if (timeout === undefined) timeout = 5000;
  const lock = lockPath(filePath);
  const start = Date.now();
  const pid = process.pid;
  const lockContent = JSON.stringify({ pid, timestamp: Date.now() });

  while (true) {
    try {
      // O_CREAT | O_EXCL — atomic create-if-not-exists
      const fd = fs.openSync(lock, 'wx');
      fs.writeSync(fd, lockContent);
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') {
        errorOut('lock_failed', `Failed to create lock: ${err.message}`);
      }
      // Lock exists — check for staleness
      try {
        const stat = fs.statSync(lock);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          // Stale lock — break it
          try { fs.unlinkSync(lock); } catch { /* another process may have removed it */ }
          continue; // retry
        }
      } catch {
        // Lock disappeared between open and stat — retry
        continue;
      }
      // Not stale — wait and retry
      if (Date.now() - start >= timeout) {
        errorOut('lock_timeout', `Could not acquire lock on ${filePath} within ${timeout}ms`);
      }
      // Busy-wait 50ms (Node built-in, no sleep needed for short intervals)
      const waitUntil = Date.now() + 50;
      while (Date.now() < waitUntil) { /* spin */ }
    }
  }
}

/**
 * Releases a lockfile.
 */
function releaseLock(filePath) {
  const lock = lockPath(filePath);
  try {
    fs.unlinkSync(lock);
  } catch {
    // Already removed — not an error
  }
}

// ─── Atomic write ───────────────────────────────────────────────────────────

/**
 * Writes content to a file atomically: write to temp, then rename.
 * The rename is atomic on POSIX systems, preventing corruption on crash.
 */
function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  const tmpName = `.tmp.${crypto.randomBytes(6).toString('hex')}`;
  const tmpPath = path.join(dir, tmpName);

  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

// ─── Nested value helpers ───────────────────────────────────────────────────

/**
 * Gets a nested value from an object using dot notation.
 * e.g., getNestedValue(obj, "progress.3.status")
 */
function getNestedValue(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    // Handle numeric keys for arrays
    const numKey = Number(key);
    if (Array.isArray(current) && !isNaN(numKey)) {
      current = current[numKey];
    } else {
      current = current[key];
    }
  }
  return current;
}

/**
 * Sets a nested value on an object using dot notation.
 * Creates intermediate objects/arrays as needed.
 */
function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    const numKey = Number(key);
    const nextIsNum = !isNaN(Number(nextKey));

    if (Array.isArray(current) && !isNaN(numKey)) {
      if (current[numKey] === undefined || typeof current[numKey] !== 'object') {
        current[numKey] = nextIsNum ? [] : {};
      }
      current = current[numKey];
    } else {
      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = nextIsNum ? [] : {};
      }
      current = current[key];
    }
  }

  const lastKey = keys[keys.length - 1];
  const numLast = Number(lastKey);
  if (Array.isArray(current) && !isNaN(numLast)) {
    current[numLast] = value;
  } else {
    current[lastKey] = value;
  }
}

/**
 * Parse a string value into its natural type (boolean, number, or string).
 */
function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value !== '' && !isNaN(value)) return Number(value);
  // Try JSON parse for arrays/objects
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try { return JSON.parse(value); } catch { /* keep as string */ }
  }
  return value;
}

// ─── Command: init ──────────────────────────────────────────────────────────

function handleInit(flags) {
  const mode = flags.mode || 'B';
  const interruption = flags.interruption || 'normal';
  const parallelism = flags.parallelism || 'sequential';

  const root = sutandoRoot();

  // Create .sutando/ directory
  try {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
  } catch (err) {
    errorOut('init_failed', `Failed to create ${SUTANDO_DIR}/: ${err.message}`);
  }

  // Create phases/research directory
  try {
    fs.mkdirSync(path.join(root, 'phases', 'research'), { recursive: true });
  } catch { /* non-fatal */ }

  // Create docs/sutando directory
  try {
    const docsDir = path.resolve('docs', 'sutando');
    fs.mkdirSync(docsDir, { recursive: true });
  } catch { /* non-fatal */ }

  // Create config.json
  const config = { mode, interruption, parallelism };
  try {
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    errorOut('init_failed', `Failed to write config.json: ${err.message}`);
  }

  // Create STATE.md from template
  const now = new Date().toISOString();
  const templatePath = path.join(templatesDir(), 'state.md');
  let stateContent;

  try {
    const template = fs.readFileSync(templatePath, 'utf-8');
    stateContent = template
      .replace(/\{\{PHASE\}\}/g, 'init')
      .replace(/\{\{TIMESTAMP\}\}/g, now)
      .replace(/\{\{MODE\}\}/g, mode)
      .replace(/\{\{INTERRUPTION\}\}/g, interruption)
      .replace(/\{\{PARALLELISM\}\}/g, parallelism)
      .replace(/\{\{TASK_LIST\}\}/g, '(populated after planning)');
  } catch {
    // Fallback if template is missing
    stateContent = renderFrontmatter(
      { phase: 'init', updated: now },
      `\n# Sutando State\n\n## Configuration\n- Mode: ${mode}\n- Interruption: ${interruption}\n- Parallelism: ${parallelism}\n\n## Progress\n(populated after planning)\n\n## Decisions Made During Execution\n| Task | Decision | Reasoning |\n|------|----------|-----------|\n\n## Issues Encountered\n\n## Test Status\n- Unit: 0 passing\n- Integration: 0 passing\n`
    );
  }

  try {
    fs.writeFileSync(statePath(), stateContent, 'utf-8');
  } catch (err) {
    errorOut('init_failed', `Failed to write STATE.md: ${err.message}`);
  }

  // Add .sutando/ to .gitignore if not present
  try {
    const gitignorePath = path.resolve('.gitignore');
    let gitignore = '';
    if (fs.existsSync(gitignorePath)) {
      gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    }
    const lines = gitignore.split('\n').map(l => l.trim());
    if (!lines.includes('.sutando/') && !lines.includes('.sutando')) {
      const suffix = gitignore.length > 0 && !gitignore.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(gitignorePath, `${suffix}.sutando/\n`);
    }
  } catch {
    // Non-fatal — user may not have a git repo
  }

  output({ status: 'ok', state_path: '.sutando/', docs_path: 'docs/sutando/' });
}

// ─── Command: state get ─────────────────────────────────────────────────────

function handleStateGet(field) {
  const sp = statePath();

  if (!fs.existsSync(sp)) {
    errorOut('no_state', `${SUTANDO_DIR}/${STATE_FILE} not found`);
  }

  let content;
  try {
    content = fs.readFileSync(sp, 'utf-8');
  } catch (err) {
    errorOut('read_failed', `Failed to read STATE.md: ${err.message}`);
  }

  const { frontmatter, body } = parseFrontmatter(content);

  if (!field) {
    // Return full state: frontmatter fields + raw body + parsed progress
    const progress = parseProgressFromBody(body);
    output({ ...frontmatter, body, progress });
    return;
  }

  // Check frontmatter first
  if (field in frontmatter) {
    output({ [field]: frontmatter[field] });
    return;
  }

  // Check derived fields
  if (field === 'progress') {
    output({ progress: parseProgressFromBody(body) });
    return;
  }

  if (field === 'body') {
    output({ body });
    return;
  }

  // Try dot-notation into frontmatter
  const nested = getNestedValue(frontmatter, field);
  if (nested !== undefined) {
    output({ [field]: nested });
    return;
  }

  errorOut('field_not_found', `Field "${field}" not found in state`);
}

/**
 * Parses task progress items from the Markdown body.
 * Looks for checkbox lines: - [ ] Task N: description  or  - [x] Task N: description
 */
function parseProgressFromBody(body) {
  const tasks = [];
  const pattern = /^- \[([ xX])\]\s*Task\s+(\d+):\s*(.*)$/gm;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    tasks.push({
      task: parseInt(match[2], 10),
      status: match[1].trim() === '' ? 'pending' : 'done',
      description: match[3].trim(),
    });
  }
  return tasks;
}

// ─── Command: state set ─────────────────────────────────────────────────────

function handleStateSet(field, value) {
  if (!field) {
    errorOut('usage', 'Usage: state set <field> <value>');
  }

  const sp = statePath();
  if (!fs.existsSync(sp)) {
    errorOut('no_state', `${SUTANDO_DIR}/${STATE_FILE} not found`);
  }

  acquireLock(sp);
  try {
    let content = fs.readFileSync(sp, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const parsedValue = parseValue(value);

    // Set value using dot notation into frontmatter
    setNestedValue(frontmatter, field, parsedValue);

    // Always update the timestamp
    frontmatter.updated = new Date().toISOString();

    const updated = renderFrontmatter(frontmatter, body);
    atomicWrite(sp, updated);

    releaseLock(sp);
    output({ updated: true, field, value: parsedValue });
  } catch (err) {
    releaseLock(sp);
    errorOut('state_set_failed', err.message);
  }
}

// ─── Command: state progress ────────────────────────────────────────────────

/**
 * Reads PLAN.md to discover tasks, syncs them into STATE.md progress section.
 * Plan tasks are the source of truth; existing statuses in STATE.md are preserved.
 */
function discoverAndSyncTasks(sp, planFile) {
  // Read plan tasks
  const planTasks = [];
  if (fs.existsSync(planFile)) {
    const planContent = fs.readFileSync(planFile, 'utf-8');
    const taskHeaderPattern = /^###\s+Task\s+(\d+):\s*(.*)$/gm;
    let m;
    while ((m = taskHeaderPattern.exec(planContent)) !== null) {
      planTasks.push({ task: parseInt(m[1], 10), description: m[2].trim() });
    }
  }

  if (planTasks.length === 0) return;

  // Read current STATE.md
  let content = fs.readFileSync(sp, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  // Parse existing progress to preserve statuses
  const existingTasks = parseProgressFromBody(body);
  const statusMap = {};
  for (const t of existingTasks) {
    statusMap[t.task] = t.status;
  }

  // Build merged progress lines
  const progressLines = planTasks.map(pt => {
    const existing = statusMap[pt.task] || 'pending';
    const marker = existing === 'done' ? 'x' : ' ';
    return `- [${marker}] Task ${pt.task}: ${pt.description}`;
  });
  const newProgressBlock = progressLines.join('\n');

  // Replace progress section in body
  let updatedBody;
  if (body.includes('(populated after planning)')) {
    updatedBody = body.replace('(populated after planning)', newProgressBlock);
  } else {
    // Replace existing task lines in the Progress section
    const progressSectionPattern = /(## Progress\s*\n)([\s\S]*?)(\n## |\n*$)/;
    const sectionMatch = body.match(progressSectionPattern);
    if (sectionMatch) {
      updatedBody = body.replace(progressSectionPattern, `$1${newProgressBlock}\n$3`);
    } else {
      updatedBody = body;
    }
  }

  frontmatter.updated = new Date().toISOString();
  const updated = renderFrontmatter(frontmatter, updatedBody);
  atomicWrite(sp, updated);
}

function handleStateProgress(flags) {
  const sp = statePath();
  if (!fs.existsSync(sp)) {
    errorOut('no_state', `${SUTANDO_DIR}/${STATE_FILE} not found`);
  }

  const planFile = flags['plan-file'] || path.resolve('docs', 'sutando', 'PLAN.md');

  // Summary mode
  if (flags.summary) {
    discoverAndSyncTasks(sp, planFile);

    const content = fs.readFileSync(sp, 'utf-8');
    const { body } = parseFrontmatter(content);
    const tasks = parseProgressFromBody(body);

    if (tasks.length === 0) {
      output({ tasks: [], done: 0, total: 0, summary: 'No tasks found' });
      return;
    }

    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    const summaryLine = `Progress: ${done}/${total} tasks done`;

    output({ tasks, done, total, summary: summaryLine });
    return;
  }

  // Update mode
  const taskNum = flags.task;
  const status = flags.status;

  if (!taskNum || !status) {
    errorOut('usage', 'Usage: state progress --task <N> --status <done|pending|in_progress>');
  }

  const taskInt = parseInt(taskNum, 10);
  if (isNaN(taskInt)) {
    errorOut('invalid_task', `Invalid task number: ${taskNum}`);
  }

  acquireLock(sp);
  try {
    // Sync tasks from plan first
    discoverAndSyncTasks(sp, planFile);

    let content = fs.readFileSync(sp, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Find and update the task line
    const taskPattern = new RegExp(
      `^(- \\[)[ xX](\\]\\s*Task\\s+${taskInt}:.*)$`,
      'm'
    );
    const taskMatch = body.match(taskPattern);

    if (!taskMatch) {
      throw new Error(`Task ${taskInt} not found in Progress section`);
    }

    let marker;
    switch (status) {
      case 'done':
        marker = 'x';
        break;
      case 'pending':
        marker = ' ';
        break;
      case 'in_progress':
        marker = ' ';
        break;
      default:
        throw new Error(`Invalid status: "${status}". Use: done, pending, in_progress`);
    }

    let updatedBody = body.replace(taskPattern, `$1${marker}$2`);

    // For in_progress, annotate the description if not already annotated
    if (status === 'in_progress') {
      const annoPattern = new RegExp(
        `^(- \\[ \\]\\s*Task\\s+${taskInt}:.*?)(?:\\s*\\[IN PROGRESS\\])?$`,
        'm'
      );
      updatedBody = updatedBody.replace(annoPattern, '$1 [IN PROGRESS]');
    } else {
      // Remove [IN PROGRESS] annotation if switching away
      const cleanPattern = new RegExp(
        `^(- \\[.\\]\\s*Task\\s+${taskInt}:.*?)\\s*\\[IN PROGRESS\\]`,
        'm'
      );
      updatedBody = updatedBody.replace(cleanPattern, '$1');
    }

    frontmatter.updated = new Date().toISOString();
    const updated = renderFrontmatter(frontmatter, updatedBody);
    atomicWrite(sp, updated);

    releaseLock(sp);
    output({ updated: true, task: taskInt, status });
  } catch (err) {
    releaseLock(sp);
    errorOut('progress_failed', err.message);
  }
}

// ─── Command: config get ────────────────────────────────────────────────────

function handleConfigGet(key) {
  const cp = configPath();

  if (!fs.existsSync(cp)) {
    errorOut('no_config', `${SUTANDO_DIR}/${CONFIG_FILE} not found`);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(cp, 'utf-8'));
  } catch (err) {
    errorOut('config_parse_failed', `Failed to parse config.json: ${err.message}`);
  }

  if (!key) {
    output(config);
    return;
  }

  const value = getNestedValue(config, key);
  if (value === undefined) {
    errorOut('key_not_found', `Config key "${key}" not found`);
  }

  output({ [key]: value });
}

// ─── Command: config set ────────────────────────────────────────────────────

function handleConfigSet(key, value) {
  if (!key) {
    errorOut('usage', 'Usage: config set <key> <value>');
  }

  // Validate top-level key
  const topKey = key.split('.')[0];
  if (!VALID_CONFIG_KEYS.has(topKey)) {
    errorOut('invalid_key', `Unknown config key: "${key}". Valid keys: ${[...VALID_CONFIG_KEYS].join(', ')}`);
  }

  const cp = configPath();
  if (!fs.existsSync(cp)) {
    errorOut('no_config', `${SUTANDO_DIR}/${CONFIG_FILE} not found. Run "init" first.`);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(cp, 'utf-8'));
  } catch (err) {
    errorOut('config_parse_failed', `Failed to parse config.json: ${err.message}`);
  }

  const parsedValue = parseValue(value);
  const previousValue = getNestedValue(config, key);
  setNestedValue(config, key, parsedValue);

  try {
    atomicWrite(cp, JSON.stringify(config, null, 2) + '\n');
  } catch (err) {
    errorOut('config_write_failed', `Failed to write config.json: ${err.message}`);
  }

  output({ updated: true, key, value: parsedValue, previousValue });
}

// ─── Command: template render ───────────────────────────────────────────────

function handleTemplateRender(templateName, flags) {
  if (!templateName) {
    errorOut('usage', 'Usage: template render <name> --var KEY=VALUE [--var KEY=VALUE ...]');
  }

  const tDir = templatesDir();
  const templateFile = path.join(tDir, `${templateName}.md`);

  if (!fs.existsSync(templateFile)) {
    // List available templates for helpful error
    let available = [];
    try {
      available = fs.readdirSync(tDir)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
    } catch { /* ignore */ }
    errorOut('template_not_found', `Template "${templateName}" not found. Available: ${available.join(', ') || 'none'}`);
  }

  let content;
  try {
    content = fs.readFileSync(templateFile, 'utf-8');
  } catch (err) {
    errorOut('template_read_failed', `Failed to read template: ${err.message}`);
  }

  // Parse --var flags
  const vars = {};
  let varList = flags.var || [];
  if (!Array.isArray(varList)) varList = [varList];

  for (const v of varList) {
    if (typeof v !== 'string') continue;
    const eqIdx = v.indexOf('=');
    if (eqIdx === -1) {
      errorOut('invalid_var', `Invalid --var format: "${v}". Use KEY=VALUE`);
    }
    const varKey = v.slice(0, eqIdx);
    const varValue = v.slice(eqIdx + 1);
    vars[varKey] = varValue;
  }

  // Replace {{PLACEHOLDER}} with provided values
  const rendered = content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });

  // Template render outputs raw content to stdout (not JSON)
  process.stdout.write(rendered);
  process.exit(0);
}

// ─── Command: status ────────────────────────────────────────────────────────

function handleStatus() {
  const sp = statePath();
  const cp = configPath();

  if (!fs.existsSync(sp) || !fs.existsSync(cp)) {
    process.stdout.write('[Sutando] Not initialized. Run: node sutando-tools.cjs init\n');
    process.exit(1);
  }

  let config, content;
  try {
    config = JSON.parse(fs.readFileSync(cp, 'utf-8'));
    content = fs.readFileSync(sp, 'utf-8');
  } catch (err) {
    errorOut('status_failed', `Failed to read state/config: ${err.message}`);
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const tasks = parseProgressFromBody(body);
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const phase = frontmatter.phase || 'unknown';
  const mode = config.mode || '?';
  const interruption = config.interruption || '?';

  const line = `[Sutando] Phase: ${phase} | Task: ${done}/${total} | Mode: ${mode} | Interruption: ${interruption}`;
  process.stdout.write(line + '\n');
  process.exit(0);
}

// ─── Help ───────────────────────────────────────────────────────────────────

function showHelp() {
  const help = `sutando-tools.cjs — State management CLI for Sutando

Usage:
  node sutando-tools.cjs <command> [subcommand] [options]

Commands:
  init                                    Initialize .sutando/ directory
    --mode <mode>                         Set mode (default: B)
    --interruption <type>                 Set interruption type (default: normal)
    --parallelism <type>                  Set parallelism (default: sequential)

  state get [field]                       Read full state or a specific field
  state set <field> <value>               Update a state field atomically
  state progress                          Update or view task progress
    --task <N> --status <done|pending|in_progress>
    --summary                             Print progress table

  config get [key]                        Read full config or a specific key
  config set <key> <value>                Update a config value

  template render <name>                  Render a template
    --var KEY=VALUE                       Set template variables (repeatable)

  status                                  Quick one-line status summary
`;
  process.stdout.write(help);
  process.exit(0);
}

// ─── Main dispatcher ────────────────────────────────────────────────────────

function main() {
  const { positional, flags } = parseArgs(process.argv);
  const command = positional[0];
  const subcommand = positional[1];

  if (!command || command === 'help' || flags.help) {
    showHelp();
  }

  switch (command) {
    case 'init':
      handleInit(flags);
      break;

    case 'state':
      switch (subcommand) {
        case 'get':
          handleStateGet(positional[2]);
          break;
        case 'set':
          handleStateSet(positional[2], positional[3]);
          break;
        case 'progress':
          handleStateProgress(flags);
          break;
        default:
          errorOut('unknown_subcommand', `Unknown state subcommand: "${subcommand}". Use: get, set, progress`);
      }
      break;

    case 'config':
      switch (subcommand) {
        case 'get':
          handleConfigGet(positional[2]);
          break;
        case 'set':
          handleConfigSet(positional[2], positional[3]);
          break;
        default:
          errorOut('unknown_subcommand', `Unknown config subcommand: "${subcommand}". Use: get, set`);
      }
      break;

    case 'template':
      if (subcommand !== 'render') {
        errorOut('unknown_subcommand', `Unknown template subcommand: "${subcommand}". Use: render`);
      }
      handleTemplateRender(positional[2], flags);
      break;

    case 'status':
      handleStatus();
      break;

    default:
      errorOut('unknown_command', `Unknown command: "${command}". Run with "help" for usage.`);
  }
}

main();
