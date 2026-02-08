/**
 * Architecture Diagram — SVG layout with category groups, edges, interactions
 */

import { showDetail } from './catalog.js';

const GROUP_LAYOUT = [
  { category: 'Production',     col: 1, row: 0 },
  { category: 'Infrastructure', col: 0, row: 1 },
  { category: 'Finance',        col: 1, row: 1 },
  { category: 'Orchestration',  col: 2, row: 1 },
  { category: 'Business',       col: 0, row: 2 },
  { category: 'Development',    col: 1, row: 2 },
  { category: 'Content',        col: 2, row: 2 },
  { category: 'Analytics',      col: 0, row: 3 },
  { category: 'Learning',       col: 2, row: 3 },
];

const GROUP_COLORS = {
  Production: '#e74c3c',
  Infrastructure: '#3498db',
  Content: '#2ecc71',
  Development: '#9b59b6',
  Business: '#e67e22',
  Finance: '#f1c40f',
  Analytics: '#1abc9c',
  Learning: '#e91e63',
  Orchestration: '#607d8b',
};

const NODE_W = 140;
const NODE_H = 28;
const GROUP_PAD = 16;
const COL_W = 360;
const ROW_H = 220;
const MARGIN = { top: 30, left: 30 };

let nodePositions = {};

export function initArchitecture(data) {
  const container = document.getElementById('arch-container');
  container.innerHTML = `
    <div class="arch-svg-wrap"></div>
    <div class="arch-list-wrap"></div>
  `;
  buildSVG(data, container.querySelector('.arch-svg-wrap'));
  buildList(data, container.querySelector('.arch-list-wrap'));
}

function buildSVG(data, wrapper) {
  const agents = data.agents;
  const groups = {};
  for (const a of agents) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }

  // Calculate node positions
  nodePositions = {};
  for (const gl of GROUP_LAYOUT) {
    const groupAgents = groups[gl.category] || [];
    const gx = MARGIN.left + gl.col * COL_W;
    const gy = MARGIN.top + gl.row * ROW_H;

    const cols = Math.min(groupAgents.length, 2);
    groupAgents.forEach((a, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      nodePositions[a.id] = {
        x: gx + GROUP_PAD + col * (NODE_W + 10),
        y: gy + 30 + row * (NODE_H + 6),
        category: a.category
      };
    });
  }

  // SVG dimensions
  const maxX = Math.max(...Object.values(nodePositions).map(p => p.x)) + NODE_W + MARGIN.left + 40;
  const maxY = Math.max(...Object.values(nodePositions).map(p => p.y)) + NODE_H + MARGIN.top + 40;

  // Build connection list (bidirectional deduped)
  const connections = [];
  const connSet = new Set();
  for (const a of agents) {
    if (!a.connections) continue;
    for (const toId of a.connections) {
      const key = [a.id, toId].sort().join('|');
      if (connSet.has(key)) continue;
      if (nodePositions[a.id] && nodePositions[toId]) {
        connSet.add(key);
        connections.push({ from: a.id, to: toId });
      }
    }
  }

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" style="width:100%;height:auto;">`;
  svg += `<defs><marker id="arrow" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#30363d"/></marker></defs>`;

  // Group backgrounds
  for (const gl of GROUP_LAYOUT) {
    const groupAgents = groups[gl.category] || [];
    if (groupAgents.length === 0) continue;
    const gx = MARGIN.left + gl.col * COL_W;
    const gy = MARGIN.top + gl.row * ROW_H;
    const cols = Math.min(groupAgents.length, 2);
    const rows = Math.ceil(groupAgents.length / cols);
    const gw = cols * (NODE_W + 10) + GROUP_PAD * 2 - 10;
    const gh = rows * (NODE_H + 6) + 40;
    const color = GROUP_COLORS[gl.category];
    svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="8" fill="${color}10" stroke="${color}40" stroke-width="1"/>`;
    svg += `<text x="${gx + 8}" y="${gy + 18}" class="arch-group-label" fill="${color}">${gl.category}</text>`;
  }

  // Edges
  for (const conn of connections) {
    const from = nodePositions[conn.from];
    const to = nodePositions[conn.to];
    if (!from || !to) continue;
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y + NODE_H / 2;
    svg += `<line class="arch-edge" data-from="${conn.from}" data-to="${conn.to}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#30363d" stroke-width="1" opacity="0.4"/>`;
  }

  // Nodes
  for (const a of agents) {
    const pos = nodePositions[a.id];
    if (!pos) continue;
    const color = GROUP_COLORS[a.category] || '#888';
    svg += `<g class="arch-node" data-id="${a.id}">`;
    svg += `<rect x="${pos.x}" y="${pos.y}" width="${NODE_W}" height="${NODE_H}" rx="4" fill="#161b22" stroke="${color}" stroke-width="1"/>`;
    const label = a.name.length > 18 ? a.name.substring(0, 16) + '..' : a.name;
    svg += `<text x="${pos.x + 8}" y="${pos.y + 18}" font-size="11" fill="#e6edf3" font-family="'SF Mono','Cascadia Code',monospace">${label}</text>`;
    svg += `</g>`;
  }

  svg += `</svg>`;
  wrapper.innerHTML = svg;

  // Interactions
  const svgEl = wrapper.querySelector('svg');
  const nodes = svgEl.querySelectorAll('.arch-node');
  const edges = svgEl.querySelectorAll('.arch-edge');

  nodes.forEach(node => {
    const id = node.dataset.id;

    node.addEventListener('mouseenter', () => {
      const connected = new Set();
      connected.add(id);
      edges.forEach(edge => {
        if (edge.dataset.from === id || edge.dataset.to === id) {
          connected.add(edge.dataset.from);
          connected.add(edge.dataset.to);
          edge.classList.add('arch-highlighted');
          edge.style.stroke = '#58a6ff';
          edge.style.strokeWidth = '2';
          edge.style.opacity = '1';
        } else {
          edge.classList.remove('arch-highlighted');
          edge.style.opacity = '0.08';
        }
      });
      nodes.forEach(n => {
        n.classList.toggle('arch-dimmed', !connected.has(n.dataset.id));
      });
    });

    node.addEventListener('mouseleave', () => {
      nodes.forEach(n => n.classList.remove('arch-dimmed'));
      edges.forEach(e => {
        e.classList.remove('arch-highlighted');
        e.style.stroke = '#30363d';
        e.style.strokeWidth = '1';
        e.style.opacity = '0.4';
      });
    });

    node.addEventListener('click', () => showDetail(id));
  });
}

function buildList(data, wrapper) {
  const groups = {};
  for (const a of data.agents) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }

  let html = '<div class="arch-list">';
  for (const gl of GROUP_LAYOUT) {
    const agents = groups[gl.category] || [];
    if (agents.length === 0) continue;
    const color = GROUP_COLORS[gl.category];
    html += `<div class="arch-list-group"><h3>${gl.category}</h3>`;
    for (const a of agents) {
      html += `<div class="arch-list-item" data-id="${a.id}">`;
      html += `<span class="arch-list-dot" style="background:${color}"></span>`;
      html += `<span>${a.name}</span>`;
      if (a.connections?.length) html += `<span style="color:var(--text-dim);font-size:0.75rem;margin-left:auto">${a.connections.length} conn</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += '</div>';
  wrapper.innerHTML = html;

  wrapper.querySelectorAll('.arch-list-item').forEach(item => {
    item.addEventListener('click', () => showDetail(item.dataset.id));
  });
}
