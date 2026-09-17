/**
 * inventory.js — Enterprise Inventory & Product Management Module
 * Features:
 * 1. 4-State Stock Movement Ledger (In, Out, Damage/Adjust, Sale)
 * 2. Automated SKU Generator & Barcode Engine (Hardware Wedge + Camera BarcodeDetector)
 * 3. Paginated, Sortable Data Table with Sticky Headers, Inline Editing & Bulk Actions
 * 4. Threshold status alert pills & CSV Export with Valuation Metrics
 */

// ── Module State ─────────────────────────────────────────────
let inventoryItems        = [];
let inventoryCategory     = 'All';
let inventoryStockStatus  = 'All'; // 'All' | 'low' | 'out' | 'in'
let inventorySearch       = '';
let inventorySort         = 'name'; // 'name' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_asc' | 'price_desc' | 'margin_desc'
let inventoryPage         = 1;
let inventoryPageSize     = 25;
let inventoryView         = localStorage.getItem('inv_view_v3') || 'table';
let selectedItemIds       = new Set();
let hardwareScannerBound  = false;

// ── Main Page Renderer ───────────────────────────────────────
async function renderInventory(container) {
  selectedItemIds.clear();

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Inventory Catalog</h1>
        <p>Real-time stock ledger, barcode scanner integration, and enterprise bulk management</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" id="inv-camera-scan-btn" title="Open Camera Barcode Scanner">
          ${icon('icon-barcode')} Scan Barcode
        </button>
        <button class="btn btn-ghost btn-sm" id="inv-import-csv">
          ${icon('icon-upload')} Import CSV
        </button>
        <button class="btn btn-ghost btn-sm" id="inv-export-csv">
          ${icon('icon-download')} Export CSV
        </button>
        <button class="btn btn-primary btn-sm" id="inv-add-btn">
          ${icon('icon-plus')} Add Product
        </button>
      </div>
    </div>

    <!-- Filter & Control Bar -->
    <div class="filter-bar" style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center;margin-bottom:var(--space-4);background:var(--surface);padding:var(--space-4);border-radius:var(--radius-lg);border:1px solid var(--border);">
      <!-- Search Input with clear icon -->
      <div class="filter-search-wrap" style="flex:1;min-width:240px;position:relative;">
        <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;">
          ${icon('icon-search')}
        </span>
        <input type="text" class="form-input" id="inv-search" placeholder="Search by name, SKU, barcode, category… (or scan barcode)" value="${inventorySearch}" style="padding-left:36px;font-size:0.875rem;">
      </div>

      <!-- Stock Status Filters (Threshold Alert Pills) -->
      <div style="display:flex;gap:4px;background:var(--surface-raised);padding:3px;border-radius:var(--radius-md);border:1px solid var(--border);">
        <button class="btn-pill btn-ghost ${inventoryStockStatus === 'All' ? 'active' : ''}" data-status="All" style="font-size:0.75rem;padding:4px 10px;">All Stock</button>
        <button class="btn-pill btn-ghost ${inventoryStockStatus === 'low' ? 'active' : ''}" data-status="low" style="font-size:0.75rem;padding:4px 10px;">⚠️ Low Stock</button>
        <button class="btn-pill btn-ghost ${inventoryStockStatus === 'out' ? 'active' : ''}" data-status="out" style="font-size:0.75rem;padding:4px 10px;">🚫 Out of Stock</button>
        <button class="btn-pill btn-ghost ${inventoryStockStatus === 'in' ? 'active' : ''}" data-status="in" style="font-size:0.75rem;padding:4px 10px;">✅ In Stock</button>
      </div>

      <!-- View Switcher & Sort Selector -->
      <div style="display:flex;gap:var(--space-2);align-items:center;margin-left:auto;">
        <select class="form-select" id="inv-sort" style="width:auto;padding:7px 32px 7px 10px;font-size:0.8125rem;">
          <option value="name" ${inventorySort === 'name' ? 'selected' : ''}>Sort: Name (A–Z)</option>
          <option value="name_desc" ${inventorySort === 'name_desc' ? 'selected' : ''}>Sort: Name (Z–A)</option>
          <option value="stock_asc" ${inventorySort === 'stock_asc' ? 'selected' : ''}>Stock: Lowest First</option>
          <option value="stock_desc" ${inventorySort === 'stock_desc' ? 'selected' : ''}>Stock: Highest First</option>
          <option value="price_desc" ${inventorySort === 'price_desc' ? 'selected' : ''}>Price: High to Low</option>
          <option value="price_asc" ${inventorySort === 'price_asc' ? 'selected' : ''}>Price: Low to High</option>
          <option value="margin_desc" ${inventorySort === 'margin_desc' ? 'selected' : ''}>Margin: Highest First</option>
        </select>
        
        <div style="display:flex;background:var(--surface-raised);padding:3px;border-radius:var(--radius-md);border:1px solid var(--border);">
          <button class="btn btn-ghost btn-sm ${inventoryView === 'table' ? 'active' : ''}" id="inv-view-table" style="padding:4px 9px;min-height:auto;" title="Enterprise Table View">${icon('icon-logs')}</button>
          <button class="btn btn-ghost btn-sm ${inventoryView === 'grid' ? 'active' : ''}" id="inv-view-grid" style="padding:4px 9px;min-height:auto;" title="Card Grid View">${icon('icon-dashboard')}</button>
        </div>
      </div>
    </div>

    <!-- Category Pills Bar -->
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:var(--space-3);margin-bottom:var(--space-3);scrollbar-width:none;" id="inv-category-pills"></div>

    <!-- Table / Grid Container -->
    <div id="inv-grid-container" class="animate-fade-in">
      <div class="table-wrap" style="padding:var(--space-12);text-align:center;">
        <div class="animate-spin" style="display:inline-block;font-size:2rem;margin-bottom:var(--space-2)">⌛</div>
        <p class="text-secondary text-sm">Loading inventory ledger...</p>
      </div>
    </div>

    <!-- Floating Bulk Actions Toolbar (hidden until items selected) -->
    <div id="inv-bulk-action-bar" class="bulk-action-bar hidden">
      <span class="bulk-count-badge" id="bulk-selected-count">0 Selected</span>
      <button class="bulk-action-btn" id="bulk-price-update-btn">
        ${icon('icon-edit')} Update Prices
      </button>
      <button class="bulk-action-btn" id="bulk-stock-in-btn">
        ${icon('icon-plus')} Bulk Stock In
      </button>
      <button class="bulk-action-btn" id="bulk-category-btn">
        ${icon('icon-package')} Set Category
      </button>
      <button class="bulk-action-btn" id="bulk-export-btn">
        ${icon('icon-download')} Export Selected
      </button>
      <button class="bulk-action-btn danger" id="bulk-delete-btn">
        ${icon('icon-trash')} Delete
      </button>
      <button class="btn btn-ghost btn-sm" id="bulk-cancel-btn" style="color:white;padding:4px 8px;" title="Clear Selection">
        ${icon('icon-close')}
      </button>
    </div>
  `;

  // Initialize hardware barcode scanner listener (keyboard wedge)
  setupHardwareBarcodeScanner();

  // Load initial dataset
  await loadAndRenderInventory(container);

  // ── Global Event Bindings ────────────────────────────────────
  container.querySelector('#inv-add-btn').addEventListener('click', () => showProductModal(null));

  container.querySelector('#inv-camera-scan-btn').addEventListener('click', () => {
    showCameraScannerModal((barcode) => {
      inventorySearch = barcode;
      container.querySelector('#inv-search').value = barcode;
      inventoryPage = 1;
      renderInventoryContent(container);
      toast.success('Barcode Scanned', `Filtered by SKU/Barcode: ${barcode}`);
    });
  });

  container.querySelector('#inv-search').addEventListener('input', debounce((e) => {
    inventorySearch = e.target.value.trim();
    inventoryPage = 1;
    renderInventoryContent(container);
  }, 220));

  container.querySelector('#inv-sort').addEventListener('change', (e) => {
    inventorySort = e.target.value;
    renderInventoryContent(container);
  });

  // Stock status filter pills
  container.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b === btn));
      inventoryStockStatus = btn.dataset.status;
      inventoryPage = 1;
      renderInventoryContent(container);
    });
  });

  // View toggle buttons
  const gridBtn = container.querySelector('#inv-view-grid');
  const tableBtn = container.querySelector('#inv-view-table');

  const updateViewMode = (mode) => {
    inventoryView = mode;
    localStorage.setItem('inv_view_v3', mode);
    gridBtn.classList.toggle('active', mode === 'grid');
    tableBtn.classList.toggle('active', mode === 'table');
    renderInventoryContent(container);
  };

  gridBtn.addEventListener('click', () => updateViewMode('grid'));
  tableBtn.addEventListener('click', () => updateViewMode('table'));

  // CSV Export & Import
  container.querySelector('#inv-export-csv').addEventListener('click', async () => {
    const items = getFilteredItems();
    await exportInventoryCSV(items, 'inventory-export');
    toast.success('Export Successful', `Exported ${items.length} items to CSV.`);
  });

  container.querySelector('#inv-import-csv').addEventListener('click', () => showImportCSVModal());

  // Bulk actions bindings
  setupBulkActionHandlers(container);
}

// ── Hardware Barcode Scanner Engine (Keyboard Wedge) ──────────
function setupHardwareBarcodeScanner() {
  if (hardwareScannerBound) return;
  hardwareScannerBound = true;

  let barcodeBuffer = '';
  let lastCharTime = 0;

  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'inv-search';
    
    // Barcode scanner keys come in rapid bursts (< 45ms between strokes)
    const now = Date.now();
    const interval = now - lastCharTime;
    lastCharTime = now;

    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= 4 && interval < 60) {
        // Highly likely to be a barcode scanner wedge input!
        e.preventDefault();
        const scannedCode = barcodeBuffer.trim();
        barcodeBuffer = '';
        handleScannedBarcode(scannedCode);
      } else {
        barcodeBuffer = '';
      }
      return;
    }

    // Ignore non-printable keys
    if (e.key.length !== 1) return;

    if (interval < 50 || barcodeBuffer.length === 0) {
      barcodeBuffer += e.key;
    } else {
      barcodeBuffer = e.key;
    }
  });
}

function handleScannedBarcode(barcode) {
  playBeepSound('success');

  // If a product modal is currently active, populate its barcode field
  const modalBarcode = document.getElementById('prod-barcode');
  if (modalBarcode) {
    modalBarcode.value = barcode;
    modalBarcode.classList.add('cell-saved-flash');
    setTimeout(() => modalBarcode.classList.remove('cell-saved-flash'), 1000);
    toast.success('Scanner Wedge Input', `Barcode field filled: ${barcode}`);
    return;
  }

  // Otherwise, filter the inventory catalog
  const searchInput = document.getElementById('inv-search');
  if (searchInput) {
    inventorySearch = barcode;
    searchInput.value = barcode;
    inventoryPage = 1;
    const container = document.getElementById('page-content');
    if (container) renderInventoryContent(container);
    toast.success('Barcode Wedge Scanned', `Loaded item SKU/Barcode: ${barcode}`);
  }
}

// ── Camera Barcode Scanner Modal (Native BarcodeDetector) ─────
function showCameraScannerModal(onDetected) {
  let stream = null;
  let scanning = true;

  const hasBarcodeDetector = 'BarcodeDetector' in window;

  const bodyHTML = `
    <div class="scanner-modal-body">
      <p class="text-sm text-secondary" style="text-align:center;">
        Align the product barcode within the camera viewfinder. Supports EAN-13, UPC, Code 128, and QR codes.
      </p>

      <div class="scanner-viewport">
        <video id="camera-barcode-video" autoplay playsinline muted></video>
        <div class="scanner-overlay-reticle"></div>
        <div class="scanner-laser-line"></div>
        <div id="scanner-status" style="position:absolute;bottom:10px;background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:var(--radius-full);color:#FFFFFF;font-size:0.75rem;font-weight:600;">
          Initializing Camera...
        </div>
      </div>

      <!-- Manual barcode entry fallback -->
      <div style="width:100%;max-width:440px;margin-top:var(--space-2);">
        <label class="form-label" style="font-size:0.75rem;">Or type / wedge-scan barcode manually:</label>
        <div class="input-group">
          <input type="text" class="form-input" id="scanner-manual-input" placeholder="Type barcode and press Enter">
          <button class="btn btn-primary btn-sm" id="scanner-manual-submit" style="position:absolute;right:4px;height:32px;">Submit</button>
        </div>
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" id="scanner-cancel-btn">Close Scanner</button>
  `;

  openModal({
    title: 'Camera Barcode Scanner',
    bodyHTML,
    footerHTML,
    onOpen: async (backdrop) => {
      const video = backdrop.querySelector('#camera-barcode-video');
      const statusEl = backdrop.querySelector('#scanner-status');
      const manualInput = backdrop.querySelector('#scanner-manual-input');
      const manualSubmit = backdrop.querySelector('#scanner-manual-submit');

      const stopCamera = () => {
        scanning = false;
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          stream = null;
        }
      };

      backdrop.querySelector('#scanner-cancel-btn').addEventListener('click', () => {
        stopCamera();
        closeModal();
      });

      const handleSuccess = (code) => {
        playBeepSound('success');
        stopCamera();
        closeModal();
        if (onDetected) onDetected(code);
      };

      manualSubmit.addEventListener('click', () => {
        const val = manualInput.value.trim();
        if (val) handleSuccess(val);
      });

      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = manualInput.value.trim();
          if (val) handleSuccess(val);
        }
      });

      // Camera initialization
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        await video.play();
        statusEl.textContent = 'Camera active · Searching for barcode…';

        if (hasBarcodeDetector) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
          });

          const scanLoop = async () => {
            if (!scanning) return;
            try {
              if (video.readyState === video.HAVE_ENOUGH_DATA) {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                  const detected = barcodes[0].rawValue;
                  statusEl.textContent = `Scanned: ${detected}`;
                  handleSuccess(detected);
                  return;
                }
              }
            } catch (err) {
              // Frame scan skipped
            }
            if (scanning) requestAnimationFrame(scanLoop);
          };

          requestAnimationFrame(scanLoop);
        } else {
          statusEl.textContent = 'BarcodeDetector API unsupported in this browser. Use manual entry or wedge scanner.';
        }
      } catch (err) {
        statusEl.textContent = `Camera access error: ${err.message}`;
        statusEl.style.background = 'var(--danger)';
      }
    }
  });
}

// ── Data Fetcher & Content Renderer ──────────────────────────
async function loadAndRenderInventory(container) {
  inventoryItems = await db.items.toArray();
  renderCategoryPills(container);
  renderInventoryContent(container);
}

function getFilteredItems() {
  let items = [...inventoryItems];

  // Category filter
  if (inventoryCategory !== 'All') {
    items = items.filter(it => it.category === inventoryCategory);
  }

  // Stock Status Threshold filter
  if (inventoryStockStatus === 'low') {
    items = items.filter(it => !it.is_composite && it.stock_quantity > 0 && it.stock_quantity <= it.min_stock_alert);
  } else if (inventoryStockStatus === 'out') {
    items = items.filter(it => !it.is_composite && it.stock_quantity === 0);
  } else if (inventoryStockStatus === 'in') {
    items = items.filter(it => it.is_composite || it.stock_quantity > it.min_stock_alert);
  }

  // Search filter
  if (inventorySearch) {
    const q = inventorySearch.toLowerCase();
    items = items.filter(it =>
      (it.name && it.name.toLowerCase().includes(q)) ||
      (it.barcode && it.barcode.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q))
    );
  }

  // Multi-column sorting
  switch (inventorySort) {
    case 'name':
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'name_desc':
      items.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      break;
    case 'stock_asc':
      items.sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0));
      break;
    case 'stock_desc':
      items.sort((a, b) => (b.stock_quantity || 0) - (a.stock_quantity || 0));
      break;
    case 'price_desc':
      items.sort((a, b) => (b.selling_price || 0) - (a.selling_price || 0));
      break;
    case 'price_asc':
      items.sort((a, b) => (a.selling_price || 0) - (b.selling_price || 0));
      break;
    case 'margin_desc':
      items.sort((a, b) => {
        const ma = a.selling_price > 0 ? (a.selling_price - a.cost_price) / a.selling_price : 0;
        const mb = b.selling_price > 0 ? (b.selling_price - b.cost_price) / b.selling_price : 0;
        return mb - ma;
      });
      break;
  }

  return items;
}

function renderInventoryContent(container) {
  const filtered = getFilteredItems();
  const gridContainer = container.querySelector('#inv-grid-container');
  if (!gridContainer) return;

  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state" style="padding:var(--space-12) var(--space-4);">
        <div style="font-size:3rem;margin-bottom:var(--space-2)">📦</div>
        <h3>No Products Found</h3>
        <p style="max-width:360px">${inventorySearch || inventoryCategory !== 'All' || inventoryStockStatus !== 'All' ? 'No items match your active filters or barcode search.' : 'Your inventory is currently empty.'}</p>
        <button class="btn btn-primary btn-sm" style="margin-top:var(--space-3);" onclick="document.getElementById('inv-add-btn').click()">
          ${icon('icon-plus')} Add New Product
        </button>
      </div>`;
    updateBulkActionBar();
    return;
  }

  // Pagination slicing
  const totalPages = Math.ceil(filtered.length / inventoryPageSize) || 1;
  if (inventoryPage > totalPages) inventoryPage = totalPages;
  const startIdx = (inventoryPage - 1) * inventoryPageSize;
  const pagedItems = filtered.slice(startIdx, startIdx + inventoryPageSize);

  if (inventoryView === 'table') {
    gridContainer.innerHTML = `
      ${renderProductTable(pagedItems, filtered.length)}
      ${renderPagination(startIdx + 1, Math.min(startIdx + inventoryPageSize, filtered.length), filtered.length, totalPages)}
    `;
  } else {
    gridContainer.innerHTML = `
      <div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(210px, 1fr));gap:var(--space-4);">
        ${pagedItems.map(item => renderProductCard(item)).join('')}
      </div>
      ${renderPagination(startIdx + 1, Math.min(startIdx + inventoryPageSize, filtered.length), filtered.length, totalPages)}
    `;
  }

  // Bind Table / Grid Events
  bindItemRowInteractions(gridContainer, container);
  bindPaginationEvents(gridContainer, container);
  updateBulkActionBar();
}

// ── Advanced Enterprise Data Table Component ──────────────────
function renderProductTable(items, totalCount) {
  const allSelectedOnPage = items.length > 0 && items.every(it => selectedItemIds.has(it.id));

  return `
    <div class="table-sticky-wrap">
      <table style="width:100%;border-collapse:collapse;text-align:left;">
        <thead>
          <tr>
            <th style="width:40px;text-align:center;">
              <input type="checkbox" class="row-checkbox" id="th-select-all" ${allSelectedOnPage ? 'checked' : ''} title="Select All on Page">
            </th>
            <th style="width:48px;">Photo</th>
            <th class="th-sortable ${inventorySort.startsWith('name') ? 'active' : ''}" data-sort="name">
              Product & SKU / Barcode <span class="sort-indicator">${inventorySort === 'name' ? '▲' : inventorySort === 'name_desc' ? '▼' : '↕'}</span>
            </th>
            <th>Category</th>
            <th class="th-sortable ${inventorySort.startsWith('stock') ? 'active' : ''}" data-sort="stock">
              Live Stock Level <span class="sort-indicator">${inventorySort === 'stock_asc' ? '▲' : inventorySort === 'stock_desc' ? '▼' : '↕'}</span>
            </th>
            <th class="th-sortable" data-sort="cost">
              Cost Price <span class="sort-indicator">↕</span>
            </th>
            <th class="th-sortable ${inventorySort.startsWith('price') ? 'active' : ''}" data-sort="price">
              Selling Price <span class="sort-indicator">${inventorySort === 'price_asc' ? '▲' : inventorySort === 'price_desc' ? '▼' : '↕'}</span>
            </th>
            <th class="th-sortable ${inventorySort === 'margin_desc' ? 'active' : ''}" data-sort="margin">
              Margin % <span class="sort-indicator">↕</span>
            </th>
            <th style="text-align:right;width:140px;">Stock Movement</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const isSelected = selectedItemIds.has(item.id);
            const isCritical = !item.is_composite && item.stock_quantity === 0;
            const isLow = !item.is_composite && item.stock_quantity > 0 && item.stock_quantity <= item.min_stock_alert;

            const margin = item.selling_price > 0
              ? (((item.selling_price - item.cost_price) / item.selling_price) * 100).toFixed(1)
              : 0;

            const thumb = item.photo_blob
              ? `<img src="${item.photo_blob}" alt="${item.name}" style="width:36px;height:36px;border-radius:var(--radius-md);object-fit:cover;">`
              : `<div style="width:36px;height:36px;border-radius:var(--radius-md);background:var(--surface-raised);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);">${categoryIcon(item.category)}</div>`;

            // Threshold status alert pill
            const statusPill = item.is_composite
              ? `<span class="badge badge-primary">Recipe</span>`
              : isCritical
              ? `<span class="badge badge-red" style="font-weight:700;">● Out of Stock</span>`
              : isLow
              ? `<span class="badge badge-amber" style="font-weight:700;">▲ Low Stock</span>`
              : `<span class="badge badge-green">✔ In Stock</span>`;

            return `
              <tr class="product-row ${isSelected ? 'row-selected' : ''}" data-item-id="${item.id}" style="${isSelected ? 'background:var(--primary-light);' : ''}">
                <td style="text-align:center;">
                  <input type="checkbox" class="row-checkbox item-select-cb" data-item-id="${item.id}" ${isSelected ? 'checked' : ''}>
                </td>
                <td>${thumb}</td>
                <td>
                  <div class="font-bold text-sm text-primary" style="display:flex;align-items:center;gap:6px;">
                    <span class="product-title-clickable" style="cursor:pointer;" title="Click to view/edit">${item.name}</span>
                    ${statusPill}
                  </div>
                  <div class="mono text-xs text-muted" style="margin-top:2px;">
                    SKU: <strong>${item.barcode || 'NO-SKU'}</strong>
                  </div>
                </td>
                <td>
                  <span class="badge badge-gray">${item.category}</span>
                </td>
                <td>
                  <!-- Inline editable stock quantity -->
                  <div class="editable-cell editable-stock" data-item-id="${item.id}" data-current="${item.stock_quantity}" title="Double click to quick-adjust stock">
                    <span class="mono font-bold ${isCritical ? 'text-red' : isLow ? 'text-amber' : 'text-primary'}" style="font-size:0.95rem;">
                      ${fmtNum(item.stock_quantity)}
                    </span>
                    <span class="text-xs text-muted">${item.unit}</span>
                    <span class="edit-hint-icon">${icon('icon-edit')}</span>
                  </div>
                </td>
                <td>
                  <!-- Inline editable cost price -->
                  <div class="editable-cell editable-cost" data-item-id="${item.id}" data-current="${item.cost_price}" title="Double click to edit cost price">
                    <span class="mono text-sm">${fmt(item.cost_price)}</span>
                    <span class="edit-hint-icon">${icon('icon-edit')}</span>
                  </div>
                </td>
                <td>
                  <!-- Inline editable selling price -->
                  <div class="editable-cell editable-price" data-item-id="${item.id}" data-current="${item.selling_price}" title="Double click to edit selling price">
                    <span class="mono text-sm font-bold text-primary">${fmt(item.selling_price)}</span>
                    <span class="edit-hint-icon">${icon('icon-edit')}</span>
                  </div>
                </td>
                <td>
                  <span class="text-sm font-semibold ${margin > 30 ? 'text-green' : margin > 15 ? 'text-teal' : 'text-secondary'}">${margin}%</span>
                </td>
                <td style="text-align:right;">
                  <div style="display:flex;gap:4px;justify-content:flex-end;">
                    <button class="btn btn-ghost btn-sm btn-movement" data-type="IN" data-item-id="${item.id}" title="Record Stock In / Receiving" style="padding:4px 8px;min-height:auto;color:var(--stock-in);">
                      ${icon('icon-plus')}
                    </button>
                    <button class="btn btn-ghost btn-sm btn-movement" data-type="OUT" data-item-id="${item.id}" title="Record Stock Out / Shrinkage" style="padding:4px 8px;min-height:auto;color:var(--alert);">
                      ${icon('icon-minus')}
                    </button>
                    <button class="btn btn-ghost btn-sm btn-edit-product" data-item-id="${item.id}" title="Full Edit & Barcode Setup" style="padding:4px 8px;min-height:auto;">
                      ${icon('icon-edit')}
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Card Grid View (Alternative Layout) ───────────────────────
function renderProductCard(item) {
  const isCritical = !item.is_composite && item.stock_quantity === 0;
  const isLow      = !item.is_composite && item.stock_quantity > 0 && item.stock_quantity <= item.min_stock_alert;

  const thumb = item.photo_blob
    ? `<img src="${item.photo_blob}" alt="${item.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
    : categoryIcon(item.category);

  const margin = item.selling_price > 0
    ? (((item.selling_price - item.cost_price) / item.selling_price) * 100).toFixed(0)
    : 0;

  const statusBadge = isCritical
    ? `<div class="badge badge-red" style="position:absolute;top:8px;left:8px;box-shadow:var(--shadow-sm);font-weight:700;">Out of Stock</div>`
    : isLow
    ? `<div class="badge badge-amber" style="position:absolute;top:8px;left:8px;box-shadow:var(--shadow-sm);font-weight:700;">Low Stock</div>`
    : '';

  return `
    <div class="product-card" data-item-id="${item.id}" style="cursor:pointer;position:relative;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;transition:all var(--transition-fast);">
      <div style="aspect-ratio:1.3;background:var(--surface-raised);display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid var(--border);">
        ${thumb}
        ${statusBadge}
        ${item.is_composite ? `<div class="badge badge-primary" style="position:absolute;top:8px;right:8px">Recipe</div>` : ''}
      </div>
      <div style="padding:var(--space-3)">
        <div style="font-size:0.875rem;font-weight:700;color:var(--text-primary);margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:40px" title="${item.name}">${item.name}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <span class="badge badge-gray" style="font-size:0.65rem">${item.category}</span>
          <span class="text-xs font-semibold text-teal">${margin}% Margin</span>
        </div>
        
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:var(--space-2)">
          <span class="text-secondary">Stock: <strong class="${isCritical ? 'text-red' : isLow ? 'text-amber' : 'text-primary'}">${fmtNum(item.stock_quantity)}</strong> ${item.unit}</span>
          <span class="text-muted">Min: ${item.min_stock_alert}</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--border);padding-top:var(--space-2);margin-bottom:var(--space-2)">
          <div style="font-size:0.7rem;color:var(--text-muted)">Cost: <span class="mono">${fmt(item.cost_price)}</span></div>
          <div style="font-size:0.95rem;font-weight:800;color:var(--primary);" class="mono">${fmt(item.selling_price)}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <button class="btn btn-movement btn btn-ghost btn-sm" data-type="IN" data-item-id="${item.id}" style="font-size:0.75rem;padding:4px;min-height:auto;color:var(--stock-in);">
            ${icon('icon-plus')} Stock In
          </button>
          <button class="btn btn-movement btn btn-ghost btn-sm" data-type="OUT" data-item-id="${item.id}" style="font-size:0.75rem;padding:4px;min-height:auto;color:var(--alert);">
            ${icon('icon-minus')} Stock Out
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── Pagination Renderer ───────────────────────────────────────
function renderPagination(startNum, endNum, totalCount, totalPages) {
  return `
    <div class="pagination-wrap">
      <div>
        Showing <strong class="text-primary">${startNum}–${endNum}</strong> of <strong class="text-primary">${totalCount}</strong> products
      </div>

      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <div style="display:flex;align-items:center;gap:6px">
          <span>Rows per page:</span>
          <select class="form-select" id="inv-page-size" style="width:auto;padding:3px 26px 3px 8px;font-size:0.8rem;height:30px;">
            <option value="10" ${inventoryPageSize === 10 ? 'selected' : ''}>10</option>
            <option value="25" ${inventoryPageSize === 25 ? 'selected' : ''}>25</option>
            <option value="50" ${inventoryPageSize === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${inventoryPageSize === 100 ? 'selected' : ''}>100</option>
          </select>
        </div>

        <div class="pagination-btns">
          <button class="pagination-btn" id="page-first" ${inventoryPage === 1 ? 'disabled' : ''} title="First Page">«</button>
          <button class="pagination-btn" id="page-prev" ${inventoryPage === 1 ? 'disabled' : ''} title="Previous Page">‹</button>
          <span style="padding:0 8px;font-weight:700;color:var(--text-primary);">Page ${inventoryPage} of ${totalPages}</span>
          <button class="pagination-btn" id="page-next" ${inventoryPage >= totalPages ? 'disabled' : ''} title="Next Page">›</button>
          <button class="pagination-btn" id="page-last" ${inventoryPage >= totalPages ? 'disabled' : ''} title="Last Page">»</button>
        </div>
      </div>
    </div>
  `;
}

// ── Table Interactions, Sorting & Inline Editing ──────────────
function bindItemRowInteractions(gridContainer, pageContainer) {
  // Sortable headers click
  gridContainer.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const type = th.dataset.sort;
      if (type === 'name') {
        inventorySort = inventorySort === 'name' ? 'name_desc' : 'name';
      } else if (type === 'stock') {
        inventorySort = inventorySort === 'stock_asc' ? 'stock_desc' : 'stock_asc';
      } else if (type === 'price') {
        inventorySort = inventorySort === 'price_desc' ? 'price_asc' : 'price_desc';
      } else if (type === 'cost') {
        inventorySort = 'price_asc';
      } else if (type === 'margin') {
        inventorySort = 'margin_desc';
      }
      renderInventoryContent(pageContainer);
    });
  });

  // Select all checkbox
  const selectAllCb = gridContainer.querySelector('#th-select-all');
  if (selectAllCb) {
    selectAllCb.addEventListener('change', (e) => {
      const checked = e.target.checked;
      gridContainer.querySelectorAll('.item-select-cb').forEach(cb => {
        cb.checked = checked;
        const id = parseInt(cb.dataset.itemId);
        if (checked) selectedItemIds.add(id);
        else selectedItemIds.delete(id);
      });
      updateBulkActionBar();
    });
  }

  // Row selection checkboxes
  gridContainer.querySelectorAll('.item-select-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = parseInt(cb.dataset.itemId);
      if (cb.checked) selectedItemIds.add(id);
      else selectedItemIds.delete(id);
      updateBulkActionBar();
    });
  });

  // Row click or edit button -> Edit Product modal
  gridContainer.querySelectorAll('.product-title-clickable, .btn-edit-product').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = el.closest('[data-item-id]');
      const id = parseInt(row.dataset.itemId);
      const item = inventoryItems.find(it => it.id === id);
      if (item) showProductModal(item);
    });
  });

  // Quick Movement Modal buttons (IN / OUT)
  gridContainer.querySelectorAll('.btn-movement').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.itemId);
      const type = btn.dataset.type;
      const item = inventoryItems.find(it => it.id === id);
      if (item) showStockMovementModal(item, type, pageContainer);
    });
  });

  // Inline Editable Cells: Stock Quantity
  gridContainer.querySelectorAll('.editable-stock').forEach(cell => {
    cell.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineNumberEdit(cell, async (newVal) => {
        const id = parseInt(cell.dataset.itemId);
        const item = inventoryItems.find(it => it.id === id);
        if (!item) return;
        const diff = newVal - item.stock_quantity;
        if (diff !== 0) {
          await recordStockEvent({
            itemId: id,
            changeType: CHANGE_TYPE.ADJUSTMENT,
            qty: Math.abs(diff),
            notes: diff > 0 ? `Inline adjustment [+]` : `Inline adjustment [-]`
          });
          toast.success('Stock Updated', `${item.name}: ${item.stock_quantity} → ${newVal}`);
          await loadAndRenderInventory(pageContainer);
        }
      });
    });
  });

  // Inline Editable Cells: Cost Price
  gridContainer.querySelectorAll('.editable-cost').forEach(cell => {
    cell.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineNumberEdit(cell, async (newVal) => {
        const id = parseInt(cell.dataset.itemId);
        await db.items.update(id, { cost_price: newVal });
        toast.success('Cost Price Updated', `New cost: ${fmt(newVal)}`);
        await loadAndRenderInventory(pageContainer);
      });
    });
  });

  // Inline Editable Cells: Selling Price
  gridContainer.querySelectorAll('.editable-price').forEach(cell => {
    cell.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineNumberEdit(cell, async (newVal) => {
        const id = parseInt(cell.dataset.itemId);
        await db.items.update(id, { selling_price: newVal });
        toast.success('Price Updated', `New price: ${fmt(newVal)}`);
        await loadAndRenderInventory(pageContainer);
      });
    });
  });
}

// ── Generic Inline Number Editor ──────────────────────────────
function startInlineNumberEdit(cell, onSave) {
  const currentVal = parseFloat(cell.dataset.current) || 0;
  cell.innerHTML = `
    <input type="number" class="editable-input" value="${currentVal}" step="any">
  `;
  const input = cell.querySelector('input');
  input.focus();
  input.select();

  let saved = false;
  const commit = async () => {
    if (saved) return;
    saved = true;
    const newVal = parseFloat(input.value);
    if (!isNaN(newVal) && newVal >= 0) {
      cell.classList.add('cell-saved-flash');
      await onSave(newVal);
    } else {
      cell.textContent = currentVal;
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      saved = true;
      cell.textContent = currentVal;
    }
  });

  input.addEventListener('blur', commit);
}

// ── Pagination Controls Binder ────────────────────────────────
function bindPaginationEvents(gridContainer, pageContainer) {
  const pageSizeSelect = gridContainer.querySelector('#inv-page-size');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      inventoryPageSize = parseInt(e.target.value) || 25;
      inventoryPage = 1;
      renderInventoryContent(pageContainer);
    });
  }

  const firstBtn = gridContainer.querySelector('#page-first');
  const prevBtn  = gridContainer.querySelector('#page-prev');
  const nextBtn  = gridContainer.querySelector('#page-next');
  const lastBtn  = gridContainer.querySelector('#page-last');

  firstBtn?.addEventListener('click', () => { inventoryPage = 1; renderInventoryContent(pageContainer); });
  prevBtn?.addEventListener('click', () => { if (inventoryPage > 1) { inventoryPage--; renderInventoryContent(pageContainer); } });
  nextBtn?.addEventListener('click', () => { inventoryPage++; renderInventoryContent(pageContainer); });
  lastBtn?.addEventListener('click', () => {
    const filtered = getFilteredItems();
    inventoryPage = Math.ceil(filtered.length / inventoryPageSize) || 1;
    renderInventoryContent(pageContainer);
  });
}

// ── Floating Bulk Action Bar ──────────────────────────────────
function updateBulkActionBar() {
  const bar = document.getElementById('inv-bulk-action-bar');
  const countEl = document.getElementById('bulk-selected-count');
  if (!bar || !countEl) return;

  const count = selectedItemIds.size;
  if (count > 0) {
    countEl.textContent = `${count} Selected`;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

function setupBulkActionHandlers(pageContainer) {
  const cancelBtn = pageContainer.querySelector('#bulk-cancel-btn');
  cancelBtn?.addEventListener('click', () => {
    selectedItemIds.clear();
    pageContainer.querySelectorAll('.item-select-cb, #th-select-all').forEach(cb => cb.checked = false);
    updateBulkActionBar();
  });

  // Bulk Price Update Modal
  pageContainer.querySelector('#bulk-price-update-btn')?.addEventListener('click', () => {
    showBulkPriceModal(pageContainer);
  });

  // Bulk Stock In Modal
  pageContainer.querySelector('#bulk-stock-in-btn')?.addEventListener('click', () => {
    showBulkStockInModal(pageContainer);
  });

  // Bulk Category Move Modal
  pageContainer.querySelector('#bulk-category-btn')?.addEventListener('click', () => {
    showBulkCategoryModal(pageContainer);
  });

  // Bulk Export Selected
  pageContainer.querySelector('#bulk-export-btn')?.addEventListener('click', async () => {
    const selected = inventoryItems.filter(it => selectedItemIds.has(it.id));
    await exportInventoryCSV(selected, 'selected-inventory');
    toast.success('Export Successful', `Exported ${selected.length} selected items.`);
  });

  // Bulk Delete
  pageContainer.querySelector('#bulk-delete-btn')?.addEventListener('click', () => {
    const count = selectedItemIds.size;
    showConfirm(`Are you sure you want to delete ${count} selected product(s)? This will also remove their stock logs.`, async () => {
      const ids = Array.from(selectedItemIds);
      await db.transaction('rw', [db.items, db.logs, db.recipes], async () => {
        for (const id of ids) {
          await db.items.delete(id);
          await db.logs.where('item_id').equals(id).delete();
          await db.recipes.where('composite_item_id').equals(id).delete();
          await db.recipes.where('ingredient_item_id').equals(id).delete();
        }
      });
      selectedItemIds.clear();
      toast.success('Bulk Delete Complete', `Removed ${count} products.`);
      await loadAndRenderInventory(pageContainer);
    });
  });
}

// ── Bulk Actions Modals ───────────────────────────────────────
function showBulkPriceModal(pageContainer) {
  const count = selectedItemIds.size;
  const bodyHTML = `
    <p class="text-sm text-secondary" style="margin-bottom:var(--space-3);">
      Adjust selling prices for <strong>${count}</strong> selected products simultaneously.
    </p>

    <div class="form-group">
      <label class="form-label">Adjustment Type</label>
      <select class="form-select" id="bulk-price-type">
        <option value="pct_increase">Percentage Increase (+ %)</option>
        <option value="pct_decrease">Percentage Decrease (− %)</option>
        <option value="flat_increase">Fixed Amount Increase (+ Rs.)</option>
        <option value="flat_decrease">Fixed Amount Decrease (− Rs.)</option>
      </select>
    </div>

    <div class="form-group" style="margin-top:var(--space-3);">
      <label class="form-label">Value <span class="required">*</span></label>
      <input type="number" class="form-input" id="bulk-price-val" placeholder="e.g. 10" min="0" step="any">
    </div>
  `;

  openModal({
    title: `Bulk Price Update (${count} Items)`,
    bodyHTML,
    footerHTML: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="bulk-price-apply-btn">${icon('icon-check')} Apply Price Update</button>
    `,
    onOpen: (backdrop) => {
      backdrop.querySelector('#bulk-price-apply-btn').addEventListener('click', async () => {
        const val = parseFloat(backdrop.querySelector('#bulk-price-val').value);
        const type = backdrop.querySelector('#bulk-price-type').value;

        if (isNaN(val) || val <= 0) {
          toast.error('Invalid Value', 'Please enter an adjustment amount greater than zero.');
          return;
        }

        const ids = Array.from(selectedItemIds);
        await db.transaction('rw', db.items, async () => {
          for (const id of ids) {
            const item = await db.items.get(id);
            if (!item) continue;
            let newPrice = item.selling_price || 0;
            if (type === 'pct_increase') newPrice = Math.round(newPrice * (1 + val / 100));
            else if (type === 'pct_decrease') newPrice = Math.max(0, Math.round(newPrice * (1 - val / 100)));
            else if (type === 'flat_increase') newPrice += val;
            else if (type === 'flat_decrease') newPrice = Math.max(0, newPrice - val);

            await db.items.update(id, { selling_price: newPrice });
          }
        });

        closeModal();
        selectedItemIds.clear();
        toast.success('Prices Updated', `Updated selling prices for ${ids.length} products.`);
        await loadAndRenderInventory(pageContainer);
      });
    }
  });
}

function showBulkStockInModal(pageContainer) {
  const count = selectedItemIds.size;
  const bodyHTML = `
    <p class="text-sm text-secondary" style="margin-bottom:var(--space-3);">
      Add incoming inventory quantity across all <strong>${count}</strong> selected products (e.g. batch delivery receiving).
    </p>

    <div class="form-group">
      <label class="form-label">Quantity to Add to Each Product <span class="required">*</span></label>
      <input type="number" class="form-input" id="bulk-qty-val" value="10" min="1">
    </div>

    <div class="form-group" style="margin-top:var(--space-3);">
      <label class="form-label">Receiving Batch / Delivery Note</label>
      <input type="text" class="form-input" id="bulk-stock-notes" placeholder="e.g. Supplier PO #4092 shipment">
    </div>
  `;

  openModal({
    title: `Bulk Stock In (${count} Items)`,
    bodyHTML,
    footerHTML: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="bulk-stock-apply-btn">${icon('icon-plus')} Add Stock to All</button>
    `,
    onOpen: (backdrop) => {
      backdrop.querySelector('#bulk-stock-apply-btn').addEventListener('click', async () => {
        const qty = parseFloat(backdrop.querySelector('#bulk-qty-val').value);
        const notes = backdrop.querySelector('#bulk-stock-notes').value.trim() || 'Bulk receiving';

        if (isNaN(qty) || qty <= 0) {
          toast.error('Invalid Quantity', 'Please enter a quantity greater than zero.');
          return;
        }

        const ids = Array.from(selectedItemIds);
        for (const id of ids) {
          await recordStockEvent({
            itemId: id,
            changeType: CHANGE_TYPE.IN,
            qty,
            notes: `[Bulk In] ${notes}`,
            reason: 'Receiving'
          });
        }

        closeModal();
        selectedItemIds.clear();
        toast.success('Bulk Stock Added', `Added +${qty} to ${ids.length} products.`);
        await loadAndRenderInventory(pageContainer);
      });
    }
  });
}

function showBulkCategoryModal(pageContainer) {
  const count = selectedItemIds.size;
  const cats = CATEGORIES.filter(c => c !== 'All');

  const bodyHTML = `
    <p class="text-sm text-secondary" style="margin-bottom:var(--space-3);">
      Assign <strong>${count}</strong> selected products to a new category.
    </p>

    <div class="form-group">
      <label class="form-label">Target Category <span class="required">*</span></label>
      <select class="form-select" id="bulk-cat-select">
        ${cats.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  `;

  openModal({
    title: `Move ${count} Products Category`,
    bodyHTML,
    footerHTML: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="bulk-cat-apply-btn">${icon('icon-check')} Update Category</button>
    `,
    onOpen: (backdrop) => {
      backdrop.querySelector('#bulk-cat-apply-btn').addEventListener('click', async () => {
        const newCat = backdrop.querySelector('#bulk-cat-select').value;
        const ids = Array.from(selectedItemIds);
        await db.transaction('rw', db.items, async () => {
          for (const id of ids) {
            await db.items.update(id, { category: newCat });
          }
        });
        closeModal();
        selectedItemIds.clear();
        toast.success('Category Updated', `Moved ${ids.length} products to ${newCat}.`);
        await loadAndRenderInventory(pageContainer);
      });
    }
  });
}

// ── 4-State Stock Movement Ledger Modal ───────────────────────
function showStockMovementModal(item, defaultType = 'IN', pageContainer) {
  let selectedMovement = defaultType; // 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE'

  const bodyHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);background:var(--surface-raised);border-radius:var(--radius-lg);margin-bottom:var(--space-4);border:1px solid var(--border);">
      <div style="width:48px;height:48px;border-radius:var(--radius-md);overflow:hidden;background:var(--surface);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);">
        ${item.photo_blob ? `<img src="${item.photo_blob}" alt="" style="width:100%;height:100%;object-fit:cover;">` : categoryIcon(item.category)}
      </div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">${item.name}</div>
        <div class="text-xs text-secondary">Current Live Stock: <strong class="text-primary font-bold" id="movement-current-stock">${fmtNum(item.stock_quantity)} ${item.unit}</strong></div>
      </div>
    </div>

    <!-- 4-State Movement Tabs -->
    <div class="movement-type-tabs">
      <button class="movement-tab-btn ${selectedMovement === 'IN' ? 'active type-in' : ''}" data-mtype="IN">
        <span>📥 Stock In</span>
        <span style="font-size:0.65rem;opacity:0.85;">Receiving</span>
      </button>
      <button class="movement-tab-btn ${selectedMovement === 'OUT' ? 'active type-out' : ''}" data-mtype="OUT">
        <span>📤 Stock Out</span>
        <span style="font-size:0.65rem;opacity:0.85;">Shrinkage</span>
      </button>
      <button class="movement-tab-btn ${selectedMovement === 'ADJUSTMENT' ? 'active type-adjust' : ''}" data-mtype="ADJUSTMENT">
        <span>⚖️ Adjust</span>
        <span style="font-size:0.65rem;opacity:0.85;">Damage/Audit</span>
      </button>
      <button class="movement-tab-btn ${selectedMovement === 'SALE' ? 'active type-sale' : ''}" data-mtype="SALE">
        <span>🧾 Sale</span>
        <span style="font-size:0.65rem;opacity:0.85;">Deduction</span>
      </button>
    </div>

    <!-- Live Calculation Preview Card -->
    <div style="background:var(--surface-raised);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
      <span class="text-xs text-secondary">Calculated Stock After Event:</span>
      <span class="mono font-bold text-sm" id="movement-preview-val" style="color:var(--primary);">
        ${fmtNum(item.stock_quantity + 1)} ${item.unit} (+1)
      </span>
    </div>

    <form id="movement-form" style="display:flex;flex-direction:column;gap:var(--space-3);">
      <div class="form-group">
        <label class="form-label">Quantity to Move (${item.unit}) <span class="required">*</span></label>
        <div style="display:flex;align-items:center;gap:8px;">
          <button type="button" class="btn btn-ghost btn-sm" id="movement-dec-btn" style="width:36px;height:36px;font-size:1.1rem;font-weight:700;">−</button>
          <input type="number" class="form-input" id="movement-qty" value="1" min="0.01" step="any" style="text-align:center;font-size:1.1rem;font-weight:700;font-family:var(--font-mono);flex:1;">
          <button type="button" class="btn btn-ghost btn-sm" id="movement-inc-btn" style="width:36px;height:36px;font-size:1.1rem;font-weight:700;">+</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" id="movement-reason-label">Movement Reason / Category</label>
        <select class="form-select" id="movement-reason">
          <!-- Populated dynamically based on movement type -->
        </select>
      </div>

      <div class="form-group" id="movement-cost-wrap">
        <label class="form-label">Unit Cost (Optional - Updates Inventory Cost)</label>
        <input type="number" class="form-input" id="movement-unit-cost" value="${item.cost_price || ''}" placeholder="${item.cost_price || 0}" step="any">
      </div>

      <div class="form-group">
        <label class="form-label">Audit Notes / Supplier PO</label>
        <input type="text" class="form-input" id="movement-notes" placeholder="Optional notes for ledger traceability">
      </div>
    </form>
  `;

  openModal({
    title: `Record Stock Movement: ${item.name}`,
    bodyHTML,
    footerHTML: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="movement-confirm-btn">${icon('icon-check')} Post Movement Ledger</button>
    `,
    onOpen: (backdrop) => {
      const qtyInput = backdrop.querySelector('#movement-qty');
      const reasonSelect = backdrop.querySelector('#movement-reason');
      const costWrap = backdrop.querySelector('#movement-cost-wrap');
      const previewVal = backdrop.querySelector('#movement-preview-val');
      const confirmBtn = backdrop.querySelector('#movement-confirm-btn');

      const reasonOptions = {
        IN: ['Supplier Purchase Delivery', 'Restock / New Shipment', 'Customer Return (Restock)', 'Warehouse Transfer In', 'Inventory Audit Correction (+)'],
        OUT: ['Loss / Unknown Shrinkage', 'Theft / Shoplift', 'Internal Store Consumption', 'Return to Vendor', 'Demonstration Sample'],
        ADJUSTMENT: ['Physical Audit Count Correction', 'Damaged / Broken Product', 'Expired / Spoiled Item', 'Factory Packing Defect', 'Batch Correction'],
        SALE: ['Direct Retail Sale', 'Phone / Offline Order', 'B2B Wholesale Order', 'Promotional Gift']
      };

      const updateReasonOptions = () => {
        const opts = reasonOptions[selectedMovement] || [];
        reasonSelect.innerHTML = opts.map(o => `<option value="${o}">${o}</option>`).join('');
        costWrap.style.display = selectedMovement === 'IN' ? 'block' : 'none';

        // Update button style
        confirmBtn.className = 'btn';
        if (selectedMovement === 'IN') confirmBtn.classList.add('btn-success');
        else if (selectedMovement === 'OUT') confirmBtn.classList.add('btn-amber');
        else if (selectedMovement === 'ADJUSTMENT') confirmBtn.classList.add('btn-indigo');
        else confirmBtn.classList.add('btn-primary');
      };

      const updatePreview = () => {
        const qty = parseFloat(qtyInput.value) || 0;
        let nextStock = item.stock_quantity;
        let sign = '+';

        if (selectedMovement === 'IN') {
          nextStock += qty;
          sign = `+${qty}`;
        } else if (selectedMovement === 'OUT' || selectedMovement === 'SALE') {
          nextStock = Math.max(0, nextStock - qty);
          sign = `−${qty}`;
        } else if (selectedMovement === 'ADJUSTMENT') {
          const isNegative = reasonSelect.value.includes('Damaged') || reasonSelect.value.includes('Expired') || reasonSelect.value.includes('Defect');
          nextStock = isNegative ? Math.max(0, nextStock - qty) : nextStock + qty;
          sign = isNegative ? `−${qty}` : `+${qty}`;
        }

        previewVal.textContent = `${fmtNum(nextStock)} ${item.unit} (${sign})`;
        if ((selectedMovement === 'OUT' || selectedMovement === 'SALE') && item.stock_quantity < qty) {
          previewVal.style.color = 'var(--danger)';
        } else {
          previewVal.style.color = 'var(--primary)';
        }
      };

      // Movement tab switching
      backdrop.querySelectorAll('[data-mtype]').forEach(tab => {
        tab.addEventListener('click', () => {
          selectedMovement = tab.dataset.mtype;
          backdrop.querySelectorAll('[data-mtype]').forEach(t => {
            t.className = 'movement-tab-btn';
            if (t === tab) {
              const cls = t.dataset.mtype === 'IN' ? 'type-in' : t.dataset.mtype === 'OUT' ? 'type-out' : t.dataset.mtype === 'ADJUSTMENT' ? 'type-adjust' : 'type-sale';
              t.classList.add('active', cls);
            }
          });
          updateReasonOptions();
          updatePreview();
        });
      });

      backdrop.querySelector('#movement-dec-btn').addEventListener('click', () => {
        qtyInput.value = Math.max(1, (parseFloat(qtyInput.value) || 1) - 1);
        updatePreview();
      });
      backdrop.querySelector('#movement-inc-btn').addEventListener('click', () => {
        qtyInput.value = (parseFloat(qtyInput.value) || 0) + 1;
        updatePreview();
      });

      qtyInput.addEventListener('input', updatePreview);
      reasonSelect.addEventListener('change', updatePreview);

      updateReasonOptions();
      updatePreview();

      // Submit Stock Movement
      confirmBtn.addEventListener('click', async () => {
        const qty = parseFloat(qtyInput.value);
        if (isNaN(qty) || qty <= 0) {
          toast.error('Invalid Quantity', 'Please enter a valid stock quantity.');
          return;
        }

        if ((selectedMovement === 'OUT' || selectedMovement === 'SALE') && item.stock_quantity < qty) {
          toast.error('Insufficient Stock', `Only ${fmtNum(item.stock_quantity)} ${item.unit} available.`);
          return;
        }

        const reason = reasonSelect.value;
        const notes = backdrop.querySelector('#movement-notes').value.trim();
        const unitCost = selectedMovement === 'IN' ? parseFloat(backdrop.querySelector('#movement-unit-cost').value) : null;

        // Map movement type
        let changeType = CHANGE_TYPE[selectedMovement];
        let notePrefix = '';
        if (selectedMovement === 'ADJUSTMENT') {
          const isNegative = reason.includes('Damaged') || reason.includes('Expired') || reason.includes('Defect');
          notePrefix = isNegative ? '[-] ' : '[+] ';
        }

        closeModal();

        await recordStockEvent({
          itemId: item.id,
          changeType,
          qty,
          notes: notePrefix + notes,
          reason,
          unitCost
        });

        playBeepSound('success');
        toast.success('Movement Recorded', `Posted ${selectedMovement} event for ${item.name}.`);
        await loadAndRenderInventory(pageContainer);
      });
    }
  });
}

// ── Add / Edit Product Modal with Auto SKU & Camera Scan ──────
async function showProductModal(item) {
  const isEdit = !!item;
  let previewPhotoBlob = item?.photo_blob || null;

  const bodyHTML = `
    <div class="form-group">
      <label class="form-label">Product Photo</label>
      <div class="image-upload-zone ${previewPhotoBlob ? 'has-image' : ''}" id="photo-zone">
        ${previewPhotoBlob
          ? `<img class="image-preview" src="${previewPhotoBlob}" id="photo-preview" alt="Product photo">
             <div>
               <div class="text-sm font-semibold">Photo uploaded</div>
               <div class="text-muted text-xs">Click to change</div>
             </div>`
          : `${icon('icon-upload')}
             <p><strong>Click to upload</strong> or drag & drop</p>
             <p class="text-xs">WebP/PNG/JPG · Auto-compressed for 0ms offline storage</p>`
        }
        <input type="file" id="photo-input" accept="image/*" class="hidden" aria-label="Upload product photo">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Product Name <span class="required">*</span></label>
      <input class="form-input" id="prod-name" value="${item?.name || ''}" placeholder="e.g. 1L Full Cream Milk">
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="prod-category">
          ${CATEGORIES.filter(c => c !== 'All').map(c => `<option value="${c}" ${item?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Unit of Measure</label>
        <select class="form-select" id="prod-unit">
          ${UNITS.map(u => `<option value="${u}" ${item?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- SKU & Barcode Engine Section -->
    <div class="form-group">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <label class="form-label" style="margin-bottom:0;">SKU / Barcode</label>
        <div style="display:flex;gap:4px;">
          <button type="button" class="btn btn-ghost btn-sm" id="prod-auto-sku-btn" style="padding:2px 8px;font-size:0.75rem;">
            ✨ Auto SKU
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="prod-cam-scan-btn" style="padding:2px 8px;font-size:0.75rem;">
            📷 Scan Barcode
          </button>
        </div>
      </div>
      <div class="input-group">
        <span class="input-icon">${icon('icon-barcode')}</span>
        <input class="form-input" id="prod-barcode" value="${item?.barcode || ''}" placeholder="Scan hardware barcode or click Auto SKU">
      </div>
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Cost Price (Purchase)</label>
        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input class="form-input" type="number" id="prod-cost" value="${item?.cost_price || ''}" placeholder="0" min="0" step="any">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Selling Price (Retail) <span class="required">*</span></label>
        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input class="form-input" type="number" id="prod-price" value="${item?.selling_price || ''}" placeholder="0" min="0" step="any">
        </div>
      </div>
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Initial / Live Stock</label>
        <input class="form-input" type="number" id="prod-stock" value="${item?.stock_quantity ?? ''}" placeholder="0" min="0" ${isEdit ? 'readonly style="background:var(--surface-raised);cursor:not-allowed;"' : ''}>
        ${isEdit ? '<div class="form-hint">Use Stock Movement buttons to update stock live.</div>' : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Min Stock Threshold Alert</label>
        <input class="form-input" type="number" id="prod-min-alert" value="${item?.min_stock_alert ?? 5}" placeholder="5" min="0">
      </div>
    </div>

    <div class="form-group">
      <label class="toggle-wrap">
        <span class="toggle">
          <input type="checkbox" id="prod-is-composite" ${item?.is_composite ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </span>
        <div>
          <div class="font-semibold text-sm">Composite / Recipe Item</div>
          <div class="text-muted text-xs">Uses ingredients from inventory (e.g. Burger made from patties & buns)</div>
        </div>
      </label>
    </div>
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-ghost-danger" id="prod-delete-btn">${icon('icon-trash')} Delete Product</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="prod-save-btn">${icon('icon-check')} ${isEdit ? 'Save Changes' : 'Create Product'}</button>
  `;

  openModal({
    title: isEdit ? `Edit Product: ${item.name}` : 'Add New Product to Inventory',
    bodyHTML,
    footerHTML,
    size: 'modal-lg',
    onOpen: (backdrop) => {
      const nameInput = backdrop.querySelector('#prod-name');
      const catSelect = backdrop.querySelector('#prod-category');
      const barcodeInput = backdrop.querySelector('#prod-barcode');

      // ✨ Auto SKU button
      backdrop.querySelector('#prod-auto-sku-btn').addEventListener('click', () => {
        const sku = generateSKU(catSelect.value, nameInput.value);
        barcodeInput.value = sku;
        barcodeInput.classList.add('cell-saved-flash');
        setTimeout(() => barcodeInput.classList.remove('cell-saved-flash'), 1000);
        toast.info('SKU Generated', `Created SKU: ${sku}`);
      });

      // 📷 Scan button in modal
      backdrop.querySelector('#prod-cam-scan-btn').addEventListener('click', () => {
        showCameraScannerModal((code) => {
          barcodeInput.value = code;
          barcodeInput.classList.add('cell-saved-flash');
          setTimeout(() => barcodeInput.classList.remove('cell-saved-flash'), 1000);
          toast.success('Barcode Captured', code);
        });
      });

      // Image upload
      const photoZone  = backdrop.querySelector('#photo-zone');
      const photoInput = backdrop.querySelector('#photo-input');
      photoZone.addEventListener('click', () => photoInput.click());
      photoZone.addEventListener('dragover', (e) => { e.preventDefault(); photoZone.style.borderColor = 'var(--primary)'; });
      photoZone.addEventListener('dragleave', () => { photoZone.style.borderColor = ''; });
      photoZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        photoZone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file) await handlePhotoUpload(file, photoZone);
      });

      photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await handlePhotoUpload(file, photoZone);
      });

      async function handlePhotoUpload(file, zone) {
        try {
          previewPhotoBlob = await compressImage(file);
          zone.classList.add('has-image');
          zone.innerHTML = `
            <img class="image-preview" src="${previewPhotoBlob}" id="photo-preview" alt="Product photo">
            <div>
              <div class="text-sm font-semibold">Photo ready</div>
              <div class="text-muted text-xs">Click to change</div>
            </div>
            <input type="file" id="photo-input" accept="image/*" class="hidden">`;
          zone.querySelector('#photo-input').addEventListener('change', async (e2) => {
            const f2 = e2.target.files[0];
            if (f2) await handlePhotoUpload(f2, zone);
          });
          zone.addEventListener('click', () => zone.querySelector('#photo-input').click());
        } catch (err) {
          toast.error('Upload Failed', 'Could not process image.');
        }
      }

      // Save Product
      backdrop.querySelector('#prod-save-btn').addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const price = parseFloat(backdrop.querySelector('#prod-price').value) || 0;

        if (!name) {
          nameInput.classList.add('error');
          toast.error('Validation Error', 'Product name is required.');
          return;
        }

        let barcode = barcodeInput.value.trim();
        if (!barcode && !isEdit) {
          barcode = generateSKU(catSelect.value, name);
        }

        const itemData = {
          name,
          barcode,
          category:        catSelect.value,
          unit:            backdrop.querySelector('#prod-unit').value,
          cost_price:      parseFloat(backdrop.querySelector('#prod-cost').value) || 0,
          selling_price:   price,
          min_stock_alert: parseFloat(backdrop.querySelector('#prod-min-alert').value) || 5,
          is_composite:    backdrop.querySelector('#prod-is-composite').checked,
          photo_blob:      previewPhotoBlob
        };

        if (isEdit) {
          await db.items.update(item.id, itemData);
          toast.success('Product Updated', `${name} has been updated.`);
        } else {
          const initialStock = parseFloat(backdrop.querySelector('#prod-stock').value) || 0;
          itemData.initial_stock = initialStock;
          itemData.stock_quantity = initialStock;
          itemData.created_at = new Date().toISOString();
          const id = await db.items.add(itemData);
          if (initialStock > 0) {
            await recordStockEvent({
              itemId: id,
              changeType: CHANGE_TYPE.IN,
              qty: initialStock,
              notes: 'Initial opening stock',
              reason: 'Receiving'
            });
          }
          toast.success('Product Added', `${name} created with SKU: ${barcode}`);
        }

        closeModal();
        const pageContainer = document.getElementById('page-content');
        await loadAndRenderInventory(pageContainer);
      });

      // Delete Product
      if (isEdit) {
        backdrop.querySelector('#prod-delete-btn').addEventListener('click', () => {
          closeModal();
          showConfirm(`Permanently delete "${item.name}"? All related stock ledger logs will also be removed.`, async () => {
            await db.items.delete(item.id);
            await db.logs.where('item_id').equals(item.id).delete();
            await db.recipes.where('composite_item_id').equals(item.id).delete();
            await db.recipes.where('ingredient_item_id').equals(item.id).delete();
            toast.success('Deleted', `${item.name} has been removed.`);
            const pageContainer = document.getElementById('page-content');
            await loadAndRenderInventory(pageContainer);
          });
        });
      }
    }
  });
}

// ── Category Filter Pills ─────────────────────────────────────
function renderCategoryPills(container) {
  const pillsEl = container.querySelector('#inv-category-pills');
  if (!pillsEl) return;

  const cats = ['All', ...new Set(inventoryItems.map(it => it.category))].filter(Boolean);
  pillsEl.innerHTML = cats.map(cat => `
    <button class="btn btn-pill btn-ghost ${inventoryCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
  `).join('');

  pillsEl.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      inventoryCategory = btn.dataset.cat;
      pillsEl.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('active', b === btn));
      inventoryPage = 1;
      renderInventoryContent(container);
    });
  });
}

// ── CSV Bulk Import ───────────────────────────────────────────
function showImportCSVModal() {
  const bodyHTML = `
    <p class="text-sm text-secondary">Upload a CSV file to bulk-create or update products with SKUs and stock levels.</p>
    <button class="btn btn-ghost btn-sm" id="csv-template-btn" style="margin-top:var(--space-2);">${icon('icon-download')} Download CSV Template</button>
    <div class="image-upload-zone" id="csv-drop-zone" style="margin-top:var(--space-3)">
      ${icon('icon-upload')}
      <p><strong>Click to choose CSV file</strong> or drag & drop</p>
      <p class="text-xs">Columns: barcode, name, category, unit, cost_price, selling_price, min_stock_alert, stock_quantity</p>
      <input type="file" id="csv-file-input" accept=".csv" class="hidden">
    </div>
    <div id="csv-import-result" class="hidden" style="margin-top:var(--space-3)"></div>
  `;

  openModal({
    title: 'Bulk Import Products from CSV',
    bodyHTML,
    footerHTML: `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`,
    onOpen: (backdrop) => {
      backdrop.querySelector('#csv-template-btn').addEventListener('click', downloadImportTemplate);
      const dropZone = backdrop.querySelector('#csv-drop-zone');
      const fileInput = backdrop.querySelector('#csv-file-input');

      dropZone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await runImport(file, backdrop);
      });
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
      dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file) await runImport(file, backdrop);
      });
    }
  });
}

async function runImport(file, backdrop) {
  const resultDiv = backdrop.querySelector('#csv-import-result');
  resultDiv.innerHTML = `<div class="badge badge-gray animate-pulse">Importing CSV...</div>`;
  resultDiv.classList.remove('hidden');

  try {
    const results = await importItemsFromCSV(file);
    resultDiv.innerHTML = `
      <div style="padding:var(--space-3);background:var(--stock-in-bg);border-radius:var(--radius-md);border:1px solid var(--stock-in)">
        <div class="font-semibold text-sm" style="color:#065F46">Import Complete</div>
        <div class="text-sm" style="color:#065F46">Created: ${results.created} · Updated: ${results.updated}</div>
        ${results.errors.length > 0 ? `<div class="text-sm" style="color:var(--danger);margin-top:4px">${results.errors.join('<br>')}</div>` : ''}
      </div>`;
    toast.success('Import Finished', `Created ${results.created}, updated ${results.updated} items.`);
    const pageContainer = document.getElementById('page-content');
    await loadAndRenderInventory(pageContainer);
  } catch (err) {
    resultDiv.innerHTML = `<div style="color:var(--danger);font-size:0.875rem">${err.message}</div>`;
    toast.error('Import Failed', err.message);
  }
}
