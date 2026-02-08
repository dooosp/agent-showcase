/**
 * App entry point — init, routing, counter animation
 */

import { DATA } from './data.js';
import { initCatalog, setSearch, showDetail, hideDetail } from './catalog.js';
import { initArchitecture } from './architecture.js';

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initCatalog(DATA);
  initArchitecture(DATA);
  initSearch();
  initDetailEvents();
  initCounterAnimation();
  initFooter();
  handleRoute();
});

// ── Search ──
function initSearch() {
  const input = document.getElementById('search');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => setSearch(input.value), 200);
  });
}

// ── Detail panel events ──
function initDetailEvents() {
  document.getElementById('detail-close').addEventListener('click', hideDetail);
  document.getElementById('detail-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideDetail();
  });
}

// ── Counter animation with IntersectionObserver ──
function initCounterAnimation() {
  const stats = document.getElementById('stats');
  let animated = false;

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !animated) {
      animated = true;
      animateCounters();
    }
  }, { threshold: 0.5 });

  observer.observe(stats);
}

function animateCounters() {
  document.querySelectorAll('.stat').forEach(stat => {
    const target = parseInt(stat.dataset.target, 10);
    const numEl = stat.querySelector('.stat-num');
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      numEl.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// ── Hash routing ──
function handleRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#agent/')) {
    const id = hash.replace('#agent/', '');
    showDetail(id);
  }
}

window.addEventListener('hashchange', handleRoute);

// ── Footer ──
function initFooter() {
  const meta = document.getElementById('footer-meta');
  const date = new Date(DATA.meta.generatedAt);
  meta.textContent = `Data generated: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}
