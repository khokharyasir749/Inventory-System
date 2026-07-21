/**
 * search.js — Global Search Bar with Barcode Scanner Detection
 */

let searchTimeout = null;
let barcodeBuffer = '';
let barcodeTimer  = null;
const BARCODE_THRESHOLD_MS = 80; // chars arriving faster than this = barcode scanner

async function initSearch() {
  const input   = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  // Detect barcode scanner: rapid key input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (barcodeBuffer.length > 3) {
        handleBarcodeInput(barcodeBuffer.trim());
        barcodeBuffer = '';
        input.value = '';
        results.classList.remove('visible');
        return;
      }
    }
  });

  input.addEventListener('input', (e) => {
    const val = input.value.trim();

    // Barcode buffer tracking
    clearTimeout(barcodeTimer);
    barcodeBuffer += e.data || '';
    barcodeTimer = setTimeout(() => { barcodeBuffer = ''; }, BARCODE_THRESHOLD_MS);

    if (!val) {
      results.classList.remove('visible');
      results.innerHTML = '';
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(val, results), 200);
  });

  // Close results on outside click
  document.addEventListener('click', (e) => {
    if (!input.closest('.topbar-search-wrap').contains(e.target)) {
      results.classList.remove('visible');
    }
  });

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
    // Escape to close
    if (e.key === 'Escape' && document.activeElement === input) {
      results.classList.remove('visible');
      input.blur();
    }
  });
}

async function performSearch(query, resultsEl) {
  const q = query.toLowerCase();
  const allItems = await db.items.toArray();

  const matched = allItems
    .filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q))
    )
    .slice(0, 8);

  if (matched.length === 0) {
    resultsEl.innerHTML = `
      <div class="search-result-item">
        <div class="search-result-info">
          <div class="search-result-name text-muted">No results for "${query}"</div>
        </div>
      </div>`;
  } else {
    resultsEl.innerHTML = matched.map(item => {
      const thumb = item.photo_blob
        ? `<img src="${item.photo_blob}" alt="${item.name}" loading="lazy">`
        : categoryIcon(item.category);
      const lowStock = item.stock_quantity <= item.min_stock_alert;
      return `
        <div class="search-result-item" data-item-id="${item.id}" role="option">
          <div class="search-result-thumb">${thumb}</div>
          <div class="search-result-info">
            <div class="search-result-name">${item.name}</div>
            <div class="search-result-meta">${item.category} · ${item.barcode || 'No barcode'}</div>
          </div>
          <div class="search-result-stock ${lowStock ? 'text-amber' : ''}">${fmtNum(item.stock_quantity)} ${item.unit}</div>
        </div>`;
    }).join('');
  }

  resultsEl.classList.add('visible');

  // Click handlers on results
  resultsEl.querySelectorAll('.search-result-item[data-item-id]').forEach(el => {
    el.addEventListener('click', () => {
      const itemId = parseInt(el.dataset.itemId);
      resultsEl.classList.remove('visible');
      document.getElementById('global-search').value = '';
      // Navigate to inventory and highlight
      navigate('inventory');
      setTimeout(() => {
        const card = document.querySelector(`[data-item-id="${itemId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.outline = `2px solid var(--primary)`;
          setTimeout(() => { card.style.outline = ''; }, 2000);
        }
      }, 300);
    });
  });
}

async function handleBarcodeInput(barcode) {
  const item = await db.items.where('barcode').equals(barcode).first();

  if (!item) {
    toast.warning('Barcode Not Found', `No item with barcode ${barcode}. Add it in Inventory.`);
    return;
  }

  // Show quick-action modal for the found item
  showQuickStockModal(item);
}

/**
 * Quick stock in/out modal triggered from search or barcode scan
 */
function showQuickStockModal(item) {
  const thumb = item.photo_blob
    ? `<img class="image-preview" src="${item.photo_blob}" alt="${item.name}">`
    : `<div style="width:80px;height:80px;background:var(--canvas);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">${categoryIcon(item.category)}</div>`;

  const bodyHTML = `
    <div class="quick-action-product">
      <div class="quick-action-thumb">${thumb}</div>
      <div>
        <div style="font-weight:700;font-size:0.9375rem;">${item.name}</div>
        <div class="text-muted text-sm">${item.category} · ${fmtNum(item.stock_quantity)} ${item.unit} in stock</div>
        <div style="font-weight:700;color:var(--primary);margin-top:4px;">${fmt(item.selling_price)}</div>
      </div>
    </div>
    <div class="quick-action-qty-wrap flex-col gap-3">
      <div>
        <label class="form-label">Quantity</label>
        <div class="qty-input-group">
          <button class="qty-btn" id="qty-dec">−</button>
          <input type="number" class="qty-display" id="modal-qty" value="1" min="1" style="width:80px;text-align:center;">
          <button class="qty-btn" id="qty-inc">+</button>
        </div>
      </div>
      <div>
        <label class="form-label">Notes (optional)</label>
        <input type="text" class="form-input" id="modal-notes" placeholder="e.g. Supplier delivery">
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" id="quick-sale-btn">${icon('icon-minus')} Quick Sale</button>
    <button class="btn btn-success" id="quick-in-btn">${icon('icon-plus')} Stock In</button>
  `;

  openModal({ title: 'Quick Stock Action', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      const qtyInput = backdrop.querySelector('#modal-qty');
      backdrop.querySelector('#qty-dec').addEventListener('click', () => {
        qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1);
      });
      backdrop.querySelector('#qty-inc').addEventListener('click', () => {
        qtyInput.value = parseInt(qtyInput.value) + 1;
      });

      backdrop.querySelector('#quick-in-btn').addEventListener('click', async () => {
        const qty   = parseInt(qtyInput.value) || 1;
        const notes = backdrop.querySelector('#modal-notes').value || 'Manual stock-in';
        closeModal();
        await recordStockEvent({ itemId: item.id, changeType: CHANGE_TYPE.IN, qty, notes });
        toast.success('Stock Added', `+${qty} ${item.unit} added to ${item.name}`);
        if (currentPage === 'inventory' || currentPage === 'dashboard') handleRoute();
      });

      backdrop.querySelector('#quick-sale-btn').addEventListener('click', async () => {
        const qty   = parseInt(qtyInput.value) || 1;
        const notes = backdrop.querySelector('#modal-notes').value || 'Quick sale';
        if (item.stock_quantity < qty) {
          toast.error('Insufficient Stock', `Only ${item.stock_quantity} ${item.unit} available.`);
          return;
        }
        closeModal();
        await recordStockEvent({ itemId: item.id, changeType: CHANGE_TYPE.OUT, qty, notes });
        toast.success('Sale Recorded', `−${qty} ${item.unit} from ${item.name}`);
        if (currentPage === 'inventory' || currentPage === 'dashboard') handleRoute();
      });
    }
  });
}
