#!/usr/bin/env node

// install.mjs — Zero-dependency universal skill installer
// Reads skill.yaml, detects coding agents, renders templates, writes config files.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── ANSI colors ──────────────────────────────────────────────────────────────

const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

const ok   = msg => console.log(`  ${C.green('✓')} ${msg}`);
const warn = msg => console.log(`  ${C.yellow('⚠')} ${msg}`);
const err  = msg => console.log(`  ${C.red('✗')} ${msg}`);
const info = msg => console.log(`  ${C.cyan('•')} ${msg}`);

// ── Minimal YAML parser ─────────────────────────────────────────────────────
// Handles: scalars, quoted strings, lists (- items and [inline]), nested maps.
// Does NOT handle: anchors, aliases, multi-doc, complex keys.

function parseYaml(text) {
  const lines = text.split('\n');
  return parseBlock(lines, 0, 0).value;
}

function parseBlock(lines, start, baseIndent) {
  const result = {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.replace(/\s+$/, '');

    // Skip blanks and comments
    if (stripped === '' || stripped.trimStart().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent < baseIndent) break; // dedented — done with this block
    if (indent > baseIndent && i > start) break; // deeper indent — let caller handle

    // List item at this indent?
    const listMatch = line.match(/^(\s*)- (.*)$/);
    if (listMatch && listMatch[1].length === baseIndent) {
      // This key's value is a list — but we need the key from the parent.
      // Actually, bare list items mean we're inside a list context.
      break; // Let the parent handle list parsing
    }

    // Key: value
    const kvMatch = line.match(/^(\s*)([\w._-]+)\s*:\s*(.*)$/);
    if (!kvMatch || kvMatch[1].length !== baseIndent) { i++; continue; }

    const key = kvMatch[2];
    let val = kvMatch[3].replace(/\s+$/, '');

    // Remove inline comment
    if (val && !val.startsWith('"') && !val.startsWith("'")) {
      val = val.replace(/\s+#.*$/, '');
    }

    if (val === '' || val === '|' || val === '>') {
      // Check if next line is a list or a nested map
      const nextNonEmpty = findNextNonEmpty(lines, i + 1);
      if (nextNonEmpty < lines.length) {
        const nextIndent = lines[nextNonEmpty].search(/\S/);
        const nextLine = lines[nextNonEmpty].trimStart();

        if (nextLine.startsWith('- ')) {
          // List
          const listResult = parseList(lines, nextNonEmpty, nextIndent);
          result[key] = listResult.value;
          i = listResult.next;
          continue;
        } else if (val === '>' || val === '|') {
          // Block scalar
          const scalarResult = parseBlockScalar(lines, i + 1, nextIndent, val);
          result[key] = scalarResult.value;
          i = scalarResult.next;
          continue;
        } else {
          // Nested map
          const nested = parseBlock(lines, nextNonEmpty, nextIndent);
          result[key] = nested.value;
          i = nested.next;
          continue;
        }
      }
      result[key] = '';
      i++;
    } else if (val.startsWith('[')) {
      // Inline list
      result[key] = parseInlineList(val);
      i++;
    } else if (val.startsWith('{')) {
      result[key] = parseInlineMap(val);
      i++;
    } else {
      result[key] = unquote(val);
      i++;
    }
  }

  return { value: result, next: i };
}

function parseList(lines, start, baseIndent) {
  const result = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.replace(/\s+$/, '');
    if (stripped === '' || stripped.trimStart().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent < baseIndent) break;

    const listMatch = line.match(/^(\s*)- (.*)$/);
    if (!listMatch || listMatch[1].length !== baseIndent) break;

    const itemVal = listMatch[2].replace(/\s+$/, '');

    // Check if this list item has nested content (map)
    const nextNonEmpty = findNextNonEmpty(lines, i + 1);
    if (nextNonEmpty < lines.length) {
      const nextIndent = lines[nextNonEmpty].search(/\S/);
      const nextLine = lines[nextNonEmpty].trimStart();

      // If item value contains a colon, it's a key:value in the first line of a map
      const itemKV = itemVal.match(/^([\w._-]+)\s*:\s*(.*)$/);
      if (itemKV) {
        // Map item — first key is on this line, rest may follow
        const mapObj = {};
        mapObj[itemKV[1]] = unquote(itemKV[2].replace(/\s+$/, ''));

        if (nextIndent >= baseIndent + 2) {
          // More keys follow at deeper indent
          const rest = parseBlock(lines, nextNonEmpty, nextIndent);
          Object.assign(mapObj, rest.value);
          i = rest.next;
        } else {
          i++;
        }
        result.push(mapObj);
        continue;
      }
    }

    // Simple scalar item
    result.push(unquote(itemVal));
    i++;
  }

  return { value: result, next: i };
}

function parseBlockScalar(lines, start, baseIndent, style) {
  const parts = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.replace(/\s+$/, '') === '') { parts.push(''); i++; continue; }
    const indent = line.search(/\S/);
    if (indent < baseIndent) break;
    parts.push(line.slice(baseIndent));
    i++;
  }
  const joined = style === '>' ? parts.join(' ').replace(/\s+/g, ' ').trim() : parts.join('\n').trim();
  return { value: joined, next: i };
}

function parseInlineList(str) {
  const inner = str.replace(/^\[/, '').replace(/\]$/, '');
  if (inner.trim() === '') return [];
  return inner.split(',').map(s => unquote(s.trim()));
}

function parseInlineMap(str) {
  const inner = str.replace(/^\{/, '').replace(/\}$/, '');
  const result = {};
  for (const pair of inner.split(',')) {
    const [k, ...rest] = pair.split(':');
    if (k) result[k.trim()] = unquote(rest.join(':').trim());
  }
  return result;
}

function unquote(s) {
  if (!s) return '';
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function findNextNonEmpty(lines, start) {
  let i = start;
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trimStart().startsWith('#'))) i++;
  return i;
}

// ── Template rendering ──────────────────────────────────────────────────────

function renderTemplate(template, context) {
  let output = template;

  // Handle {{#each <array>}} ... {{/each}} blocks
  output = output.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, arrayKey, body) => {
    const items = context[arrayKey];
    if (!Array.isArray(items)) return '';
    return items.map((item, idx) => {
      let rendered = body;
      if (typeof item === 'object') {
        for (const [k, v] of Object.entries(item)) {
          const val = Array.isArray(v) ? v.join(', ') : String(v ?? '');
          rendered = rendered.replaceAll(`{{${arrayKey}.${k}}}`, val);
          rendered = rendered.replaceAll(`{{item.${k}}}`, val);
        }
      } else {
        rendered = rendered.replaceAll('{{this}}', String(item));
      }
      rendered = rendered.replaceAll('{{@index}}', String(idx));
      return rendered;
    }).join('');
  });

  // Handle {{PROMPTS_BLOCK}} — generates a prompt summary block
  if (output.includes('{{PROMPTS_BLOCK}}') && context.prompts) {
    const block = context.prompts.map(p =>
      `- **${p.id}**: ${p.description}${p.variables ? ` (variables: ${Array.isArray(p.variables) ? p.variables.join(', ') : p.variables})` : ''}`
    ).join('\n');
    output = output.replaceAll('{{PROMPTS_BLOCK}}', block);
  }

  // Handle {{TRIGGERS_BLOCK}} — generates trigger list
  if (output.includes('{{TRIGGERS_BLOCK}}') && context.triggers) {
    const block = context.triggers.map(t => `- "${t}"`).join('\n');
    output = output.replaceAll('{{TRIGGERS_BLOCK}}', block);
  }

  // Handle {{PARAMETERS_BLOCK}} — generates parameter docs
  if (output.includes('{{PARAMETERS_BLOCK}}') && context.parameters) {
    const block = context.parameters.map(p => {
      const parts = [`- **${p.name}**`];
      if (p.type) parts.push(`(${p.type})`);
      if (p.description) parts.push(`— ${p.description}`);
      if (p.default !== undefined) parts.push(`[default: ${p.default}]`);
      if (p.required) parts.push(`*required*`);
      return parts.join(' ');
    }).join('\n');
    output = output.replaceAll('{{PARAMETERS_BLOCK}}', block);
  }

  // Simple {{variable}} replacement — supports dot notation
  output = output.replace(/\{\{([\w._-]+)\}\}/g, (match, key) => {
    const val = resolveDot(context, key);
    if (val === undefined) return match; // leave unknown placeholders
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  });

  return output;
}

function resolveDot(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}

// ── File utilities ──────────────────────────────────────────────────────────

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function writeFileSafe(filepath, content) {
  ensureDir(dirname(filepath));
  writeFileSync(filepath, content, 'utf8');
}

function copyDirRecursive(src, dest) {
  const files = [];
  if (!existsSync(src)) return files;
  ensureDir(dest);
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      files.push(...copyDirRecursive(srcPath, destPath));
    } else {
      copyFileSync(srcPath, destPath);
      files.push(destPath);
    }
  }
  return files;
}

function removeEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) removeEmptyDirs(full);
    }
    if (readdirSync(dir).length === 0) rmSync(dir);
  } catch { /* ignore */ }
}

// ── Agent detection ─────────────────────────────────────────────────────────

const AGENT_SIGNALS = {
  copilot: ['.github', '.github/copilot-instructions.md'],
};

function detectAgents(targetDir) {
  const found = [];
  for (const [agent, signals] of Object.entries(AGENT_SIGNALS)) {
    if (signals.some(s => existsSync(join(targetDir, s)))) {
      found.push(agent);
    }
  }
  return found.length > 0 ? found : ['copilot'];
}

// ── CLI argument parser ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { command: null, agent: null, target: process.cwd(), help: false };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { args.help = true; }
    else if (arg === '--agent' || arg === '-a') { args.agent = argv[++i]; }
    else if (arg === '--target' || arg === '-t') { args.target = resolve(argv[++i] || '.'); }
    else if (!arg.startsWith('-')) { positional.push(arg); }
  }

  args.command = positional[0] || null;
  return args;
}

// ── Help text ───────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${C.bold('a11y-scan-skill')} — Universal skill installer for coding agents

${C.bold('USAGE')}
  node install.mjs ${C.cyan('install')}  [--agent copilot|generic|all] [--target <dir>]
  node install.mjs ${C.cyan('uninstall')} [--target <dir>]

${C.bold('OPTIONS')}
  --agent, -a   Target agent (default: auto-detect)
  --target, -t  Target project directory (default: cwd)
  --help, -h    Show this help

${C.bold('EXAMPLES')}
  npx @anthropic/a11y-scan install                  ${C.dim('# auto-detect agents')}
  npx @anthropic/a11y-scan install --agent copilot   ${C.dim('# copilot only')}
  npx @anthropic/a11y-scan install --agent generic    ${C.dim('# generic only')}
  npx @anthropic/a11y-scan install --agent all        ${C.dim('# all agents')}
  npx @anthropic/a11y-scan uninstall                 ${C.dim('# remove all installed files')}
`);
}

// ── Install logic ───────────────────────────────────────────────────────────

function loadManifest(pkgDir) {
  const yamlPath = join(pkgDir, 'skill.yaml');
  if (!existsSync(yamlPath)) {
    err(`skill.yaml not found in ${pkgDir}`);
    process.exit(2);
  }
  return parseYaml(readFileSync(yamlPath, 'utf8'));
}

function loadPromptContent(pkgDir, prompts) {
  return prompts.map(p => {
    const filePath = join(pkgDir, p.file);
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf8');
      // Strip YAML frontmatter
      const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      return { ...p, content: match ? match[1].trim() : raw.trim() };
    }
    return { ...p, content: '' };
  });
}

function installSkill(pkgDir, targetDir, agentNames, manifest) {
  const skillName = manifest.name;
  const installedFiles = [];

  console.log(`\n${C.bold(`Installing ${C.cyan(manifest.display_name || skillName)} v${manifest.version}`)}\n`);

  // 1. Load prompts with content for template rendering (needed before agent templates)
  const promptsWithContent = loadPromptContent(pkgDir, manifest.prompts || []);

  // Build template context — skill_path points to .github/skills/{name}
  const skillPath = `.github/skills/${skillName}`;
  const ctx = {
    ...manifest,
    skill_path: skillPath,
    triggers: manifest.triggers || [],
    parameters: manifest.parameters || [],
    prompts: promptsWithContent,
  };

  // 4. Render agent templates
  for (const agent of agentNames) {
    info(`Configuring for ${C.bold(agent)}...`);
    const agentDir = join(pkgDir, 'agents', agent);

    if (!existsSync(agentDir)) {
      warn(`No templates found for agent '${agent}' — skipping`);
      continue;
    }

    // Load _config.json
    const configPath = join(agentDir, '_config.json');
    let config = { templates: {} };
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, 'utf8'));
      } catch (e) {
        warn(`Invalid _config.json for ${agent}: ${e.message}`);
        continue;
      }
    } else {
      // Auto-discover templates: any file that isn't _config.json
      const entries = readdirSync(agentDir).filter(f => f !== '_config.json');
      for (const entry of entries) {
        config.templates[entry] = { output: `.skills/${skillName}/agents/${agent}/${entry}` };
      }
      if (Object.keys(config.templates).length === 0) {
        warn(`No templates in agents/${agent}/ — skipping`);
        continue;
      }
    }

    for (const [templateFile, templateCfg] of Object.entries(config.templates || {})) {
      const templatePath = join(agentDir, templateFile);
      if (!existsSync(templatePath)) {
        warn(`Template file ${templateFile} not found — skipping`);
        continue;
      }
      const templateContent = readFileSync(templatePath, 'utf8');

      if (templateCfg.per_prompt) {
        // Render once per prompt
        for (const prompt of promptsWithContent) {
          const promptCtx = { ...ctx, prompt };
          let outPath = templateCfg.output;
          outPath = outPath.replaceAll('{{name}}', skillName);
          outPath = outPath.replaceAll('{{prompt.id}}', prompt.id);
          const rendered = renderTemplate(templateContent, promptCtx);
          const fullPath = join(targetDir, outPath);
          writeFileSafe(fullPath, rendered);
          const rel = relative(targetDir, fullPath);
          installedFiles.push(rel);
          ok(`${C.dim(rel)}`);
        }
      } else {
        // Render once with full context
        let outPath = templateCfg.output;
        outPath = outPath.replaceAll('{{name}}', skillName);
        const rendered = renderTemplate(templateContent, ctx);
        const fullPath = join(targetDir, outPath);
        writeFileSafe(fullPath, rendered);
        const rel = relative(targetDir, fullPath);
        installedFiles.push(rel);
        ok(`${C.dim(rel)}`);
      }
    }
  }

  // 5. Copy scripts and prompts into .github/skills/{name}/
  info('Copying runtime scripts...');
  const scriptsDir = join(pkgDir, 'scripts');
  const destScriptsDir = join(targetDir, skillPath, 'scripts');
  const scriptFiles = copyDirRecursive(scriptsDir, destScriptsDir);
  for (const f of scriptFiles) {
    const rel = relative(targetDir, f);
    installedFiles.push(rel);
    ok(`${C.dim(rel)}`);
  }

  info('Copying prompt templates...');
  const promptsDir = join(pkgDir, 'prompts');
  const destPromptsDir = join(targetDir, skillPath, 'prompts');
  const promptFiles = copyDirRecursive(promptsDir, destPromptsDir);
  for (const f of promptFiles) {
    const rel = relative(targetDir, f);
    installedFiles.push(rel);
    ok(`${C.dim(rel)}`);
  }

  // 6. Write lockfile
  const lockfile = {
    name: skillName,
    version: String(manifest.version),
    installed_at: new Date().toISOString(),
    agents: agentNames,
    files: installedFiles,
  };
  const lockPath = join(targetDir, skillPath, 'skill.lock');
  writeFileSafe(lockPath, JSON.stringify(lockfile, null, 2) + '\n');
  ok(`Wrote ${C.dim(relative(targetDir, lockPath))}`);

  console.log(`\n${C.green('✓')} ${C.bold('Done!')} Installed ${C.cyan(skillName)} for ${agentNames.map(a => C.bold(a)).join(', ')}\n`);
}

// ── Uninstall logic ─────────────────────────────────────────────────────────

function uninstallSkill(targetDir, skillName) {
  const skillDir = join(targetDir, '.skills', skillName);
  const lockPath = join(skillDir, 'skill.lock');

  console.log(`\n${C.bold(`Uninstalling ${C.cyan(skillName)}`)}\n`);

  if (!existsSync(lockPath)) {
    err(`No skill.lock found at ${relative(targetDir, lockPath)}`);
    err('Cannot uninstall — skill may not be installed or was installed manually.');
    process.exit(1);
  }

  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  let removed = 0;
  let missing = 0;

  for (const relPath of lock.files) {
    const fullPath = join(targetDir, relPath);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
      ok(`Removed ${C.dim(relPath)}`);
      removed++;
    } else {
      warn(`Already gone: ${C.dim(relPath)}`);
      missing++;
    }
  }

  // Remove lockfile itself
  unlinkSync(lockPath);
  ok(`Removed ${C.dim(relative(targetDir, lockPath))}`);

  // Clean up empty directories (skill dir + any agent dirs we created)
  const dirsToClean = new Set();
  for (const relPath of lock.files) {
    let dir = dirname(join(targetDir, relPath));
    while (dir !== targetDir && dir !== dirname(dir)) {
      dirsToClean.add(dir);
      dir = dirname(dir);
    }
  }
  dirsToClean.add(skillDir);
  // Sort deepest-first so children are removed before parents
  const sorted = [...dirsToClean].sort((a, b) => b.length - a.length);
  for (const dir of sorted) {
    try {
      if (existsSync(dir) && statSync(dir).isDirectory() && readdirSync(dir).length === 0) {
        rmSync(dir, { recursive: true });
      }
    } catch { /* ignore */ }
  }
  const skillsRoot = join(targetDir, '.skills');
  try {
    if (existsSync(skillsRoot) && readdirSync(skillsRoot).length === 0) {
      rmSync(skillsRoot, { recursive: true });
    }
  } catch { /* ignore */ }

  console.log(`\n${C.green('✓')} ${C.bold('Done!')} Removed ${removed} files${missing > 0 ? ` (${missing} already missing)` : ''}\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const targetDir = resolve(args.target);
  const pkgDir = __dirname;
  const manifest = loadManifest(pkgDir);

  switch (args.command) {
    case 'install': {
      let agents;
      if (args.agent === 'all') {
        agents = ['copilot', 'generic'];
      } else if (args.agent) {
        agents = [args.agent];
      } else {
        agents = detectAgents(targetDir);
        info(`Auto-detected agent(s): ${agents.map(a => C.bold(a)).join(', ')}`);
      }
      installSkill(pkgDir, targetDir, agents, manifest);
      break;
    }

    case 'uninstall': {
      uninstallSkill(targetDir, manifest.name);
      break;
    }

    default:
      err(`Unknown command: ${args.command}`);
      printHelp();
      process.exit(1);
  }
}

main();
