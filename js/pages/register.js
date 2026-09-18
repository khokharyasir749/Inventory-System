/**
 * register.js — Cash Register, Cash Float & Reconciliation Engine
 * Features:
 * 1. Drawer opening float management & active session state
 * 2. Cash In / Cash Out manual drawer adjustments (petty cash, float top-up, vendor payouts)
 * 3. Real-time Expected Cash Calculation: Opening + POS Cash + Customer Payoffs + Cash In - Cash Out
 * 4. End-of-Day Reconciliation Card with interactive Denomination Counter & discrepancy detection
 * 5. Historical session audit logs with Slate theme badges and variance tracking
 */

async function getActiveSession() {
  return await db.cash_sessions.where('status').equals('OPEN').first();
}

async function renderRegister(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Cash Register & Float</h1>
        <p>Drawer shift management, petty cash adjustments, and end-of-day reconciliation</p>
      </div>
    </div>
    <div id="register-container" class="animate-fade-in">
      <div class="section-card">
        <div class="skeleton" style="height:200px"></div>
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
    // Session is OPEN: calculate sales & adjustments
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
    const custPayTotal = customerPayments.reduce((sum, t) => sum + (t.amount || 0), 0);
    const creditCashTotal = creditSalesPartials.reduce((sum, s) => sum + (s.cash_received || 0), 0);

    const adjustments = Array.isArray(active.adjustments) ? active.adjustments : [];
    const cashInTotal = adjustments.filter(a => a.type === 'IN').reduce((sum, a) => sum + (a.amount || 0), 0);
    const cashOutTotal = adjustments.filter(a => a.type === 'OUT').reduce((sum, a) => sum + (a.amount || 0), 0);

    const expectedCash = active.opening_cash + cashSalesTotal + custPayTotal + creditCashTotal + cashInTotal - cashOutTotal;

    // Cache expected cash in active session record
    await db.cash_sessions.update(active.id, {
      expected_cash: expectedCash,
      cash_in_total: cashInTotal,
      cash_out_total: cashOutTotal
    });

    regContainer.innerHTML = `
      <!-- Active Drawer KPI Cards -->
      <div class="grid-4" style="margin-bottom:var(--space-4)">
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">Opening Float</span>
            ${icon('icon-cash', 'text-secondary')}
          </div>
          <div class="kpi-card-body">
            <div class="kpi-value mono">${fmt(active.opening_cash)}</div>
            <div class="kpi-label">Started @ ${fmtTime(active.opened_at)}</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">POS Cash Inflow</span>
            ${icon('icon-trending-up', 'text-green')}
          </div>
          <div class="kpi-card-body">
            <div class="kpi-value mono text-green">+ ${fmt(cashSalesTotal + creditCashTotal + custPayTotal)}</div>
            <div class="kpi-label">${cashSales.length} cash orders settled</div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">Manual Float Adj.</span>
            ${icon('icon-edit', 'text-indigo')}
          </div>
          <div class="kpi-card-body">
            <div class="kpi-value mono ${cashInTotal >= cashOutTotal ? 'text-indigo' : 'text-red'}">
              ${cashInTotal >= cashOutTotal ? '+' : '−'} ${fmt(Math.abs(cashInTotal - cashOutTotal))}
            </div>
            <div class="kpi-label">+${fmt(cashInTotal)} In / −${fmt(cashOutTotal)} Out</div>
          </div>
        </div>

        <div class="kpi-card" style="border-color:var(--primary);background:var(--primary-muted)">
          <div class="kpi-card-header">
            <span class="kpi-card-title" style="color:var(--primary);font-weight:700">Expected Drawer</span>
            ${icon('icon-check-circle', 'text-primary')}
          </div>
          <div class="kpi-card-body">
            <div class="kpi-value mono text-primary" id="reg-expected-cash">${fmt(expectedCash)}</div>
            <div class="kpi-label" style="color:var(--primary);font-weight:600">Live Calculated Total</div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Drawer Actions & Manual Adjustments -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-check-circle', 'text-green')} Active Drawer Session</span>
            <span class="badge badge-green">Open Since ${fmtDateTime(active.opened_at)}</span>
          </div>

          <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4)">
            <button class="btn btn-ghost btn-sm" id="btn-cash-in" style="flex:1;border-color:var(--stock-in);color:var(--stock-in)">
              ${icon('icon-plus')} Cash In (Float Add)
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-cash-out" style="flex:1;border-color:var(--danger);color:var(--danger)">
              ${icon('icon-close')} Cash Out (Petty / Expense)
            </button>
          </div>

          <!-- Adjustments List -->
          <div style="margin-bottom:var(--space-4)">
            <div class="text-xs text-secondary font-semibold" style="margin-bottom:var(--space-2);text-transform:uppercase;letter-spacing:0.05em">Shift Adjustments Log</div>
            ${adjustments.length === 0
        ? `<div class="text-xs text-muted" style="padding:var(--space-3);background:var(--surface-raised);border-radius:var(--radius-md);text-align:center">No manual float adjustments during this shift.</div>`
        : `<div class="table-scroll" style="max-height:160px">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Reason / Notes</th>
                        <th style="text-align:right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${adjustments.slice().reverse().map(a => `
                        <tr>
                          <td class="text-xs mono">${fmtTime(a.timestamp)}</td>
                          <td><span class="badge ${a.type === 'IN' ? 'badge-green' : 'badge-red'}">${a.type === 'IN' ? 'Cash In' : 'Cash Out'}</span></td>
                          <td class="text-xs truncate" style="max-width:140px">${a.reason || '—'}</td>
                          <td class="mono font-bold text-xs" style="text-align:right;color:${a.type === 'IN' ? 'var(--stock-in)' : 'var(--danger)'}">
                            ${a.type === 'IN' ? '+' : '−'} ${fmt(a.amount)}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>`
      }
          </div>

          <!-- End of Day Reconciliation Trigger -->
          <div style="border-top:1px solid var(--border-soft);padding-top:var(--space-3)">
            <button class="btn btn-danger w-full" id="btn-open-reconciliation">
              ${icon('icon-check')} End of Day Reconciliation & Close Shift
            </button>
          </div>
        </div>

        <!-- Historical Session Logs -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-clock')} Session History & Variances</span>
          </div>

          <div class="table-scroll" style="max-height:360px">
            <table>
              <thead>
                <tr>
                  <th>Shift Opened</th>
                  <th>Shift Closed</th>
                  <th>Opening</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                ${pastSessions.filter(s => s.status === 'CLOSED').slice(0, 12).map(s => {
        let varianceBadge = `<span class="badge badge-green">Exact Match</span>`;
        if (s.difference < 0) {
          varianceBadge = `<span class="badge badge-red">Short ${fmt(Math.abs(s.difference))}</span>`;
        } else if (s.difference > 0) {
          varianceBadge = `<span class="badge badge-amber">Over +${fmt(s.difference)}</span>`;
        }

        return `
                    <tr>
                      <td class="text-xs">${fmtDateTime(s.opened_at)}</td>
                      <td class="text-xs">${s.closed_at ? fmtDateTime(s.closed_at) : '—'}</td>
                      <td class="mono text-xs">${fmt(s.opening_cash)}</td>
                      <td class="mono text-xs">${fmt(s.expected_cash)}</td>
                      <td class="mono text-xs font-semibold">${fmt(s.actual_cash)}</td>
                      <td>${varianceBadge}</td>
                    </tr>
                  `;
      }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Cash In Click
    regContainer.querySelector('#btn-cash-in').addEventListener('click', () => {
      showCashAdjustmentModal(active, 'IN', container);
    });

    // Cash Out Click
    regContainer.querySelector('#btn-cash-out').addEventListener('click', () => {
      showCashAdjustmentModal(active, 'OUT', container);
    });

    // End of Day Reconciliation Click
    regContainer.querySelector('#btn-open-reconciliation').addEventListener('click', () => {
      showReconciliationModal(active, expectedCash, container);
    });

  } else {
    // Session is CLOSED: Show Drawer Start Floating Card
    regContainer.innerHTML = `
      <div class="grid-2">
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-alert', 'text-amber')} Cash Drawer Offline</span>
            <span class="badge badge-amber">Shift Closed</span>
          </div>

          <p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">
            Start a new register shift to accept cash payments at checkout. Setting an initial float balance helps track end-of-day cash variances accurately.
          </p>

          <div class="form-group" style="margin-bottom:var(--space-4)">
            <label class="form-label" for="open-opening-cash">Opening Float Amount <span class="required">*</span></label>
            <div class="input-group">
              <span class="input-prefix">Rs.</span>
              <input type="number" class="form-input" id="open-opening-cash" value="5000" min="0" step="1" style="font-size:1.15rem;font-weight:700">
            </div>
            <div class="form-hint">Typical starting cash float in register drawer (change notes and coins).</div>
          </div>

          <button class="btn btn-primary w-full" id="open-session-btn" style="height:44px;font-size:0.95rem">
            ${icon('icon-check')} Open Register & Start Shift
          </button>
        </div>

        <!-- History Summary -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-clock')} Past Shifts & Reconciliation</span>
          </div>

          <div class="table-scroll" style="max-height:360px">
            <table>
              <thead>
                <tr>
                  <th>Shift Opened</th>
                  <th>Shift Closed</th>
                  <th>Opening</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                ${pastSessions.slice(0, 10).map(s => {
      let varianceBadge = `<span class="badge badge-green">Exact</span>`;
      if (s.difference < 0) {
        varianceBadge = `<span class="badge badge-red">Short ${fmt(Math.abs(s.difference))}</span>`;
      } else if (s.difference > 0) {
        varianceBadge = `<span class="badge badge-amber">Over +${fmt(s.difference)}</span>`;
      }

      return `
                    <tr>
                      <td class="text-xs">${fmtDateTime(s.opened_at)}</td>
                      <td class="text-xs">${s.closed_at ? fmtDateTime(s.closed_at) : '—'}</td>
                      <td class="mono text-xs">${fmt(s.opening_cash)}</td>
                      <td class="mono text-xs">${fmt(s.expected_cash)}</td>
                      <td class="mono text-xs font-semibold">${s.closed_at ? fmt(s.actual_cash) : '—'}</td>
                      <td>${s.closed_at ? varianceBadge : '—'}</td>
                    </tr>
                  `;
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
        adjustments: [],
        status: 'OPEN'
      });

      toast.success('Register Opened', `Shift started with ${fmt(opening)} cash float.`);
      await refreshRegisterView(container);
    });
  }
}

// ── Cash In / Cash Out Adjustment Modal ─────────────────────────
function showCashAdjustmentModal(activeSession, type, pageContainer) {
  const isCashIn = type === 'IN';

  const bodyHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div style="background:${isCashIn ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'};border:1px solid ${isCashIn ? 'var(--stock-in)' : 'var(--danger)'};border-radius:var(--radius-md);padding:var(--space-3)">
        <div class="font-bold text-sm" style="color:${isCashIn ? 'var(--stock-in)' : 'var(--danger)'}">
          ${isCashIn ? 'Cash In (Add Cash Float)' : 'Cash Out (Petty Cash / Vendor Payout)'}
        </div>
        <div class="text-xs text-secondary" style="margin-top:2px">
          ${isCashIn ? 'Add change float or cash injection into the active register drawer.' : 'Record drawer cash withdrawn for supplier payments, refreshments, or petty expenses.'}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="adj-amount">Adjustment Amount <span class="required">*</span></label>
        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input type="number" class="form-input" id="adj-amount" placeholder="0.00" min="0.5" step="0.5" autofocus style="font-size:1.15rem;font-weight:700">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="adj-reason">Reason / Description <span class="required">*</span></label>
        <input type="text" class="form-input" id="adj-reason" placeholder="${isCashIn ? 'e.g. Additional change float, owner cash deposit' : 'e.g. Bread vendor delivery payment, cleaning supplies'}" required>
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn ${isCashIn ? 'btn-success' : 'btn-danger'}" id="adj-submit-btn">
      ${icon('icon-check')} Record ${isCashIn ? 'Cash In' : 'Cash Out'}
    </button>
  `;

  openModal({
    title: isCashIn ? 'Drawer Adjustment: Cash In' : 'Drawer Adjustment: Cash Out',
    bodyHTML,
    footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#adj-submit-btn').addEventListener('click', async () => {
        const amt = parseFloat(backdrop.querySelector('#adj-amount').value);
        const reason = backdrop.querySelector('#adj-reason').value.trim();

        if (isNaN(amt) || amt <= 0) {
          toast.error('Validation Error', 'Enter a valid adjustment amount greater than zero.');
          return;
        }
        if (!reason) {
          toast.error('Validation Error', 'A reason is required for audit logs.');
          return;
        }

        const adjustments = Array.isArray(activeSession.adjustments) ? activeSession.adjustments : [];
        adjustments.push({
          type,
          amount: amt,
          reason,
          timestamp: new Date().toISOString()
        });

        await db.cash_sessions.update(activeSession.id, { adjustments });

        // Record audit log
        await db.logs.add({
          shop_id: 1,
          item_id: null,
          change_type: isCashIn ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          qty_changed: amt,
          timestamp: new Date().toISOString(),
          sync_status: 'SYNCED',
          notes: `Register ${type}: ${reason}`
        });

        closeModal();
        toast.success('Adjustment Recorded', `${isCashIn ? 'Cash In' : 'Cash Out'} of ${fmt(amt)} applied to active drawer.`);
        await refreshRegisterView(pageContainer);
      });
    }
  });
}

// ── End of Day Reconciliation Modal ────────────────────────────
function showReconciliationModal(activeSession, expectedCash, pageContainer) {
  const denominations = [5000, 1000, 500, 100, 50, 20, 10];

  const bodyHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface-raised);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--border-soft)">
        <div>
          <div class="text-xs text-secondary">System Calculated Expected Cash</div>
          <div class="font-bold text-lg text-primary mono">${fmt(expectedCash)}</div>
        </div>
        <div style="text-align:right">
          <div class="text-xs text-secondary">Shift Duration</div>
          <div class="font-semibold text-xs">${fmtTime(activeSession.opened_at)} – Now</div>
        </div>
      </div>

      <!-- Denomination Assistant Toggle -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <label class="form-label" style="margin-bottom:0">Actual Counted Cash <span class="required">*</span></label>
          <button type="button" class="btn btn-ghost btn-xs" id="toggle-denom-btn">
            ${icon('icon-calculator')} Use Denomination Counter
          </button>
        </div>

        <div class="input-group">
          <span class="input-prefix">Rs.</span>
          <input type="number" class="form-input" id="recon-actual-cash" placeholder="Enter counted cash in drawer" min="0" step="0.5" style="font-size:1.25rem;font-weight:700">
        </div>
      </div>

      <!-- Denomination Inputs Grid (Initially Hidden) -->
      <div id="denom-wrap" style="display:none;background:var(--surface-raised);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--border)">
        <div class="text-xs font-semibold text-secondary" style="margin-bottom:var(--space-2)">Denomination Counter:</div>
        <div class="denom-grid">
          ${denominations.map(d => `
            <div class="denom-card">
              <div class="denom-label">Rs. ${d}</div>
              <input type="number" class="denom-input" data-denom="${d}" min="0" placeholder="0">
            </div>
          `).join('')}
          <div class="denom-card">
            <div class="denom-label">Coins / Misc</div>
            <input type="number" class="denom-input" id="denom-coins" min="0" placeholder="0">
          </div>
        </div>
      </div>

      <!-- Live Variance Status Indicator -->
      <div id="recon-diff-box" style="padding:var(--space-3);border-radius:var(--radius-md);background:var(--surface-raised);border:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center">
        <span class="text-xs font-semibold text-secondary">Calculated Discrepancy:</span>
        <span class="mono font-bold text-sm" id="recon-diff-val">—</span>
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" id="recon-submit-btn">
      ${icon('icon-close')} Reconcile & Close Register
    </button>
  `;

  openModal({
    title: 'End of Day Drawer Reconciliation',
    bodyHTML,
    footerHTML,
    size: 'modal-lg',
    onOpen: (backdrop) => {
      const actualInp = backdrop.querySelector('#recon-actual-cash');
      const diffBox = backdrop.querySelector('#recon-diff-box');
      const diffVal = backdrop.querySelector('#recon-diff-val');
      const denomWrap = backdrop.querySelector('#denom-wrap');
      const toggleDenomBtn = backdrop.querySelector('#toggle-denom-btn');

      function updateDiff() {
        const actual = parseFloat(actualInp.value);
        if (isNaN(actual)) {
          diffVal.textContent = '—';
          diffVal.style.color = '';
          return;
        }

        const diff = actual - expectedCash;
        if (diff === 0) {
          diffVal.innerHTML = `<span class="badge badge-green">Exact Match (0.00)</span>`;
          diffBox.style.borderColor = 'var(--stock-in)';
        } else if (diff > 0) {
          diffVal.innerHTML = `<span class="badge badge-amber">Surplus: +${fmt(diff)}</span>`;
          diffBox.style.borderColor = 'var(--primary)';
        } else {
          diffVal.innerHTML = `<span class="badge badge-red">Shortage: −${fmt(Math.abs(diff))}</span>`;
          diffBox.style.borderColor = 'var(--danger)';
        }
      }

      actualInp.addEventListener('input', updateDiff);

      // Denomination Calculator logic
      toggleDenomBtn.addEventListener('click', () => {
        const isHidden = denomWrap.style.display === 'none';
        denomWrap.style.display = isHidden ? 'block' : 'none';
        toggleDenomBtn.textContent = isHidden ? 'Hide Denomination Counter' : 'Use Denomination Counter';
      });

      const denomInputs = backdrop.querySelectorAll('.denom-input');
      denomInputs.forEach(inp => {
        inp.addEventListener('input', () => {
          let sum = 0;
          denomInputs.forEach(i => {
            const count = parseFloat(i.value) || 0;
            if (i.id === 'denom-coins') {
              sum += count;
            } else {
              const d = parseFloat(i.dataset.denom) || 0;
              sum += (count * d);
            }
          });
          actualInp.value = sum;
          updateDiff();
        });
      });

      // Submit Reconciliation
      backdrop.querySelector('#recon-submit-btn').addEventListener('click', async () => {
        const actual = parseFloat(actualInp.value);
        if (isNaN(actual)) {
          toast.error('Error', 'Please enter counted cash in drawer.');
          return;
        }

        const difference = actual - expectedCash;

        await db.cash_sessions.update(activeSession.id, {
          closed_at: new Date().toISOString(),
          actual_cash: actual,
          difference: difference,
          status: 'CLOSED'
        });

        closeModal();
        toast.success('Register Closed', `Day reconciliation complete. Variance: ${difference >= 0 ? '+' : ''}${fmt(difference)}`);
        await refreshRegisterView(pageContainer);
      });
    }
  });
}
