/**
 * router.js — Hash-based SPA Router
 */

const routes = {};
let currentPage = null;

function register(hash, renderFn) {
  routes[hash] = renderFn;
}

function navigate(hash) {
  window.location.hash = hash;
}

function handleRoute() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const renderFn = routes[hash] || routes['dashboard'];

  // Update nav item active states
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === hash);
  });

  // Render the page with crisp mechanical entrance animation
  const content = document.getElementById('page-content');
  if (content && renderFn) {
    content.innerHTML = '';
    content.classList.remove('page-enter');
    void content.offsetWidth;
    content.classList.add('page-enter');
    currentPage = hash;
    renderFn(content);
  }
}

function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
