/**
 * showcase.js — Client Demo Showcase View
 * Sales pitch presentation slide deck designed for client pitches (Zeploy demo sessions)
 */

async function renderShowcase(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Client Showcase Pitch</h1>
        <p>Interactive value propositions and system benefits deck for sales demonstrations</p>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:var(--space-5)">
      <!-- Interactive Slide Deck -->
      <div class="section-card" style="border-left:4px solid var(--primary);display:flex;flex-direction:column;justify-content:between;min-height:360px">
        <div id="showcase-deck-content">
          <!-- Slide content injected here -->
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-4);border-top:1px solid var(--border-soft);padding-top:var(--space-3)">
          <div class="text-xs text-secondary" id="showcase-slide-indicator">Slide 1 of 5</div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-ghost btn-sm" id="showcase-prev-btn">${icon('icon-chevron-left')} Prev</button>
            <button class="btn btn-primary btn-sm" id="showcase-next-btn">Next ${icon('icon-chevron-right')}</button>
          </div>
        </div>
      </div>

      <!-- Feature Matrix Grid -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-check-circle', 'text-teal')} Commercial Grade System Features</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:var(--space-3);margin-top:var(--space-2)">
          <div style="display:flex;gap:var(--space-3);align-items:flex-start">
            <div style="padding:var(--space-2);background:var(--primary-muted);border-radius:var(--radius-md);color:var(--primary)">${icon('icon-refresh')}</div>
            <div>
              <div class="font-semibold text-sm">Offline-First Local Architecture</div>
              <div class="text-xs text-secondary">Runs completely on-device without internet. Zero server hosting costs. Immune to broadband outages.</div>
            </div>
          </div>
          
          <div style="display:flex;gap:var(--space-3);align-items:flex-start">
            <div style="padding:var(--space-2);background:var(--primary-muted);border-radius:var(--radius-md);color:var(--primary)">${icon('icon-trending-up')}</div>
            <div>
              <div class="font-semibold text-sm">Dynamic Profit Margins Tracker</div>
              <div class="text-xs text-secondary">Auto-calculates COGS (Cost of Goods Sold) and itemized margins. Instant store valuations at cost vs retail.</div>
            </div>
          </div>

          <div style="display:flex;gap:var(--space-3);align-items:flex-start">
            <div style="padding:var(--space-2);background:var(--primary-muted);border-radius:var(--radius-md);color:var(--primary)">${icon('icon-recipes')}</div>
            <div>
              <div class="font-semibold text-sm">Raw Ingredients / Recipe BOM Deductions</div>
              <div class="text-xs text-secondary">Composite items auto-deduct raw materials from stock on checkout. Essential for bakeries and restaurants.</div>
            </div>
          </div>

          <div style="display:flex;gap:var(--space-3);align-items:flex-start">
            <div style="padding:var(--space-2);background:var(--primary-muted);border-radius:var(--radius-md);color:var(--primary)">${icon('icon-cash')}</div>
            <div>
              <div class="font-semibold text-sm">Reconciled Cash Drawer Audits</div>
              <div class="text-xs text-secondary">Forced starting/ending register sessions tracks expected sales drawer balances and mismatch reports.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Retail Profiles Showcase -->
    <div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">${icon('icon-store')} Tailored Industry Profiles Showcase</span>
      </div>
      
      <div class="tab-nav" style="margin-top:var(--space-2);margin-bottom:var(--space-3)">
        <button class="tab-btn active" data-psec="grocery">🛒 Grocery</button>
        <button class="tab-btn" data-psec="bakery">🍞 Bakery</button>
        <button class="tab-btn" data-psec="restaurant">🍔 Restaurant</button>
        <button class="tab-btn" data-psec="vape">💨 Vape Shop</button>
        <button class="tab-btn" data-psec="pharmacy">💊 Pharmacy</button>
        <button class="tab-btn" data-psec="electronics">💻 Electronics</button>
      </div>

      <div id="showcase-profile-details" style="padding:var(--space-2)">
        <!-- Details injected dynamically -->
      </div>
    </div>
  `;

  // Bind Presentation Slide Deck
  initShowcaseSlides(container);

  // Bind Profiles tab switcher
  container.querySelectorAll('[data-psec]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-psec]').forEach(b => b.classList.toggle('active', b === btn));
      renderProfileDetails(container, btn.dataset.psec);
    });
  });

  renderProfileDetails(container, 'grocery');
}

// ── Showcase Slides Definitions ─────────────────────────────────
const SHOWCASE_SLIDES = [
  {
    title: 'Welcome to InventoryPOS 📦',
    subtitle: 'Local-First Commerce Infrastructure',
    points: [
      'Built specifically for small-to-medium retail and hospitality businesses.',
      'Operates 100% offline, keeping checkout lines moving during internet drops.',
      'Loads instantly from double-click with zero complex database setups.',
      'Saves monthly SaaS hosting costs ($0 hosting setup fee).'
    ]
  },
  {
    title: 'Real-time Financial Tracking 📊',
    subtitle: 'Track Cost, Margins, and Net Revenues',
    points: [
      'Automatic cost of goods sold (COGS) reporting based on catalog records.',
      'Dynamic margin calculators highlights slow vs top-selling items.',
      'Historical 30-day analytics graphs visualizes revenue trends.',
      'Asset valuations shows cash value of items sitting on shelves.'
    ]
  },
  {
    title: 'Cash register drawer audit compliance 💵',
    subtitle: 'Register session float validations',
    points: [
      'Cashiers must start the day with an open drawer float session.',
      'Every POS checkout calculates expected drawer balances in real time.',
      'Day-end close form reports drawer variance mismatches.',
      'Maintains complete log histories of historical sessions for audit audits.'
    ]
  },
  {
    title: 'Customer Accounts & Credit ledger 👥',
    subtitle: 'Retain custom clients and offer ledger balances',
    points: [
      'Link walk-in or contract customers directly to sales checkout orders.',
      'Allow credit balances checkout with outstanding balance tracking.',
      'Accept partial cash deposits or total payoffs on customer balances.',
      'Export custom ledger statement logs for customer billing reports.'
    ]
  },
  {
    title: 'Ready for client deployments 🚀',
    subtitle: 'Production hardened features ready to showcase',
    points: [
      'Mobile/Tablet responsive layouts for handheld checkout devices.',
      'Thermal printer layout stylesheets for 80mm/58mm printers.',
      'Security PIN codes screens locks to prevent unauthorized settings edits.',
      '1-click database JSON backup exports and corruption-safe restores.'
    ]
  }
];

function initShowcaseSlides(container) {
  let curSlide = 0;
  const content = container.querySelector('#showcase-deck-content');
  const indicator = container.querySelector('#showcase-slide-indicator');
  const prevBtn = container.querySelector('#showcase-prev-btn');
  const nextBtn = container.querySelector('#showcase-next-btn');

  function renderSlide() {
    const s = SHOWCASE_SLIDES[curSlide];
    content.innerHTML = `
      <div style="font-size:0.875rem;color:var(--primary);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">${s.subtitle}</div>
      <h3 style="font-size:1.5rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:var(--space-4);color:var(--text-primary)">${s.title}</h3>
      <ul style="display:flex;flex-direction:column;gap:var(--space-3);padding-left:var(--space-4);list-style:disc">
        ${s.points.map(pt => `<li style="font-size:0.925rem;line-height:1.5;color:var(--text-secondary)">${pt}</li>`).join('')}
      </ul>
    `;
    indicator.textContent = `Slide ${curSlide + 1} of ${SHOWCASE_SLIDES.length}`;
    prevBtn.disabled = curSlide === 0;
    nextBtn.innerHTML = curSlide === SHOWCASE_SLIDES.length - 1
      ? `${icon('icon-check')} Finish Pitch`
      : `Next ${icon('icon-chevron-right')}`;
  }

  prevBtn.addEventListener('click', () => {
    if (curSlide > 0) { curSlide--; renderSlide(); }
  });

  nextBtn.addEventListener('click', () => {
    if (curSlide < SHOWCASE_SLIDES.length - 1) {
      curSlide++;
      renderSlide();
    } else {
      toast.success('Awesome!', 'Demo slide pitch completed. Ready to initialize store demo profiles below!');
      curSlide = 0;
      renderSlide();
    }
  });

  renderSlide();
}

// ── Profile Detail Details ──────────────────────────────────────
const PROFILE_DETAILS = {
  grocery: {
    badge: 'Grocery Store Preset',
    desc: 'Perfect for retail supermarket and food marts. Focuses on rapid barcode scans, stock alerts, and bulk CSV item list loads.',
    highlights: [
      'Barcode scans adds item directly to checkout cart.',
      'Low-stock badges dynamically alert manager of replenishments.',
      'Initial item loads via standard CSV spreadsheets.',
      'Asset valuation calculates gross cost of dairy, beverages, snacks, etc.'
    ]
  },
  bakery: {
    badge: 'Bakery & Cake Cafe Preset',
    desc: 'Designed for bakeries processing baked goods with raw ingredients. Integrates recipe raw deductions.',
    highlights: [
      'Bakes (cakes, cookies) are configured as recipe items.',
      'Selling 1 cake auto-deducts flour, eggs, sugar from inventory logs.',
      'Tracks raw material supplier purchase order restocking.',
      'Margin calculator highlights high-margin cakes vs raw costs.'
    ]
  },
  restaurant: {
    badge: 'Fast Food & Fine Dine Preset',
    desc: 'Combines recipe ingredients deductions, dynamic tax percentages, custom print receipts, and rapid POS selections.',
    highlights: [
      'Burgers deduct patties, cheese, buns from raw stock ledger.',
      'POS layout supports Category tabs for drinks, sides, burgers.',
      'Calculates change tender amounts for rapid cash cashiers.',
      'Receipt printing includes customizable headers, footer remarks, tax rates.'
    ]
  },
  vape: {
    badge: 'Vape Shop & E-Cig Retail Preset',
    desc: 'Structured for vaporizers, e-liquid cataloging, battery safety, and customer loyalty credit accounts.',
    highlights: [
      'Displays batch lot numbers and expiration dates for e-liquids.',
      'Customer accounts allow keeping tab limits for regular vapers.',
      'Disposables are tracked by category for stock warnings.',
      'Popular items quick-grid targets high-turnover vape accessories.'
    ]
  },
  pharmacy: {
    badge: 'Pharmacy & Medical Presets',
    desc: 'Tailored for medicine catalog lot control, critical expiration alert tags, and Zero-Tax medicine transactions.',
    highlights: [
      'Active batch logs warn manager of batches expiring within 7 days.',
      'Medicine boxes are tracked by barcode and manufacturer.',
      'Supports Zero-Tax medical checkout compliance.',
      'Tracks outstanding medical credits balances for regular patients.'
    ]
  },
  electronics: {
    badge: 'Electronics & Hardware Preset',
    desc: 'Best for electronics equipment, chargers, smart-home items, high cost tracking, and detailed PO procurement.',
    highlights: [
      'Tracks high cost-value product items asset margins.',
      'Purchase Orders help request mechanical keyboard or earphone stock.',
      'Warranty returns recorded as quick stock adjustments (DAMAGE code).',
      'Table list toggle provides compact overview of thousands of products.'
    ]
  }
};

function renderProfileDetails(container, profileId) {
  const detailsEl = container.querySelector('#showcase-profile-details');
  if (!detailsEl) return;

  const p = PROFILE_DETAILS[profileId];

  detailsEl.innerHTML = `
    <div style="background:var(--canvas);padding:var(--space-4);border-radius:var(--radius-lg);margin-bottom:var(--space-3)">
      <span class="badge badge-indigo" style="margin-bottom:6px">${p.badge}</span>
      <p class="text-sm font-semibold" style="margin-bottom:12px;color:var(--text-primary)">${p.desc}</p>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:var(--space-3)">
        ${p.highlights.map(hl => `
          <div style="display:flex;gap:var(--space-2);align-items:center;background:var(--surface);padding:8px 12px;border:1px solid var(--border-soft);border-radius:var(--radius-md)">
            <span style="color:var(--primary)">✓</span>
            <span class="text-xs font-semibold text-secondary">${hl}</span>
          </div>`).join('')}
      </div>
    </div>
    
    <div style="display:flex;justify-content:flex-end">
      <button class="btn btn-primary btn-sm" id="showcase-initialize-btn">
        ${icon('icon-refresh')} Load "${p.badge.split(' ')[0]}" Demo Setup
      </button>
    </div>
  `;

  detailsEl.querySelector('#showcase-initialize-btn').addEventListener('click', () => {
    showConfirm(`Initialize "${p.badge.split(' ')[0]}" demo? This will clear all current tables and generate 30 days transactions.`, async () => {
      // Show loading overlay
      const picker = document.getElementById('template-picker-screen');
      const submitBtn = document.getElementById('template-picker-submit-btn');
      
      picker.style.display = 'flex';
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="animate-spin" style="display:inline-block;margin-right:8px;animation:spin 1s linear infinite">⌛</span>Initializing "${profileId}"...`;
      
      try {
        await seedBusinessTemplate(profileId);
        await generate30DaysDemoTransactions();
        
        picker.style.display = 'none';
        toast.success('Store Initialized', `Loaded the ${profileId} profile!`);
        
        // Refresh app and navigate to dashboard
        window.location.reload();
      } catch (err) {
        picker.style.display = 'none';
        toast.error('Failed to Initialize', err.message);
      }
    });
  });
}
