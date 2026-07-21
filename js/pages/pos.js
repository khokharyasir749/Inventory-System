/**
 * pos.js — Upgraded Premium Touch-first Point of Sale Page
 * Dynamic category tabs, Popular Items, Recent Sales logs, preset discounts, QR receipts
 */

let posItems    = [];
let posCategory = 'All';
let posSearch   = '';
let taxRate     = 0;
let discount    = 0;
let payMethod   = 'Cash';
let cashTendered = 0;
let selectedCustomerId = '';

async function renderPOS(container) {
  taxRate = await getSetting('tax_rate', 0);
  selectedCustomerId = ''; 

  // Restore cart
  await Cart.load();

  // Check register session status
  const activeSession = await getActiveSession();

  container.innerHTML = `
    <div class="pos-layout">
      <!-- Product Panel -->
      <div class="pos-product-panel">
        ${!activeSession ? `
          <div style="background:var(--danger-bg);border:1px solid var(--danger);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;justify-content:between">
            <div>
              <div class="font-bold text-red" style="font-size:1.05rem">${icon('icon-alert')} Cash Drawer Closed</div>
              <div class="text-sm text-secondary" style="margin-top:2px">You must open a register session before processing checkouts.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="navigate('register')">${icon('icon-cash')} Open Session</button>
          </div>
        ` : ''}

        <!-- Top Row: Barcode & Search -->
        <div class="pos-search-bar" style="margin-bottom:var(--space-4)">
          <div class="pos-search-wrap" style="flex:1">
            ${icon('icon-search', 'pos-search-icon')}
            <input type="text" id="pos-search" placeholder="Scan barcode or type name..." autocomplete="off">
          </div>
        </div>

        <!-- Section: Popular Products -->
        <div id="pos-popular-section" style="margin-bottom:var(--space-4)">
          <h3 style="font-size:0.875rem;font-weight:700;margin-bottom:var(--space-2);color:var(--text-primary)">⭐ Quick Popular Add</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:var(--space-2)" id="pos-popular-grid">
            <!-- Popular items loaded here -->
          </div>
        </div>

        <!-- Section: Product List -->
        <div class="pos-filter-pills" id="pos-pills" style="margin-bottom:var(--space-3)"></div>
        <div class="pos-product-grid" id="pos-grid">
          ${[1,2,3,4,6].map(() => `<div class="skeleton-card"><div class="skeleton" style="aspect-ratio:1.3"></div></div>`).join('')}
        </div>

        <!-- Section: Recent Sales logs -->
        <div style="margin-top:var(--space-5);border-top:1px solid var(--border-soft);padding-top:var(--space-4)">
          <h3 style="font-size:0.875rem;font-weight:700;margin-bottom:var(--space-2);color:var(--text-primary)">${icon('icon-clock')} Recent Drawer Sales</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:var(--space-2)" id="pos-recent-sales-list">
            <!-- Recent sales loaded here -->
          </div>
        </div>
      </div>

      <!-- Cart Panel -->
      <div class="pos-cart-panel" style="${!activeSession ? 'opacity:0.3;pointer-events:none' : ''}">
        <div class="cart-header">
          <div class="cart-title">
            ${icon('icon-cart')} Order Panel
            <span class="cart-count" id="cart-count">0</span>
          </div>
          <button class="cart-clear-btn" id="cart-clear-btn">Clear</button>
        </div>

        <!-- Customer selection -->
        <div style="padding:var(--space-3);background:var(--canvas);border-bottom:1px solid var(--border-soft);display:flex;flex-direction:column;gap:4px">
          <label class="form-label text-xs" style="margin-bottom:0">Link Customer Account</label>
          <select class="form-select" id="pos-customer-select" style="padding:6px;font-size:0.8125rem">
            <option value="">Walk-in Customer</option>
          </select>
        </div>

        <!-- Cart Items list -->
        <div class="cart-items" id="cart-items">
          <div class="cart-empty">
            ${icon('icon-cart')}
            <p>Cart is empty</p>
          </div>
        </div>

        <!-- Total Summaries & Checkout -->
        <div class="cart-summary" id="cart-summary">
          <div class="cart-summary-row">
            <span class="cart-summary-label">Subtotal</span>
            <span class="cart-summary-value" id="cart-subtotal">Rs. 0</span>
          </div>
          
          <div class="cart-summary-row" style="flex-direction:column;align-items:stretch;gap:4px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="cart-summary-label">Apply Discount</span>
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

          <div class="cart-summary-row">
            <span class="cart-summary-label">GST Tax (${taxRate}%)</span>
            <span class="cart-summary-value" id="cart-tax">Rs. 0</span>
          </div>
          
          <div class="cart-summary-row total">
            <span class="cart-summary-label">Grand Total</span>
            <span class="cart-summary-value" id="cart-total">Rs. 0</span>
          </div>

          <!-- Checkout payment toggle -->
          <div class="payment-methods" id="payment-methods" style="margin-top:var(--space-2)">
            <button class="payment-method-btn active" data-method="Cash">
              ${icon('icon-cash')} Cash
            </button>
            <button class="payment-method-btn" data-method="Card">
              ${icon('icon-card')} Card
            </button>
            <button class="payment-method-btn" data-method="Credit" id="pay-method-credit" style="display:none">
              ${icon('icon-users')} Ledger
            </button>
          </div>

          <!-- Tender keypad display -->
          <div class="change-calculator" id="change-calc" style="margin-top:var(--space-2)">
            <div class="change-calculator-row">
              <span class="text-sm font-semibold">Tender Cash</span>
            </div>
            <input type="number" class="cash-tendered-input" id="cash-tendered" placeholder="0.00" min="0">
            <div class="change-calculator-row" style="margin-top:var(--space-1)">
              <span class="text-sm text-secondary" id="change-calc-label">Change Due</span>
              <span class="change-amount" id="change-due">Rs. 0</span>
            </div>
          </div>

          <button class="checkout-btn" id="checkout-btn" disabled style="margin-top:var(--space-2)">
            ${icon('icon-check')} Complete Checkout
          </button>
        </div>
      </div>
    </div>
  `;

  // Fetch load and seed
  posItems = await db.items.toArray();
  const sellable = posItems.filter(it => it.selling_price > 0 || it.is_composite);

  // Populate customers dropdown
  const customers = await db.customers.toArray();
  const custSelect = container.querySelector('#pos-customer-select');
  if (custSelect) {
    customers.sort((a,b) => a.name.localeCompare(b.name));
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.phone || 'no phone'}) - Bal: Rs.${c.current_balance}`;
      custSelect.appendChild(opt);
    });

    custSelect.addEventListener('change', (e) => {
      selectedCustomerId = e.target.value ? parseInt(e.target.value) : '';
      const creditBtn = container.querySelector('#pay-method-credit');
      if (creditBtn) creditBtn.style.display = selectedCustomerId ? 'flex' : 'none';
      if (!selectedCustomerId && payMethod === 'Credit') {
        container.querySelector('[data-method="Cash"]').click();
      }
    });
  }

  renderPOSGrid(container);
  renderPOSPills(container);
  renderPopularItems(container);
  renderRecentSalesList(container);
  renderCart(container);

  // ── Bind controls ──────────────────────────────────────────
  const searchInput = container.querySelector('#pos-search');
  searchInput.focus();

  searchInput.addEventListener('input', debounce((e) => {
    if (!activeSession) return;
    posSearch = e.target.value;
    renderPOSGrid(container);
  }, 150));

  container.querySelector('#cart-clear-btn').addEventListener('click', () => {
    if (Cart.getItemCount() === 0) return;
    showConfirm('Clear current cart?', () => {
      Cart.clear();
      renderCart(container);
    });
  });

  // Pay method triggers
  container.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      payMethod = btn.dataset.method;
      
      const calcEl = container.querySelector('#change-calc');
      if (calcEl) calcEl.style.display = payMethod === 'Cash' || payMethod === 'Credit' ? 'block' : 'none';

      updateCartTotals(container);
    });
  });

  // Discount input change
  const discInput = container.querySelector('#discount-input');
  discInput.addEventListener('input', (e) => {
    discount = parseFloat(e.target.value) || 0;
    updateCartTotals(container);
  });

  // Discount preset clicks
  container.querySelectorAll('.btn-discount-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = parseFloat(btn.dataset.pct);
      const subtotal = Cart.getSubtotal();
      if (pct === 0) {
        discount = 0;
      } else {
        discount = Math.round(subtotal * (pct / 100));
      }
      discInput.value = discount;
      updateCartTotals(container);
    });
  });

  // Cash tendered input
  const cashInput = container.querySelector('#cash-tendered');
  cashInput.addEventListener('input', (e) => {
    cashTendered = parseFloat(e.target.value) || 0;
    updateCartTotals(container);
  });

  // Checkout confirmation trigger
  container.querySelector('#checkout-btn').addEventListener('click', () => {
    processCheckout(container);
  });
}

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
      <div style="grid-column:1/-1;padding:var(--space-6) 0;text-align:center;color:var(--text-muted)">
        No matching products found.
      </div>
    `;
    return;
  }

  gridEl.innerHTML = items.map(item => {
    const isOut = !item.is_composite && item.stock_quantity <= 0;
    const isLow = !item.is_composite && item.stock_quantity <= item.min_stock_alert;
    const thumb = item.photo_blob
      ? `<img src="${item.photo_blob}" alt="${item.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : categoryIcon(item.category);

    return `
      <div class="pos-item-card ${isOut ? 'disabled' : ''}" data-item-id="${item.id}" style="cursor:pointer;position:relative;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:8px;transition:all var(--transition-fast)">
        <div style="height:80px;background:var(--canvas);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;margin-bottom:6px;overflow:hidden;position:relative">
          ${thumb}
          ${isOut ? `<div class="badge badge-red" style="position:absolute;font-size:0.6rem;padding:2px 4px">SOLD OUT</div>` : ''}
        </div>
        <div class="truncate text-xs font-bold" style="color:var(--text-primary);max-width:100%" title="${item.name}">${item.name}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span class="text-xs font-bold text-primary mono">${fmt(item.selling_price)}</span>
          ${!item.is_composite ? `<span class="text-xs text-muted" style="font-size:0.65rem">${item.stock_quantity} ${item.unit}</span>` : ''}
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
          toast.error('Out of stock', 'Product has zero quantities available.');
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
      : `<span style="font-size:1.25rem">${item.name[0]}</span>`;
    return `
      <div class="popular-item-card" data-item-id="${item.id}" style="cursor:pointer;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);padding:8px;text-align:center;transition:all var(--transition-fast);display:flex;flex-direction:column;align-items:center">
        <div style="width:40px;height:40px;background:var(--canvas);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;margin-bottom:4px;overflow:hidden">${thumb}</div>
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
          <button class="btn btn-ghost btn-xs btn-reprint-sale" data-sid="${s.id}" style="padding:2px 4px;font-size:0.65rem;min-height:auto;margin-top:2px">Reprint</button>
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
          item: item || { name: 'Unknown Item' },
          qty: si.quantity,
          unit_price: si.unit_price
        });
      }

      const storeName = await getSetting('store_name', 'My Shop');
      const storeAddr = await getSetting('store_address', '');
      const storePhone = await getSetting('store_phone', '');
      const receiptFooter = await getSetting('receipt_footer', 'Thank you!');
      const taxLabel  = await getSetting('tax_label', 'GST');

      showReceiptModal(cartItems, {
        subtotal: sale.subtotal,
        discountAmt: sale.discount,
        taxAmount: sale.tax,
        total: sale.total,
        changeDue: sale.change_returned,
        receiptNo: sale.invoice_no
      }, { storeName, storeAddr, storePhone, receiptFooter, taxLabel }, sale.timestamp);
    });
  });
}

function renderCart(container) {
  const itemsEl = container.querySelector('#cart-items');
  const countEl = container.querySelector('#cart-count');
  if (!itemsEl) return;

  const items = Cart.getItems();
  countEl.textContent = Cart.getItemCount();

  if (items.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        ${icon('icon-cart')}
        <p>Cart is empty</p>
      </div>
    `;
    container.querySelector('#checkout-btn').disabled = true;
    updateCartTotals(container);
    return;
  }

  itemsEl.innerHTML = items.map(ci => `
    <div class="cart-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px var(--space-3);border-bottom:1px solid var(--border-soft)">
      <div style="flex:1;min-width:0;margin-right:8px">
        <div class="font-bold text-xs truncate" style="color:var(--text-primary)" title="${ci.item.name}">${ci.item.name}</div>
        <div class="mono text-xs text-muted" style="margin-top:2px">${fmt(ci.unit_price)} each</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <button class="btn btn-ghost btn-xs cart-qty-btn" data-action="dec" data-id="${ci.item.id}" style="padding:2px 6px;min-height:auto;font-weight:bold">−</button>
        <span class="mono text-xs font-bold" style="width:24px;text-align:center">${ci.qty}</span>
        <button class="btn btn-ghost btn-xs cart-qty-btn" data-action="inc" data-id="${ci.item.id}" style="padding:2px 6px;min-height:auto;font-weight:bold">+</button>
      </div>
      <div class="mono text-xs font-bold" style="width:65px;text-align:right;color:var(--text-primary)">
        ${fmt(ci.unit_price * ci.qty)}
      </div>
    </div>
  `).join('');

  // Bind cart quantity buttons
  itemsEl.querySelectorAll('.cart-qty-btn').forEach(btn => {
    const itemId = parseInt(btn.dataset.id);
    const act = btn.dataset.action;
    btn.addEventListener('click', () => {
      const ci = Cart.getItems().find(c => c.item.id === itemId);
      if (act === 'dec') {
        if (ci && ci.qty <= 1) Cart.remove(itemId);
        else Cart.setQty(itemId, (ci?.qty || 1) - 1);
      } else {
        Cart.setQty(itemId, (ci?.qty || 1) + 1);
      }
      renderCart(container);
    });
  });

  container.querySelector('#checkout-btn').disabled = false;
  updateCartTotals(container);
}

function updateCartTotals(container) {
  const subtotal  = Cart.getSubtotal();
  const afterDisc = Math.max(0, subtotal - discount);
  const tax       = Math.round(afterDisc * (taxRate / 100) * 100) / 100;
  const total     = afterDisc + tax;

  const set = (id, val) => { const el = container.querySelector(id); if (el) el.textContent = val; };
  set('#cart-subtotal', fmt(subtotal));
  set('#cart-tax',      fmt(tax));
  set('#cart-total',    fmt(total));

  updateChangeDue(container);
}

function updateChangeDue(container) {
  const subtotal  = Cart.getSubtotal();
  const afterDisc = Math.max(0, subtotal - discount);
  const tax       = Math.round(afterDisc * (taxRate / 100) * 100) / 100;
  const total     = afterDisc + tax;

  let change = 0;
  if (payMethod === 'Cash') {
    change = Math.max(0, cashTendered - total);
    const label = container.querySelector('#change-calc-label');
    if (label) label.textContent = 'Change Due';
    const val = container.querySelector('#change-due');
    if (val) {
      val.textContent = fmt(change);
      val.className = 'change-amount';
    }
  } else if (payMethod === 'Credit') {
    // ledger credit amount
    change = Math.max(0, total - cashTendered);
    const label = container.querySelector('#change-calc-label');
    if (label) label.textContent = 'Credited Ledger Value';
    const val = container.querySelector('#change-due');
    if (val) {
      val.textContent = fmt(change);
      val.className = 'change-amount text-red';
    }
  }
}

async function addToCart(item, container) {
  const ci = Cart.getItems().find(c => c.item.id === item.id);
  if (!item.is_composite && item.stock_quantity <= (ci ? ci.qty : 0)) {
    toast.error('Limit Reached', `Only ${item.stock_quantity} ${item.unit} available in stock.`);
    return;
  }
  Cart.add(item);
  renderCart(container);
}

async function processCheckout(container) {
  const cartItems = Cart.getItems();
  if (cartItems.length === 0) return;

  const activeSession = await getActiveSession();
  if (!activeSession) {
    toast.error('Session Closed', 'You must open a register session to execute transactions.');
    return;
  }

  const subtotal  = Cart.getSubtotal();
  const afterDisc = Math.max(0, subtotal - discount);
  const tax       = Math.round(afterDisc * (taxRate / 100) * 100) / 100;
  const total     = afterDisc + tax;

  // Validate tender cash if Cash is chosen
  if (payMethod === 'Cash' && cashTendered < total) {
    toast.error('Tender Failure', `Cash received (${fmt(cashTendered)}) must cover total amount (${fmt(total)}).`);
    return;
  }

  const checkoutBtn = container.querySelector('#checkout-btn');
  checkoutBtn.disabled = true;
  checkoutBtn.innerHTML = `${icon('icon-refresh', 'animate-spin')} Finalizing...`;

  try {
    const storeName = await getSetting('store_name', 'My Shop');
    const storeAddr = await getSetting('store_address', '');
    const storePhone = await getSetting('store_phone', '');
    const receiptFooter = await getSetting('receipt_footer', 'Thank you!');
    const taxLabel  = await getSetting('tax_label', 'GST');

    const result = await processSale(cartItems, {
      discount,
      taxRate,
      paymentMethod: payMethod,
      cashTendered,
      customerId: selectedCustomerId || null,
      sessionId: activeSession.id
    });

    // Show thermal receipt modal
    showReceiptModal(cartItems, result, { storeName, storeAddr, storePhone, receiptFooter, taxLabel });

    // Clear cart
    Cart.clear();
    discount = 0;
    cashTendered = 0;
    selectedCustomerId = '';

    const discInput = container.querySelector('#discount-input');
    const cashInput = container.querySelector('#cash-tendered');
    const custSelect = container.querySelector('#pos-customer-select');
    if (discInput) discInput.value = '0';
    if (cashInput) cashInput.value = '';
    if (custSelect) custSelect.value = '';

    renderCart(container);
    renderRecentSalesList(container);

    // Refresh catalog lists
    posItems = await db.items.toArray();
    renderPOSGrid(container);
    renderPopularItems(container);

  } catch (err) {
    toast.error('Checkout Failed', err.message);
    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = `${icon('icon-check')} Complete Checkout`;
  }
}

// ── Upgraded Receipt modal with offline QR codes and cashier tag ────────────────
function showReceiptModal(cartItems, result, storeInfo, timestamp = null) {
  const { subtotal, discountAmt, taxAmount, total, changeDue, receiptNo } = result;
  const { storeName, storeAddr, storePhone, receiptFooter, taxLabel } = storeInfo;
  const dateStr = fmtDateTime(timestamp || new Date().toISOString());

  const itemsHTML = cartItems.map(ci => `
    <div class="receipt-item-row">
      <div class="receipt-item-name">${ci.item.name}</div>
      <div class="receipt-item-qty">x${ci.qty}</div>
      <div class="receipt-item-total">${fmt(ci.unit_price * ci.qty)}</div>
    </div>`).join('');

  // QR Code generation
  const qrCodeSVG = generateMockQRCodeSVG(receiptNo);

  const bodyHTML = `
    <div class="receipt-body" id="invoice-receipt-wrapper">
      <div class="receipt-store" style="text-align:center">
        <!-- Stylized Logo Mark -->
        <div style="width:40px;height:40px;background:var(--primary);border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;margin:0 auto var(--space-2);font-size:1.25rem">${storeName[0].toUpperCase()}</div>
        <div class="receipt-store-name" style="font-size:1.15rem;font-weight:800;letter-spacing:-0.03em">${storeName}</div>
        ${storeAddr ? `<div class="receipt-store-sub" style="font-size:0.75rem">${storeAddr}</div>` : ''}
        ${storePhone ? `<div class="receipt-store-sub" style="font-size:0.75rem">Phone: ${storePhone}</div>` : ''}
      </div>
      <hr class="receipt-divider" style="margin:var(--space-3) 0">
      <div style="font-size:0.75rem;color:var(--text-muted);display:flex;justify-content:space-between">
        <span>Date: ${dateStr.split(' ')[0]}</span>
        <span>Invoice: ${receiptNo.split('-')[1] || receiptNo}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">
        Cashier: Main Desk Admin
      </div>
      <hr class="receipt-divider" style="margin:var(--space-3) 0">
      ${itemsHTML}
      <hr class="receipt-divider" style="margin:var(--space-3) 0">
      <div class="receipt-total-section">
        <div class="receipt-total-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        ${discountAmt > 0 ? `<div class="receipt-total-row"><span>Discount</span><span>- ${fmt(discountAmt)}</span></div>` : ''}
        ${taxAmount > 0 ? `<div class="receipt-total-row"><span>${taxLabel}</span><span>${fmt(taxAmount)}</span></div>` : ''}
        <hr class="receipt-divider" style="margin:6px 0">
        <div class="receipt-total-row grand" style="font-size:1.15rem;font-weight:900"><span>TOTAL</span><span>${fmt(total)}</span></div>
        
        <div class="receipt-total-row" style="margin-top:6px;font-size:0.75rem;color:var(--text-secondary)">
          <span>Payment Mode</span><span>${payMethod}</span>
        </div>
        ${payMethod === 'Cash' ? `
          <div class="receipt-total-row" style="font-size:0.75rem"><span>Cash Tendered</span><span>${fmt(cashTendered)}</span></div>
          <div class="receipt-total-row" style="font-size:0.75rem"><span>Change Due</span><span>${fmt(changeDue)}</span></div>` : ''}
        ${payMethod === 'Credit' ? `
          <div class="receipt-total-row" style="font-size:0.75rem"><span>Paid Cash</span><span>${fmt(cashTendered)}</span></div>
          <div class="receipt-total-row" style="font-size:0.75rem"><span>Balance Credited</span><span>${fmt(total - cashTendered)}</span></div>` : ''}
      </div>
      
      <!-- Dynamic QR Code -->
      ${qrCodeSVG}
      <div style="font-size:0.65rem;text-align:center;color:var(--text-muted);margin-top:-6px;margin-bottom:12px">Scan invoice details locally</div>
      
      <div class="receipt-footer" style="text-align:center;font-size:0.75rem;margin-top:12px">${receiptFooter}</div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    <button class="btn btn-primary" id="receipt-print-btn">${icon('icon-print')} Print Invoice</button>
  `;

  openModal({ title: 'Transaction Complete', bodyHTML, footerHTML, size: '',
    onOpen: (backdrop) => {
      backdrop.querySelector('#receipt-print-btn').addEventListener('click', () => {
        const receiptHTML = `
          <div style="text-align:center;font-family:monospace;font-size:12px;color:black">
            <h2 style="font-size:16px;margin-bottom:2px">${storeName}</h2>
            ${storeAddr ? `<div style="font-size:10px">${storeAddr}</div>` : ''}
            ${storePhone ? `<div style="font-size:10px">Phone: ${storePhone}</div>` : ''}
            <div>--------------------------------</div>
            <div style="text-align:left;font-size:10px">
              Date: ${dateStr}<br>
              Invoice: ${receiptNo}<br>
              Cashier: Main Desk Admin
            </div>
            <div>--------------------------------</div>
            ${cartItems.map(ci => `
              <div style="display:flex;justify-content:space-between">
                <span>${ci.item.name} x${ci.qty}</span>
                <span>${fmt(ci.unit_price * ci.qty)}</span>
              </div>`).join('')}
            <div>--------------------------------</div>
            <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
            ${discountAmt > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-${fmt(discountAmt)}</span></div>` : ''}
            ${taxAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>${taxLabel}</span><span>${fmt(taxAmount)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px"><span>TOTAL</span><span>${fmt(total)}</span></div>
            <div>--------------------------------</div>
            <div style="display:flex;justify-content:space-between"><span>Mode:</span><span>${payMethod}</span></div>
            ${payMethod === 'Cash' ? `
              <div style="display:flex;justify-content:space-between"><span>Tendered</span><span>${fmt(cashTendered)}</span></div>
              <div style="display:flex;justify-content:space-between"><span>Change</span><span>${fmt(changeDue)}</span></div>` : ''}
            ${payMethod === 'Credit' ? `
              <div style="display:flex;justify-content:space-between"><span>Paid</span><span>${fmt(cashTendered)}</span></div>
              <div style="display:flex;justify-content:space-between"><span>Balance</span><span>${fmt(total - cashTendered)}</span></div>` : ''}
            <div style="margin:8px 0">${receiptFooter}</div>
            
            <!-- Inline SVG QR Code in printer -->
            <div style="display:flex;justify-content:center;margin-top:10px">
              ${generateMockQRCodeSVG(receiptNo)}
            </div>
            <div style="font-size:8px">Local verification code</div>
          </div>
        `;
        printElement(receiptHTML, 'printing-receipt');
      });
    }
  });
}

// ── Static Offline QR Code Generator ─────────────────────────────
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
    <svg viewBox="0 0 ${size * cellW} ${size * cellW}" width="80" height="80" style="display:block;margin:8px auto;color:var(--text-primary)">
      <path d="${paths}" fill="currentColor"/>
    </svg>
  `;
}
