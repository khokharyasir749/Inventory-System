/**
 * tour.js — Interactive Sales Presentation Tour Engine
 * Walks client prospects through 6 core business value modules with interactive callouts
 */

const TOUR_STEPS = [
  {
    route: 'dashboard',
    title: '1. Executive SaaS Dashboard',
    desc: 'Provides real-time visibility into daily revenue, gross profit margin (Revenue - COGS), stock valuations, and expiring batch alerts.'
  },
  {
    route: 'inventory',
    title: '2. Product Catalog & Margins',
    desc: 'Switch seamlessly between Grid cards and compact Data Tables. Monitor live margin percentages, stock progress bars, and BOM composite recipes.'
  },
  {
    route: 'pos',
    title: '3. Touch-First Point of Sale',
    desc: 'Process sales in seconds with 1-tap popular item grids, instant discount presets (5%, 10%, 15%), and thermal receipt printing with dynamic QR codes.'
  },
  {
    route: 'customers',
    title: '4. Customer Credit & Ledgers',
    desc: 'Eliminate untracked debt. Allow credit purchases, record cash payoffs, and generate detailed customer ledger statements.'
  },
  {
    route: 'reports',
    title: '5. Audit Trails & Export',
    desc: 'Export clean CSV reports, audit inventory movement logs, and perform full database backups for multi-device deployment.'
  },
  {
    route: 'analytics',
    title: '6. Sales Trends & Category Profitability',
    desc: 'Track sales trends over time, evaluate top-performing categories, and make data-driven purchasing decisions.'
  }
];

let currentTourStep = 0;
let tourBannerEl = null;

function initTourBanner() {
  if (document.getElementById('zeploy-tour-banner')) return;

  tourBannerEl = document.createElement('div');
  tourBannerEl.id = 'zeploy-tour-banner';
  tourBannerEl.className = 'no-print';
  tourBannerEl.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10000;
    width: 380px;
    background: var(--surface);
    color: var(--text-primary);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-strong);
    display: none;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  document.body.appendChild(tourBannerEl);
}

function renderTourStep() {
  initTourBanner();
  const step = TOUR_STEPS[currentTourStep];
  if (!step) return;

  // Navigate to step route
  if (window.navigate) {
    window.navigate(step.route);
  }

  tourBannerEl.style.display = 'block';
  tourBannerEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span class="badge badge-primary" style="font-size:0.75rem;padding:2px 8px">
        ZEPLOY DEMO TOUR (${currentTourStep + 1} / ${TOUR_STEPS.length})
      </span>
      <button id="tour-close-btn" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;line-height:1">✕</button>
    </div>
    <h4 style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-bottom:6px">${step.title}</h4>
    <p style="font-size:0.8125rem;color:var(--text-secondary);line-height:1.5;margin-bottom:14px">${step.desc}</p>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <button class="btn btn-ghost btn-xs" id="tour-prev-btn" ${currentTourStep === 0 ? 'disabled' : ''}>
        ← Previous
      </button>
      <button class="btn btn-primary btn-xs" id="tour-next-btn" style="padding:6px 14px">
        ${currentTourStep === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next Step →'}
      </button>
    </div>
  `;

  tourBannerEl.querySelector('#tour-close-btn').addEventListener('click', stopGuidedTour);
  tourBannerEl.querySelector('#tour-prev-btn')?.addEventListener('click', () => {
    if (currentTourStep > 0) {
      currentTourStep--;
      renderTourStep();
    }
  });
  tourBannerEl.querySelector('#tour-next-btn').addEventListener('click', () => {
    if (currentTourStep < TOUR_STEPS.length - 1) {
      currentTourStep++;
      renderTourStep();
    } else {
      stopGuidedTour();
      toast.success('Tour Complete', 'Thank you for exploring the Zeploy POS Commercial Edition!');
    }
  });
}

window.startGuidedTour = function() {
  currentTourStep = 0;
  renderTourStep();
};

window.stopGuidedTour = function() {
  if (tourBannerEl) {
    tourBannerEl.style.display = 'none';
  }
};
