/**
 * utils.js — Formatting, Image Compression, CSV/XLSX Export, Helpers
 */

// ── Currency / Number Formatting ─────────────────────────────
let _currencySymbol = 'Rs.';

async function loadCurrencySymbol() {
  _currencySymbol = await getSetting('currency', 'Rs.');
}

function fmt(amount) {
  const n = Number(amount) || 0;
  return `${_currencySymbol} ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-PK');
}

function fmtDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function fmtTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function timeAgo(isoString) {
  const d = new Date(isoString);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7)     return `${days}d ago`;
  return fmtDate(isoString);
}

// ── SVG Helper ───────────────────────────────────────────────
function icon(id, cls = '') {
  return `<svg class="${cls}" aria-hidden="true"><use href="icons/sprite.svg#${id}"/></svg>`;
}

// ── Category Icon ────────────────────────────────────────────
function categoryIcon(category) {
  const id = CATEGORY_ICON[category] || 'icon-cat-default';
  return `<svg class="cat-icon" aria-hidden="true"><use href="icons/sprite.svg#${id}"/></svg>`;
}

// ── Image Compression ─────────────────────────────────────────
/**
 * Compress an image File to WebP, max 300×300, target < 20KB.
 * Returns base64 data URL string.
 */
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 300;
        let { width, height } = img;

        // Scale down to fit 300×300
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height / width) * MAX);
            width = MAX;
          } else {
            width = Math.round((width / height) * MAX);
            height = MAX;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP; fall back to JPEG if unsupported
        let quality = 0.75;
        let dataUrl = canvas.toDataURL('image/webp', quality);

        // If still > 20KB, reduce quality
        while (dataUrl.length > 20 * 1024 * 1.37 && quality > 0.2) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/webp', quality);
        }

        // Final fallback to JPEG
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── CSV Export ───────────────────────────────────────────────
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSVRow(arr) {
  return arr.map(escapeCSV).join(',');
}

function downloadCSV(rows, filename) {
  const csv = rows.map(toCSVRow).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportInventoryCSV(customItems = null, filenamePrefix = 'inventory-catalog') {
  const items = customItems || await db.items.toArray();
  const rows  = [
    ['ID', 'SKU / Barcode', 'Product Name', 'Category', 'Unit', 'Cost Price', 'Selling Price', 'Margin %', 'Stock Quantity', 'Min Stock Alert', 'Stock Status', 'Cost Valuation', 'Retail Valuation', 'Is Recipe', 'Created At'],
    ...items.map(it => {
      const margin = it.selling_price > 0 ? (((it.selling_price - it.cost_price) / it.selling_price) * 100).toFixed(1) : 0;
      const status = it.is_composite ? 'Recipe' : it.stock_quantity === 0 ? 'Out of Stock' : it.stock_quantity <= it.min_stock_alert ? 'Low Stock' : 'In Stock';
      const costVal = ((it.cost_price || 0) * (it.stock_quantity || 0)).toFixed(2);
      const retailVal = ((it.selling_price || 0) * (it.stock_quantity || 0)).toFixed(2);

      return [
        it.id,
        it.barcode || 'N/A',
        it.name,
        it.category,
        it.unit,
        it.cost_price,
        it.selling_price,
        `${margin}%`,
        it.stock_quantity,
        it.min_stock_alert,
        status,
        costVal,
        retailVal,
        it.is_composite ? 'Yes' : 'No',
        fmtDate(it.created_at)
      ];
    })
  ];
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(rows, `${filenamePrefix}-${date}.csv`);
}

async function exportLowStockCSV() {
  const items = await db.items.toArray();
  const low   = items.filter(it => it.stock_quantity <= it.min_stock_alert);
  const rows  = [
    ['ID', 'Name', 'Category', 'Unit', 'Current Stock', 'Min Alert Level', 'Selling Price'],
    ...low.map(it => [
      it.id, it.name, it.category, it.unit,
      it.stock_quantity, it.min_stock_alert, it.selling_price
    ])
  ];
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(rows, `low-stock-report-${date}.csv`);
}

async function exportSalesCSV(fromDate, toDate) {
  const allSales = await db.sales.toArray();
  const sales    = allSales.filter(s => {
    const d = new Date(s.timestamp);
    return (!fromDate || d >= new Date(fromDate)) && (!toDate || d <= new Date(toDate + 'T23:59:59'));
  });

  const allSaleItems = await db.sale_items.toArray();
  const allItems = await db.items.toArray();
  const itemMap = {};
  allItems.forEach(i => { itemMap[i.id] = i.name; });

  const rows = [
    ['Receipt No', 'Date', 'Time', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Method', 'Items'],
    ...sales.map(s => {
      const items = allSaleItems.filter(si => si.sale_id === s.id);
      const itemStr = items.map(i => `${i.quantity}x ${itemMap[i.item_id] || 'Unknown Item'}`).join('; ');
      return [
        s.invoice_no,
        fmtDate(s.timestamp),
        fmtTime(s.timestamp),
        s.subtotal, s.discount, s.tax, s.total,
        s.payment_method,
        itemStr
      ];
    })
  ];
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(rows, `sales-history-${date}.csv`);
}

async function exportLogsCSV() {
  const logs  = await db.logs.orderBy('timestamp').reverse().toArray();
  const items = await db.items.toArray();
  const itemMap = {};
  items.forEach(it => { itemMap[it.id] = it.name; });

  const rows = [
    ['Date', 'Time', 'Item', 'Change Type', 'Quantity', 'Notes', 'Sync Status'],
    ...logs.map(l => [
      fmtDate(l.timestamp),
      fmtTime(l.timestamp),
      itemMap[l.item_id] || l.item_id,
      l.change_type, l.qty_changed, l.notes, l.sync_status
    ])
  ];
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(rows, `inventory-logs-${date}.csv`);
}

// ── CSV Bulk Import ───────────────────────────────────────────
/**
 * Parse a CSV file and bulk-create/update items.
 * Expected columns: barcode, name, category, unit, cost_price, selling_price, min_stock_alert, stock_quantity
 */
async function importItemsFromCSV(file) {
  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const results = { created: 0, updated: 0, errors: [] };

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCSVLine(lines[i]);
      const row  = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

      if (!row.name) { results.errors.push(`Row ${i + 1}: missing name`); continue; }

      const existing = row.barcode
        ? await db.items.where('barcode').equals(row.barcode).first()
        : await db.items.where('name').equalsIgnoreCase(row.name).first();

      const itemData = {
        barcode:         row.barcode    || '',
        name:            row.name,
        category:        row.category   || 'Other',
        unit:            row.unit       || 'pcs',
        cost_price:      parseFloat(row.cost_price)      || 0,
        selling_price:   parseFloat(row.selling_price)   || 0,
        min_stock_alert: parseFloat(row.min_stock_alert) || 5,
        initial_stock:   parseFloat(row.stock_quantity)  || 0,
        stock_quantity:  parseFloat(row.stock_quantity)  || 0,
        is_composite:    false,
        created_at:      new Date().toISOString()
      };

      if (existing) {
        await db.items.update(existing.id, itemData);
        // Record adjustment if stock changed
        if (itemData.stock_quantity !== existing.stock_quantity) {
          const diff = itemData.stock_quantity - existing.stock_quantity;
          await recordStockEvent({ itemId: existing.id, changeType: CHANGE_TYPE.ADJUSTMENT, qty: diff, notes: 'CSV Import' });
        }
        results.updated++;
      } else {
        const id = await db.items.add(itemData);
        if (itemData.stock_quantity > 0) {
          await recordStockEvent({ itemId: id, changeType: CHANGE_TYPE.IN, qty: itemData.stock_quantity, notes: 'CSV Import' });
        }
        results.created++;
      }
    } catch (err) {
      results.errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  return results;
}

function parseCSVLine(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Debounce ─────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Generate CSV template ─────────────────────────────────────
function downloadImportTemplate() {
  const rows = [
    ['barcode', 'name', 'category', 'unit', 'cost_price', 'selling_price', 'min_stock_alert', 'stock_quantity'],
    ['8901234567890', 'Example Product', 'Grocery', 'pcs', '50', '80', '10', '100'],
  ];
  downloadCSV(rows, 'inventory-import-template.csv');
}

// ── Confirm dialog ────────────────────────────────────────────
function showConfirm(message, onConfirm) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal quick-action-modal animate-scale-in">
      <div class="modal-header">
        <span class="modal-title">Confirm Action</span>
        <button class="modal-close" id="confirm-close">${icon('icon-close')}</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.9375rem; color:var(--text-secondary);">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => document.body.removeChild(backdrop);
  backdrop.querySelector('#confirm-close').addEventListener('click', close);
  backdrop.querySelector('#confirm-cancel').addEventListener('click', close);
  backdrop.querySelector('#confirm-ok').addEventListener('click', () => {
    close();
    onConfirm();
  });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
}

// ── Print helpers ─────────────────────────────────────────────
function printElement(htmlContent, className) {
  document.body.classList.add(className);
  const printDiv = document.createElement('div');
  printDiv.innerHTML = htmlContent;
  printDiv.className = 'print-receipt';
  document.body.appendChild(printDiv);
  window.print();
  document.body.removeChild(printDiv);
  document.body.classList.remove(className);
}

// ── Automated SKU Generator ───────────────────────────────────
function generateSKU(category = 'General', name = 'Item') {
  const catClean = (category || 'GEN')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');

  const nameClean = (name || 'ITM')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(3, 'X');

  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${catClean}-${nameClean}-${rand}`;
}

// ── Web Audio API Barcode Beep Synthesizer ────────────────────
let _audioCtx = null;
function getAudioContext() {
  if (!_audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      _audioCtx = new AudioCtx();
    }
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

// ── Screen-Edge Scan Flash Visual Feedback ────────────────────
/**
 * Flashes a coloured screen-edge overlay for ~150 ms to give
 * instant visual confirmation of barcode scans / transactions.
 * @param {'success'|'error'} type
 */
function triggerScanFlash(type = 'success') {
  let overlay = document.getElementById('scan-flash-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'scan-flash-overlay';
    document.body.appendChild(overlay);
  }

  // Remove error class to reset to default emerald style
  overlay.classList.remove('error', 'active');

  if (type === 'error') overlay.classList.add('error');

  // Force reflow so transition fires every time
  void overlay.offsetWidth;
  overlay.classList.add('active');

  clearTimeout(overlay._flashTimer);
  overlay._flashTimer = setTimeout(() => {
    overlay.classList.remove('active');
  }, 150);
}

function playBeepSound(type = 'success') {
  try {

    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now); // High clean POS beep
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      triggerScanFlash('success');
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
      triggerScanFlash('error');
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    // Graceful fallback if audio context blocked before gesture
  }
}

// ── Brand Identity & Customization Engine ─────────────────────

/**
 * Compresses an uploaded image file on the client side using HTML5 Canvas
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @param {number} quality
 * @returns {Promise<string>} base64 data URL
 */
function compressImageFile(file, maxWidth = 320, maxHeight = 320, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not a valid image.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Retrieves current store name and logo
 */
async function getStoreBranding() {
  const [name, logo] = await Promise.all([
    getSetting('store_name', 'Zeploy POS'),
    getSetting('store_logo', '')
  ]);
  return { name, logo };
}

/**
 * Saves store branding and synchronizes UI across the application
 */
async function setStoreBranding(name, logo = null) {
  const cleanName = (name || '').trim() || 'Zeploy POS';
  await setSetting('store_name', cleanName);
  if (logo !== null) {
    await setSetting('store_logo', logo || '');
  }
  await applyStoreBranding(cleanName, logo);
}

/**
 * Globally updates all visible header elements, receipt previews, and dispatches sync event
 */
async function applyStoreBranding(storeName = null, storeLogo = null) {
  if (storeName === null || storeLogo === null) {
    const branding = await getStoreBranding();
    if (storeName === null) storeName = branding.name;
    if (storeLogo === null) storeLogo = branding.logo;
  }

  // 1. Update Sidebar Store Name
  const sidebarNameEl = document.getElementById('sidebar-store-name');
  if (sidebarNameEl) sidebarNameEl.textContent = storeName;

  // 2. Update Sidebar Logo Mark
  const sidebarLogoContainer = document.getElementById('sidebar-logo-container');
  const defaultSidebarIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  `;
  if (sidebarLogoContainer) {
    if (storeLogo) {
      sidebarLogoContainer.innerHTML = `<img src="${storeLogo}" alt="${storeName}" class="sidebar-logo-img" />`;
    } else {
      sidebarLogoContainer.innerHTML = defaultSidebarIcon;
    }
  }

  // 3. Update Topbar Store Pill & Name
  const topbarNameEl = document.getElementById('topbar-store-name');
  if (topbarNameEl) topbarNameEl.textContent = storeName;

  const topbarLogoWrap = document.getElementById('topbar-store-logo-wrap');
  if (topbarLogoWrap) {
    if (storeLogo) {
      topbarLogoWrap.innerHTML = `<img src="${storeLogo}" alt="${storeName}" class="topbar-logo-img" />`;
    } else {
      topbarLogoWrap.innerHTML = `
        <span class="topbar-logo-fallback">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
        </span>
      `;
    }
  }

  // 4. Update Setup Wizard if visible
  const wizStoreInp = document.getElementById('wiz-store-name');
  if (wizStoreInp && !wizStoreInp.value) wizStoreInp.value = storeName;

  const wizBrandLogoWrap = document.getElementById('wiz-brand-logo-preview');
  if (wizBrandLogoWrap) {
    if (storeLogo) {
      wizBrandLogoWrap.innerHTML = `<img src="${storeLogo}" style="max-height:48px;max-width:140px;object-fit:contain" alt="Brand Logo" />`;
    } else {
      wizBrandLogoWrap.innerHTML = `<span class="text-xs text-muted">No custom logo set</span>`;
    }
  }

  // 5. Broadcast custom event for active views (Dashboard, POS, etc.)
  window.dispatchEvent(new CustomEvent('store-branding-updated', {
    detail: { name: storeName, logo: storeLogo }
  }));
}

/**
 * Modal dialog for quick Brand Name and Logo customization from topbar or settings
 */
async function openQuickBrandModal() {
  const { name, logo } = await getStoreBranding();
  let currentLogoData = logo || '';

  const bodyHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div class="form-group">
        <label class="form-label" for="qb-store-name">Store / Brand Name <span class="required">*</span></label>
        <input type="text" class="form-input" id="qb-store-name" value="${name}" placeholder="e.g. Metro Supermarket" required>
      </div>

      <div class="form-group">
        <label class="form-label">Brand Logo (PNG, SVG, JPG, WebP)</label>
        <div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
          <!-- Logo Preview Box -->
          <div id="qb-logo-preview-box" class="brand-logo-preview-box">
            ${currentLogoData 
              ? `<img src="${currentLogoData}" id="qb-preview-img" alt="Logo" class="brand-logo-preview-img" />`
              : `<div class="text-xs text-muted" style="text-align:center;padding:12px">Default Mark Active</div>`
            }
          </div>

          <!-- Actions -->
          <div style="display:flex;flex-direction:column;gap:var(--space-2);flex:1;min-width:200px">
            <label class="btn btn-ghost btn-sm" style="cursor:pointer;justify-content:center">
              ${icon('icon-plus')} Upload New Logo
              <input type="file" id="qb-logo-input" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none">
            </label>
            <button type="button" class="btn btn-ghost-danger btn-sm" id="qb-reset-logo-btn" ${!currentLogoData ? 'style="display:none"' : ''}>
              ${icon('icon-trash')} Reset to Default Mark
            </button>
            <div class="text-xs text-secondary">Optimal size: 300x300px. Images are automatically compressed offline.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="qb-save-btn">${icon('icon-check')} Save Brand Identity</button>
  `;

  openModal({
    title: 'Brand Identity & Customization',
    bodyHTML,
    footerHTML,
    onOpen: (backdrop) => {
      const nameInput = backdrop.querySelector('#qb-store-name');
      const fileInput = backdrop.querySelector('#qb-logo-input');
      const resetBtn  = backdrop.querySelector('#qb-reset-logo-btn');
      const previewBox= backdrop.querySelector('#qb-logo-preview-box');
      const saveBtn   = backdrop.querySelector('#qb-save-btn');

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          const compressed = await compressImageFile(file, 360, 360, 0.88);
          currentLogoData = compressed;
          previewBox.innerHTML = `<img src="${compressed}" id="qb-preview-img" alt="Logo" class="brand-logo-preview-img" />`;
          resetBtn.style.display = 'inline-flex';
          toast.success('Logo Uploaded', 'Preview updated. Click Save to apply.');
        } catch (err) {
          toast.error('Upload Error', err.message);
        }
      });

      resetBtn.addEventListener('click', () => {
        currentLogoData = '';
        fileInput.value = '';
        previewBox.innerHTML = `<div class="text-xs text-muted" style="text-align:center;padding:12px">Default Mark Active</div>`;
        resetBtn.style.display = 'none';
      });

      saveBtn.addEventListener('click', async () => {
        const newName = nameInput.value.trim();
        if (!newName) {
          toast.error('Validation Error', 'Brand / Store name cannot be empty.');
          return;
        }

        saveBtn.disabled = true;
        try {
          await setStoreBranding(newName, currentLogoData);
          closeModal();
          toast.success('Branding Updated', 'Custom identity synchronized across header, receipts, and reports.');
        } catch (err) {
          toast.error('Save Failed', err.message);
          saveBtn.disabled = false;
        }
      });
    }
  });
}

