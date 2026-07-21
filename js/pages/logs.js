/**
 * logs.js — Inventory Event Ledger Page
 * Filterable, paginated log of all stock events
 */

const LOGS_PER_PAGE = 50;
let logsPage = 1;
let logsFilter = { type: 'ALL', search: '', dateFrom: '', dateTo: '' };

async function renderLogs(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Inventory Ledger</h1>
        <p>Complete append-only event log of all stock changes</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" id="logs-export-btn">${icon('icon-download')} Export CSV</button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar" style="flex-wrap:wrap;gap:var(--space-3)">
      <div class="filter-search-wrap" style="min-width:200px;max-width:260px">
        ${icon('icon-search', 'filter-search-icon')}
        <input type="text" class="filter-search" id="logs-search" placeholder="Search item name...">
      </div>
      <div class="filter-pills" id="logs-type-pills">
        ${['ALL','IN','SALE','OUT','ADJUSTMENT','SPOILAGE'].map(t => `
          <button class="btn btn-pill btn-ghost ${logsFilter.type === t ? 'active' : ''}" data-type="${t}">${t}</button>
        `).join('')}
      </div>
      <input type="date" class="form-input" id="logs-date-from" value="${logsFilter.dateFrom}" style="width:auto;padding:7px 10px;font-size:0.8125rem;" title="From date">
      <input type="date" class="form-input" id="logs-date-to"   value="${logsFilter.dateTo}"   style="width:auto;padding:7px 10px;font-size:0.8125rem;" title="To date">
      <button class="btn btn-ghost btn-sm" id="logs-clear-filter">Clear</button>
    </div>

    <div id="logs-table-wrap">
      <div class="section-card"><div class="skeleton" style="height:300px;border-radius:var(--radius-md)"></div></div>
    </div>
  `;

  await refreshLogsTable(container);

  // ── Controls ─────────────────────────────────────────────
  container.querySelector('#logs-export-btn').addEventListener('click', async () => {
    await exportLogsCSV();
    toast.success('Exported', 'Inventory logs CSV downloaded.');
  });

  container.querySelector('#logs-search').addEventListener('input', debounce(async (e) => {
    logsFilter.search = e.target.value;
    logsPage = 1;
    await refreshLogsTable(container);
  }, 250));

  container.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', async () => {
      logsFilter.type = btn.dataset.type;
      container.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b === btn));
      logsPage = 1;
      await refreshLogsTable(container);
    });
  });

  container.querySelector('#logs-date-from').addEventListener('change', async (e) => {
    logsFilter.dateFrom = e.target.value;
    logsPage = 1;
    await refreshLogsTable(container);
  });

  container.querySelector('#logs-date-to').addEventListener('change', async (e) => {
    logsFilter.dateTo = e.target.value;
    logsPage = 1;
    await refreshLogsTable(container);
  });

  container.querySelector('#logs-clear-filter').addEventListener('click', async () => {
    logsFilter = { type: 'ALL', search: '', dateFrom: '', dateTo: '' };
    container.querySelector('#logs-search').value = '';
    container.querySelector('#logs-date-from').value = '';
    container.querySelector('#logs-date-to').value = '';
    container.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === 'ALL'));
    logsPage = 1;
    await refreshLogsTable(container);
  });
}

async function refreshLogsTable(container) {
  const tableWrap = container.querySelector('#logs-table-wrap');
  if (!tableWrap) return;

  // Fetch all logs and items
  const [allLogs, allItems] = await Promise.all([
    db.logs.orderBy('timestamp').reverse().toArray(),
    db.items.toArray()
  ]);

  const itemMap = {};
  allItems.forEach(it => { itemMap[it.id] = it; });

  // Apply filters
  let filtered = allLogs;

  if (logsFilter.type !== 'ALL') {
    filtered = filtered.filter(l => l.change_type === logsFilter.type);
  }

  if (logsFilter.search) {
    const q = logsFilter.search.toLowerCase();
    filtered = filtered.filter(l => {
      const it = itemMap[l.item_id];
      return it && it.name.toLowerCase().includes(q);
    });
  }

  if (logsFilter.dateFrom) {
    const from = new Date(logsFilter.dateFrom);
    filtered = filtered.filter(l => new Date(l.timestamp) >= from);
  }

  if (logsFilter.dateTo) {
    const to = new Date(logsFilter.dateTo + 'T23:59:59');
    filtered = filtered.filter(l => new Date(l.timestamp) <= to);
  }

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / LOGS_PER_PAGE));
  logsPage = Math.min(logsPage, totalPages);
  const page = filtered.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE);

  if (filtered.length === 0) {
    tableWrap.innerHTML = `
      <div class="empty-state">
        ${icon('icon-logs', 'empty-state-icon')}
        <h3>No Logs Found</h3>
        <p>No events match your current filters.</p>
      </div>`;
    return;
  }

  const BADGE = {
    'IN':         `<span class="badge badge-green">Stock In</span>`,
    'SALE':       `<span class="badge badge-indigo">Sale</span>`,
    'OUT':        `<span class="badge badge-amber">Stock Out</span>`,
    'ADJUSTMENT': `<span class="badge badge-primary">Adjustment</span>`,
    'SPOILAGE':   `<span class="badge badge-purple">Spoilage</span>`
  };

  tableWrap.innerHTML = `
    <div class="table-wrap">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Item</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Notes</th>
              <th>Sync</th>
            </tr>
          </thead>
          <tbody>
            ${page.map(log => {
              const it   = itemMap[log.item_id];
              const sign = log.change_type === 'IN' ? '+' : '−';
              const isIn = log.change_type === 'IN';
              return `
                <tr>
                  <td class="mono text-sm" style="white-space:nowrap">${fmtDateTime(log.timestamp)}</td>
                  <td>
                    <div class="font-semibold text-sm">${it ? it.name : '<em class="text-muted">Deleted item</em>'}</div>
                    ${it ? `<div class="text-xs text-muted">${it.category}</div>` : ''}
                  </td>
                  <td>${BADGE[log.change_type] || `<span class="badge badge-gray">${log.change_type}</span>`}</td>
                  <td class="mono font-bold" style="color:${isIn ? 'var(--stock-in)' : 'var(--danger)'}">
                    ${sign}${fmtNum(log.qty_changed)} ${it ? it.unit : ''}
                  </td>
                  <td class="text-sm text-muted">${log.notes || '—'}</td>
                  <td>
                    ${log.sync_status === 'SYNCED'
                      ? `<span class="badge badge-green">Synced</span>`
                      : `<span class="badge badge-amber">Pending</span>`}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <div class="pagination-info">
          Showing ${(logsPage - 1) * LOGS_PER_PAGE + 1}–${Math.min(logsPage * LOGS_PER_PAGE, filtered.length)} of ${filtered.length} events
        </div>
        <div class="pagination-controls">
          <button class="page-btn" id="logs-prev" ${logsPage <= 1 ? 'disabled' : ''}>${icon('icon-chevron-left')}</button>
          ${generatePageNumbers(logsPage, totalPages).map(p =>
            p === '...'
              ? `<span class="page-btn" style="cursor:default">…</span>`
              : `<button class="page-btn ${p === logsPage ? 'active' : ''}" data-page="${p}">${p}</button>`
          ).join('')}
          <button class="page-btn" id="logs-next" ${logsPage >= totalPages ? 'disabled' : ''}>${icon('icon-chevron-right')}</button>
        </div>
      </div>
    </div>
  `;

  // Pagination events
  tableWrap.querySelector('#logs-prev')?.addEventListener('click', async () => { if (logsPage > 1) { logsPage--; await refreshLogsTable(container); }});
  tableWrap.querySelector('#logs-next')?.addEventListener('click', async () => { if (logsPage < totalPages) { logsPage++; await refreshLogsTable(container); }});
  tableWrap.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', async () => {
      logsPage = parseInt(btn.dataset.page);
      await refreshLogsTable(container);
    });
  });
}

function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
