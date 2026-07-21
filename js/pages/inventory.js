/**
 * inventory.js — Inventory Management Page
 * Visual product grid, CRUD, quick stock in/out, category filters, search
 */

let inventoryItems     = [];
let inventoryCategory  = 'All';
let inventorySearch    = '';
let inventorySort      = 'name'; // 'name' | 'stock_asc' | 'stock_desc' | 'price' | 'low_stock'
let inventoryView      = localStorage.getItem('inv_view_v3') || 'grid';

async function renderInventory(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Inventory Catalog</h1>
        <p>Manage products, stock levels, margins, and recipes</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" id="inv-import-csv">${icon('icon-upload')} Import CSV</button>
        <button class="btn btn-ghost btn-sm" id="inv-export-csv">${icon('icon-download')} Export CSV</button>
        <button class="btn btn-primary btn-sm" id="inv-add-btn">${icon('icon-plus')} Add Product</button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-search-wrap">
        ${icon('icon-search', 'filter-search-icon')}
        <input type="text" class="filter-search" id="inv-search" placeholder="Search products..." value="${inventorySearch}">
      </div>
      <div class="filter-pills" id="inv-category-pills"></div>
      
      <div style="display:flex;gap:var(--space-2);align-items:center;margin-left:auto">
        <select class="form-select" id="inv-sort" style="width:auto;padding:7px 32px 7px 10px;font-size:0.8125rem;">
          <option value="name">Sort: A–Z</option>
          <option value="stock_asc">Stock: Low First</option>
          <option value="stock_desc">Stock: High First</option>
          <option value="price">Price: High First</option>
          <option value="low_stock">Low Stock First</option>
        </select>
        
        <div style="display:flex;background:var(--border-soft);padding:2px;border-radius:var(--radius-md)">
          <button class="btn btn-ghost btn-sm" id="inv-view-grid" style="padding:4px 8px;min-height:auto" title="Grid View">${icon('icon-dashboard')}</button>
          <button class="btn btn-ghost btn-sm" id="inv-view-table" style="padding:4px 8px;min-height:auto" title="Table View">${icon('icon-logs')}</button>
        </div>
      </div>
    </div>

    <div id="inv-grid-container">
      <div class="product-grid">
        ${[1,2,3,4,5,6,7,8].map(() => `
          <div class="skeleton-card">
            <div class="skeleton" style="aspect-ratio:1.3;border-radius:var(--radius-md)"></div>
            <div class="skeleton" style="height:16px;width:80%;margin-top:8px"></div>
            <div class="skeleton" style="height:14px;width:50%;margin-top:6px"></div>
          </div>`).join('')}
      </div>
    </div>
  `;

  await loadAndRenderGrid(container);

  // ── Controls ─────────────────────────────────────────────
  container.querySelector('#inv-add-btn').addEventListener('click', () => showProductModal(null));

  container.querySelector('#inv-search').addEventListener('input', debounce((e) => {
    inventorySearch = e.target.value;
    renderGrid(container);
  }, 200));

  container.querySelector('#inv-sort').addEventListener('change', (e) => {
    inventorySort = e.target.value;
    renderGrid(container);
  });

  const gridBtn = container.querySelector('#inv-view-grid');
  const tableBtn = container.querySelector('#inv-view-table');

  const updateViewBtns = () => {
    gridBtn.classList.toggle('active', inventoryView === 'grid');
    tableBtn.classList.toggle('active', inventoryView === 'table');
  };

  gridBtn.addEventListener('click', () => {
    inventoryView = 'grid';
    localStorage.setItem('inv_view_v3', 'grid');
    updateViewBtns();
    renderGrid(container);
  });

  tableBtn.addEventListener('click', () => {
    inventoryView = 'table';
    localStorage.setItem('inv_view_v3', 'table');
    updateViewBtns();
    renderGrid(container);
  });

  updateViewBtns();

  container.querySelector('#inv-export-csv').addEventListener('click', async () => {
    await exportInventoryCSV();
    toast.success('Exported', 'Inventory CSV downloaded.');
  });

  container.querySelector('#inv-import-csv').addEventListener('click', () => showImportCSVModal());

  // Category pills
  renderCategoryPills(container);
}

async function loadAndRenderGrid(container) {
  inventoryItems = await db.items.toArray();
  renderGrid(container);
}

function getFilteredItems() {
  let items = [...inventoryItems];

  // Category filter
  if (inventoryCategory !== 'All') {
    items = items.filter(it => it.category === inventoryCategory);
  }

  // Search filter
  if (inventorySearch) {
    const q = inventorySearch.toLowerCase();
    items = items.filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q))
    );
  }

  // Sort
  switch (inventorySort) {
    case 'name':        items.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'stock_asc':   items.sort((a, b) => a.stock_quantity - b.stock_quantity); break;
    case 'stock_desc':  items.sort((a, b) => b.stock_quantity - a.stock_quantity); break;
    case 'price':       items.sort((a, b) => b.selling_price - a.selling_price); break;
    case 'low_stock':   items.sort((a, b) => {
      const aLow = a.stock_quantity <= a.min_stock_alert ? 0 : 1;
      const bLow = b.stock_quantity <= b.min_stock_alert ? 0 : 1;
      return aLow - bLow || a.stock_quantity - b.stock_quantity;
    }); break;
  }

  return items;
}

function renderGrid(container) {
  const filtered = getFilteredItems();
  const gridContainer = container.querySelector('#inv-grid-container');
  if (!gridContainer) return;

  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state">
        ${icon('icon-package', 'empty-state-icon')}
        <h3>No Products Found</h3>
        <p>${inventorySearch || inventoryCategory !== 'All' ? 'Try adjusting your search or filter.' : 'Add your first product to get started.'}</p>
        ${inventorySearch === '' && inventoryCategory === 'All' ? `<button class="btn btn-primary btn-sm" onclick="document.getElementById('inv-add-btn').click()">${icon('icon-plus')} Add Product</button>` : ''}
      </div>`;
    return;
  }

  if (inventoryView === 'grid') {
    gridContainer.innerHTML = `
      <div class="product-grid">
        ${filtered.map(item => renderProductCard(item)).join('')}
      </div>
      <div style="padding:var(--space-3) 0;color:var(--text-muted);font-size:0.8125rem;">
        Showing ${filtered.length} of ${inventoryItems.length} products
      </div>
    `;
  } else {
    gridContainer.innerHTML = `
      ${renderProductTable(filtered)}
      <div style="padding:var(--space-3) 0;color:var(--text-muted);font-size:0.8125rem;">
        Showing ${filtered.length} of ${inventoryItems.length} products
      </div>
    `;
  }

  // Row / Card click → edit modal
  const selector = inventoryView === 'grid' ? '.product-card' : '.product-row';
  gridContainer.querySelectorAll(selector).forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.product-card-btn') || e.target.closest('.btn-edit')) return;
      const itemId = parseInt(card.dataset.itemId);
      const item = inventoryItems.find(it => it.id === itemId);
      if (item) showProductModal(item);
    });
  });

  // Edit action in table row
  gridContainer.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = parseInt(btn.closest('.product-row').dataset.itemId);
      const item = inventoryItems.find(it => it.id === itemId);
      if (item) showProductModal(item);
    });
  });

  // Quick IN button
  gridContainer.querySelectorAll('.product-card-btn.btn-in').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cardEl = btn.closest(selector);
      const itemId = parseInt(cardEl.dataset.itemId);
      const item   = inventoryItems.find(it => it.id === itemId);
      if (item) showQuickStockInputModal(item, 'IN', container);
    });
  });

  // Quick SALE button
  gridContainer.querySelectorAll('.product-card-btn.btn-out').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cardEl = btn.closest(selector);
      const itemId = parseInt(cardEl.dataset.itemId);
      const item   = inventoryItems.find(it => it.id === itemId);
      if (item) showQuickStockInputModal(item, 'SALE', container);
    });
  });
}

function renderProductCard(item) {
  const isLow      = !item.is_composite && item.stock_quantity <= item.min_stock_alert;
  const isCritical = !item.is_composite && item.stock_quantity === 0;
  const thumb = item.photo_blob
    ? `<img src="${item.photo_blob}" alt="${item.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
    : categoryIcon(item.category);

  const margin = item.selling_price > 0
    ? (((item.selling_price - item.cost_price) / item.selling_price) * 100).toFixed(0)
    : 0;

  const lowBadge = isCritical
    ? `<div class="badge badge-red" style="position:absolute;top:8px;left:8px;box-shadow:var(--shadow-sm)">Out of Stock</div>`
    : isLow
    ? `<div class="badge badge-amber" style="position:absolute;top:8px;left:8px;box-shadow:var(--shadow-sm)">Low Stock</div>`
    : '';

  // Stock status progress bar representation
  const stockRatio = item.min_stock_alert > 0 
    ? Math.min(100, (item.stock_quantity / (item.min_stock_alert * 2)) * 100)
    : 100;
  const barColor = isCritical ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)';

  return `
    <div class="product-card" data-item-id="${item.id}" style="cursor:pointer;position:relative;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;transition:all var(--transition-fast)">
      <div style="aspect-ratio:1.3;background:var(--canvas);display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid var(--border-soft)">
        ${thumb}
        ${lowBadge}
        ${item.is_composite ? `<div class="badge badge-primary" style="position:absolute;top:8px;right:8px">Recipe</div>` : ''}
      </div>
      <div style="padding:var(--space-3)">
        <div style="font-size:0.875rem;font-weight:700;color:var(--text-primary);margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:40px" title="${item.name}">${item.name}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <span class="badge badge-gray" style="font-size:0.65rem">${item.category}</span>
          <span class="text-xs font-semibold text-teal" title="Profit Margin">${margin}% Margin</span>
        </div>
        
        <!-- Stock level stats & bar -->
        ${item.is_composite ? `
          <div style="font-size:0.75rem;font-weight:500;color:var(--text-muted);margin-bottom:var(--space-2)">Linked recipe ingredients</div>
        ` : `
          <div style="margin-bottom:var(--space-2)">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
              <span class="text-secondary">Stock: <strong class="${isLow ? 'text-amber' : 'text-primary'}">${item.stock_quantity}</strong> ${item.unit}</span>
              <span class="text-muted">Min: ${item.min_stock_alert}</span>
            </div>
            <div style="background:var(--border-soft);height:5px;border-radius:var(--radius-full);overflow:hidden">
              <div style="width:${stockRatio}%;background:${barColor};height:100%"></div>
            </div>
          </div>
        `}

        <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--border-soft);padding-top:var(--space-2);margin-bottom:var(--space-2)">
          <div style="font-size:0.7rem;color:var(--text-muted)">Cost: <span class="mono">${fmt(item.cost_price)}</span></div>
          <div style="font-size:0.95rem;font-weight:800;color:var(--primary);letter-spacing:-0.02em" class="mono">${fmt(item.selling_price)}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
          <button class="product-card-btn btn-in btn btn-ghost btn-sm" style="font-size:0.75rem;padding:4px;min-height:auto" title="Quick Add Stock">${icon('icon-plus')} Stock In</button>
          <button class="product-card-btn btn-out btn btn-ghost btn-sm" style="font-size:0.75rem;padding:4px;min-height:auto" title="Quick Deduct Stock">${icon('icon-minus')} Quick Sale</button>
        </div>
      </div>
    </div>
  `;
}

function renderProductTable(items) {
  return `
    <div class="table-scroll">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="width:50px">Image</th>
            <th>Product & Barcode</th>
            <th>Category</th>
            <th>Stock Level</th>
            <th>Cost Price</th>
            <th>Selling Price</th>
            <th>Margin</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const isLow = !item.is_composite && item.stock_quantity <= item.min_stock_alert;
            const isCritical = !item.is_composite && item.stock_quantity === 0;
            const thumb = item.photo_blob
              ? `<img src="${item.photo_blob}" alt="${item.name}" style="width:36px;height:36px;border-radius:var(--radius-md);object-fit:cover">`
              : `<div style="width:36px;height:36px;border-radius:var(--radius-md);background:var(--canvas);display:flex;align-items:center;justify-content:center">${categoryIcon(item.category)}</div>`;

            const margin = item.selling_price > 0
              ? (((item.selling_price - item.cost_price) / item.selling_price) * 100).toFixed(0)
              : 0;

            const stockText = item.is_composite
              ? `<span class="badge badge-primary">Recipe</span>`
              : isCritical
              ? `<span class="badge badge-red">Out of Stock</span>`
              : isLow
              ? `<span class="badge badge-amber">Low (${item.stock_quantity} ${item.unit})</span>`
              : `<span class="badge badge-green">${item.stock_quantity} ${item.unit}</span>`;

            return `
              <tr class="product-row" data-item-id="${item.id}" style="cursor:pointer">
                <td>${thumb}</td>
                <td>
                  <div class="font-bold text-sm text-primary">${item.name}</div>
                  <div class="mono text-xs text-muted">${item.barcode || 'No Barcode'}</div>
                </td>
                <td><span class="badge badge-gray">${item.category}</span></td>
                <td>${stockText}</td>
                <td class="mono text-sm">${fmt(item.cost_price)}</td>
                <td class="mono text-sm font-semibold">${fmt(item.selling_price)}</td>
                <td class="text-teal font-semibold text-sm">${margin}%</td>
                <td style="text-align:right">
                  <div style="display:flex;gap:var(--space-2);justify-content:flex-end">
                    <button class="product-card-btn btn-in btn btn-ghost btn-sm" style="padding:4px 8px;min-height:auto" title="Quick Stock In">${icon('icon-plus')}</button>
                    <button class="product-card-btn btn-out btn btn-ghost btn-sm" style="padding:4px 8px;min-height:auto" title="Quick Sale">${icon('icon-minus')}</button>
                    <button class="btn btn-ghost btn-sm btn-edit" style="padding:4px 8px;min-height:auto" title="Edit">${icon('icon-edit')}</button>
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
      renderGrid(container);
    });
  });
}

// ── Quick Stock Input (inline) ───────────────────────────────
function showQuickStockInputModal(item, type, pageContainer) {
  const isIn = type === 'IN';
  const title = isIn ? `Stock In: ${item.name}` : `Record Sale: ${item.name}`;
  const btnClass = isIn ? 'btn-success' : 'btn-indigo';
  const btnLabel = isIn ? `${icon('icon-plus')} Add to Stock` : `${icon('icon-minus')} Record Sale`;

  const bodyHTML = `
    <div class="quick-action-product">
      <div class="quick-action-thumb">
        ${item.photo_blob
          ? `<img src="${item.photo_blob}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;">`
          : categoryIcon(item.category)}
      </div>
      <div>
        <div style="font-weight:700">${item.name}</div>
        <div class="text-muted text-sm">Current stock: <strong>${fmtNum(item.stock_quantity)} ${item.unit}</strong></div>
        ${!isIn && item.stock_quantity === 0 ? '<div class="badge badge-red" style="margin-top:4px">Out of Stock</div>' : ''}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Quantity (${item.unit}) <span class="required">*</span></label>
      <div class="qty-input-group">
        <button class="qty-btn" id="quick-qty-dec">−</button>
        <input type="number" class="qty-display" id="quick-qty-input" value="1" min="1" style="width:90px;text-align:center;border:1px solid var(--border);border-radius:var(--radius-md);padding:6px;">
        <button class="qty-btn" id="quick-qty-inc">+</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <input type="text" class="form-input" id="quick-notes" placeholder="${isIn ? 'Supplier name, delivery note...' : 'Customer, reason...'}">
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn ${btnClass}" id="quick-confirm-btn">${btnLabel}</button>
  `;

  openModal({ title, bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      const qtyInput = backdrop.querySelector('#quick-qty-input');
      backdrop.querySelector('#quick-qty-dec').addEventListener('click', () => {
        qtyInput.value = Math.max(1, parseInt(qtyInput.value || 1) - 1);
      });
      backdrop.querySelector('#quick-qty-inc').addEventListener('click', () => {
        qtyInput.value = (parseInt(qtyInput.value || 1) + 1);
      });

      backdrop.querySelector('#quick-confirm-btn').addEventListener('click', async () => {
        const qty   = parseFloat(qtyInput.value) || 1;
        const notes = backdrop.querySelector('#quick-notes').value || (isIn ? 'Manual stock-in' : 'Manual sale');

        if (!isIn && item.stock_quantity < qty) {
          toast.error('Insufficient Stock', `Only ${fmtNum(item.stock_quantity)} ${item.unit} available.`);
          return;
        }

        closeModal();
        await recordStockEvent({ itemId: item.id, changeType: type === 'IN' ? CHANGE_TYPE.IN : CHANGE_TYPE.SALE, qty, notes });

        const sign = isIn ? '+' : '−';
        toast[isIn ? 'success' : 'info'](
          isIn ? 'Stock Added' : 'Sale Recorded',
          `${sign}${fmtNum(qty)} ${item.unit} for ${item.name}`
        );

        await loadAndRenderGrid(pageContainer);
      });
    }
  });
}

// ── Add / Edit Product Modal ──────────────────────────────────
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
             <p class="text-xs">WebP/PNG/JPG · Max 300×300 · Auto-compressed</p>`
        }
        <input type="file" id="photo-input" accept="image/*" class="hidden" aria-label="Upload product photo">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Product Name <span class="required">*</span></label>
      <input class="form-input" id="prod-name" value="${item?.name || ''}" placeholder="e.g. 1L Milk (Full Cream)">
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="prod-category">
          ${CATEGORIES.filter(c => c !== 'All').map(c => `<option value="${c}" ${item?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Unit</label>
        <select class="form-select" id="prod-unit">
          ${UNITS.map(u => `<option value="${u}" ${item?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Barcode / SKU</label>
      <div class="input-group">
        ${icon('icon-barcode', 'input-prefix')}
        <input class="form-input" id="prod-barcode" value="${item?.barcode || ''}" placeholder="Scan or type barcode">
      </div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Cost Price</label>
        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input class="form-input" type="number" id="prod-cost" value="${item?.cost_price || ''}" placeholder="0" min="0" step="0.5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Selling Price <span class="required">*</span></label>
        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input class="form-input" type="number" id="prod-price" value="${item?.selling_price || ''}" placeholder="0" min="0" step="0.5">
        </div>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Initial / Current Stock</label>
        <input class="form-input" type="number" id="prod-stock" value="${item?.stock_quantity ?? ''}" placeholder="0" min="0" ${isEdit ? 'readonly style="background:var(--canvas);cursor:not-allowed"' : ''}>
        ${isEdit ? '<div class="form-hint">Use Stock In / Sale buttons to change stock levels.</div>' : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Min Stock Alert</label>
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
          <div class="text-muted text-xs">e.g. Zinger Burger made from raw ingredients</div>
        </div>
      </label>
    </div>
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-ghost-danger" id="prod-delete-btn">${icon('icon-trash')} Delete</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="prod-save-btn">${icon('icon-check')} ${isEdit ? 'Save Changes' : 'Add Product'}</button>
  `;

  openModal({ title: isEdit ? 'Edit Product' : 'Add New Product', bodyHTML, footerHTML, size: 'modal-lg',
    onOpen: (backdrop) => {
      // Photo upload
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

      // Save
      backdrop.querySelector('#prod-save-btn').addEventListener('click', async () => {
        const name  = backdrop.querySelector('#prod-name').value.trim();
        const price = parseFloat(backdrop.querySelector('#prod-price').value) || 0;

        if (!name) {
          backdrop.querySelector('#prod-name').classList.add('error');
          toast.error('Validation Error', 'Product name is required.');
          return;
        }

        const itemData = {
          name,
          barcode:         backdrop.querySelector('#prod-barcode').value.trim(),
          category:        backdrop.querySelector('#prod-category').value,
          unit:            backdrop.querySelector('#prod-unit').value,
          cost_price:      parseFloat(backdrop.querySelector('#prod-cost').value) || 0,
          selling_price:   price,
          min_stock_alert: parseFloat(backdrop.querySelector('#prod-min-alert').value) || 5,
          is_composite:    backdrop.querySelector('#prod-is-composite').checked,
          photo_blob:      previewPhotoBlob,
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
            await recordStockEvent({ itemId: id, changeType: CHANGE_TYPE.IN, qty: initialStock, notes: 'Initial stock' });
          }
          toast.success('Product Added', `${name} has been added to inventory.`);
        }

        closeModal();
        inventoryItems = await db.items.toArray();
        renderGrid(document.getElementById('page-content'));
        renderCategoryPills(document.getElementById('page-content'));
      });

      // Delete
      if (isEdit) {
        backdrop.querySelector('#prod-delete-btn').addEventListener('click', () => {
          closeModal();
          showConfirm(`Permanently delete "${item.name}"? All stock logs will also be removed.`, async () => {
            await db.items.delete(item.id);
            await db.logs.where('item_id').equals(item.id).delete();
            await db.recipes.where('composite_item_id').equals(item.id).delete();
            await db.recipes.where('ingredient_item_id').equals(item.id).delete();
            toast.success('Deleted', `${item.name} has been removed.`);
            inventoryItems = await db.items.toArray();
            renderGrid(document.getElementById('page-content'));
            renderCategoryPills(document.getElementById('page-content'));
          });
        });
      }
    }
  });
}

// ── CSV Import Modal ──────────────────────────────────────────
function showImportCSVModal() {
  const bodyHTML = `
    <p class="text-sm text-secondary">Upload a CSV file to bulk-create or update products. Download the template to see the required format.</p>
    <button class="btn btn-ghost btn-sm" id="csv-template-btn">${icon('icon-download')} Download Template</button>
    <div class="image-upload-zone" id="csv-drop-zone" style="margin-top:var(--space-3)">
      ${icon('icon-upload')}
      <p><strong>Click to choose CSV file</strong> or drag & drop</p>
      <p class="text-xs">Columns: barcode, name, category, unit, cost_price, selling_price, min_stock_alert, stock_quantity</p>
      <input type="file" id="csv-file-input" accept=".csv" class="hidden">
    </div>
    <div id="csv-import-result" class="hidden"></div>
  `;

  const footerHTML = `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`;

  openModal({ title: 'Bulk Import from CSV', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#csv-template-btn').addEventListener('click', downloadImportTemplate);

      const dropZone = backdrop.querySelector('#csv-drop-zone');
      const fileInput = backdrop.querySelector('#csv-file-input');

      dropZone.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await runImport(file, backdrop);
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
  resultDiv.innerHTML = `<div class="badge badge-gray animate-pulse">Importing...</div>`;
  resultDiv.classList.remove('hidden');
  try {
    const results = await importItemsFromCSV(file);
    resultDiv.innerHTML = `
      <div style="padding:var(--space-3);background:var(--stock-in-bg);border-radius:var(--radius-md);border:1px solid var(--stock-in)">
        <div class="font-semibold text-sm" style="color:#065F46">Import Complete</div>
        <div class="text-sm" style="color:#065F46">Created: ${results.created} · Updated: ${results.updated}</div>
        ${results.errors.length > 0 ? `<div class="text-sm" style="color:var(--danger);margin-top:4px">${results.errors.join('<br>')}</div>` : ''}
      </div>`;
    toast.success('Import Done', `${results.created} created, ${results.updated} updated.`);
    inventoryItems = await db.items.toArray();
    const pc = document.getElementById('page-content');
    renderGrid(pc);
    renderCategoryPills(pc);
  } catch (err) {
    resultDiv.innerHTML = `<div style="color:var(--danger);font-size:0.875rem">${err.message}</div>`;
    toast.error('Import Failed', err.message);
  }
}
