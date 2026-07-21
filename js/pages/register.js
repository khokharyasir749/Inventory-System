/**
 * register.js — Cash Register Sessions
 * Day start, day end cash reconciliation, expected cash calculations
 */

async function getActiveSession() {
  return await db.cash_sessions.where('status').equals('OPEN').first();
}

async function renderRegister(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Cash Register</h1>
        <p>Manage cash drawer sessions and day reconciliation</p>
      </div>
    </div>
    <div id="register-container" class="animate-fade-in">
      <div class="section-card">
        <div class="skeleton" style="height:180px"></div>
      </div>
    </div>
  `;

  await refreshRegisterView(container);
}

async function refreshRegisterView(container) {
  const regContainer = container.querySelector('#register-container');
  if (!regContainer) return;

  const active = await getActiveSession();
  const pastSessions = await db.cash_sessions.orderBy('opened_at').reverse().toArray();

  if (active) {
    // Session is open
    const [cashSales, customerPayments, creditSalesPartials] = await Promise.all([
      db.sales
        .where('timestamp').aboveOrEqual(active.opened_at)
        .and(s => s.payment_method === 'Cash' && s.session_id === active.id)
        .toArray(),
      db.customer_transactions
        .where('timestamp').aboveOrEqual(active.opened_at)
        .and(t => t.transaction_type === 'PAYMENT')
        .toArray(),
      db.sales
        .where('timestamp').aboveOrEqual(active.opened_at)
        .and(s => s.payment_method === 'Credit' && s.session_id === active.id)
        .toArray()
    ]);

    const cashSalesTotal = cashSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const custPayTotal   = customerPayments.reduce((sum, t) => sum + (t.amount || 0), 0);
    const creditCashTotal= creditSalesPartials.reduce((sum, s) => sum + (s.cash_received || 0), 0);

    const expectedCash = active.opening_cash + cashSalesTotal + custPayTotal + creditCashTotal;

    // Update session expected cash cache
    await db.cash_sessions.update(active.id, { expected_cash: expectedCash });

    regContainer.innerHTML = `
      <div class="grid-2">
        <!-- Active Session Card -->
        <div class="section-card" style="border-color:var(--primary)">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-check-circle', 'text-green')} Session Open</span>
            <span class="badge badge-green">Active Since ${fmtTime(active.opened_at)}</span>
          </div>
          
          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
              <div>
                <div class="text-sm text-secondary">Opened At</div>
                <div class="font-semibold text-base">${fmtDateTime(active.opened_at)}</div>
              </div>
              <div>
                <div class="text-sm text-secondary">Opening Cash</div>
                <div class="font-bold text-base mono">${fmt(active.opening_cash)}</div>
              </div>
            </div>

            <div class="divider" style="margin:var(--space-2) 0"></div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-2)">
              <div>
                <div class="text-xs text-secondary">POS Cash Sales</div>
                <div class="font-semibold text-sm text-teal mono">+ ${fmt(cashSalesTotal + creditCashTotal)}</div>
              </div>
              <div>
                <div class="text-xs text-secondary">Ledger Payoffs</div>
                <div class="font-semibold text-sm text-green mono">+ ${fmt(custPayTotal)}</div>
              </div>
              <div>
                <div class="text-xs text-secondary">Expected Drawer</div>
                <div class="font-bold text-lg text-primary mono">${fmt(expectedCash)}</div>
              </div>
            </div>

            <div class="divider" style="margin:var(--space-2) 0"></div>

            <!-- Close Session Form -->
            <div class="form-group" style="margin-top:var(--space-2)">
              <label class="form-label">Actual Cash in Drawer <span class="required">*</span></label>
              <div class="input-group">
                <span class="input-prefix">Rs.</span>
                <input type="number" class="form-input" id="close-actual-cash" placeholder="Enter counted cash in drawer" min="0" step="0.5" style="font-size:1.1rem;font-weight:700">
              </div>
            </div>

            <button class="btn btn-danger w-full" id="close-session-btn" style="margin-top:var(--space-2)">
              ${icon('icon-close')} Reconcile & Close Register
            </button>
          </div>
        </div>

        <!-- Past Sessions Summary -->
        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-clock')} Session Logs</span>
          </div>
          <div class="table-scroll" style="max-height:360px">
            <table>
              <thead>
                <tr>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Opening</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                ${pastSessions.filter(s => s.status === 'CLOSED').slice(0, 10).map(s => {
                  const diffColor = s.difference < 0 ? 'color:var(--danger)' : s.difference > 0 ? 'color:var(--alert)' : '';
                  const diffSign = s.difference > 0 ? '+' : '';
                  return `
                    <tr>
                      <td class="text-xs">${fmtDateTime(s.opened_at)}</td>
                      <td class="text-xs">${fmtDateTime(s.closed_at)}</td>
                      <td class="mono text-xs">${fmt(s.opening_cash)}</td>
                      <td class="mono text-xs">${fmt(s.expected_cash)}</td>
                      <td class="mono text-xs">${fmt(s.actual_cash)}</td>
                      <td class="mono text-xs font-bold" style="${diffColor}">${diffSign}${fmt(s.difference)}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    regContainer.querySelector('#close-session-btn').addEventListener('click', async () => {
      const actualVal = parseFloat(regContainer.querySelector('#close-actual-cash').value);
      if (isNaN(actualVal)) {
        toast.error('Error', 'Please enter actual drawer cash to close register.');
        return;
      }

      showConfirm('Are you sure you want to close this register session?', async () => {
        const difference = actualVal - expectedCash;
        await db.cash_sessions.update(active.id, {
          closed_at: new Date().toISOString(),
          actual_cash: actualVal,
          difference: difference,
          status: 'CLOSED'
        });

        toast.success('Register Closed', `Reconciliation complete. Difference: ${fmt(difference)}`);
        await refreshRegisterView(container);
      });
    });

  } else {
    // Session is closed
    regContainer.innerHTML = `
      <div class="grid-2">
        <div class="section-card" style="border-color:var(--border)">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-alert', 'text-amber')} Register Closed</span>
            <span class="badge badge-amber">Offline Drawer</span>
          </div>

          <p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">
            You must open a cash register session to accept POS sales. This helps track opening/closing cash balances and cash drawer discrepancies.
          </p>

          <div class="form-group" style="margin-bottom:var(--space-4)">
            <label class="form-label">Opening Cash Balance <span class="required">*</span></label>
            <div class="input-group">
              <span class="input-prefix">Rs.</span>
              <input type="number" class="form-input" id="open-opening-cash" value="5000" min="0" step="1" style="font-size:1.1rem;font-weight:700">
            </div>
            <div class="form-hint">Standard starting float amount in cash drawer.</div>
          </div>

          <button class="btn btn-primary w-full" id="open-session-btn">
            ${icon('icon-check')} Open Session & Start Day
          </button>
        </div>

        <!-- History Summary -->
        <div class="section-card">
          <div class="section-card-header">
            <span class="section-card-title">${icon('icon-clock')} Session Logs</span>
          </div>
          <div class="table-scroll" style="max-height:360px">
            <table>
              <thead>
                <tr>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Opening</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                ${pastSessions.slice(0, 10).map(s => {
                  const diffColor = s.difference < 0 ? 'color:var(--danger)' : s.difference > 0 ? 'color:var(--alert)' : '';
                  const diffSign = s.difference > 0 ? '+' : '';
                  return `
                    <tr>
                      <td class="text-xs">${fmtDateTime(s.opened_at)}</td>
                      <td class="text-xs">${s.closed_at ? fmtDateTime(s.closed_at) : '—'}</td>
                      <td class="mono text-xs">${fmt(s.opening_cash)}</td>
                      <td class="mono text-xs">${fmt(s.expected_cash)}</td>
                      <td class="mono text-xs">${s.closed_at ? fmt(s.actual_cash) : '—'}</td>
                      <td class="mono text-xs font-bold" style="${diffColor}">${s.closed_at ? `${diffSign}${fmt(s.difference)}` : '—'}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    regContainer.querySelector('#open-session-btn').addEventListener('click', async () => {
      const opening = parseFloat(regContainer.querySelector('#open-opening-cash').value) || 0;
      await db.cash_sessions.add({
        shop_id: 1,
        opened_at: new Date().toISOString(),
        closed_at: null,
        opening_cash: opening,
        expected_cash: opening,
        actual_cash: 0,
        difference: 0,
        status: 'OPEN'
      });

      toast.success('Register Opened', `Session started with ${fmt(opening)} cash float.`);
      await refreshRegisterView(container);
    });
  }
}
