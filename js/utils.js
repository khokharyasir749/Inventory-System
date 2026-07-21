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

async function exportInventoryCSV() {
  const items = await db.items.toArray();
  const rows  = [
    ['ID', 'Barcode', 'Name', 'Category', 'Unit', 'Cost Price', 'Selling Price', 'Stock Qty', 'Min Stock Alert', 'Is Composite', 'Created At'],
    ...items.map(it => [
      it.id, it.barcode, it.name, it.category, it.unit,
      it.cost_price, it.selling_price, it.stock_quantity,
      it.min_stock_alert, it.is_composite ? 'Yes' : 'No',
      fmtDate(it.created_at)
    ])
  ];
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(rows, `inventory-snapshot-${date}.csv`);
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
