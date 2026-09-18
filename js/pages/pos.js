/**
 * pos.js — Enterprise Point of Sale & Lightning-Fast Retail Terminal
 * Features:
 * 1. High-Speed Split Layout with responsive product cards, SKU tags, and stock pills
 * 2. Keyboard-First Hotkeys Engine (F2, F4, F8, F9, Enter, Escape) & On-Screen Guide Pill
 * 3. Hardware Barcode Scanner Wedge Auto-Add with zero-latency Web Audio POS chime
 * 4. Itemized Checkout Cart Ledger with Quantity Steppers and Custom Line-Item Discounts
 * 5. Multi-Tender & Split Payment Modal (Cash with Denominations, Card, Digital Wallets, Split)
 * 6. Professional Thermal Receipt Engine (58mm & 80mm) with NTN, Cashier tag, and Dynamic QR
 */

// ── Module State ─────────────────────────────────────────────
let posItems            = [];
let posCategory         = 'All';
let posSearch           = '';
let taxRate             = 0;
let discount            = 0;
let payMethod           = 'Cash';
let cashTendered        = 0;
let selectedCustomerId  = '';
let posHotkeysBound     = false;
let posWedgeBound       = false;

// ── Main Page Renderer ───────────────────────────────────────
async function renderPOS(container) {
  taxRate = await getSetting('tax_rate', 0);
  selectedCustomerId = '';
  discount = 0;
  cashTendered = 0;

  // Restore cart from session storage
  await Cart.load();

  // Check register session status
  const activeSession = await getActiveSession();

  container.innerHTML = `
    <div class="pos-layout">
      <!-- Left Column: Product Catalog & Fast Scanner -->
      <div class="pos-product-panel">
        ${!activeSession ? `
          <div style="background:var(--danger-bg);border:1px solid var(--danger);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3);display:flex;align-items:center;justify-content:space-between">
            <div>
              <div class="font-bold text-red" style="font-size:0.95rem">${icon('icon-alert')} Cash Drawer Closed</div>
              <div class="text-xs text-secondary" style="margin-top:2px">Open a register session to execute transactions.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="navigate('register')">${icon('icon-cash')} Open Session</button>
          </div>
        ` : ''}

        <!-- Hotkey Guide Pill Bar -->
        <div class="pos-hotkeys-bar">
          <span class="hotkey-pill"><kbd>F2</kbd> Search / Scan</span>
          <span class="hotkey-divider"></span>
          <span class="hotkey-pill"><kbd>F4</kbd> Void Cart</span>
          <span class="hotkey-divider"></span>
          <span class="hotkey-pill"><kbd>F8</kbd> Quick Cash</span>
          <span class="hotkey-divider"></span>
          <span class="hotkey-pill"><kbd>F9</kbd> Pay / Split</span>
          <span class="hotkey-divider"></span>
          <span class="hotkey-pill"><kbd>Esc</kbd> Close</span>
        </div>

        <!-- Top Search Bar -->
        <div class="pos-search-bar" style="margin-bottom:var(--space-3)">
          <div class="pos-search-wrap" style="flex:1">
            ${icon('icon-barcode', 'pos-search-icon')}
            <input type="text" id="pos-search" placeholder="Scan barcode (F2) or type name / SKU..." autocomplete="off" autofocus>
          </div>
          <button class="btn btn-ghost btn-sm" id="pos-clear-search-btn" title="Clear Search" style="display:none;padding:6px 10px;">
            ${icon('icon-close')}
          </button>
        </div>

        <!-- Popular Quick Add Section -->
        <div id="pos-popular-section" style="margin-bottom:var(--space-3)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)">
            <h3 style="font-size:0.8125rem;font-weight:700;color:var(--text-primary);margin:0">⭐ Quick Popular Add</h3>
            <span class="text-xs text-muted">Frequent items</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(125px, 1fr));gap:var(--space-2)" id="pos-popular-grid">
            <!-- Loaded dynamically -->
          </div>
        </div>

        <!-- Category Pills Filter -->
        <div class="pos-filter-pills" id="pos-pills" style="margin-bottom:var(--space-3)"></div>

        <!-- Responsive Product Grid -->
        <div class="pos-product-grid" id="pos-grid">
          ${[1,2,3,4,5,6].map(() => `<div class="skeleton-card"><div class="skeleton" style="aspect-ratio:1.2"></div></div>`).join('')}
        </div>

        <!-- Recent Sales Drawer Logs -->
        <div style="margin-top:var(--space-4);border-top:1px solid var(--border-soft);padding-top:var(--space-3)">
          <h3 style="font-size:0.8125rem;font-weight:700;margin-bottom:var(--space-2);color:var(--text-primary)">
            ${icon('icon-clock')} Recent Drawer Sales
          </h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:var(--space-2)" id="pos-recent-sales-list">
            <!-- Loaded dynamically -->
          </div>
        </div>
      </div>

      <!-- Right Column: Checkout Cart Ledger -->
      <div class="pos-cart-panel" style="${!activeSession ? 'opacity:0.4;pointer-events:none' : ''}">
        <!-- Cart Header -->
        <div class="cart-header">
          <div class="cart-title">
            ${icon('icon-cart')} Checkout Cart
            <span class="cart-count" id="cart-count">0</span>
          </div>
          <button class="cart-clear-btn" id="cart-clear-btn" title="Void Cart (F4)">
            ${icon('icon-trash')} Void (F4)
          </button>
        </div>

        <!-- Linked Customer Selection -->
        <div style="padding:var(--space-3);background:var(--canvas);border-bottom:1px solid var(--border-soft);display:flex;flex-direction:column;gap:4px">
          <label class="form-label text-xs" style="margin-bottom:0">Link Customer Account</label>
          <select class="form-select" id="pos-customer-select" style="padding:6px;font-size:0.8125rem">
            <option value="">Walk-in Customer</option>
          </select>
        </div>

        <!-- Itemized Cart List -->
        <div class="cart-items" id="cart-items">
          <div class="cart-empty">
            ${icon('icon-cart')}
            <p>Scan barcode or click items to build cart</p>
          </div>
        </div>

        <!-- Total Summaries & Checkout -->
        <div class="cart-summary" id="cart-summary">
          <!-- Gross Subtotal -->
          <div class="cart-summary-row">
            <span class="cart-summary-label">Subtotal</span>
            <span class="cart-summary-value" id="cart-subtotal">Rs. 0</span>
          </div>

          <!-- Line Discounts Total (hidden if 0) -->
          <div class="cart-summary-row" id="cart-line-discounts-row" style="display:none;color:var(--primary)">
            <span class="cart-summary-label" style="color:var(--primary)">Line Discounts</span>
            <span class="cart-summary-value" id="cart-line-discounts">- Rs. 0</span>
          </div>
          
          <!-- Overall Bill Discount -->
          <div class="cart-summary-row" style="flex-direction:column;align-items:stretch;gap:4px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="cart-summary-label">Bill Discount</span>
              <div class="cart-discount-wrap">
                <span>Rs.</span>
                <input type="number" class="cart-discount-input" id="discount-input" value="0" min="0" style="width:70px">
              </div>
            </div>
            <!-- Discount Presets -->
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button class="btn btn-ghost btn-xs btn-discount-preset" data-pct="5" style="padding:2px 6px;font-size:0.7rem;min-height:auto">5%</button>
              <button class="btn btn-ghost btn-xs btn-discount-preset" data-pct="10" style="padding:2px 6px;font-size:0.7rem;min-height:auto">10%</button>
              <button class="btn btn-ghost btn-xs btn-discount-preset" data-pct="15" style="padding:2px 6px;font-size:0.7rem;min-height:auto">15%</button>
              <button class="btn btn-ghost btn-xs btn-discount-preset" data-pct="0" style="padding:2px 6px;font-size:0.7rem;min-height:auto">Reset</button>
            </div>
          </div>

          <!-- Sales Tax Breakdown -->
          <div class="cart-summary-row">
            <span class="cart-summary-label">GST Tax (${taxRate}%)</span>
            <span class="cart-summary-value" id="cart-tax">Rs. 0</span>
          </div>
          
          <!-- Grand Total Card -->
          <div class="cart-summary-row total">
            <span class="cart-summary-label">Grand Total</span>
            <span class="cart-summary-value" id="cart-total">Rs. 0</span>
          </div>

          <!-- Quick Cash & Split Tender Checkout Action Buttons -->
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:var(--space-2)">
            <button class="btn btn-success" id="btn-quick-cash" disabled style="width:100%;font-weight:700;padding:10px;font-size:0.875rem;">
              💵 Quick Cash [F8]
            </button>
            <button class="checkout-btn" id="checkout-btn" disabled style="width:100%;margin-top:0;">
              💳 Pay / Split Tender [F9]
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Fetch initial items
  posItems = await db.items.toArray();

  // Populate customers dropdown
  await populateCustomersDropdown(container);

  // Render components
  renderPOSGrid(container);
  renderPOSPills(container);
  renderPopularItems(container);
  renderRecentSalesList(container);
  renderCart(container);

  // Setup Event Bindings, Keyboard Hotkeys & Barcode Scanner
  setupPOSEvents(container);
  setupPOSHotkeys(container);
  setupHardwareWedgeScanner(container);
}

// ── Bind POS Interactions ─────────────────────────────────────
function setupPOSEvents(container) {
  const searchInput = container.querySelector('#pos-search');
  const clearSearchBtn = container.querySelector('#pos-clear-search-btn');

  // Auto-focus search on load
  if (searchInput) {
    setTimeout(() => { searchInput.focus(); searchInput.select(); }, 50);
  }

  searchInput.addEventListener('input', (e) => {
    posSearch = e.target.value;
    if (clearSearchBtn) clearSearchBtn.style.display = posSearch ? 'inline-flex' : 'none';
    renderPOSGrid(container);
  });

  clearSearchBtn?.addEventListener('click', () => {
    posSearch = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderPOSGrid(container);
  });

  // Void cart button (F4)
  container.querySelector('#cart-clear-btn').addEventListener('click', () => {
    if (Cart.getItemCount() === 0) return;
    showConfirm('Void current cart? This will clear all line items.', () => {
      Cart.clear();
      renderCart(container);
      playBeepSound('click');
      toast.info('Cart Voided', 'All items cleared from checkout ledger.');
    });
  });

  // Bill Discount input change
  const discInput = container.querySelector('#discount-input');
  discInput.addEventListener('input', (e) => {
    discount = parseFloat(e.target.value) || 0;
    updateCartTotals(container);
  });

  // Bill Discount presets
  container.querySelectorAll('.btn-discount-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseFloat(btn.dataset.pct);
      const netSubtotal = Cart.getSubtotal();
      if (pct === 0) {
        discount = 0;
      } else {
        discount = Math.round(netSubtotal * (pct / 100));
      }
      discInput.value = discount;
      updateCartTotals(container);
    });
  });

  // Quick Cash Checkout [F8]
  container.querySelector('#btn-quick-cash').addEventListener('click', () => {
    executeQuickCashCheckout(container);
  });

  // Open Multi-Tender & Split Payment Modal [F9]
  container.querySelector('#checkout-btn').addEventListener('click', () => {
    openMultiTenderModal(container);
  });
}

// ── Keyboard-First Hotkeys Engine ─────────────────────────────
function setupPOSHotkeys(container) {
  if (posHotkeysBound) return;
  posHotkeysBound = true;

  window.addEventListener('keydown', (e) => {
    // Only process hotkeys when user is on POS page
    const hash = window.location.hash;
    if (hash && hash !== '#pos' && hash !== '#' && hash !== '') return;

    // F2: Focus & select search bar
    if (e.key === 'F2') {
      e.preventDefault();
      const s = document.querySelector('#pos-search');
      if (s) {
        s.focus();
        s.select();
      }
      return;
    }

    // F4: Void Cart
    if (e.key === 'F4') {
      e.preventDefault();
      const clearBtn = document.querySelector('#cart-clear-btn');
      if (clearBtn && Cart.getItemCount() > 0) clearBtn.click();
      return;
    }

    // F8: Quick Cash Checkout
    if (e.key === 'F8') {
      e.preventDefault();
      const quickCashBtn = document.querySelector('#btn-quick-cash');
      if (quickCashBtn && !quickCashBtn.disabled) quickCashBtn.click();
      return;
    }

    // F9: Open Payment / Split Modal
    if (e.key === 'F9') {
      e.preventDefault();
      const payBtn = document.querySelector('#checkout-btn');
      if (payBtn && !payBtn.disabled) payBtn.click();
      return;
    }

    // Escape: Dismiss active modal or clear search
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-backdrop');
      if (activeModal) {
        closeModal();
      } else {
        const s = document.querySelector('#pos-search');
        if (s && s.value) {
          s.value = '';
          posSearch = '';
          const cBtn = document.querySelector('#pos-clear-search-btn');
          if (cBtn) cBtn.style.display = 'none';
          const pageCont = document.querySelector('#page-content');
          if (pageCont) renderPOSGrid(pageCont);
        }
      }
    }
  });
}

// ── Hardware Barcode Scanner Wedge Auto-Add Engine ────────────
function setupHardwareWedgeScanner(container) {
  if (posWedgeBound) return;
  posWedgeBound = true;

  let wedgeBuffer = '';
  let lastWedgeTime = 0;

  window.addEventListener('keydown', (e) => {
    const hash = window.location.hash;
    if (hash && hash !== '#pos' && hash !== '#' && hash !== '') return;

    // Do not capture if an active input inside a modal is focused (e.g. cash tendered)
    const activeEl = document.activeElement;
    const isModalInput = activeEl && activeEl.closest('.modal-body');
    if (isModalInput) return;

    const now = Date.now();
    const interval = now - lastWedgeTime;
    lastWedgeTime = now;

    if (e.key === 'Enter') {
      if (wedgeBuffer.length >= 3 && interval < 60) {
        e.preventDefault();
        const scannedCode = wedgeBuffer.trim();
        wedgeBuffer = '';
        handlePOSScannedBarcode(scannedCode);
      } else {
        // If Enter pressed inside #pos-search, check for exact barcode/SKU match
        if (activeEl && activeEl.id === 'pos-search' && activeEl.value.trim()) {
          e.preventDefault();
          handlePOSScannedBarcode(activeEl.value.trim());
        }
        wedgeBuffer = '';
      }
      return;
    }

    // Ignore modifier keys
    if (e.key.length !== 1) return;

    if (interval < 45 || wedgeBuffer.length === 0) {
      wedgeBuffer += e.key;
    } else {
      wedgeBuffer = e.key;
    }
  });
}

async function handlePOSScannedBarcode(barcode) {
  const code = barcode.toLowerCase();
  const match = posItems.find(it =>
    (it.barcode && it.barcode.toLowerCase() === code) ||
    (it.name && it.name.toLowerCase() === code)
  );

  const container = document.getElementById('page-content');

  if (match) {
    const ci = Cart.getItems().find(c => c.item.id === match.id);
    const currentQty = ci ? ci.qty : 0;

    // Check availability
    if (match.is_composite) {
      const maxAvail = await getMaxCompositeAvailable(match);
      if (currentQty >= maxAvail) {
        playBeepSound('error');
        toast.error('Stock Limit', `Cannot exceed ${maxAvail}x ${match.name}.`);
        return;
      }
    } else {
      if (match.stock_quantity <= currentQty) {
        playBeepSound('error');
        toast.error('Stock Limit', `Only ${match.stock_quantity} in stock for ${match.name}.`);
        return;
      }
    }

    // Add to cart & Play audio chime
    Cart.add(match, 1);
    playBeepSound('success');
    toast.success('Barcode Scanned', `Added: ${match.name} (x1)`);

    // Reset search input if it held this code
    const searchInput = document.getElementById('pos-search');
    if (searchInput && searchInput.value.trim().toLowerCase() === code) {
      searchInput.value = '';
      posSearch = '';
      const cBtn = document.getElementById('pos-clear-search-btn');
      if (cBtn) cBtn.style.display = 'none';
      if (container) renderPOSGrid(container);
    }

    if (container) renderCart(container);
  } else {
    playBeepSound('error');
    toast.warning('Product Not Found', `No matching product for barcode: "${barcode}".`);
  }
}

// ── Populate Customers Dropdown ───────────────────────────────
async function populateCustomersDropdown(container) {
  const customers = await db.customers.toArray();
  const custSelect = container.querySelector('#pos-customer-select');
  if (!custSelect) return;

  customers.sort((a, b) => a.name.localeCompare(b.name));
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.phone || 'no phone'}) - Bal: Rs.${c.current_balance}`;
    custSelect.appendChild(opt);
  });

  custSelect.addEventListener('change', (e) => {
    selectedCustomerId = e.target.value ? parseInt(e.target.value) : '';
  });
}

// ── Category Pills & Product Grid ─────────────────────────────
function renderPOSPills(container) {
  const pillsEl = container.querySelector('#pos-pills');
  if (!pillsEl) return;

  const cats = ['All', ...new Set(posItems.map(it => it.category))].filter(Boolean);
  pillsEl.innerHTML = cats.map(cat => `
    <button class="btn btn-pill btn-ghost ${posCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
  `).join('');

  pillsEl.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      posCategory = btn.dataset.cat;
      pillsEl.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('active', b === btn));
      renderPOSGrid(container);
    });
  });
}

function renderPOSGrid(container) {
  const gridEl = container.querySelector('#pos-grid');
  if (!gridEl) return;

  let items = posItems.filter(it => it.selling_price > 0 || it.is_composite);

  if (posCategory !== 'All') {
    items = items.filter(it => it.category === posCategory);
  }

  if (posSearch) {
    const q = posSearch.toLowerCase();
    items = items.filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q))
    );
  }

  if (items.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column:1/-1;padding:var(--space-8) 0;text-align:center;color:var(--text-muted)">
        <div style="font-size:2rem;margin-bottom:var(--space-2)">🔍</div>
        <p class="font-semibold">No matching products found</p>
        <p class="text-xs">Try scanning another barcode or clearing your search.</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = items.map(item => {
    const isOut = !item.is_composite && item.stock_quantity <= 0;
    const isLow = !item.is_composite && item.stock_quantity > 0 && item.stock_quantity <= item.min_stock_alert;

    const thumb = item.photo_blob
      ? `<img src="${item.photo_blob}" alt="${item.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : categoryIcon(item.category);

    const stockBadge = item.is_composite
      ? `<span class="pos-card-stock-badge in-stock" style="background:var(--primary)">Recipe</span>`
      : isOut
      ? `<span class="pos-card-stock-badge out-of-stock">Sold Out</span>`
      : isLow
      ? `<span class="pos-card-stock-badge low-stock">Low (${item.stock_quantity})</span>`
      : `<span class="pos-card-stock-badge in-stock">${item.stock_quantity} ${item.unit}</span>`;

    return `
      <div class="pos-item-card ${isOut ? 'disabled' : ''}" data-item-id="${item.id}" style="cursor:${isOut ? 'not-allowed' : 'pointer'};position:relative;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px;transition:all var(--transition-fast);opacity:${isOut ? '0.5' : '1'}">
        <div style="height:84px;background:var(--canvas);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;margin-bottom:6px;overflow:hidden;position:relative">
          ${thumb}
          ${stockBadge}
        </div>
        <div class="truncate text-xs font-bold" style="color:var(--text-primary);max-width:100%" title="${item.name}">${item.name}</div>
        <div class="pos-card-sku">SKU: ${item.barcode || 'NO-SKU'}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span class="text-xs font-bold text-primary mono">${fmt(item.selling_price)}</span>
        </div>
      </div>
    `;
  }).join('');

  gridEl.querySelectorAll('.pos-item-card').forEach(card => {
    card.addEventListener('click', () => {
      const itemId = parseInt(card.dataset.itemId);
      const item = posItems.find(it => it.id === itemId);
      if (item) {
        if (!item.is_composite && item.stock_quantity <= 0) {
          playBeepSound('error');
          toast.error('Out of Stock', 'Product has zero quantity available.');
          return;
        }
        addToCart(item, container);
      }
    });
  });
}

function renderPopularItems(container) {
  const grid = container.querySelector('#pos-popular-grid');
  if (!grid) return;

  const popular = posItems.filter(it => !it.is_composite && it.stock_quantity > 0).slice(0, 6);
  if (popular.length === 0) {
    container.querySelector('#pos-popular-section').style.display = 'none';
    return;
  }

  grid.innerHTML = popular.map(item => {
    const thumb = item.photo_blob
      ? `<img src="${item.photo_blob}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover">`
      : `<span style="font-size:1.15rem">${item.name[0]}</span>`;
    return `
      <div class="popular-item-card" data-item-id="${item.id}" style="cursor:pointer;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);padding:6px;text-align:center;transition:all var(--transition-fast);display:flex;flex-direction:column;align-items:center">
        <div style="width:36px;height:36px;background:var(--canvas);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;margin-bottom:4px;overflow:hidden">${thumb}</div>
        <div class="truncate text-xs font-bold" style="max-width:100%;font-size:0.75rem;color:var(--text-primary)" title="${item.name}">${item.name}</div>
        <div class="mono text-xs font-bold text-primary" style="margin-top:2px;font-size:0.7rem">${fmt(item.selling_price)}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.popular-item-card').forEach(card => {
    card.addEventListener('click', () => {
      const itemId = parseInt(card.dataset.itemId);
      const item = posItems.find(it => it.id === itemId);
      if (item) addToCart(item, container);
    });
  });
}

async function renderRecentSalesList(container) {
  const el = container.querySelector('#pos-recent-sales-list');
  if (!el) return;

  const sales = await db.sales.orderBy('timestamp').reverse().limit(4).toArray();
  if (sales.length === 0) {
    el.innerHTML = `<div style="grid-column:1/-1;font-size:0.75rem;color:var(--text-muted)">No recent session sales.</div>`;
    return;
  }

  el.innerHTML = sales.map(s => {
    const timeStr = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div style="border:1px solid var(--border-soft);border-radius:var(--radius-md);padding:8px;background:var(--surface);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="mono font-bold text-xs" style="color:var(--text-primary)">${s.invoice_no.split('-')[1] || s.invoice_no}</div>
          <div class="text-xs text-muted" style="margin-top:2px">${timeStr} · ${s.payment_method}</div>
        </div>
        <div style="text-align:right">
          <div class="mono font-bold text-xs text-teal">${fmt(s.total)}</div>
          <button class="btn btn-ghost btn-xs btn-reprint-sale" data-sid="${s.id}" style="padding:2px 6px;font-size:0.65rem;min-height:auto;margin-top:2px">Reprint</button>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.btn-reprint-sale').forEach(btn => {
    btn.addEventListener('click', async () => {
      const saleId = parseInt(btn.dataset.sid);
      const sale = await db.sales.get(saleId);
      if (!sale) return;

      const sItems = await db.sale_items.where('sale_id').equals(saleId).toArray();
      const cartItems = [];
      for (const si of sItems) {
        const item = await db.items.get(si.item_id);
        cartItems.push({
          item: item || { name: 'Item', barcode: 'N/A' },
          qty: si.quantity,
          unit_price: si.unit_price,
          discount: si.discount || 0
        });
      }

      const storeName = await getSetting('store_name', 'My Shop');
      const storeLogo = await getSetting('store_logo', '');
      const storeAddr = await getSetting('store_address', '');
      const storePhone = await getSetting('store_phone', '');
      const receiptFooter = await getSetting('receipt_footer', 'Thank you!');
      const taxLabel  = await getSetting('tax_label', 'GST');
      const ntnTaxId  = await getSetting('ntn_tax_id', 'NTN-9842104-7');

      showReceiptModal(cartItems, {
        subtotal: sale.subtotal,
        discountAmt: sale.discount,
        taxAmount: sale.tax,
        total: sale.total,
        changeDue: sale.change_returned,
        receiptNo: sale.invoice_no,
        paymentMethod: sale.payment_method,
        cashReceived: sale.cash_received,
        splitDetails: sale.split_details,
        cardRef: sale.card_ref,
        digitalProvider: sale.digital_provider,
        digitalRef: sale.digital_ref
      }, { storeName, storeLogo, storeAddr, storePhone, receiptFooter, taxLabel, ntnTaxId }, sale.timestamp);
    });
  });
}

// ── Cart Ledger Rendering ─────────────────────────────────────
function renderCart(container) {
  const itemsEl = container.querySelector('#cart-items');
  const countEl = container.querySelector('#cart-count');
  if (!itemsEl) return;

  const items = Cart.getItems();
  const newCount = Cart.getItemCount();
  if (countEl.textContent !== String(newCount)) {
    countEl.textContent = newCount;
    countEl.classList.remove('cart-badge-bounce');
    void countEl.offsetWidth;
    countEl.classList.add('cart-badge-bounce');
  }

  const quickCashBtn = container.querySelector('#btn-quick-cash');
  const checkoutBtn = container.querySelector('#checkout-btn');

  if (items.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        ${icon('icon-cart')}
        <p>Cart is empty</p>
        <span class="text-xs text-muted">Scan barcode or press F2</span>
      </div>
    `;
    if (quickCashBtn) quickCashBtn.disabled = true;
    if (checkoutBtn) checkoutBtn.disabled = true;
    updateCartTotals(container);
    return;
  }

  itemsEl.innerHTML = items.map(ci => {
    const lineGross = ci.unit_price * ci.qty;
    const itemDiscount = ci.discount || 0;
    const lineNet = Math.max(0, lineGross - itemDiscount);

    return `
      <div class="cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px var(--space-3);border-bottom:1px solid var(--border-soft);gap:8px">
        <div style="flex:1;min-width:0;">
          <div class="font-bold text-xs truncate" style="color:var(--text-primary)" title="${ci.item.name}">${ci.item.name}</div>
          <div class="mono text-xs text-muted" style="margin-top:1px;">
            ${fmt(ci.unit_price)} each · <span style="font-size:0.65rem">SKU: ${ci.item.barcode || 'N/A'}</span>
          </div>
          <!-- Line Item Discount Actions -->
          <div class="cart-item-actions">
            ${itemDiscount > 0
              ? `<span class="line-disc-active" title="Item discount applied">
                   -${fmt(itemDiscount)} 
                   <span class="line-disc-remove" data-id="${ci.item.id}" title="Remove discount">✕</span>
                 </span>`
              : `<button class="btn-line-disc" data-id="${ci.item.id}">+ % Disc</button>`
            }
          </div>
        </div>

        <!-- Quantity Stepper -->
        <div style="display:flex;align-items:center;gap:4px">
          <button class="btn btn-ghost btn-xs cart-qty-btn" data-action="dec" data-id="${ci.item.id}" style="padding:2px 6px;min-height:auto;font-weight:bold">−</button>
          <span class="mono text-xs font-bold" style="width:24px;text-align:center">${ci.qty}</span>
          <button class="btn btn-ghost btn-xs cart-qty-btn" data-action="inc" data-id="${ci.item.id}" style="padding:2px 6px;min-height:auto;font-weight:bold">+</button>
        </div>

        <!-- Line Total Display -->
        <div style="width:70px;text-align:right;">
          ${itemDiscount > 0 ? `<div class="mono text-xs text-muted" style="text-decoration:line-through;font-size:0.65rem">${fmt(lineGross)}</div>` : ''}
          <div class="mono text-xs font-bold" style="color:var(--text-primary)">
            ${fmt(lineNet)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Quantity stepper bindings
  itemsEl.querySelectorAll('.cart-qty-btn').forEach(btn => {
    const itemId = parseInt(btn.dataset.id);
    const act = btn.dataset.action;
    btn.addEventListener('click', async () => {
      const ci = Cart.getItems().find(c => c.item.id === itemId);
      if (act === 'dec') {
        if (ci && ci.qty <= 1) Cart.remove(itemId);
        else Cart.setQty(itemId, (ci?.qty || 1) - 1);
      } else {
        const freshItem = posItems.find(it => it.id === itemId);
        if (freshItem) {
          if (freshItem.is_composite) {
            const maxAvail = await getMaxCompositeAvailable(freshItem);
            if ((ci?.qty || 0) >= maxAvail) {
              toast.error('Stock Limit', `Cannot exceed available stock of ${maxAvail}.`);
              return;
            }
          } else if ((ci?.qty || 0) >= freshItem.stock_quantity) {
            toast.error('Stock Limit', `Only ${freshItem.stock_quantity} ${freshItem.unit} available in stock.`);
            return;
          }
        }
        Cart.setQty(itemId, (ci?.qty || 1) + 1);
      }
      playBeepSound('click');
      renderCart(container);
    });
  });

  // Line Discount Triggers
  itemsEl.querySelectorAll('.btn-line-disc').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = parseInt(btn.dataset.id);
      showLineDiscountModal(itemId, container);
    });
  });

  // Line Discount Remove
  itemsEl.querySelectorAll('.line-disc-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = parseInt(btn.dataset.id);
      Cart.setItemDiscount(itemId, 0);
      renderCart(container);
      toast.info('Discount Removed', 'Line item discount reset to 0.');
    });
  });

  if (quickCashBtn) quickCashBtn.disabled = false;
  if (checkoutBtn) checkoutBtn.disabled = false;

  updateCartTotals(container);
}

function updateCartTotals(container) {
  const grossSubtotal   = Cart.getGrossSubtotal();
  const lineDiscounts   = Cart.getTotalLineDiscounts();
  const netSubtotal     = Cart.getSubtotal();
  const afterBillDisc   = Math.max(0, netSubtotal - discount);
  const tax             = Math.round(afterBillDisc * (taxRate / 100) * 100) / 100;
  const grandTotal      = afterBillDisc + tax;

  const set = (id, val) => { const el = container.querySelector(id); if (el) el.textContent = val; };
  set('#cart-subtotal', fmt(grossSubtotal));
  set('#cart-tax',      fmt(tax));
  set('#cart-total',    fmt(grandTotal));

  // Update line discounts row
  const lineDiscRow = container.querySelector('#cart-line-discounts-row');
  const lineDiscVal = container.querySelector('#cart-line-discounts');
  if (lineDiscRow && lineDiscVal) {
    if (lineDiscounts > 0) {
      lineDiscRow.style.display = 'flex';
      lineDiscVal.textContent = `- ${fmt(lineDiscounts)}`;
    } else {
      lineDiscRow.style.display = 'none';
    }
  }

  // Update Quick Cash button label
  const quickCashBtn = container.querySelector('#btn-quick-cash');
  if (quickCashBtn) {
    quickCashBtn.innerHTML = `💵 Quick Cash [F8] (${fmt(grandTotal)})`;
  }
}

async function getMaxCompositeAvailable(item) {
  if (!item.is_composite) return item.stock_quantity;
  const boms = await db.recipes.where('composite_item_id').equals(item.id).toArray();
  if (boms.length === 0) return 0;

  let maxQty = Infinity;
  for (const bom of boms) {
    const ingr = await db.items.get(bom.ingredient_item_id);
    if (!ingr) return 0;
    const avail = Math.floor(ingr.stock_quantity / bom.qty_required);
    if (avail < maxQty) maxQty = avail;
  }
  return maxQty === Infinity ? 0 : maxQty;
}

async function addToCart(item, container) {
  const ci = Cart.getItems().find(c => c.item.id === item.id);
  const currentCartQty = ci ? ci.qty : 0;

  if (item.is_composite) {
    const maxAvail = await getMaxCompositeAvailable(item);
    if (maxAvail <= currentCartQty) {
      playBeepSound('error');
      toast.error('BOM Stock Limit', `Insufficient ingredients to prepare more than ${maxAvail}x ${item.name}.`);
      return;
    }
  } else {
    if (item.stock_quantity <= currentCartQty) {
      playBeepSound('error');
      toast.error('Limit Reached', `Only ${item.stock_quantity} ${item.unit} available in stock.`);
      return;
    }
  }
  Cart.add(item);
  playBeepSound('success');
  renderCart(container);
}

// ── Custom Line-Item Discount Modal ───────────────────────────
function showLineDiscountModal(itemId, container) {
  const ci = Cart.getItems().find(c => c.item.id === itemId);
  if (!ci) return;

  const lineGross = ci.unit_price * ci.qty;
  const bodyHTML = `
    <div style="margin-bottom:var(--space-3)">
      <div class="font-bold text-sm text-primary">${ci.item.name}</div>
      <div class="mono text-xs text-muted">${ci.qty}x @ ${fmt(ci.unit_price)} = <strong>${fmt(lineGross)}</strong></div>
    </div>

    <div class="form-group">
      <label class="form-label">Discount Method</label>
      <div style="display:flex;gap:6px;margin-bottom:var(--space-2)">
        <button type="button" class="btn btn-ghost btn-sm active" id="line-disc-type-flat" style="flex:1">Flat (Rs.)</button>
        <button type="button" class="btn btn-ghost btn-sm" id="line-disc-type-pct" style="flex:1">Percentage (%)</button>
      </div>
      <input type="number" class="form-input" id="line-disc-val" value="${ci.discount || ''}" placeholder="Enter discount amount" min="0" step="any" autofocus>
    </div>

    <!-- Quick Discount Presets -->
    <div style="display:flex;gap:4px;margin-top:var(--space-2);justify-content:space-between">
      <button type="button" class="btn btn-ghost btn-xs btn-preset-line" data-pct="5">5% Off</button>
      <button type="button" class="btn btn-ghost btn-xs btn-preset-line" data-pct="10">10% Off</button>
      <button type="button" class="btn btn-ghost btn-xs btn-preset-line" data-pct="15">15% Off</button>
      <button type="button" class="btn btn-ghost btn-xs btn-preset-line" data-pct="25">25% Off</button>
      <button type="button" class="btn btn-ghost btn-xs btn-preset-line" data-pct="50">50% Off</button>
    </div>
  `;

  openModal({
    title: `Apply Discount: ${ci.item.name}`,
    bodyHTML,
    footerHTML: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="line-disc-apply-btn">${icon('icon-check')} Apply Discount</button>
    `,
    onOpen: (backdrop) => {
      let isPercentage = false;
      const flatBtn = backdrop.querySelector('#line-disc-type-flat');
      const pctBtn  = backdrop.querySelector('#line-disc-type-pct');
      const valInput = backdrop.querySelector('#line-disc-val');

      flatBtn.addEventListener('click', () => {
        isPercentage = false;
        flatBtn.classList.add('active');
        pctBtn.classList.remove('active');
        valInput.placeholder = 'Enter flat Rs. off';
        valInput.focus();
      });

      pctBtn.addEventListener('click', () => {
        isPercentage = true;
        pctBtn.classList.add('active');
        flatBtn.classList.remove('active');
        valInput.placeholder = 'Enter % off (e.g. 10)';
        valInput.focus();
      });

      backdrop.querySelectorAll('.btn-preset-line').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseFloat(btn.dataset.pct);
          isPercentage = true;
          pctBtn.classList.add('active');
          flatBtn.classList.remove('active');
          valInput.value = p;
        });
      });

      backdrop.querySelector('#line-disc-apply-btn').addEventListener('click', () => {
        const raw = parseFloat(valInput.value) || 0;
        let finalDiscount = 0;
        if (isPercentage) {
          finalDiscount = Math.round(lineGross * (raw / 100));
        } else {
          finalDiscount = raw;
        }

        Cart.setItemDiscount(itemId, finalDiscount);
        closeModal();
        renderCart(container);
        toast.success('Line Discount Applied', `${fmt(finalDiscount)} deducted for ${ci.item.name}.`);
      });
    }
  });
}

// ── Quick Cash Checkout Execution [F8] ────────────────────────
async function executeQuickCashCheckout(container) {
  const cartItems = Cart.getItems();
  if (cartItems.length === 0) return;

  const activeSession = await getActiveSession();
  if (!activeSession) {
    toast.error('Session Closed', 'Please open a cash register session first.');
    return;
  }

  const netSubtotal = Cart.getSubtotal();
  const afterDisc   = Math.max(0, netSubtotal - discount);
  const tax         = Math.round(afterDisc * (taxRate / 100) * 100) / 100;
  const total       = afterDisc + tax;

  const quickCashBtn = container.querySelector('#btn-quick-cash');
  if (quickCashBtn) quickCashBtn.disabled = true;

  try {
    const storeName   = await getSetting('store_name', 'My Shop');
    const storeLogo   = await getSetting('store_logo', '');
    const storeAddr   = await getSetting('store_address', '');
    const storePhone  = await getSetting('store_phone', '');
    const receiptFooter = await getSetting('receipt_footer', 'Thank you for your visit!');
    const taxLabel    = await getSetting('tax_label', 'GST');
    const ntnTaxId    = await getSetting('ntn_tax_id', 'NTN-9842104-7');

    const result = await processSale(cartItems, {
      discount,
      taxRate,
      paymentMethod: 'Cash',
      cashTendered: total,
      customerId: selectedCustomerId || null,
      sessionId: activeSession.id
    });

    playBeepSound('success');
    toast.success('Cash Sale Complete', `Invoice ${result.receiptNo} settled in full (${fmt(total)}).`);

    // Open Thermal Receipt Modal
    showReceiptModal(cartItems, result, { storeName, storeLogo, storeAddr, storePhone, receiptFooter, taxLabel, ntnTaxId });

    // Reset cart
    Cart.clear();
    discount = 0;
    cashTendered = 0;
    selectedCustomerId = '';

    const discInput = container.querySelector('#discount-input');
    const custSelect = container.querySelector('#pos-customer-select');
    if (discInput) discInput.value = '0';
    if (custSelect) custSelect.value = '';

    renderCart(container);
    renderRecentSalesList(container);

    // Refresh stock numbers in catalog
    posItems = await db.items.toArray();
    renderPOSGrid(container);
    renderPopularItems(container);

  } catch (err) {
    toast.error('Checkout Failed', err.message);
  } finally {
    if (quickCashBtn) quickCashBtn.disabled = Cart.getItemCount() === 0;
  }
}

// ── Multi-Tender & Split Payment Modal [F9] ───────────────────
function openMultiTenderModal(container) {
  const cartItems = Cart.getItems();
  if (cartItems.length === 0) return;

  const netSubtotal = Cart.getSubtotal();
  const afterDisc   = Math.max(0, netSubtotal - discount);
  const tax         = Math.round(afterDisc * (taxRate / 100) * 100) / 100;
  const grandTotal  = afterDisc + tax;

  let activeMethod = 'Cash'; // 'Cash' | 'Card' | 'Digital' | 'Split'
  let splitCash = grandTotal;
  let splitCard = 0;
  let splitDigital = 0;
  let splitCardBrand = 'Visa';
  let splitCardRef = '';
  let splitDigitalProvider = 'JazzCash';
  let splitDigitalRef = '';

  const bodyHTML = `
    <!-- Top Balance Status Bar -->
    <div class="tender-summary-box">
      <div class="tender-summary-metric">
        <span class="tender-metric-label">Total Order</span>
        <span class="tender-metric-val mono">${fmt(grandTotal)}</span>
      </div>
      <div class="tender-summary-metric">
        <span class="tender-metric-label" id="tender-paid-label">Paid / Tendered</span>
        <span class="tender-metric-val mono paid" id="tender-paid-val">${fmt(grandTotal)}</span>
      </div>
      <div class="tender-summary-metric">
        <span class="tender-metric-label" id="tender-diff-label">Change Due</span>
        <span class="tender-metric-val mono change" id="tender-diff-val">Rs. 0</span>
      </div>
    </div>

    <!-- Payment Method Selector Tabs -->
    <div class="tender-tabs-wrap">
      <button type="button" class="tender-tab-btn active" data-method="Cash">
        ${icon('icon-cash')} Cash
      </button>
      <button type="button" class="tender-tab-btn" data-method="Card">
        ${icon('icon-card')} Card
      </button>
      <button type="button" class="tender-tab-btn" data-method="Digital">
        ${icon('icon-phone')} Digital Wallet
      </button>
      <button type="button" class="tender-tab-btn" data-method="Split">
        ${icon('icon-git-merge')} Split Tender
      </button>
    </div>

    <!-- Tab 1: Cash Pane -->
    <div id="pane-cash" class="tender-pane">
      <label class="form-label">Cash Tendered by Customer</label>
      <input type="number" class="form-input" id="tender-cash-input" value="${grandTotal}" min="0" step="any" style="font-size:1.25rem;font-weight:700;font-family:var(--font-mono);text-align:center;">
      
      <!-- Denomination Quick Presets -->
      <div class="denom-presets-bar">
        <button type="button" class="denom-btn" data-add="exact">Exact</button>
        <button type="button" class="denom-btn" data-add="100">+100</button>
        <button type="button" class="denom-btn" data-add="500">+500</button>
        <button type="button" class="denom-btn" data-add="1000">+1,000</button>
        <button type="button" class="denom-btn" data-add="5000">+5,000</button>
      </div>
    </div>

    <!-- Tab 2: Card Pane -->
    <div id="pane-card" class="tender-pane" style="display:none;">
      <div class="form-group">
        <label class="form-label">Card Network / Type</label>
        <select class="form-select" id="card-network">
          <option value="Visa">Visa Credit / Debit</option>
          <option value="MasterCard">MasterCard</option>
          <option value="PayPak">PayPak (Local)</option>
          <option value="UnionPay">UnionPay</option>
        </select>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Approval Code / Last 4 Digits (Optional)</label>
        <input type="text" class="form-input" id="card-auth-ref" placeholder="e.g. 4821 or TXN-9841">
      </div>
    </div>

    <!-- Tab 3: Digital Wallet Pane -->
    <div id="pane-digital" class="tender-pane" style="display:none;">
      <div class="form-group">
        <label class="form-label">Digital Payment Provider</label>
        <select class="form-select" id="digital-provider">
          <option value="JazzCash">JazzCash</option>
          <option value="EasyPaisa">EasyPaisa</option>
          <option value="NayaPay">NayaPay</option>
          <option value="SadaPay">SadaPay</option>
          <option value="Bank Transfer / Raast">Bank Transfer / Raast</option>
        </select>
      </div>
      <div class="form-group" style="margin-top:var(--space-2)">
        <label class="form-label">Sender Mobile / Transaction Ref ID</label>
        <input type="text" class="form-input" id="digital-ref-id" placeholder="e.g. 03001234567 or TID-98271">
      </div>
    </div>

    <!-- Tab 4: Split Tender Pane -->
    <div id="pane-split" class="tender-pane" style="display:none;">
      <p class="text-xs text-secondary" style="margin-bottom:var(--space-2)">
        Distribute payment across multiple methods until Balance Remaining is Rs. 0:
      </p>

      <!-- Split 1: Cash -->
      <div class="split-tender-row">
        <div style="font-weight:700;font-size:0.8125rem;display:flex;align-items:center;gap:4px">
          ${icon('icon-cash')} Cash
        </div>
        <input type="number" class="form-input" id="split-val-cash" value="${grandTotal}" min="0" step="any" style="font-family:var(--font-mono);font-weight:700;">
        <button type="button" class="btn btn-ghost btn-xs btn-fill-balance" data-target="cash">Fill</button>
      </div>

      <!-- Split 2: Card -->
      <div class="split-tender-row">
        <div style="font-weight:700;font-size:0.8125rem;display:flex;align-items:center;gap:4px">
          ${icon('icon-card')} Card
        </div>
        <input type="number" class="form-input" id="split-val-card" value="0" min="0" step="any" style="font-family:var(--font-mono);font-weight:700;">
        <button type="button" class="btn btn-ghost btn-xs btn-fill-balance" data-target="card">Fill</button>
      </div>

      <!-- Split 3: Digital -->
      <div class="split-tender-row">
        <div style="font-weight:700;font-size:0.8125rem;display:flex;align-items:center;gap:4px">
          ${icon('icon-phone')} Digital
        </div>
        <input type="number" class="form-input" id="split-val-digital" value="0" min="0" step="any" style="font-family:var(--font-mono);font-weight:700;">
        <button type="button" class="btn btn-ghost btn-xs btn-fill-balance" data-target="digital">Fill</button>
      </div>
    </div>
  `;

  openModal({
    id: 'pos-pay-modal',
    title: `Complete Settlement · ${fmt(grandTotal)}`,
    bodyHTML,
    footerHTML: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel [Esc]</button>
      <button class="btn btn-primary" id="btn-confirm-payment">
        ${icon('icon-check')} Settle Transaction [Enter]
      </button>
    `,
    size: '',
    onOpen: (backdrop) => {
      const confirmBtn = backdrop.querySelector('#btn-confirm-payment');
      const paidValEl  = backdrop.querySelector('#tender-paid-val');
      const diffLabelEl = backdrop.querySelector('#tender-diff-label');
      const diffValEl  = backdrop.querySelector('#tender-diff-val');
      const cashInput  = backdrop.querySelector('#tender-cash-input');

      // Focus cash tendered
      setTimeout(() => { cashInput?.focus(); cashInput?.select(); }, 50);

      const updateCalculations = () => {
        let totalTendered = 0;
        let balanceRemaining = 0;
        let changeDue = 0;

        if (activeMethod === 'Cash') {
          totalTendered = parseFloat(cashInput.value) || 0;
          if (totalTendered >= grandTotal) {
            changeDue = totalTendered - grandTotal;
            diffLabelEl.textContent = 'Change Due';
            diffValEl.textContent = fmt(changeDue);
            diffValEl.className = 'tender-metric-val mono change';
            confirmBtn.disabled = false;
          } else {
            balanceRemaining = grandTotal - totalTendered;
            diffLabelEl.textContent = 'Balance Due';
            diffValEl.textContent = fmt(balanceRemaining);
            diffValEl.className = 'tender-metric-val mono due';
            confirmBtn.disabled = true;
          }
          paidValEl.textContent = fmt(totalTendered);

        } else if (activeMethod === 'Card' || activeMethod === 'Digital') {
          totalTendered = grandTotal;
          paidValEl.textContent = fmt(grandTotal);
          diffLabelEl.textContent = 'Balance Due';
          diffValEl.textContent = 'Rs. 0';
          diffValEl.className = 'tender-metric-val mono change';
          confirmBtn.disabled = false;

        } else if (activeMethod === 'Split') {
          const sCash = parseFloat(backdrop.querySelector('#split-val-cash').value) || 0;
          const sCard = parseFloat(backdrop.querySelector('#split-val-card').value) || 0;
          const sDig  = parseFloat(backdrop.querySelector('#split-val-digital').value) || 0;
          totalTendered = sCash + sCard + sDig;
          paidValEl.textContent = fmt(totalTendered);

          if (totalTendered >= grandTotal) {
            changeDue = totalTendered - grandTotal;
            diffLabelEl.textContent = changeDue > 0 ? 'Change Due (Cash)' : 'Balance Settled';
            diffValEl.textContent = fmt(changeDue);
            diffValEl.className = 'tender-metric-val mono change';
            confirmBtn.disabled = false;
          } else {
            balanceRemaining = grandTotal - totalTendered;
            diffLabelEl.textContent = 'Remaining Due';
            diffValEl.textContent = fmt(balanceRemaining);
            diffValEl.className = 'tender-metric-val mono due';
            confirmBtn.disabled = true;
          }
        }
      };

      // Method tab switching
      backdrop.querySelectorAll('.tender-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeMethod = btn.dataset.method;
          backdrop.querySelectorAll('.tender-tab-btn').forEach(b => b.classList.toggle('active', b === btn));

          backdrop.querySelector('#pane-cash').style.display    = activeMethod === 'Cash' ? 'block' : 'none';
          backdrop.querySelector('#pane-card').style.display    = activeMethod === 'Card' ? 'block' : 'none';
          backdrop.querySelector('#pane-digital').style.display = activeMethod === 'Digital' ? 'block' : 'none';
          backdrop.querySelector('#pane-split').style.display   = activeMethod === 'Split' ? 'block' : 'none';

          updateCalculations();
        });
      });

      // Denomination presets
      backdrop.querySelectorAll('.denom-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.add;
          if (action === 'exact') {
            cashInput.value = grandTotal;
          } else {
            const add = parseFloat(action) || 0;
            cashInput.value = (parseFloat(cashInput.value) || 0) + add;
          }
          updateCalculations();
        });
      });

      // Cash input change
      cashInput?.addEventListener('input', updateCalculations);

      // Split inputs changes
      ['cash', 'card', 'digital'].forEach(k => {
        const inp = backdrop.querySelector(`#split-val-${k}`);
        inp?.addEventListener('input', updateCalculations);
      });

      // Split Fill buttons
      backdrop.querySelectorAll('.btn-fill-balance').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.target;
          let currentOther = 0;
          if (target === 'cash') {
            currentOther = (parseFloat(backdrop.querySelector('#split-val-card').value) || 0) +
                           (parseFloat(backdrop.querySelector('#split-val-digital').value) || 0);
            backdrop.querySelector('#split-val-cash').value = Math.max(0, grandTotal - currentOther);
          } else if (target === 'card') {
            currentOther = (parseFloat(backdrop.querySelector('#split-val-cash').value) || 0) +
                           (parseFloat(backdrop.querySelector('#split-val-digital').value) || 0);
            backdrop.querySelector('#split-val-card').value = Math.max(0, grandTotal - currentOther);
          } else if (target === 'digital') {
            currentOther = (parseFloat(backdrop.querySelector('#split-val-cash').value) || 0) +
                           (parseFloat(backdrop.querySelector('#split-val-card').value) || 0);
            backdrop.querySelector('#split-val-digital').value = Math.max(0, grandTotal - currentOther);
          }
          updateCalculations();
        });
      });

      // Confirm Payment Submission
      confirmBtn.addEventListener('click', async () => {
        const activeSession = await getActiveSession();
        if (!activeSession) {
          toast.error('Session Closed', 'Please open a cash register session first.');
          return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `${icon('icon-refresh', 'animate-spin')} Processing...`;

        let paymentPayload = {
          discount,
          taxRate,
          paymentMethod: activeMethod,
          cashTendered: 0,
          changeDue: 0,
          customerId: selectedCustomerId || null,
          sessionId: activeSession.id
        };

        if (activeMethod === 'Cash') {
          const tendered = parseFloat(cashInput.value) || grandTotal;
          paymentPayload.cashTendered = tendered;
          paymentPayload.changeDue = Math.max(0, tendered - grandTotal);

        } else if (activeMethod === 'Card') {
          paymentPayload.cardRef = backdrop.querySelector('#card-auth-ref').value.trim() || 'N/A';
          paymentPayload.paymentMethod = `Card (${backdrop.querySelector('#card-network').value})`;

        } else if (activeMethod === 'Digital') {
          paymentPayload.digitalProvider = backdrop.querySelector('#digital-provider').value;
          paymentPayload.digitalRef = backdrop.querySelector('#digital-ref-id').value.trim() || 'N/A';
          paymentPayload.paymentMethod = `Digital (${paymentPayload.digitalProvider})`;

        } else if (activeMethod === 'Split') {
          const sCash = parseFloat(backdrop.querySelector('#split-val-cash').value) || 0;
          const sCard = parseFloat(backdrop.querySelector('#split-val-card').value) || 0;
          const sDig  = parseFloat(backdrop.querySelector('#split-val-digital').value) || 0;
          const splitArr = [];

          if (sCash > 0) splitArr.push({ method: 'Cash', amount: sCash });
          if (sCard > 0) splitArr.push({ method: 'Card', amount: sCard, ref: 'Visa/MC' });
          if (sDig > 0) splitArr.push({ method: 'Digital', amount: sDig, ref: 'Wallet' });

          paymentPayload.paymentMethod = 'Split';
          paymentPayload.splitDetails = splitArr;
          paymentPayload.cashTendered = sCash;
          paymentPayload.changeDue = Math.max(0, (sCash + sCard + sDig) - grandTotal);
        }

        try {
          const storeName   = await getSetting('store_name', 'My Shop');
          const storeLogo   = await getSetting('store_logo', '');
          const storeAddr   = await getSetting('store_address', '');
          const storePhone  = await getSetting('store_phone', '');
          const receiptFooter = await getSetting('receipt_footer', 'Thank you for your business!');
          const taxLabel    = await getSetting('tax_label', 'GST');
          const ntnTaxId    = await getSetting('ntn_tax_id', 'NTN-9842104-7');

          const result = await processSale(cartItems, paymentPayload);

          closeModal();
          playBeepSound('success');
          toast.success('Payment Succeeded', `Invoice ${result.receiptNo} settled (${fmt(grandTotal)}).`);

          // Open Thermal Receipt Modal
          showReceiptModal(cartItems, result, { storeName, storeAddr, storePhone, receiptFooter, taxLabel, ntnTaxId });

          // Clear cart
          Cart.clear();
          discount = 0;
          cashTendered = 0;
          selectedCustomerId = '';

          const discInput = container.querySelector('#discount-input');
          const custSelect = container.querySelector('#pos-customer-select');
          if (discInput) discInput.value = '0';
          if (custSelect) custSelect.value = '';

          renderCart(container);
          renderRecentSalesList(container);

          // Refresh catalog
          posItems = await db.items.toArray();
          renderPOSGrid(container);
          renderPopularItems(container);

        } catch (err) {
          toast.error('Transaction Failed', err.message);
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `${icon('icon-check')} Settle Transaction [Enter]`;
        }
      });

      // Allow pressing Enter to submit
      backdrop.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !confirmBtn.disabled) {
          e.preventDefault();
          confirmBtn.click();
        }
      });

      updateCalculations();
    }
  });
}

// ── Professional Thermal Receipt Engine (58mm & 80mm) ─────────
function showReceiptModal(cartItems, result, storeInfo, timestamp = null) {
  const { subtotal, discountAmt, taxAmount, total, changeDue, receiptNo, paymentMethod, splitDetails, cardRef, digitalProvider, digitalRef } = result;
  const { storeName, storeLogo, storeAddr, storePhone, receiptFooter, taxLabel, ntnTaxId } = storeInfo;
  const dateStr = fmtDateTime(timestamp || new Date().toISOString());

  let activePaperSize = '80mm'; // '80mm' | '58mm'

  // Build Itemized Rows HTML
  const itemsHTML = cartItems.map(ci => {
    const lineNet = Math.max(0, (ci.unit_price * ci.qty) - (ci.discount || 0));
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;font-size:0.75rem;">
        <div style="flex:1;padding-right:6px;word-break:break-word;">
          <div><strong>${ci.item.name}</strong></div>
          <div style="font-size:0.7rem;color:#555;">${ci.qty} @ ${fmt(ci.unit_price)}${ci.discount > 0 ? ` (-${fmt(ci.discount)})` : ''}</div>
        </div>
        <div style="min-width:55px;text-align:right;font-weight:700;">
          ${fmt(lineNet)}
        </div>
      </div>
    `;
  }).join('');

  // Tender breakdown text
  let tenderDetailsHTML = '';
  if (paymentMethod === 'Cash') {
    tenderDetailsHTML = `
      <div style="display:flex;justify-content:space-between;"><span>Method:</span><span>CASH</span></div>
      ${result.cashReceived ? `<div style="display:flex;justify-content:space-between;"><span>Tendered:</span><span>${fmt(result.cashReceived + changeDue)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;"><span>Change:</span><span>${fmt(changeDue)}</span></div>
    `;
  } else if (paymentMethod === 'Split' && Array.isArray(splitDetails)) {
    tenderDetailsHTML = `
      <div style="display:flex;justify-content:space-between;"><span>Method:</span><span>SPLIT TENDER</span></div>
      ${splitDetails.map(s => `<div style="display:flex;justify-content:space-between;padding-left:8px;"><span>- ${s.method}:</span><span>${fmt(s.amount)}</span></div>`).join('')}
      ${changeDue > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Change:</span><span>${fmt(changeDue)}</span></div>` : ''}
    `;
  } else {
    tenderDetailsHTML = `
      <div style="display:flex;justify-content:space-between;"><span>Method:</span><span>${paymentMethod.toUpperCase()}</span></div>
      ${cardRef ? `<div style="display:flex;justify-content:space-between;"><span>Auth Ref:</span><span>${cardRef}</span></div>` : ''}
      ${digitalRef ? `<div style="display:flex;justify-content:space-between;"><span>Txn Ref:</span><span>${digitalRef}</span></div>` : ''}
    `;
  }

  // QR Code payload
  const qrVerificationPayload = `INV:${receiptNo}|TOTAL:${total}|DATE:${dateStr}`;
  const qrCodeSVG = generateMockQRCodeSVG(qrVerificationPayload);

  const getReceiptHTML = (is58mm = false) => `
    <div class="thermal-receipt-container ${is58mm ? 'size-58mm' : 'size-80mm'}">
      <div style="text-align:center;margin-bottom:6px;">
        ${storeLogo ? `<div style="margin-bottom:6px;text-align:center"><img src="${storeLogo}" alt="Logo" style="max-height:46px;max-width:140px;object-fit:contain;filter:grayscale(100%) contrast(140%);display:inline-block;" /></div>` : ''}
        <div style="font-size:1.15rem;font-weight:900;letter-spacing:0.04em;">${storeName.toUpperCase()}</div>
        ${storeAddr ? `<div style="font-size:0.75rem;">${storeAddr}</div>` : ''}
        ${storePhone ? `<div style="font-size:0.75rem;">Phone: ${storePhone}</div>` : ''}
        ${ntnTaxId ? `<div style="font-size:0.75rem;font-weight:700;margin-top:2px;">NTN / TAX ID: ${ntnTaxId}</div>` : ''}
      </div>

      <div style="border-top:1px dashed #000;margin:6px 0;"></div>

      <div style="font-size:0.75rem;display:flex;justify-content:space-between;">
        <span>Inv: ${receiptNo.split('-')[1] || receiptNo}</span>
        <span>${dateStr.split(' ')[0]} ${dateStr.split(' ')[1] || ''}</span>
      </div>
      <div style="font-size:0.75rem;margin-top:2px;">
        <span>Cashier: Admin</span> · <span>Term: 01</span>
      </div>

      <div style="border-top:1px dashed #000;margin:6px 0;"></div>

      <!-- Table Header -->
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:0.75rem;border-bottom:1px dashed #000;padding-bottom:3px;margin-bottom:4px;">
        <span>ITEM</span>
        <span>TOTAL</span>
      </div>

      <!-- Items List -->
      ${itemsHTML}

      <div style="border-top:1px dashed #000;margin:6px 0;"></div>

      <!-- Totals Section -->
      <div style="font-size:0.75rem;display:flex;flex-direction:column;gap:2px;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>${fmt(subtotal)}</span></div>
        ${discountAmt > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount:</span><span>-${fmt(discountAmt)}</span></div>` : ''}
        ${taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>${taxLabel} (${taxRate}%):</span><span>${fmt(taxAmount)}</span></div>` : ''}
        <div style="border-top:2px solid #000;margin:4px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:1.05rem;font-weight:900;"><span>TOTAL:</span><span>${fmt(total)}</span></div>
        <div style="border-top:1px dashed #000;margin:4px 0;"></div>
        ${tenderDetailsHTML}
      </div>

      <!-- QR Code for local verification -->
      <div style="text-align:center;margin-top:10px;">
        ${qrCodeSVG}
        <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.05em;margin-top:2px;">SCAN TO VERIFY INVOICE</div>
      </div>

      <!-- Footer Policy -->
      <div style="border-top:1px dashed #000;margin:8px 0 6px;"></div>
      <div style="text-align:center;font-size:0.7rem;line-height:1.3;">
        ${receiptFooter}
      </div>
    </div>
  `;

  const bodyHTML = `
    <!-- Paper Format Selector -->
    <div style="display:flex;justify-content:center;margin-bottom:var(--space-3)">
      <div class="receipt-paper-toggle">
        <button type="button" class="btn btn-ghost btn-sm ${activePaperSize === '80mm' ? 'active' : ''}" id="paper-opt-80" style="padding:4px 14px;font-size:0.75rem;">
          🖨️ 80mm Standard
        </button>
        <button type="button" class="btn btn-ghost btn-sm ${activePaperSize === '58mm' ? 'active' : ''}" id="paper-opt-58" style="padding:4px 14px;font-size:0.75rem;">
          🧾 58mm Compact
        </button>
      </div>
    </div>

    <div id="receipt-preview-wrapper">
      ${getReceiptHTML(false)}
    </div>
  `;


  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    <button class="btn btn-primary" id="receipt-print-btn">
      ${icon('icon-print')} Print Thermal Receipt
    </button>
  `;

  openModal({
    id: 'receipt-modal',
    title: `Transaction Completed · ${receiptNo}`,
    bodyHTML,
    footerHTML,
    onOpen: (backdrop) => {
      const p80Btn = backdrop.querySelector('#paper-opt-80');
      const p58Btn = backdrop.querySelector('#paper-opt-58');
      const wrapEl = backdrop.querySelector('#receipt-preview-wrapper');

      p80Btn.addEventListener('click', () => {
        activePaperSize = '80mm';
        p80Btn.classList.add('active');
        p58Btn.classList.remove('active');
        wrapEl.innerHTML = getReceiptHTML(false);
      });

      p58Btn.addEventListener('click', () => {
        activePaperSize = '58mm';
        p58Btn.classList.add('active');
        p80Btn.classList.remove('active');
        wrapEl.innerHTML = getReceiptHTML(true);
      });

      backdrop.querySelector('#receipt-print-btn').addEventListener('click', () => {
        const is58 = activePaperSize === '58mm';
        const printClass = is58 ? 'printing-receipt-58mm' : 'printing-receipt-80mm';
        const rawHTML = `
          <div class="print-receipt">
            ${storeLogo ? `<img src="${storeLogo}" class="r-logo" alt="Logo" />` : ''}
            <div class="r-store-name">${storeName.toUpperCase()}</div>
            ${storeAddr ? `<div class="r-store-sub">${storeAddr}</div>` : ''}
            ${storePhone ? `<div class="r-store-sub">Phone: ${storePhone}</div>` : ''}
            ${ntnTaxId ? `<div class="r-ntn">NTN / TAX ID: ${ntnTaxId}</div>` : ''}
            <div class="r-divider"></div>
            <div class="r-order-info" style="display:flex;justify-content:space-between">
              <span>Inv: ${receiptNo.split('-')[1] || receiptNo}</span>
              <span>${dateStr}</span>
            </div>
            <div class="r-order-info">Cashier: Admin · Term: 01</div>
            <div class="r-divider"></div>
            <div class="r-table-header">
              <span>ITEM</span>
              <span>TOTAL</span>
            </div>
            ${cartItems.map(ci => {
              const lNet = Math.max(0, (ci.unit_price * ci.qty) - (ci.discount || 0));
              return `
                <div class="r-item">
                  <div class="r-item-name">${ci.item.name} (${ci.qty}x)</div>
                  <div class="r-item-price">${fmt(lNet)}</div>
                </div>
              `;
            }).join('')}
            <div class="r-divider"></div>
            <div class="r-subtotal-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
            ${discountAmt > 0 ? `<div class="r-subtotal-row"><span>Discount</span><span>-${fmt(discountAmt)}</span></div>` : ''}
            ${taxAmount > 0 ? `<div class="r-subtotal-row"><span>${taxLabel} (${taxRate}%)</span><span>${fmt(taxAmount)}</span></div>` : ''}
            <div class="r-divider-solid"></div>
            <div class="r-total-row"><span>TOTAL</span><span>${fmt(total)}</span></div>
            <div class="r-divider"></div>
            <div class="r-change-row"><span>Payment:</span><span>${paymentMethod.toUpperCase()}</span></div>
            ${paymentMethod === 'Cash' ? `
              <div class="r-change-row"><span>Tendered:</span><span>${fmt((result.cashReceived || 0) + changeDue)}</span></div>
              <div class="r-change-row"><span>Change:</span><span>${fmt(changeDue)}</span></div>
            ` : ''}
            ${paymentMethod === 'Split' && Array.isArray(splitDetails) ? `
              ${splitDetails.map(s => `<div class="r-change-row"><span>- ${s.method}:</span><span>${fmt(s.amount)}</span></div>`).join('')}
              ${changeDue > 0 ? `<div class="r-change-row"><span>Change:</span><span>${fmt(changeDue)}</span></div>` : ''}
            ` : ''}
            <div class="r-qr">
              ${qrCodeSVG}
              <div class="r-qr-label">Scan to verify invoice</div>
            </div>
            <div class="r-footer">${receiptFooter}</div>
          </div>
        `;
        printElement(rawHTML, printClass);
      });
    }
  });
}

// ── Static Offline QR Code Generator ──────────────────────────
function generateMockQRCodeSVG(text = 'RCP-12345') {
  const size = 25;
  const grid = Array(size).fill(null).map(() => Array(size).fill(0));
  
  const drawLocator = (rx, ry) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        if (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) {
          grid[ry + y][rx + x] = 1;
        }
      }
    }
  };
  
  drawLocator(0, 0);
  drawLocator(size - 7, 0);
  drawLocator(0, size - 7);
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9)) continue;
      const val = (Math.abs(hash ^ (x * 12345 + y * 67890)) % 100) > 42 ? 1 : 0;
      grid[y][x] = val;
    }
  }
  
  let paths = '';
  const cellW = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x] === 1) {
        paths += `M${x * cellW} ${y * cellW}h${cellW}v${cellW}h-${cellW}z `;
      }
    }
  }
  
  return `
    <svg viewBox="0 0 ${size * cellW} ${size * cellW}" width="70" height="70" style="display:block;margin:6px auto;color:#000000">
      <path d="${paths}" fill="currentColor"/>
    </svg>
  `;
}
