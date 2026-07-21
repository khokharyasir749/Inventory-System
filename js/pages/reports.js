/**
 * reports.js — Reports, Exports, and CSV Import Page
 */

async function renderReports(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Reports & Export</h1>
        <p>Export data, import items, and manage backups</p>
      </div>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="exports">Exports</button>
      <button class="tab-btn" data-tab="import">Bulk Import</button>
      <button class="tab-btn" data-tab="backup">Backup & Restore</button>
    </div>

    <div id="reports-tab-content"></div>
  `;

  // Tab switching
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderReportTab(container, btn.dataset.tab);
    });
  });

  renderReportTab(container, 'exports');
}

async function renderReportTab(container, tab) {
  const tabContent = container.querySelector('#reports-tab-content');

  if (tab === 'exports') {
    // Date range defaults
    const today  = new Date().toISOString().split('T')[0];
    const month1 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [sales, saleItems, items] = await Promise.all([
      db.sales.toArray(),
      db.sale_items.toArray(),
      db.items.toArray()
    ]);

    const totalSales  = sales.reduce((s, r) => s + (r.total || 0), 0);
    const todaySales  = sales.filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString());
    const todayRev    = todaySales.reduce((s, r) => s + (r.total || 0), 0);
    const lowStock    = items.filter(it => !it.is_composite && it.stock_quantity <= it.min_stock_alert);

    const itemMap = {};
    items.forEach(it => { itemMap[it.id] = it.name; });

    tabContent.innerHTML = `
      <!-- Summary Cards -->
      <div class="kpi-grid" style="margin-bottom:var(--space-5)">
        <div class="kpi-card">
          <div class="kpi-card-header"><div class="kpi-icon kpi-icon-indigo">${icon('icon-dollar')}</div></div>
          <div class="kpi-card-body">
            <div class="kpi-value">${fmt(totalSales)}</div>
            <div class="kpi-label">Total Revenue (All Time)</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card-header"><div class="kpi-icon kpi-icon-green">${icon('icon-trending-up')}</div></div>
          <div class="kpi-card-body">
            <div class="kpi-value">${fmt(todayRev)}</div>
            <div class="kpi-label">Today's Revenue</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card-header"><div class="kpi-icon kpi-icon-teal">${icon('icon-reports')}</div></div>
          <div class="kpi-card-body">
            <div class="kpi-value">${sales.length}</div>
            <div class="kpi-label">Total Transactions</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card-header"><div class="kpi-icon kpi-icon-amber">${icon('icon-alert')}</div></div>
          <div class="kpi-card-body">
            <div class="kpi-value">${lowStock.length}</div>
            <div class="kpi-label">Low Stock Items</div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Sales Export -->
        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-reports')} Sales History Export</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">From Date</label>
                <input type="date" class="form-input" id="sales-from" value="${month1}">
              </div>
              <div class="form-group">
                <label class="form-label">To Date</label>
                <input type="date" class="form-input" id="sales-to" value="${today}">
              </div>
            </div>
            <div id="sales-preview-stats" class="text-sm text-muted"></div>
            <button class="btn btn-primary btn-sm" id="export-sales-csv">
              ${icon('icon-download')} Export Sales CSV
            </button>
          </div>
        </div>

        <!-- Inventory Exports -->
        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-inventory')} Inventory Exports</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <button class="btn btn-ghost" id="export-inv-csv" style="justify-content:flex-start">
              ${icon('icon-download')} Export Full Inventory CSV
            </button>
            <button class="btn btn-ghost" id="export-low-csv" style="justify-content:flex-start">
              ${icon('icon-alert')} Export Low Stock Report CSV
            </button>
            <button class="btn btn-ghost" id="export-logs-csv" style="justify-content:flex-start">
              ${icon('icon-logs')} Export Inventory Logs CSV
            </button>
            <button class="btn btn-ghost" id="print-inv-a4" style="justify-content:flex-start">
              ${icon('icon-print')} Print Inventory Sheet (A4)
            </button>
          </div>
        </div>
      </div>

      <!-- Sales Table Preview -->
      <div class="section-card" style="margin-top:var(--space-4)">
        <div class="section-card-header">
          <span class="section-card-title">Recent Sales</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date & Time</th>
                <th>Items</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              ${sales.length === 0
                ? `<tr><td colspan="8" style="text-align:center;padding:var(--space-8);color:var(--text-muted)">No sales recorded yet</td></tr>`
                : sales.slice(0, 20).map(s => {
                    const sItems = saleItems.filter(si => si.sale_id === s.id);
                    const itemNames = sItems.map(i => `${i.quantity}x ${itemMap[i.item_id] || 'Unknown'}`).join(', ');
                    return `
                      <tr>
                        <td class="mono text-xs">${s.invoice_no}</td>
                        <td class="text-sm" style="white-space:nowrap">${fmtDateTime(s.timestamp)}</td>
                        <td class="text-sm" title="${itemNames}">${itemNames}</td>
                        <td class="mono">${fmt(s.subtotal)}</td>
                        <td class="mono">${s.discount > 0 ? fmt(s.discount) : '—'}</td>
                        <td class="mono">${s.tax > 0 ? fmt(s.tax) : '—'}</td>
                        <td class="mono font-bold">${fmt(s.total)}</td>
                        <td><span class="badge ${s.payment_method === 'Cash' ? 'badge-green' : s.payment_method === 'Card' ? 'badge-indigo' : 'badge-gray'}">${s.payment_method}</span></td>
                      </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
        ${sales.length > 20 ? `<div class="text-sm text-muted" style="padding:var(--space-3) var(--space-4)">Showing 20 of ${sales.length} sales. Export CSV to see all.</div>` : ''}
      </div>
    `;

    // Event handlers
    const updateSalesPreview = async () => {
      const from = tabContent.querySelector('#sales-from').value;
      const to   = tabContent.querySelector('#sales-to').value;
      const filtered = sales.filter(s => {
        const d = new Date(s.timestamp);
        return (!from || d >= new Date(from)) && (!to || d <= new Date(to + 'T23:59:59'));
      });
      const rev = filtered.reduce((sum, s) => sum + (s.total || 0), 0);
      const prevEl = tabContent.querySelector('#sales-preview-stats');
      if (prevEl) prevEl.textContent = `${filtered.length} transactions · ${fmt(rev)} revenue in range`;
    };

    tabContent.querySelector('#sales-from').addEventListener('change', updateSalesPreview);
    tabContent.querySelector('#sales-to').addEventListener('change', updateSalesPreview);
    await updateSalesPreview();

    tabContent.querySelector('#export-sales-csv').addEventListener('click', async () => {
      const from = tabContent.querySelector('#sales-from').value;
      const to   = tabContent.querySelector('#sales-to').value;
      await exportSalesCSV(from, to);
      toast.success('Exported', 'Sales history CSV downloaded.');
    });

    tabContent.querySelector('#export-inv-csv').addEventListener('click', async () => {
      await exportInventoryCSV();
      toast.success('Exported', 'Inventory CSV downloaded.');
    });

    tabContent.querySelector('#export-low-csv').addEventListener('click', async () => {
      await exportLowStockCSV();
      toast.success('Exported', 'Low stock report CSV downloaded.');
    });

    tabContent.querySelector('#export-logs-csv').addEventListener('click', async () => {
      await exportLogsCSV();
      toast.success('Exported', 'Inventory logs CSV downloaded.');
    });

    tabContent.querySelector('#print-inv-a4').addEventListener('click', async () => {
      const items = await db.items.toArray();
      await printInventorySheet(items);
    });

  } else if (tab === 'import') {
    tabContent.innerHTML = `
      <div class="grid-2">
        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-upload')} Bulk Import Products</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            <p class="text-sm text-secondary">Upload a CSV to bulk-create or update products. Existing items (matched by barcode or name) will be updated. New items will be created.</p>
            <button class="btn btn-ghost btn-sm" id="download-template-btn">${icon('icon-download')} Download CSV Template</button>
            <div class="image-upload-zone" id="import-drop-zone">
              ${icon('icon-upload')}
              <p><strong>Click to select CSV</strong> or drag & drop here</p>
              <p class="text-xs">Required columns: name, category, unit, selling_price, stock_quantity</p>
              <input type="file" id="import-file-input" accept=".csv" class="hidden">
            </div>
            <div id="import-result" class="hidden"></div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">CSV Format Reference</span>
          </div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Column</th><th>Required</th><th>Notes</th></tr></thead>
              <tbody>
                <tr><td class="mono text-xs">barcode</td><td>No</td><td>Used to match existing items</td></tr>
                <tr><td class="mono text-xs">name</td><td><strong>Yes</strong></td><td>Product name</td></tr>
                <tr><td class="mono text-xs">category</td><td>No</td><td>Defaults to "Other"</td></tr>
                <tr><td class="mono text-xs">unit</td><td>No</td><td>pcs / kg / g / ml / L / pack</td></tr>
                <tr><td class="mono text-xs">cost_price</td><td>No</td><td>Numeric, e.g. 50</td></tr>
                <tr><td class="mono text-xs">selling_price</td><td>No</td><td>Numeric, e.g. 80</td></tr>
                <tr><td class="mono text-xs">min_stock_alert</td><td>No</td><td>Defaults to 5</td></tr>
                <tr><td class="mono text-xs">stock_quantity</td><td>No</td><td>Initial stock count</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    tabContent.querySelector('#download-template-btn').addEventListener('click', downloadImportTemplate);

    const dropZone  = tabContent.querySelector('#import-drop-zone');
    const fileInput = tabContent.querySelector('#import-file-input');
    const resultDiv = tabContent.querySelector('#import-result');

    const doImport = async (file) => {
      resultDiv.innerHTML = `<div class="badge badge-gray animate-pulse">Importing ${file.name}...</div>`;
      resultDiv.classList.remove('hidden');
      try {
        const results = await importItemsFromCSV(file);
        resultDiv.innerHTML = `
          <div style="padding:var(--space-3);background:var(--stock-in-bg);border:1px solid var(--stock-in);border-radius:var(--radius-md)">
            <div class="font-semibold" style="color:#065F46">Import Complete</div>
            <div class="text-sm" style="color:#065F46">✓ Created: ${results.created} &nbsp;·&nbsp; Updated: ${results.updated}</div>
            ${results.errors.length > 0 ? `<div class="text-sm" style="color:var(--danger);margin-top:var(--space-2)">${results.errors.join('<br>')}</div>` : ''}
          </div>`;
        toast.success('Import Done', `${results.created} created, ${results.updated} updated.`);
      } catch (err) {
        resultDiv.innerHTML = `<div style="color:var(--danger);font-size:0.875rem;padding:var(--space-3)">Error: ${err.message}</div>`;
        toast.error('Import Failed', err.message);
      }
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) await doImport(f); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault(); dropZone.style.borderColor = '';
      const f = e.dataTransfer.files[0]; if (f) await doImport(f);
    });

  } else if (tab === 'backup') {
    tabContent.innerHTML = `
      <div class="grid-2">
        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-backup')} Backup Database</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            <p class="text-sm text-secondary">Export your entire database (items, recipes, logs, sales, and settings) to a JSON file. Store it safely to protect against browser cache clears or device upgrades.</p>
            <div style="background:var(--primary-muted);border-radius:var(--radius-md);padding:var(--space-3)">
              <div class="text-sm font-semibold" style="color:var(--primary)">✓ Includes all data</div>
              <div class="text-sm" style="color:var(--text-secondary)">Items · Recipes · Stock logs · Sales · Settings</div>
            </div>
            <button class="btn btn-primary" id="backup-now-btn">${icon('icon-backup')} Backup to File Now</button>
          </div>
        </div>

        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-upload')} Restore Database</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div style="background:var(--danger-bg);border-radius:var(--radius-md);padding:var(--space-3);border:1px solid var(--danger)">
              <div class="font-semibold text-sm" style="color:var(--danger)">⚠ Warning</div>
              <div class="text-sm" style="color:var(--danger)">Restoring will permanently overwrite ALL current data. This action cannot be undone.</div>
            </div>
            <p class="text-sm text-secondary">Select a backup JSON file previously exported from this app.</p>
            <button class="btn btn-ghost-danger" id="restore-btn">${icon('icon-upload')} Select Backup File to Restore</button>
            <input type="file" id="restore-file-input" accept=".json" class="hidden">
            <div id="restore-status" class="hidden"></div>
          </div>
        </div>
      </div>
    `;

    tabContent.querySelector('#backup-now-btn').addEventListener('click', async () => {
      try {
        await exportBackup();
        toast.success('Backup Complete', 'Database saved to JSON file.');
      } catch (e) {
        toast.error('Backup Failed', e.message);
      }
    });

    tabContent.querySelector('#restore-btn').addEventListener('click', () => {
      tabContent.querySelector('#restore-file-input').click();
    });

    tabContent.querySelector('#restore-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      showConfirm(`Restore from "${file.name}"? This will permanently replace ALL current data.`, async () => {
        const statusDiv = tabContent.querySelector('#restore-status');
        statusDiv.innerHTML = `<div class="badge badge-gray animate-pulse">Restoring...</div>`;
        statusDiv.classList.remove('hidden');
        try {
          await importBackup(file);
          statusDiv.innerHTML = `<div class="badge badge-green">Restored! Reloading...</div>`;
          toast.success('Restored!', 'Reloading the application...');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          statusDiv.innerHTML = `<div style="color:var(--danger)">${err.message}</div>`;
          toast.error('Restore Failed', err.message);
        }
      });
    });
  }
}
