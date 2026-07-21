/**
 * customers.js — Customer Management & Credit Ledger
 * CRUD, balance tracking, transactions, record payments, ledger statements
 */

let customersList    = [];
let customerSearch   = '';
let customerPage     = 1;
const CUSTOMERS_PER_PAGE = 30;

let selectedCustomerForLedger = null;

async function renderCustomers(container) {
  selectedCustomerForLedger = null; // reset

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Customers & Credits</h1>
        <p>Manage customer ledger accounts, credit balances, and payments</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary btn-sm" id="customer-add-btn">${icon('icon-plus')} Add Customer</button>
      </div>
    </div>

    <div id="customers-view-outlet" class="animate-fade-in">
      <!-- Search & Filters -->
      <div class="filter-bar">
        <div class="filter-search-wrap" style="max-width:320px;flex:1">
          ${icon('icon-search', 'filter-search-icon')}
          <input type="text" class="filter-search" id="customer-search" placeholder="Search by name or phone...">
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

  // Sort by name
  filtered.sort((a, b) => a.name.localeCompare(b.name));

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
              <th>Phone</th>
              <th>Address</th>
              <th>Outstanding Balance</th>
              <th>Account Since</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${page.map(c => `
              <tr>
                <td class="font-semibold">${c.name}</td>
                <td>${c.phone || '—'}</td>
                <td class="text-sm text-secondary truncate" style="max-width:200px" title="${c.address || ''}">${c.address || '—'}</td>
                <td class="mono font-bold ${c.current_balance > 0 ? 'text-red' : 'text-green'}">
                  ${fmt(c.current_balance)}
                </td>
                <td class="text-sm text-muted">${fmtDate(c.created_at)}</td>
                <td class="table-actions">
                  <button class="btn btn-ghost btn-sm btn-icon" data-view-ledger="${c.id}" title="Ledger Statement">
                    ${icon('icon-eye')}
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-edit-c="${c.id}" title="Edit profile">
                    ${icon('icon-edit')}
                  </button>
                </td>
              </tr>`).join('')}
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
  tableContainer.querySelector('#c-prev')?.addEventListener('click', async () => { if (customerPage > 1) { customerPage--; renderCustomersListTable(container); }});
  tableContainer.querySelector('#c-next')?.addEventListener('click', async () => { if (customerPage < totalPages) { customerPage++; renderCustomersListTable(container); }});
  
  tableContainer.querySelectorAll('[data-view-ledger]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cId = parseInt(btn.dataset.viewLedger);
      const c = customersList.find(x => x.id === cId);
      if (c) renderCustomerLedgerView(container, c);
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

// ── Customer Ledger statement View ────────────────────────────
async function renderCustomerLedgerView(container, customer) {
  selectedCustomerForLedger = customer;
  
  const outlet = container.querySelector('#customers-view-outlet');
  if (!outlet) return;

  outlet.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-4)">
      <button class="btn btn-ghost btn-sm" id="ledger-back-btn">
        ${icon('icon-chevron-left')} Back to Customers
      </button>
      <button class="btn btn-ghost btn-sm" id="ledger-export-btn" style="margin-left:auto">
        ${icon('icon-download')} Export Statement CSV
      </button>
      <button class="btn btn-success btn-sm" id="ledger-pay-btn">
        ${icon('icon-dollar')} Record Payment / Payoff
      </button>
    </div>

    <div class="grid-3" style="margin-bottom:var(--space-5)">
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-red" id="ledger-kpi-bal">${fmt(customer.current_balance)}</div>
          <div class="kpi-label">Outstanding Balance</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-teal" id="ledger-kpi-sales">Rs. 0</div>
          <div class="kpi-label">Total Credit Sales</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-green" id="ledger-kpi-paid">Rs. 0</div>
          <div class="kpi-label">Total Payments Received</div>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">Ledger Transaction Statement — ${customer.name}</span>
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

  // Sort transactions by date descending
  transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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

  if (transactions.length === 0) {
    tableWrap.innerHTML = `<p class="text-sm text-secondary" style="padding:var(--space-4);text-align:center">No transaction ledger events found for this customer.</p>`;
    return;
  }

  tableWrap.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Reference / Sale</th>
            <th>Type</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => {
            const isCredit = t.transaction_type === 'CREDIT';
            const badge = isCredit
              ? `<span class="badge badge-amber">Credit Sale</span>`
              : `<span class="badge badge-green">Payment Received</span>`;
            return `
              <tr>
                <td class="mono text-xs">${fmtDateTime(t.timestamp)}</td>
                <td>${t.sale_id ? `Invoice: ${saleMap[t.sale_id] || t.sale_id}` : 'Direct Receipt / Adjustment'}</td>
                <td>${badge}</td>
                <td class="mono font-bold ${isCredit ? 'text-indigo' : 'text-green'}">
                  ${isCredit ? '+' : '−'} ${fmt(t.amount)}
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
  const bodyHTML = `
    <div style="background:var(--canvas);padding:var(--space-3);border-radius:var(--radius-md);margin-bottom:var(--space-4)">
      <div class="text-sm text-secondary">Outstanding Balance for <strong>${customer.name}</strong></div>
      <div class="font-bold text-xl text-red mono">${fmt(customer.current_balance)}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Payment Amount <span class="required">*</span></label>
      <div class="input-group">
        <span class="input-prefix">Rs.</span>
        <input type="number" class="form-input" id="pay-amount" placeholder="e.g. 1000" min="0.01" step="0.5" style="font-size:1.1rem;font-weight:700">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Payment Notes / Remarks</label>
      <input type="text" class="form-input" id="pay-notes" placeholder="e.g. Cash payment received, check # etc.">
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-success" id="pay-submit-btn">${icon('icon-check')} Save Payment Receipt</button>
  `;

  openModal({ title: 'Record Customer Payment', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#pay-submit-btn').addEventListener('click', async () => {
        const amt = parseFloat(backdrop.querySelector('#pay-amount').value);
        if (isNaN(amt) || amt <= 0) {
          toast.error('Error', 'Please enter a valid payment amount greater than zero.');
          return;
        }

        // Check active cash session (since direct customer payment increases cash drawer)
        const activeSession = await getActiveSession();
        const sessionId = activeSession ? activeSession.id : null;

        // Record payment transaction
        await db.customer_transactions.add({
          shop_id: 1,
          customer_id: customer.id,
          sale_id: null,
          amount: amt,
          transaction_type: 'PAYMENT',
          timestamp: new Date().toISOString()
        });

        // Decrement balance
        const newBalance = Math.max(0, (customer.current_balance || 0) - amt);
        await db.customers.update(customer.id, { current_balance: newBalance });

        // Update active register session cache if session exists
        if (sessionId) {
          const session = await db.cash_sessions.get(sessionId);
          if (session) {
            const expected = (session.expected_cash || session.opening_cash) + amt;
            await db.cash_sessions.update(sessionId, { expected_cash: expected });
          }
        }

        closeModal();
        toast.success('Payment Recorded', `Successfully received ${fmt(amt)} from ${customer.name}`);
        
        // Refresh views
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
      <label class="form-label">Full Name <span class="required">*</span></label>
      <input class="form-input" id="c-name" value="${customer?.name || ''}" placeholder="e.g. Zahid Mahmood">
    </div>
    <div class="form-group">
      <label class="form-label">Phone Number</label>
      <input class="form-input" id="c-phone" value="${customer?.phone || ''}" placeholder="e.g. 03001234567">
    </div>
    <div class="form-group">
      <label class="form-label">Address</label>
      <textarea class="form-input" id="c-address" placeholder="Residential or commercial billing address...">${customer?.address || ''}</textarea>
    </div>
    ${!isEdit ? `
      <div class="form-group">
        <label class="form-label">Initial Credit Balance</label>
        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input type="number" class="form-input" id="c-balance" value="0" min="0" step="0.5">
        </div>
        <div class="form-hint">Set initial outstanding credit if importing old accounts.</div>
      </div>
    ` : ''}
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-ghost-danger" id="c-delete-btn">${icon('icon-trash')} Delete Account</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="c-save-btn">${icon('icon-check')} ${isEdit ? 'Update Details' : 'Create Customer'}</button>
  `;

  openModal({ title: isEdit ? 'Modify Customer Profile' : 'Add New Customer Account', bodyHTML, footerHTML,
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
