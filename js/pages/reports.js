/**
 * reports.js — Enterprise Reports, GST Tax Audit & Disaster Recovery Engine
 * Features:
 * 1. Date range selector (Today, Yesterday, Last 7 Days, This Month, Last Month, Custom Range)
 * 2. Sales Tax / GST Audit Report (Taxable vs Zero-rated turnover, GST collected, audit table)
 * 3. Comprehensive CSV/Excel Data Exports (Sales Ledger, Itemized Lines, Inventory Valuation)
 * 4. Full Database Backup (One-click JSON export containing all 18 Dexie tables)
 * 5. Pre-Restore Validation & Confirmation Preview Modal
 * 6. Storage Quota Estimation & Orphaned Record Cleaner
 */

let reportsActiveTab  = 'gst_audit'; // 'gst_audit' | 'exports' | 'import' | 'backup'
let reportRange       = 'month';     // 'today' | 'yesterday' | '7d' | 'month' | 'last_month' | 'custom'
let reportFromDate    = '';
let reportToDate      = '';

async function renderReports(container) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  if (!reportFromDate) reportFromDate = monthStart;
  if (!reportToDate)   reportToDate   = today;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Reports & Data Engine</h1>
        <p>Sales Tax / GST audit, financial exports, and offline disaster recovery</p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tab-nav">
      <button class="tab-btn ${reportsActiveTab === 'gst_audit' ? 'active' : ''}" data-tab="gst_audit">
        ${icon('icon-reports')} Sales Tax & GST Audit
      </button>
      <button class="tab-btn ${reportsActiveTab === 'exports' ? 'active' : ''}" data-tab="exports">
        ${icon('icon-download')} Data Exports
      </button>
      <button class="tab-btn ${reportsActiveTab === 'import' ? 'active' : ''}" data-tab="import">
        ${icon('icon-upload')} Bulk CSV Import
      </button>
      <button class="tab-btn ${reportsActiveTab === 'backup' ? 'active' : ''}" data-tab="backup">
        ${icon('icon-backup')} Backup & Disaster Recovery
      </button>
    </div>

    <div id="reports-tab-content" class="animate-fade-in"></div>
  `;

  // Tab switching
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      reportsActiveTab = btn.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderActiveReportTab(container);
    });
  });

  await renderActiveReportTab(container);
}

async function renderActiveReportTab(container) {
  const contentEl = container.querySelector('#reports-tab-content');
  if (!contentEl) return;

  if (reportsActiveTab === 'gst_audit') {
    await renderGSTTaxAuditTab(contentEl);
  } else if (reportsActiveTab === 'exports') {
    await renderExportsTab(contentEl);
  } else if (reportsActiveTab === 'import') {
    renderImportTab(contentEl);
  } else if (reportsActiveTab === 'backup') {
    await renderBackupTab(contentEl);
  }
}

// ── Date Range Helper ─────────────────────────────────────────
function getDateBounds(rangeKey) {
  const now = new Date();
  let start = new Date();
  let end   = new Date();

  if (rangeKey === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (rangeKey === 'yesterday') {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(now.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (rangeKey === '7d') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (rangeKey === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (rangeKey === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (rangeKey === 'custom') {
    start = new Date(reportFromDate || now);
    start.setHours(0, 0, 0, 0);
    end   = new Date(reportToDate || now);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

// ── TAB 1: Sales Tax & GST Audit Report ───────────────────────
async function renderGSTTaxAuditTab(contentEl) {
  const { start, end } = getDateBounds(reportRange);

  const [sales, taxLabel, ntnTaxId, storeName] = await Promise.all([
    db.sales.toArray(),
    getSetting('tax_label', 'GST'),
    getSetting('ntn_tax_id', 'NTN-9842104-7'),
    getSetting('store_name', 'Store')
  ]);

  // Filter sales within active period
  const filteredSales = sales.filter(s => {
    const t = new Date(s.timestamp);
    return t >= start && t <= end;
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Compute GST Audit Metrics
  let grossTurnover = 0;
  let taxableTurnover = 0;
  let zeroRatedTurnover = 0;
  let totalTaxCollected = 0;

  filteredSales.forEach(s => {
    grossTurnover += (s.total || 0);
    totalTaxCollected += (s.tax || 0);
    if ((s.tax || 0) > 0) {
      taxableTurnover += (s.subtotal - (s.discount || 0));
    } else {
      zeroRatedTurnover += (s.subtotal - (s.discount || 0));
    }
  });

  const effectiveTaxRate = taxableTurnover > 0
    ? ((totalTaxCollected / taxableTurnover) * 100).toFixed(2)
    : '0.00';

  contentEl.innerHTML = `
    <!-- Filter Bar with Date Range Presets -->
    <div class="filter-bar" style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center;margin-bottom:var(--space-4);background:var(--surface);padding:var(--space-3);border-radius:var(--radius-lg);border:1px solid var(--border);">
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn btn-pill btn-ghost ${reportRange === 'today' ? 'active' : ''}" data-range="today">Today</button>
        <button class="btn btn-pill btn-ghost ${reportRange === 'yesterday' ? 'active' : ''}" data-range="yesterday">Yesterday</button>
        <button class="btn btn-pill btn-ghost ${reportRange === '7d' ? 'active' : ''}" data-range="7d">Last 7 Days</button>
        <button class="btn btn-pill btn-ghost ${reportRange === 'month' ? 'active' : ''}" data-range="month">This Month</button>
        <button class="btn btn-pill btn-ghost ${reportRange === 'last_month' ? 'active' : ''}" data-range="last_month">Last Month</button>
        <button class="btn btn-pill btn-ghost ${reportRange === 'custom' ? 'active' : ''}" data-range="custom">Custom Range</button>
      </div>

      <div id="report-custom-inputs" style="display:${reportRange === 'custom' ? 'flex' : 'none'};gap:6px;align-items:center;margin-left:auto;">
        <input type="date" class="form-input" id="report-from-input" value="${reportFromDate}" style="padding:5px 8px;font-size:0.8125rem;">
        <span class="text-xs text-muted">to</span>
        <input type="date" class="form-input" id="report-to-input" value="${reportToDate}" style="padding:5px 8px;font-size:0.8125rem;">
      </div>

      <button class="btn btn-ghost btn-sm" id="btn-export-gst-csv" style="margin-left:${reportRange === 'custom' ? '0' : 'auto'};">
        ${icon('icon-download')} Export Audit CSV
      </button>
    </div>

    <!-- GST Tax Audit Summary Cards -->
    <div class="kpi-grid" style="margin-bottom:var(--space-4)">
      <div class="kpi-card" style="border-left:4px solid var(--primary)">
        <div class="kpi-card-body">
          <div class="kpi-value text-primary mono">${fmt(grossTurnover)}</div>
          <div class="kpi-label">Gross Revenue Turnover</div>
          <div class="kpi-subtext">${filteredSales.length} Total Settled Transactions</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left:4px solid var(--emerald, #10b981)">
        <div class="kpi-card-body">
          <div class="kpi-value text-green mono">${fmt(totalTaxCollected)}</div>
          <div class="kpi-label">Total ${taxLabel} Collected</div>
          <div class="kpi-subtext">Effective Tax: <strong>${effectiveTaxRate}%</strong></div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-teal mono">${fmt(taxableTurnover)}</div>
          <div class="kpi-label">Taxable Net Turnover</div>
          <div class="kpi-subtext">Sales subject to statutory GST</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-secondary mono">${fmt(zeroRatedTurnover)}</div>
          <div class="kpi-label">Zero-Rated / Exempt</div>
          <div class="kpi-subtext">Exempt & Zero-rated turnover</div>
        </div>
      </div>
    </div>

    <!-- Tax Authority Header Card -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2)">
      <div>
        <div class="font-bold text-sm text-primary">${storeName} · Sales Tax Audit Ledger</div>
        <div class="text-xs text-muted">Auditing Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</div>
      </div>
      <div>
        <span class="badge badge-gray mono font-bold text-xs">NTN: ${ntnTaxId}</span>
      </div>
    </div>

    <!-- GST Detailed Transaction Table -->
    <div class="section-card">
      <div class="section-card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <span class="section-card-title">${icon('icon-reports')} Itemized GST Transaction Audit Records</span>
        <span class="text-xs text-muted">Showing ${filteredSales.length} records</span>
      </div>
      <div class="table-scroll" style="max-height:420px;">
        ${filteredSales.length === 0
          ? `<div class="empty-state" style="padding:var(--space-8);">
               <div style="font-size:2rem;margin-bottom:var(--space-2)">🧾</div>
               <p class="font-bold">No Transactions Found</p>
               <p class="text-xs text-muted">There are no completed sales recorded in this date range.</p>
             </div>`
          : `<table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date & Time</th>
                  <th>Method</th>
                  <th style="text-align:right;">Subtotal</th>
                  <th style="text-align:right;">Discount</th>
                  <th style="text-align:right;">Taxable Amt</th>
                  <th style="text-align:right;">${taxLabel}</th>
                  <th style="text-align:right;">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                ${filteredSales.map(s => {
                  const sub = s.subtotal || 0;
                  const disc = s.discount || 0;
                  const taxable = Math.max(0, sub - disc);
                  return `
                    <tr>
                      <td class="mono font-bold text-xs text-primary">${s.invoice_no}</td>
                      <td class="text-xs text-secondary">${fmtDateTime(s.timestamp)}</td>
                      <td><span class="badge badge-gray text-xs">${s.payment_method || 'Cash'}</span></td>
                      <td class="mono text-xs" style="text-align:right;">${fmt(sub)}</td>
                      <td class="mono text-xs text-muted" style="text-align:right;">${disc > 0 ? `-${fmt(disc)}` : '—'}</td>
                      <td class="mono text-xs" style="text-align:right;">${fmt(taxable)}</td>
                      <td class="mono text-xs font-bold text-green" style="text-align:right;">${fmt(s.tax || 0)}</td>
                      <td class="mono text-xs font-bold text-primary" style="text-align:right;">${fmt(s.total || 0)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  // Range pill clicks
  contentEl.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', async () => {
      reportRange = btn.dataset.range;
      await renderGSTTaxAuditTab(contentEl);
    });
  });

  // Custom date inputs
  contentEl.querySelector('#report-from-input')?.addEventListener('change', async (e) => {
    reportFromDate = e.target.value;
    await renderGSTTaxAuditTab(contentEl);
  });
  contentEl.querySelector('#report-to-input')?.addEventListener('change', async (e) => {
    reportToDate = e.target.value;
    await renderGSTTaxAuditTab(contentEl);
  });

  // Export GST Audit CSV
  contentEl.querySelector('#btn-export-gst-csv')?.addEventListener('click', () => {
    exportGSTAuditCSV(filteredSales, taxLabel, ntnTaxId);
  });
}

function exportGSTAuditCSV(sales, taxLabel, ntnTaxId) {
  const headers = ['Invoice No', 'Timestamp', 'Payment Method', 'Subtotal', 'Discount', 'Taxable Amount', `${taxLabel} Collected`, 'Total'];
  const rows = sales.map(s => {
    const sub = s.subtotal || 0;
    const disc = s.discount || 0;
    const taxable = Math.max(0, sub - disc);
    return [
      `"${s.invoice_no}"`,
      `"${s.timestamp}"`,
      `"${s.payment_method || 'Cash'}"`,
      sub,
      disc,
      taxable,
      s.tax || 0,
      s.total || 0
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadCSVFile(csvContent, `GST-Audit-Report-NTN-${ntnTaxId}`);
  toast.success('GST Audit Exported', `Downloaded ${sales.length} audit records.`);
}

// ── TAB 2: Data Exports ───────────────────────────────────────
async function renderExportsTab(contentEl) {
  const [sales, items, saleItems, logs] = await Promise.all([
    db.sales.toArray(),
    db.items.toArray(),
    db.sale_items.toArray(),
    db.logs.toArray()
  ]);

  contentEl.innerHTML = `
    <div class="grid-2">
      <!-- Sales Ledger Exports -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-reports')} Sales & Transaction Ledgers</span>
        </div>
        <p class="text-sm text-secondary" style="margin-bottom:var(--space-3)">
          Download comprehensive sales ledgers for accounting reconciliation and tax compliance.
        </p>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          <button class="btn btn-ghost" id="export-full-sales-csv" style="justify-content:flex-start">
            ${icon('icon-download')} Export Complete Sales Ledger CSV (${sales.length} transactions)
          </button>
          <button class="btn btn-ghost" id="export-itemized-sales-csv" style="justify-content:flex-start">
            ${icon('icon-download')} Export Itemized Line-Item Sales CSV (${saleItems.length} lines)
          </button>
        </div>
      </div>

      <!-- Inventory Valuation Exports -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-inventory')} Inventory & Valuation Ledgers</span>
        </div>
        <p class="text-sm text-secondary" style="margin-bottom:var(--space-3)">
          Generate inventory asset valuations, audit logs, and print sheets.
        </p>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          <button class="btn btn-ghost" id="export-full-inv-csv" style="justify-content:flex-start">
            ${icon('icon-download')} Export Full Inventory Valuation CSV (${items.length} items)
          </button>
          <button class="btn btn-ghost" id="export-stock-logs-csv" style="justify-content:flex-start">
            ${icon('icon-logs')} Export Stock Movement Audit Logs CSV (${logs.length} events)
          </button>
          <button class="btn btn-ghost" id="print-inv-sheet-a4" style="justify-content:flex-start">
            ${icon('icon-print')} Print Inventory Sheet (A4 Format)
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind export buttons
  contentEl.querySelector('#export-full-sales-csv').addEventListener('click', () => {
    exportSalesLedgerCSV(sales);
  });

  contentEl.querySelector('#export-itemized-sales-csv').addEventListener('click', () => {
    exportItemizedSalesCSV(saleItems, items, sales);
  });

  contentEl.querySelector('#export-full-inv-csv').addEventListener('click', async () => {
    await exportInventoryCSV(items, 'inventory-valuation');
  });

  contentEl.querySelector('#export-stock-logs-csv').addEventListener('click', () => {
    exportStockLogsCSV(logs, items);
  });

  contentEl.querySelector('#print-inv-sheet-a4').addEventListener('click', () => {
    printA4InventorySheet(items);
  });
}

function exportSalesLedgerCSV(sales) {
  const headers = ['Invoice No', 'Date', 'Time', 'Payment Method', 'Subtotal', 'Discount', 'Tax', 'Grand Total', 'Cash Received', 'Change Returned'];
  const rows = sales.map(s => {
    const d = new Date(s.timestamp);
    return [
      `"${s.invoice_no}"`,
      `"${d.toISOString().split('T')[0]}"`,
      `"${d.toTimeString().split(' ')[0]}"`,
      `"${s.payment_method || 'Cash'}"`,
      s.subtotal || 0,
      s.discount || 0,
      s.tax || 0,
      s.total || 0,
      s.cash_received || 0,
      s.change_returned || 0
    ].join(',');
  });
  downloadCSVFile([headers.join(','), ...rows].join('\n'), 'Sales-Ledger-Reconciliation');
  toast.success('Sales Ledger Exported', `Saved ${sales.length} transactions.`);
}

function exportItemizedSalesCSV(saleItems, items, sales) {
  const itemMap = {};
  items.forEach(it => { itemMap[it.id] = it; });
  const saleMap = {};
  sales.forEach(s => { saleMap[s.id] = s; });

  const headers = ['Invoice No', 'Timestamp', 'Product Name', 'SKU/Barcode', 'Category', 'Quantity', 'Unit Price', 'Item Discount', 'Line Total', 'Unit Cost', 'COGS Total', 'Profit'];
  const rows = saleItems.map(si => {
    const it = itemMap[si.item_id] || { name: 'Unknown', barcode: 'N/A', category: 'General' };
    const sale = saleMap[si.sale_id] || { invoice_no: 'N/A', timestamp: '' };
    const cost = si.cost_price || 0;
    const cogsTotal = cost * si.quantity;
    const profit = (si.line_total || (si.unit_price * si.quantity)) - cogsTotal;

    return [
      `"${sale.invoice_no}"`,
      `"${sale.timestamp}"`,
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.barcode || ''}"`,
      `"${it.category || ''}"`,
      si.quantity,
      si.unit_price,
      si.discount || 0,
      si.line_total || (si.unit_price * si.quantity),
      cost,
      cogsTotal,
      profit
    ].join(',');
  });

  downloadCSVFile([headers.join(','), ...rows].join('\n'), 'Itemized-Sales-Analysis');
  toast.success('Itemized Sales Exported', `Saved ${saleItems.length} lines.`);
}

function exportStockLogsCSV(logs, items) {
  const itemMap = {};
  items.forEach(it => { itemMap[it.id] = it.name; });

  const headers = ['Log ID', 'Timestamp', 'Item Name', 'Movement Type', 'Quantity Changed', 'Reason / Audit Notes', 'Sale ID'];
  const rows = logs.map(l => [
    l.id,
    `"${l.timestamp}"`,
    `"${(itemMap[l.item_id] || 'Unknown').replace(/"/g, '""')}"`,
    `"${l.change_type}"`,
    l.qty_changed,
    `"${(l.notes || '').replace(/"/g, '""')}"`,
    l.sale_id || ''
  ].join(','));

  downloadCSVFile([headers.join(','), ...rows].join('\n'), 'Stock-Movement-Audit-Logs');
  toast.success('Logs Exported', `Saved ${logs.length} stock log entries.`);
}

function downloadCSVFile(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── TAB 3: Bulk CSV Import ────────────────────────────────────
function renderImportTab(contentEl) {
  contentEl.innerHTML = `
    <div class="grid-2">
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-upload')} Import Products from CSV</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <p class="text-sm text-secondary">
            Upload a CSV file containing your product catalog. Existing products matching barcodes will be updated; new products will be inserted automatically.
          </p>
          <button class="btn btn-ghost btn-sm" id="download-template-btn" style="align-self:flex-start">
            ${icon('icon-download')} Download Sample CSV Template
          </button>
          <div class="image-upload-zone" id="import-drop-zone" style="cursor:pointer;padding:var(--space-8);text-align:center">
            ${icon('icon-upload')}
            <p><strong>Click to browse</strong> or drag & drop CSV file here</p>
            <p class="text-xs text-muted">UTF-8 encoded CSV</p>
            <input type="file" id="import-file-input" accept=".csv" class="hidden">
          </div>
          <div id="import-result" class="hidden"></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">CSV Header Reference</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Column</th><th>Required</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td class="mono text-xs font-bold">name</td><td><strong>Yes</strong></td><td>Product title</td></tr>
              <tr><td class="mono text-xs">barcode</td><td>No</td><td>Unique SKU/Barcode</td></tr>
              <tr><td class="mono text-xs">category</td><td>No</td><td>e.g. Groceries, Dairy</td></tr>
              <tr><td class="mono text-xs">unit</td><td>No</td><td>pcs, kg, pack</td></tr>
              <tr><td class="mono text-xs">cost_price</td><td>No</td><td>Purchase cost</td></tr>
              <tr><td class="mono text-xs">selling_price</td><td><strong>Yes</strong></td><td>Retail price</td></tr>
              <tr><td class="mono text-xs">stock_quantity</td><td>No</td><td>Starting stock</td></tr>
              <tr><td class="mono text-xs">min_stock_alert</td><td>No</td><td>Low stock alert threshold</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  contentEl.querySelector('#download-template-btn').addEventListener('click', downloadImportTemplate);

  const dropZone  = contentEl.querySelector('#import-drop-zone');
  const fileInput = contentEl.querySelector('#import-file-input');
  const resultDiv = contentEl.querySelector('#import-result');

  const doImport = async (file) => {
    resultDiv.innerHTML = `<div class="badge badge-gray animate-pulse">Processing ${file.name}...</div>`;
    resultDiv.classList.remove('hidden');
    try {
      const results = await importItemsFromCSV(file);
      resultDiv.innerHTML = `
        <div style="padding:var(--space-3);background:rgba(16, 185, 129, 0.1);border:1px solid var(--emerald);border-radius:var(--radius-md);">
          <div class="font-bold text-sm text-green">Import Succeeded</div>
          <div class="text-xs text-secondary" style="margin-top:2px;">Created: ${results.created} · Updated: ${results.updated}</div>
        </div>
      `;
      toast.success('Import Finished', `Added ${results.created}, updated ${results.updated} items.`);
    } catch (err) {
      resultDiv.innerHTML = `<div class="badge badge-red">Error: ${err.message}</div>`;
      toast.error('Import Error', err.message);
    }
  };

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) doImport(e.target.files[0]); });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.style.borderColor = '';
    if (e.dataTransfer.files[0]) doImport(e.dataTransfer.files[0]);
  });
}

// ── TAB 4: Backup & Disaster Recovery ─────────────────────────
async function renderBackupTab(contentEl) {
  const estimate = await getStorageUsageEstimate();

  contentEl.innerHTML = `
    <!-- Storage & Diagnostics Health Banner -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3)">
      <div style="flex:1;min-width:240px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="health-pulse-dot"></span>
          <span class="font-bold text-sm text-primary">IndexedDB Storage Health & Quota</span>
          <span class="badge badge-green text-xs" style="font-size:0.65rem;">ONLINE RESILIENT</span>
        </div>
        <div class="quota-track">
          <div class="quota-fill" style="width:${Math.max(3, estimate.pct)}%;"></div>
        </div>
        <div class="text-xs text-muted">
          Used: <strong>${estimate.usedMB} MB</strong> · Total Allocated Quota: <strong>${estimate.quotaMB} MB</strong> (${estimate.pct}% used)
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-run-cleaner">
        ${icon('icon-refresh')} Clean Orphaned Logs
      </button>
    </div>

    <div class="grid-2">
      <!-- Full Database Backup -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-backup')} Full Database Backup</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <p class="text-sm text-secondary">
            Export an encrypted/raw JSON archive containing all database tables (catalog items, sales history, stock movement ledger, recipes, customers, and store settings).
          </p>
          <div style="background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-3)">
            <div class="text-xs font-bold text-primary">✓ Comprehensive Archive:</div>
            <div class="text-xs text-muted" style="margin-top:2px">
              Items · Stock Ledger · Recipes · Sales · Sale Items · Customers · Cash Sessions · Settings
            </div>
          </div>
          <button class="btn btn-primary" id="btn-do-backup" style="margin-top:var(--space-2)">
            ${icon('icon-download')} Download Full Backup JSON Now
          </button>
        </div>
      </div>

      <!-- Database Restore / Migration -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-upload')} Restore / Data Migration</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3)">
          <div style="background:var(--danger-bg);border:1px solid var(--danger);border-radius:var(--radius-md);padding:var(--space-3);">
            <div class="font-bold text-xs text-red">⚠️ Overwrite Precaution</div>
            <div class="text-xs text-secondary" style="margin-top:2px">
              Restoring a backup file will replace existing records. A preview verification card will appear before committing.
            </div>
          </div>
          <p class="text-sm text-secondary">Select a valid <code>.json</code> backup file to validate and restore:</p>
          <button class="btn btn-ghost-danger" id="btn-select-restore-file">
            ${icon('icon-upload')} Select Backup JSON to Restore
          </button>
          <input type="file" id="input-restore-file" accept=".json" class="hidden">
        </div>
      </div>
    </div>
  `;

  // Backup trigger
  contentEl.querySelector('#btn-do-backup').addEventListener('click', async () => {
    try {
      await exportDatabaseBackup();
      playBeepSound('success');
      toast.success('Backup Saved', 'Database exported successfully to JSON.');
    } catch (e) {
      playBeepSound('error');
      toast.error('Backup Error', e.message);
    }
  });

  // Restore trigger
  const restoreFileInput = contentEl.querySelector('#input-restore-file');
  contentEl.querySelector('#btn-select-restore-file').addEventListener('click', () => {
    restoreFileInput.click();
  });

  restoreFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const backupData = await parseBackupFile(file);
      showPreRestorePreviewModal(backupData);
    } catch (err) {
      playBeepSound('error');
      toast.error('Invalid Backup', err.message);
    } finally {
      restoreFileInput.value = '';
    }
  });

  // Orphaned records cleaner trigger
  contentEl.querySelector('#btn-run-cleaner').addEventListener('click', async () => {
    const result = await cleanOrphanedRecords();
    playBeepSound('click');
    if (result.totalCleaned > 0) {
      toast.success('Database Cleaned', `Removed ${result.cleanedLogs} orphaned logs & ${result.cleanedRecipes} recipe links.`);
    } else {
      toast.info('Database Healthy', 'Zero orphaned records detected. All indexes are consistent.');
    }
    await renderBackupTab(contentEl);
  });
}

// ── Pre-Restore Preview & Validation Modal ────────────────────
function showPreRestorePreviewModal(backupData) {
  const tableCounts = {};
  if (backupData.tables) {
    Object.keys(backupData.tables).forEach(k => {
      tableCounts[k] = Array.isArray(backupData.tables[k]) ? backupData.tables[k].length : 0;
    });
  }

  const bodyHTML = `
    <p class="text-sm text-secondary">
      Please inspect the backup file metadata and record counts before confirming the migration:
    </p>

    <div class="restore-preview-box">
      <div class="restore-stat-row">
        <span class="text-muted">Backup Version</span>
        <span class="mono font-bold">${backupData.version || '1.0'}</span>
      </div>
      <div class="restore-stat-row">
        <span class="text-muted">Exported Store Name</span>
        <span class="font-bold text-primary">${backupData.store_name || 'Retail Store'}</span>
      </div>
      <div class="restore-stat-row">
        <span class="text-muted">Export Timestamp</span>
        <span class="mono">${backupData.exported_at ? fmtDateTime(backupData.exported_at) : 'Unknown'}</span>
      </div>
      <div class="restore-stat-row">
        <span class="text-muted">Products Cataloged</span>
        <span class="mono font-bold">${tableCounts['items'] || 0} items</span>
      </div>
      <div class="restore-stat-row">
        <span class="text-muted">Sales Invoices</span>
        <span class="mono font-bold text-green">${tableCounts['sales'] || 0} sales</span>
      </div>
      <div class="restore-stat-row">
        <span class="text-muted">Stock Movement Logs</span>
        <span class="mono font-bold">${tableCounts['logs'] || 0} logs</span>
      </div>
      <div class="restore-stat-row">
        <span class="text-muted">Customer Accounts</span>
        <span class="mono font-bold">${tableCounts['customers'] || 0}</span>
      </div>
    </div>

    <div style="background:var(--danger-bg);border:1px solid var(--danger);border-radius:var(--radius-md);padding:var(--space-3);">
      <div class="font-bold text-xs text-red">⚠️ Irreversible Operation</div>
      <div class="text-xs text-secondary" style="margin-top:2px">
        Clicking "Proceed with Restore" will overwrite all current local data with the records from this archive.
      </div>
    </div>
  `;

  openModal({
    title: 'Validate Backup & Confirm Restore',
    bodyHTML,
    footerHTML: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-restore-now">
        ${icon('icon-check')} Proceed with Restore
      </button>
    `,
    onOpen: (backdrop) => {
      backdrop.querySelector('#btn-confirm-restore-now').addEventListener('click', async () => {
        const btn = backdrop.querySelector('#btn-confirm-restore-now');
        btn.disabled = true;
        btn.innerHTML = `${icon('icon-refresh', 'animate-spin')} Restoring...`;

        try {
          await restoreDatabaseFromBackup(backupData);
          closeModal();
          playBeepSound('success');
          toast.success('Database Restored', 'All tables restored. Reloading system...');
          setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
          playBeepSound('error');
          toast.error('Restore Failed', err.message);
          btn.disabled = false;
          btn.innerHTML = `${icon('icon-check')} Proceed with Restore`;
        }
      });
    }
  });
}

// ── Print A4 Inventory Sheet Helper ───────────────────────────
async function printA4InventorySheet(items) {
  const storeName = await getSetting('store_name', 'Retail Store');
  const storeAddr = await getSetting('store_address', '');
  const ntnTaxId  = await getSetting('ntn_tax_id', 'NTN-9842104-7');
  const totalValuation = items.reduce((sum, it) => sum + ((it.cost_price || 0) * (it.stock_quantity || 0)), 0);

  const html = `
    <div class="print-a4-sheet">
      <div class="a4-header">
        <div>
          <div class="a4-store-name">${storeName}</div>
          <div style="font-size:9pt;color:#555;">${storeAddr} · NTN: ${ntnTaxId}</div>
        </div>
        <div style="text-align:right;">
          <div class="a4-report-title">INVENTORY VALUATION SHEET</div>
          <div class="a4-date">Date: ${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-top:10px;">
        <thead>
          <tr style="border-bottom:2px solid #000;text-align:left;">
            <th style="padding:6px 4px;">#</th>
            <th style="padding:6px 4px;">Product Name</th>
            <th style="padding:6px 4px;">SKU/Barcode</th>
            <th style="padding:6px 4px;">Category</th>
            <th style="padding:6px 4px;text-align:right;">Stock</th>
            <th style="padding:6px 4px;text-align:right;">Unit Cost</th>
            <th style="padding:6px 4px;text-align:right;">Unit Retail</th>
            <th style="padding:6px 4px;text-align:right;">Valuation</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => {
            const val = (it.cost_price || 0) * (it.stock_quantity || 0);
            return `
              <tr style="border-bottom:1px solid #ddd;">
                <td style="padding:4px;">${idx + 1}</td>
                <td style="padding:4px;font-weight:600;">${it.name}</td>
                <td style="padding:4px;font-family:monospace;">${it.barcode || 'N/A'}</td>
                <td style="padding:4px;">${it.category}</td>
                <td style="padding:4px;text-align:right;font-family:monospace;">${it.stock_quantity} ${it.unit}</td>
                <td style="padding:4px;text-align:right;font-family:monospace;">${fmt(it.cost_price)}</td>
                <td style="padding:4px;text-align:right;font-family:monospace;">${fmt(it.selling_price)}</td>
                <td style="padding:4px;text-align:right;font-family:monospace;font-weight:700;">${fmt(val)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="margin-top:20px;border-top:2px solid #000;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:11pt;">
        <span>TOTAL ASSET VALUATION (AT COST):</span>
        <span>${fmt(totalValuation)}</span>
      </div>
    </div>
  `;

  printElement(html, 'printing-a4');
}

