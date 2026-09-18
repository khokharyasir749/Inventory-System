/**
 * customers.js — Customer Management, Credit Ledger & CRM Engine
 * Features:
 * 1. Customer CRUD, search, and outstanding credit balance badges
 * 2. Instant WhatsApp Click-to-Chat (wa.me) & Phone Call triggers
 * 3. Interactive Customer Ledger Statement with running balance tracking
 * 4. Payment Collection Modal with quick-pay preset chips and receipt printing
 * 5. Statement CSV export
 */

let customersList = [];
let customerSearch = '';
let customerPage = 1;
const CUSTOMERS_PER_PAGE = 30;

let selectedCustomerForLedger = null;

async function renderCustomers(container) {
  selectedCustomerForLedger = null; // reset

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Customers & Credit Ledger</h1>
        <p>Customer ledger statements, outstanding receivables, WhatsApp payment reminders, and payment receipts</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary btn-sm" id="customer-add-btn">${icon('icon-plus')} Add Customer</button>
      </div>
    </div>

    <div id="customers-view-outlet" class="animate-fade-in">
      <!-- Search & Filters -->
      <div class="filter-bar">
        <div class="filter-search-wrap" style="max-width:340px;flex:1">
          ${icon('icon-search', 'filter-search-icon')}
          <input type="text" class="filter-search" id="customer-search" placeholder="Search customer name or phone...">
        </div>
      </div>

      <div id="customers-table-container">
        <div class="section-card">
          <div class="skeleton" style="height:250px"></div>
        </div>
      </div>
    </div>
  `;

  await loadAndRenderCustomers(container);

  container.querySelector('#customer-add-btn').addEventListener('click', () => showCustomerEditModal(null, container));

  const searchInp = container.querySelector('#customer-search');
  searchInp.addEventListener('input', debounce(async (e) => {
    customerSearch = e.target.value;
    customerPage = 1;
    await loadAndRenderCustomers(container);
  }, 200));
}

async function loadAndRenderCustomers(container) {
  customersList = await db.customers.toArray();
  renderCustomersListTable(container);
}

function renderCustomersListTable(container) {
  const tableContainer = container.querySelector('#customers-table-container');
  if (!tableContainer) return;

  let filtered = [...customersList];
  if (customerSearch) {
    const q = customerSearch.toLowerCase();
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  }

  // Sort by outstanding balance descending, then by name
  filtered.sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0) || a.name.localeCompare(b.name));

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / CUSTOMERS_PER_PAGE));
  customerPage = Math.min(customerPage, totalPages);
  const page = filtered.slice((customerPage - 1) * CUSTOMERS_PER_PAGE, customerPage * CUSTOMERS_PER_PAGE);

  if (filtered.length === 0) {
    tableContainer.innerHTML = `
      <div class="empty-state">
        ${icon('icon-users', 'empty-state-icon')}
        <h3>No Customers Found</h3>
        <p>${customerSearch ? 'Try adjusting your search criteria.' : 'Create customer accounts to track credit sales.'}</p>
      </div>`;
    return;
  }

  tableContainer.innerHTML = `
    <div class="table-wrap">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Contact & Triggers</th>
              <th>Address</th>
              <th>Outstanding Balance</th>
              <th>Status</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${page.map(c => {
    const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
    const waText = encodeURIComponent(`Assalam-o-Alaikum ${c.name},\nThis is a friendly reminder regarding your outstanding balance of ${fmt(c.current_balance)} at our store.\nThank you!`);
    const hasBalance = (c.current_balance || 0) > 0;

    return `
                <tr>
                  <td class="font-semibold">
                    <div style="font-size:0.925rem;color:var(--text-primary)">${c.name}</div>
                    <div class="text-xs text-muted">Customer since ${fmtDate(c.created_at)}</div>
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      ${c.phone ? `
                        <a href="tel:${c.phone}" class="contact-btn-phone" title="Call ${c.phone}">
                          📞 ${c.phone}
                        </a>
                        ${cleanPhone.length >= 7 ? `
                          <a href="https://wa.me/${cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone}?text=${waText}" target="_blank" rel="noopener" class="contact-btn-wa" title="Send WhatsApp reminder">
                            💬 WhatsApp
                          </a>
                        ` : ''}
                      ` : '<span class="text-muted text-xs">—</span>'}
                    </div>
                  </td>
                  <td class="text-xs text-secondary truncate" style="max-width:180px" title="${c.address || ''}">${c.address || '—'}</td>
                  <td class="mono font-bold ${hasBalance ? 'text-red' : 'text-green'}">
                    ${fmt(c.current_balance)}
                  </td>
                  <td>
                    ${hasBalance
        ? `<span class="badge badge-red">Receivable Due</span>`
        : `<span class="badge badge-green">Cleared</span>`
      }
                  </td>
                  <td class="table-actions">
                    <button class="btn btn-ghost btn-sm" data-view-ledger="${c.id}" title="Statement">
                      ${icon('icon-eye')} Statement
                    </button>
                    ${hasBalance ? `
                      <button class="btn btn-success btn-sm" data-pay-c="${c.id}" title="Collect Payment">
                        ${icon('icon-check')} Pay
                      </button>
                    ` : ''}
                    <button class="btn btn-ghost btn-sm btn-icon" data-edit-c="${c.id}" title="Edit Profile">
                      ${icon('icon-edit')}
                    </button>
                  </td>
                </tr>`;
  }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <div class="pagination-info">
          Showing ${(customerPage - 1) * CUSTOMERS_PER_PAGE + 1}–${Math.min(customerPage * CUSTOMERS_PER_PAGE, filtered.length)} of ${filtered.length} customers
        </div>
        <div class="pagination-controls">
          <button class="page-btn" id="c-prev" ${customerPage <= 1 ? 'disabled' : ''}>${icon('icon-chevron-left')}</button>
          <button class="page-btn" id="c-next" ${customerPage >= totalPages ? 'disabled' : ''}>${icon('icon-chevron-right')}</button>
        </div>
      </div>
    </div>
  `;

  // Events
  tableContainer.querySelector('#c-prev')?.addEventListener('click', async () => { if (customerPage > 1) { customerPage--; renderCustomersListTable(container); } });
  tableContainer.querySelector('#c-next')?.addEventListener('click', async () => { if (customerPage < totalPages) { customerPage++; renderCustomersListTable(container); } });

  tableContainer.querySelectorAll('[data-view-ledger]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cId = parseInt(btn.dataset.viewLedger);
      const c = customersList.find(x => x.id === cId);
      if (c) renderCustomerLedgerView(container, c);
    });
  });

  tableContainer.querySelectorAll('[data-pay-c]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cId = parseInt(btn.dataset.payC);
      const c = customersList.find(x => x.id === cId);
      if (c) showPaymentModal(c, container);
    });
  });

  tableContainer.querySelectorAll('[data-edit-c]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cId = parseInt(btn.dataset.editC);
      const c = customersList.find(x => x.id === cId);
      if (c) showCustomerEditModal(c, container);
    });
  });
}

// ── Customer Ledger Statement View ────────────────────────────
async function renderCustomerLedgerView(container, customer) {
  selectedCustomerForLedger = customer;

  const outlet = container.querySelector('#customers-view-outlet');
  if (!outlet) return;

  const cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');
  const waText = encodeURIComponent(`Assalam-o-Alaikum ${customer.name},\nThis is your account statement from our store. Your current outstanding balance is ${fmt(customer.current_balance)}.`);

  outlet.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" id="ledger-back-btn">
        ${icon('icon-chevron-left')} Back to Customers
      </button>

      <div style="display:flex;gap:var(--space-2);margin-left:auto;flex-wrap:wrap">
        ${customer.phone ? `
          <a href="tel:${customer.phone}" class="btn btn-ghost btn-sm">
            📞 Call ${customer.phone}
          </a>
          ${cleanPhone.length >= 7 ? `
            <a href="https://wa.me/${cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone}?text=${waText}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="color:#10B981;border-color:rgba(16,185,129,0.3)">
              💬 WhatsApp Reminder
            </a>
          ` : ''}
        ` : ''}
        <button class="btn btn-ghost btn-sm" id="ledger-export-btn">
          ${icon('icon-download')} Export CSV
        </button>
        <button class="btn btn-success btn-sm" id="ledger-pay-btn">
          ${icon('icon-check')} Record Payment
        </button>
      </div>
    </div>

    <!-- Customer KPI Cards -->
    <div class="grid-3" style="margin-bottom:var(--space-5)">
      <div class="kpi-card" style="border-color:${customer.current_balance > 0 ? 'var(--danger)' : 'var(--stock-in)'}">
        <div class="kpi-card-body">
          <div class="kpi-value mono ${customer.current_balance > 0 ? 'text-red' : 'text-green'}" id="ledger-kpi-bal">
            ${fmt(customer.current_balance)}
          </div>
          <div class="kpi-label">Current Outstanding Balance</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-sale mono" id="ledger-kpi-sales">Rs. 0</div>
          <div class="kpi-label">Total Credit Sales (Receivables)</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-green mono" id="ledger-kpi-paid">Rs. 0</div>
          <div class="kpi-label">Total Payments Received</div>
        </div>
      </div>
    </div>

    <!-- Statement Table -->
    <div class="section-card">
      <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
        <span class="section-card-title">${icon('icon-reports')} Account Statement Timeline — ${customer.name}</span>
      </div>
      <div id="ledger-transactions-table">
        <div class="skeleton" style="height:150px"></div>
      </div>
    </div>
  `;

  outlet.querySelector('#ledger-back-btn').addEventListener('click', () => renderCustomers(container));
  outlet.querySelector('#ledger-pay-btn').addEventListener('click', () => showPaymentModal(customer, container));
  outlet.querySelector('#ledger-export-btn').addEventListener('click', () => exportCustomerStatementCSV(customer));

  await loadAndRenderTransactions(outlet, customer.id);
}

async function loadAndRenderTransactions(outlet, customerId) {
  const transactions = await db.customer_transactions.where('customer_id').equals(customerId).toArray();
  const sales = await db.sales.toArray();
  const saleMap = {};
  sales.forEach(s => { saleMap[s.id] = s.invoice_no; });

  // Sort chronological for running balance calculation
  transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let runningBalance = 0;
  const transactionsWithRunning = transactions.map(t => {
    if (t.transaction_type === 'CREDIT') {
      runningBalance += (t.amount || 0);
    } else {
      runningBalance = Math.max(0, runningBalance - (t.amount || 0));
    }
    return { ...t, running_balance: runningBalance };
  });

  // Display reverse-chronological (newest first)
  const displayTransactions = transactionsWithRunning.slice().reverse();

  // Compute metrics
  const totalCredit = transactions
    .filter(t => t.transaction_type === 'CREDIT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalPaid = transactions
    .filter(t => t.transaction_type === 'PAYMENT')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const setKpi = (id, val) => { const el = outlet.querySelector(id); if (el) el.textContent = fmt(val); };
  setKpi('#ledger-kpi-sales', totalCredit);
  setKpi('#ledger-kpi-paid', totalPaid);

  const tableWrap = outlet.querySelector('#ledger-transactions-table');
  if (!tableWrap) return;

  if (displayTransactions.length === 0) {
    tableWrap.innerHTML = `<p class="text-sm text-secondary" style="padding:var(--space-4);text-align:center">No transaction ledger events found for this customer.</p>`;
    return;
  }

  tableWrap.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Reference / Details</th>
            <th>Transaction Type</th>
            <th>Amount</th>
            <th style="text-align:right">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${displayTransactions.map(t => {
    const isCredit = t.transaction_type === 'CREDIT';
    const badge = isCredit
      ? `<span class="badge badge-amber">Credit Sale</span>`
      : `<span class="badge badge-green">Payment Settled</span>`;
    return `
              <tr>
                <td class="mono text-xs">${fmtDateTime(t.timestamp)}</td>
                <td class="text-xs">${t.sale_id ? `Invoice: <strong>${saleMap[t.sale_id] || t.sale_id}</strong>` : 'Direct Payment / Opening Balance'}</td>
                <td>${badge}</td>
                <td class="mono font-bold text-xs ${isCredit ? 'text-sale' : 'text-green'}">
                  ${isCredit ? '+' : '−'} ${fmt(t.amount)}
                </td>
                <td class="mono font-bold text-xs" style="text-align:right">
                  ${fmt(t.running_balance)}
                </td>
              </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Direct Customer Payment Modal ────────────────────────────
function showPaymentModal(customer, pageContainer) {
  const curBal = customer.current_balance || 0;
  const halfBal = Math.round(curBal / 2);

  const bodyHTML = `
    <div style="background:var(--surface-raised);padding:var(--space-4);border-radius:var(--radius-lg);margin-bottom:var(--space-4);border:1px solid var(--border)">
      <div class="text-xs text-secondary">Outstanding Balance for <strong>${customer.name}</strong></div>
      <div class="font-bold text-2xl text-red mono" style="margin-top:2px">${fmt(curBal)}</div>
    </div>

    <!-- Quick Preset Chips -->
    <div style="margin-bottom:var(--space-3)">
      <div class="text-xs font-semibold text-secondary" style="margin-bottom:var(--space-2)">Quick Fill Amount:</div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        <button type="button" class="btn btn-ghost btn-xs" id="chip-full-pay">Full Payoff (${fmt(curBal)})</button>
        ${curBal > 100 ? `<button type="button" class="btn btn-ghost btn-xs" id="chip-half-pay">50% (${fmt(halfBal)})</button>` : ''}
        <button type="button" class="btn btn-ghost btn-xs" id="chip-1000">1,000</button>
        <button type="button" class="btn btn-ghost btn-xs" id="chip-5000">5,000</button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="pay-amount">Payment Amount Collected <span class="required">*</span></label>
      <div class="input-group">
        <span class="input-prefix">Rs.</span>
        <input type="number" class="form-input" id="pay-amount" value="${curBal > 0 ? curBal : ''}" placeholder="0.00" min="0.01" step="0.5" autofocus style="font-size:1.25rem;font-weight:700">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="pay-notes">Payment Remarks / Reference</label>
      <input type="text" class="form-input" id="pay-notes" placeholder="e.g. Cash received in store, bank transfer, check #">
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-success" id="pay-submit-btn">${icon('icon-check')} Save Payment Receipt</button>
  `;

  openModal({
    title: `Collect Payment: ${customer.name}`,
    bodyHTML,
    footerHTML,
    onOpen: (backdrop) => {
      const amtInp = backdrop.querySelector('#pay-amount');

      backdrop.querySelector('#chip-full-pay')?.addEventListener('click', () => { amtInp.value = curBal; });
      backdrop.querySelector('#chip-half-pay')?.addEventListener('click', () => { amtInp.value = halfBal; });
      backdrop.querySelector('#chip-1000')?.addEventListener('click', () => { amtInp.value = 1000; });
      backdrop.querySelector('#chip-5000')?.addEventListener('click', () => { amtInp.value = 5000; });

      backdrop.querySelector('#pay-submit-btn').addEventListener('click', async () => {
        const amt = parseFloat(amtInp.value);
        if (isNaN(amt) || amt <= 0) {
          toast.error('Validation Error', 'Please enter a valid payment amount greater than zero.');
          return;
        }

        const activeSession = await getActiveSession();
        const sessionId = activeSession ? activeSession.id : null;
        const notes = backdrop.querySelector('#pay-notes').value.trim();

        // 1. Add customer transaction
        await db.customer_transactions.add({
          shop_id: 1,
          customer_id: customer.id,
          sale_id: null,
          amount: amt,
          transaction_type: 'PAYMENT',
          timestamp: new Date().toISOString()
        });

        // 2. Decrement customer balance
        const newBalance = Math.max(0, (customer.current_balance || 0) - amt);
        await db.customers.update(customer.id, { current_balance: newBalance });

        // 3. Update active drawer session expected cash
        if (sessionId) {
          const session = await db.cash_sessions.get(sessionId);
          if (session) {
            const expected = (session.expected_cash || session.opening_cash) + amt;
            await db.cash_sessions.update(sessionId, { expected_cash: expected });
          }
        }

        // 4. Record audit log
        await db.logs.add({
          shop_id: 1,
          item_id: null,
          change_type: 'PAYMENT_RECEIVED',
          qty_changed: amt,
          timestamp: new Date().toISOString(),
          sync_status: 'SYNCED',
          notes: `Received ${fmt(amt)} from ${customer.name}${notes ? ` (${notes})` : ''}`
        });

        closeModal();
        toast.success('Payment Recorded', `Successfully recorded payment of ${fmt(amt)} for ${customer.name}.`);

        customer.current_balance = newBalance;
        const outlet = pageContainer.querySelector('#customers-view-outlet');
        if (outlet && selectedCustomerForLedger) {
          const balEl = outlet.querySelector('#ledger-kpi-bal');
          if (balEl) balEl.textContent = fmt(newBalance);
          await loadAndRenderTransactions(outlet, customer.id);
        } else {
          await loadAndRenderCustomers(pageContainer);
        }
      });
    }
  });
}

// ── Customer CRUD modal ───────────────────────────────────────
function showCustomerEditModal(customer, pageContainer) {
  const isEdit = !!customer;
  const bodyHTML = `
    <div class="form-group">
      <label class="form-label" for="c-name">Full Customer Name <span class="required">*</span></label>
      <input class="form-input" id="c-name" value="${customer?.name || ''}" placeholder="e.g. Zahid Mahmood" required>
    </div>
    <div class="form-group">
      <label class="form-label" for="c-phone">Phone / WhatsApp Number</label>
      <input class="form-input" id="c-phone" value="${customer?.phone || ''}" placeholder="e.g. 03001234567">
      <div class="form-hint">Used for 1-click WhatsApp payment reminders and notifications.</div>
    </div>
    <div class="form-group">
      <label class="form-label" for="c-address">Delivery / Billing Address</label>
      <textarea class="form-input" id="c-address" placeholder="Residential or commercial billing address...">${customer?.address || ''}</textarea>
    </div>
    ${!isEdit ? `
      <div class="form-group">
        <label class="form-label" for="c-balance">Initial Outstanding Balance</label>
        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input type="number" class="form-input" id="c-balance" value="0" min="0" step="0.5">
        </div>
        <div class="form-hint">Set existing credit balance if migrating accounts.</div>
      </div>
    ` : ''}
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-ghost-danger" id="c-delete-btn">${icon('icon-trash')} Delete Account</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="c-save-btn">${icon('icon-check')} ${isEdit ? 'Update Details' : 'Create Customer'}</button>
  `;

  openModal({
    title: isEdit ? 'Modify Customer Profile' : 'Add New Customer Account', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#c-save-btn').addEventListener('click', async () => {
        const name = backdrop.querySelector('#c-name').value.trim();
        const phone = backdrop.querySelector('#c-phone').value.trim();
        const address = backdrop.querySelector('#c-address').value.trim();

        if (!name) {
          toast.error('Validation Error', 'Customer Name is required.');
          return;
        }

        const data = { name, phone, address };

        if (isEdit) {
          await db.customers.update(customer.id, data);
          toast.success('Updated', `Customer ${name} profile updated.`);
        } else {
          const bal = parseFloat(backdrop.querySelector('#c-balance').value) || 0;
          data.current_balance = bal;
          data.shop_id = 1;
          data.created_at = new Date().toISOString();
          const newId = await db.customers.add(data);

          if (bal > 0) {
            await db.customer_transactions.add({
              shop_id: 1,
              customer_id: newId,
              sale_id: null,
              amount: bal,
              transaction_type: 'CREDIT',
              timestamp: new Date().toISOString()
            });
          }

          toast.success('Customer Created', `${name} account created.`);
        }

        closeModal();
        await loadAndRenderCustomers(pageContainer);
      });

      if (isEdit) {
        backdrop.querySelector('#c-delete-btn').addEventListener('click', () => {
          closeModal();
          showConfirm(`Permanently delete account for "${customer.name}"? This removes transaction histories.`, async () => {
            await db.customers.delete(customer.id);
            await db.customer_transactions.where('customer_id').equals(customer.id).delete();
            toast.success('Deleted', 'Customer account deleted.');
            await loadAndRenderCustomers(pageContainer);
          });
        });
      }
    }
  });
}

// ── Customer Ledger Statement Export ──────────────────────────
async function exportCustomerStatementCSV(customer) {
  const transactions = await db.customer_transactions.where('customer_id').equals(customer.id).toArray();
  const sales = await db.sales.toArray();
  const saleMap = {};
  sales.forEach(s => { saleMap[s.id] = s.invoice_no; });

  transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const rows = [
    ['Date', 'Time', 'Reference', 'Type', 'Amount'],
    ...transactions.map(t => [
      fmtDate(t.timestamp),
      fmtTime(t.timestamp),
      t.sale_id ? `Invoice ${saleMap[t.sale_id] || t.sale_id}` : 'Opening Balance / Payment',
      t.transaction_type,
      t.amount
    ])
  ];

  downloadCSV(rows, `${customer.name.replace(/\s+/g, '_')}_statement.csv`);
  toast.success('Statement Exported', 'CSV downloaded.');
}
