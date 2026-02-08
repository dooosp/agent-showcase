#!/usr/bin/env node
/**
 * Build data pipeline: merge 3 sources → agents.json + data.js
 * Sources:
 *   1. ~/telegram-bot-agent/lib/agent-catalog.js → 47 agents
 *   2. ~/.claude/agents/*.md → 32 subagent YAML frontmatter
 *   3. ~/portfolio/catalog.yml → 20 project highlights/tags
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const HOME = process.env.HOME || '/home/taeho';
const ROOT = resolve(import.meta.dirname, '..');

// ── Source 1: Agent catalog (parse JS object literal) ──
function parseCatalog() {
  const src = readFileSync(join(HOME, 'telegram-bot-agent/lib/agent-catalog.js'), 'utf8');
  const agents = [];
  const regex = /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*category:\s*'([^']+)',\s*desc:\s*'([^']*)'(?:,\s*deploy:\s*'([^']*)')?/g;
  let m;
  while ((m = regex.exec(src)) !== null) {
    const [, id, name, category, desc, deploy] = m;
    // Extract keywords
    const kwMatch = src.substring(m.index).match(/keywords:\s*\[([^\]]+)\]/);
    const keywords = kwMatch
      ? kwMatch[1].match(/'([^']+)'/g)?.map(k => k.replace(/'/g, '')) || []
      : [];
    // Extract usage
    const usageMatch = src.substring(m.index).match(/usage:\s*\[([\s\S]*?)\]/);
    const usage = usageMatch
      ? usageMatch[1].match(/'([^']+)'/g)?.map(u => u.replace(/'/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')) || []
      : [];
    agents.push({ id, name, category, desc, deploy: deploy || 'Local', usage, keywords });
  }
  return agents;
}

// ── Source 2: Subagent .md files (YAML frontmatter) ──
function parseSubagents() {
  const dir = join(HOME, '.claude/agents');
  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  const subs = {};
  for (const f of files) {
    const content = readFileSync(join(dir, f), 'utf8');
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const yaml = fm[1];
    const name = yaml.match(/name:\s*(.+)/)?.[1]?.trim();
    const tools = yaml.match(/tools:\s*(.+)/)?.[1]?.trim();
    const model = yaml.match(/model:\s*(.+)/)?.[1]?.trim();
    if (name) {
      subs[name] = {
        model: model || 'sonnet',
        tools: tools ? tools.split(',').map(t => t.trim()) : []
      };
    }
  }
  return subs;
}

// ── Source 3: Portfolio catalog.yml (simple parse) ──
function parsePortfolio() {
  const src = readFileSync(join(HOME, 'portfolio/catalog.yml'), 'utf8');
  const projects = {};
  const blocks = src.split(/\n  - id: /).slice(1);
  for (const block of blocks) {
    const id = block.match(/^(\S+)/)?.[1];
    if (!id) continue;
    const title = block.match(/title:\s*(.+)/)?.[1]?.trim();
    const oneliner = block.match(/oneliner:\s*(.+)/)?.[1]?.trim();
    const inMaster = block.includes('in_master: true');
    const highlights = [];
    const hlMatch = block.match(/highlights:\s*\n((?:\s+- .+\n?)+)/);
    if (hlMatch) {
      const lines = hlMatch[1].match(/- (.+)/g);
      if (lines) lines.forEach(l => highlights.push(l.replace(/^- /, '')));
    }
    const tags = [];
    const techMatch = block.match(/기술:\s*\[([^\]]+)\]/);
    if (techMatch) tags.push(...techMatch[1].split(',').map(t => t.trim()));
    projects[id] = { title, oneliner, highlights, tags, inMaster };
  }
  return projects;
}

// ── Category icons ──
const CATEGORY_ICONS = {
  Production: '🏭',
  Infrastructure: '🔧',
  Content: '📝',
  Development: '💻',
  Business: '💼',
  Finance: '💰',
  Analytics: '📊',
  Learning: '📚',
  Orchestration: '🔗'
};

// ── Deploy targets ──
const DEPLOY_NORMALIZE = {
  'Railway': 'Railway',
  'Render + GitHub Pages': 'Render',
  'Render': 'Render',
  'Cloudflare Worker': 'Cloudflare',
  'WSL systemd': 'WSL',
  '로컬': 'Local',
  'Local': 'Local'
};

// ── Build ──
function build() {
  const translations = JSON.parse(readFileSync(join(ROOT, 'scripts/translations.json'), 'utf8'));
  const archMap = JSON.parse(readFileSync(join(ROOT, 'scripts/architecture-map.json'), 'utf8'));

  const catalogAgents = parseCatalog();
  const subagents = parseSubagents();
  const portfolio = parsePortfolio();

  // Build connection index
  const connectionIndex = {};
  for (const conn of archMap.connections) {
    if (!connectionIndex[conn.from]) connectionIndex[conn.from] = new Set();
    for (const to of conn.to) {
      connectionIndex[conn.from].add(to);
      if (!connectionIndex[to]) connectionIndex[to] = new Set();
      connectionIndex[to].add(conn.from);
    }
  }

  // Merge
  const agents = catalogAgents.map(a => {
    const sub = subagents[a.id];
    const proj = portfolio[a.id];
    const conns = connectionIndex[a.id] ? [...connectionIndex[a.id]] : [];
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      categoryIcon: CATEGORY_ICONS[a.category] || '📦',
      description: translations[a.id] || a.desc,
      deploy: DEPLOY_NORMALIZE[a.deploy] || a.deploy,
      usage: a.usage,
      keywords: a.keywords.filter(k => !/[\u3131-\uD79D]/.test(k)),
      type: sub ? 'subagent' : 'standalone',
      subagent: sub || null,
      project: proj ? {
        title: proj.title,
        highlights: proj.highlights,
        tags: proj.tags,
        inMaster: proj.inMaster
      } : null,
      connections: conns
    };
  });

  // Categories
  const catCounts = {};
  for (const a of agents) {
    catCounts[a.category] = (catCounts[a.category] || 0) + 1;
  }
  const categories = Object.entries(catCounts).map(([name, count]) => ({
    id: name.toLowerCase(),
    name,
    icon: CATEGORY_ICONS[name] || '📦',
    count
  }));

  // Unique deploy targets
  const deployTargets = [...new Set(agents.map(a => a.deploy))].sort();

  // Meta
  const meta = {
    generatedAt: new Date().toISOString(),
    counts: {
      agents: agents.length,
      subagents: agents.filter(a => a.type === 'subagent').length,
      projects: agents.filter(a => a.project).length,
      categories: categories.length,
      deployTargets: deployTargets.length
    }
  };

  const data = { meta, categories, deployTargets, agents };

  // Write agents.json
  writeFileSync(join(ROOT, 'public/data/agents.json'), JSON.stringify(data, null, 2));

  // Write data.js (inline for zero network requests)
  writeFileSync(join(ROOT, 'public/js/data.js'), `// Auto-generated by build-data.js — do not edit\nexport const DATA = ${JSON.stringify(data)};\n`);

  console.log(`Built: ${agents.length} agents, ${categories.length} categories, ${meta.counts.subagents} subagents, ${meta.counts.projects} projects`);
  console.log(`Deploy targets: ${deployTargets.join(', ')}`);
}

build();
