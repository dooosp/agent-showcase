/**
 * Agent Catalog — filter, search, render cards, detail panel
 */

let allAgents = [];
let activeCategory = 'all';
let activeDeploy = null;
let searchQuery = '';

export function initCatalog(data) {
  allAgents = data.agents;
  buildCategoryTabs(data.categories);
  buildDeployFilters(data.deployTargets);
  render();
}

function buildCategoryTabs(categories) {
  const container = document.getElementById('category-tabs');
  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.category = cat.id;
    btn.textContent = `${cat.icon} ${cat.name} (${cat.count})`;
    btn.addEventListener('click', () => {
      activeCategory = cat.id;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
    container.appendChild(btn);
  }
  // "All" tab click
  container.querySelector('[data-category="all"]').addEventListener('click', () => {
    activeCategory = 'all';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    container.querySelector('[data-category="all"]').classList.add('active');
    render();
  });
}

function buildDeployFilters(targets) {
  const container = document.getElementById('deploy-filters');
  for (const target of targets) {
    const btn = document.createElement('button');
    btn.className = 'deploy-pill';
    btn.textContent = target;
    btn.addEventListener('click', () => {
      if (activeDeploy === target) {
        activeDeploy = null;
        btn.classList.remove('active');
      } else {
        activeDeploy = target;
        document.querySelectorAll('.deploy-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
      }
      render();
    });
    container.appendChild(btn);
  }
}

export function setSearch(q) {
  searchQuery = q.toLowerCase();
  render();
}

function filterAgents() {
  return allAgents.filter(a => {
    if (activeCategory !== 'all' && a.category.toLowerCase() !== activeCategory) return false;
    if (activeDeploy && a.deploy !== activeDeploy) return false;
    if (searchQuery) {
      const haystack = `${a.id} ${a.name} ${a.description} ${a.keywords.join(' ')}`.toLowerCase();
      return haystack.includes(searchQuery);
    }
    return true;
  });
}

function render() {
  const grid = document.getElementById('agent-grid');
  const noResults = document.getElementById('no-results');
  const filtered = filterAgents();

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noResults.hidden = false;
    return;
  }
  noResults.hidden = true;

  grid.innerHTML = filtered.map(a => `
    <div class="agent-card" data-id="${a.id}">
      <div class="card-header">
        <span class="card-icon">${a.categoryIcon}</span>
        <span class="card-name">${a.name}</span>
      </div>
      <p class="card-desc">${a.description}</p>
      <div class="card-meta">
        <span class="badge badge-deploy">${a.deploy}</span>
        ${a.type === 'subagent' ? '<span class="badge badge-subagent">Subagent</span>' : ''}
        ${a.project?.inMaster ? '<span class="badge badge-master">Featured</span>' : ''}
      </div>
      <div class="card-keywords">
        ${a.keywords.slice(0, 4).map(k => `<span class="keyword">${k}</span>`).join('')}
      </div>
    </div>
  `).join('');

  // Card click events
  grid.querySelectorAll('.agent-card').forEach(card => {
    card.addEventListener('click', () => showDetail(card.dataset.id));
  });
}

export function showDetail(id) {
  const agent = allAgents.find(a => a.id === id);
  if (!agent) return;

  const overlay = document.getElementById('detail-overlay');
  const content = document.getElementById('detail-content');

  let html = `
    <h2 class="detail-title">${agent.categoryIcon} ${agent.name}</h2>
    <div class="detail-badges">
      <span class="badge badge-category">${agent.category}</span>
      <span class="badge badge-deploy">${agent.deploy}</span>
      ${agent.type === 'subagent' ? '<span class="badge badge-subagent">Subagent</span>' : ''}
      ${agent.project?.inMaster ? '<span class="badge badge-master">Featured Project</span>' : ''}
    </div>
    <p class="detail-desc">${agent.description}</p>
  `;

  if (agent.subagent) {
    html += `
      <div class="detail-section">
        <h3>Subagent Config</h3>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.5rem;">Model: <strong style="color:var(--purple)">${agent.subagent.model}</strong></p>
        <div class="detail-tools">
          ${agent.subagent.tools.map(t => `<span class="tool-tag">${t}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (agent.usage?.length) {
    html += `
      <div class="detail-section">
        <h3>Usage</h3>
        <ul class="detail-list">
          ${agent.usage.map(u => `<li>${escapeHtml(u)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (agent.project) {
    html += `
      <div class="detail-section">
        <h3>Project Highlights</h3>
        <ul class="detail-highlights">
          ${agent.project.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
        ${agent.project.tags?.length ? `
          <div class="card-keywords" style="margin-top:0.5rem">
            ${agent.project.tags.map(t => `<span class="keyword">${t}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  if (agent.connections?.length) {
    html += `
      <div class="detail-section">
        <h3>Connected Agents</h3>
        <div class="detail-connections">
          ${agent.connections.map(c => {
            const connected = allAgents.find(a => a.id === c);
            const label = connected ? connected.name : c;
            return `<span class="detail-conn-link" data-conn-id="${c}">${label}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  content.innerHTML = html;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Update URL hash
  history.replaceState(null, '', `#agent/${id}`);

  // Connection link clicks
  content.querySelectorAll('.detail-conn-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      showDetail(link.dataset.connId);
    });
  });
}

export function hideDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
  document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
