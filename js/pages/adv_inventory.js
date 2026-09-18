/**
 * adv_inventory.js — Advanced Inventory Features
 * Tabs: Expiry Alerts & Batches, Physical Counts, Stock Adjustments, Shop Transfers
 */

let activeAdvTab = 'expiry'; // 'expiry' | 'counts' | 'adjust' | 'transfers'

async function renderAdvInventory(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Advanced Inventory</h1>
        <p>Manage batches, physical counts, stock adjustments, and multi-branch transfers</p>
      </div>
      <div class="page-header-actions" id="adv-header-actions"></div>
    </div>

    <div class="tab-nav" style="margin-bottom:var(--space-4)">
      <button class="tab-btn active" data-atab="expiry">Expiry Alerts & Batches</button>
      <button class="tab-btn" data-atab="counts">Physical Stock Counts</button>
      <button class="tab-btn" data-atab="adjust">Stock Adjustments</button>
      <button class="tab-btn" data-atab="transfers">Inter-Shop Transfers</button>
    </div>

    <div id="adv-view-outlet" class="animate-fade-in">
      <div class="section-card">
        <div class="skeleton" style="height:250px"></div>
      </div>
    </div>
  `;

  // Bind tab switching
  container.querySelectorAll('[data-atab]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-atab]').forEach(b => b.classList.toggle('active', b === btn));
      activeAdvTab = btn.dataset.atab;
      renderActiveAdvTab(container);
    });
  });

  await loadAdvInventoryData(container);
}

async function loadAdvInventoryData(container) {
  renderActiveAdvTab(container);
}

async function renderActiveAdvTab(container) {
  const outlet = container.querySelector('#adv-view-outlet');
  const actionBtnWrap = container.querySelector('#adv-header-actions');
  if (!outlet) return;

  const now = new Date();
  const allItems = await db.items.toArray();
  const itemMap = {};
  allItems.forEach(i => { itemMap[i.id] = i; });

  if (activeAdvTab === 'expiry') {
    actionBtnWrap.innerHTML = `<button class="btn btn-primary btn-sm" id="batch-add-btn">${icon('icon-plus')} Add Batch</button>`;
    actionBtnWrap.querySelector('#batch-add-btn').addEventListener('click', () => showAddBatchModal(container));

    const batches = await db.batches.toArray();

    // Sort batches by expiry date
    batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

    // Expiry alerts classification
    const alerts = batches.map(b => {
      const exp = new Date(b.expiry_date);
      const diffDays = Math.ceil((exp - now) / 86400000);
      let alertClass = '';
      let statusText = '';

      if (diffDays <= 0) {
        alertClass = 'badge-red';
        statusText = 'Expired';
      } else if (diffDays <= 7) {
        alertClass = 'badge-red';
        statusText = `Expires in ${diffDays}d`;
      } else if (diffDays <= 30) {
        alertClass = 'badge-amber';
        statusText = `Expires in ${diffDays}d`;
      } else if (diffDays <= 90) {
        alertClass = 'badge-primary';
        statusText = `Expires in ${diffDays}d`;
      } else {
        alertClass = 'badge-gray';
        statusText = 'OK';
      }

      return { ...b, diffDays, alertClass, statusText };
    });

    const activeAlerts = alerts.filter(a => a.diffDays <= 90);

    outlet.innerHTML = `
      <div class="grid-3" style="margin-bottom:var(--space-5)">
        <div class="glass-metric-pill pill-danger">
          <div class="kpi-value text-red" style="font-size:2rem;">${alerts.filter(a => a.diffDays <= 7).length}</div>
          <div class="kpi-label" style="color:var(--danger)">Critical — Expiry ≤ 7 Days</div>
        </div>
        <div class="glass-metric-pill pill-warning">
          <div class="kpi-value text-amber" style="font-size:2rem;">${alerts.filter(a => a.diffDays > 7 && a.diffDays <= 30).length}</div>
          <div class="kpi-label" style="color:var(--alert)">Warning — Expiry ≤ 30 Days</div>
        </div>
        <div class="glass-metric-pill pill-primary">
          <div class="kpi-value text-primary" style="font-size:2rem;">${alerts.filter(a => a.diffDays > 30 && a.diffDays <= 90).length}</div>
          <div class="kpi-label">Attention — Expiry ≤ 90 Days</div>
        </div>
      </div>

      <div class="section-card" style="margin-bottom:var(--space-4)">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-alert', 'text-amber')} Expiry Alerts List</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch Number</th>
                <th>Expiry Date</th>
                <th>Batch Quantity</th>
                <th>Alert Status</th>
              </tr>
            </thead>
            <tbody>
              ${activeAlerts.length === 0
        ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:var(--space-4)">No batches expiring within 90 days.</td></tr>'
        : activeAlerts.map(a => {
          const it = itemMap[a.item_id];
          return `
                      <tr>
                        <td class="font-semibold">${it ? it.name : 'Unknown Item'}</td>
                        <td class="mono font-medium">${a.batch_number}</td>
                        <td class="mono text-sm">${fmtDate(a.expiry_date)}</td>
                        <td class="mono font-bold">${a.quantity} ${it ? it.unit : ''}</td>
                        <td><span class="badge ${a.alertClass}">${a.statusText}</span></td>
                      </tr>`;
        }).join('')
      }
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-package')} Total Batches In Stock</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch Number</th>
                <th>Expiry Date</th>
                <th>Batch Qty</th>
                <th>Added Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${batches.length === 0
        ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:var(--space-4)">No batch records registered yet.</td></tr>'
        : batches.map(b => {
          const it = itemMap[b.item_id];
          return `
                      <tr>
                        <td class="font-semibold">${it ? it.name : 'Unknown Item'}</td>
                        <td class="mono">${b.batch_number}</td>
                        <td class="mono">${fmtDate(b.expiry_date)}</td>
                        <td class="mono font-bold">${b.quantity} ${it ? it.unit : ''}</td>
                        <td class="text-sm text-secondary">${fmtDate(b.created_at)}</td>
                        <td>
                          <button class="btn btn-ghost btn-sm btn-icon" style="color:var(--danger)" data-delete-batch="${b.id}">
                            ${icon('icon-trash')}
                          </button>
                        </td>
                      </tr>`;
        }).join('')
      }
            </tbody>
          </table>
        </div>
      </div>
    `;

    outlet.querySelectorAll('[data-delete-batch]').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = parseInt(btn.dataset.deleteBatch);
        showConfirm('Are you sure you want to delete this batch record?', async () => {
          await db.batches.delete(bId);
          toast.success('Batch Deleted', 'Record removed.');
          await renderActiveAdvTab(container);
        });
      });
    });

  } else if (activeAdvTab === 'counts') {
    actionBtnWrap.innerHTML = `<button class="btn btn-primary btn-sm" id="count-create-btn">${icon('icon-plus')} Perform Stock Audit</button>`;
    actionBtnWrap.querySelector('#count-create-btn').addEventListener('click', () => showCountCreateModal(container));

    const counts = await db.inventory_counts.orderBy('date').reverse().toArray();

    if (counts.length === 0) {
      outlet.innerHTML = `
        <div class="empty-state">
          ${icon('icon-check-circle', 'empty-state-icon')}
          <h3>No Stock Audits Yet</h3>
          <p>Create a physical count audit to inspect discrepancies and update actual inventories.</p>
        </div>`;
      return;
    }

    outlet.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Date Opened</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${counts.map(c => {
      const isDraft = c.status === 'DRAFT';
      const badge = isDraft
        ? `<span class="badge badge-amber">Drafting Count</span>`
        : `<span class="badge badge-green">Completed</span>`;
      return `
                  <tr>
                    <td class="mono text-xs font-semibold">AUD-#${c.id}</td>
                    <td class="text-sm">${fmtDateTime(c.date)}</td>
                    <td>${badge}</td>
                    <td class="text-sm text-secondary">${c.notes || '—'}</td>
                    <td class="table-actions">
                      <button class="btn btn-ghost btn-sm" data-view-count="${c.id}">
                        ${icon(isDraft ? 'icon-edit' : 'icon-eye')} ${isDraft ? 'Resume' : 'View'}
                      </button>
                    </td>
                  </tr>`;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    outlet.querySelectorAll('[data-view-count]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cId = parseInt(btn.dataset.viewCount);
        const count = counts.find(x => x.id === cId);
        if (count) showCountDetailsModal(count, container);
      });
    });

  } else if (activeAdvTab === 'adjust') {
    actionBtnWrap.innerHTML = `<button class="btn btn-primary btn-sm" id="adjust-add-btn">${icon('icon-plus')} Log Stock Loss</button>`;
    actionBtnWrap.querySelector('#adjust-add-btn').addEventListener('click', () => showAddAdjustmentModal(container));

    const adjustments = await db.stock_adjustments.orderBy('timestamp').reverse().toArray();

    if (adjustments.length === 0) {
      outlet.innerHTML = `
        <div class="empty-state">
          ${icon('icon-trash', 'empty-state-icon')}
          <h3>No Stock Loss Logs</h3>
          <p>Record stock deductions due to Spoilage, Damage, Theft, or Expiry.</p>
        </div>`;
      return;
    }

    outlet.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Item</th>
                <th>Adjustment Qty</th>
                <th>Reason Type</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${adjustments.map(a => {
      const it = itemMap[a.item_id];
      const badge = {
        'DAMAGE': '<span class="badge badge-red">Damaged</span>',
        'SPOILAGE': '<span class="badge badge-amber">Spoiled</span>',
        'THEFT': '<span class="badge badge-dark">Theft / Shoplift</span>',
        'EXPIRED': '<span class="badge badge-red">Expired</span>'
      }[a.type] || '<span class="badge badge-gray">Adjusted</span>';

      return `
                  <tr>
                    <td class="mono text-xs">${fmtDateTime(a.timestamp)}</td>
                    <td class="font-semibold">${it ? it.name : 'Unknown Item'}</td>
                    <td class="mono font-bold text-red">− ${Math.abs(a.qty)} ${it ? it.unit : ''}</td>
                    <td>${badge}</td>
                    <td class="text-sm text-secondary">${a.notes || '—'}</td>
                  </tr>`;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

  } else if (activeAdvTab === 'transfers') {
    actionBtnWrap.innerHTML = `<button class="btn btn-primary btn-sm" id="transfer-create-btn">${icon('icon-plus')} Draft Stock Transfer</button>`;
    actionBtnWrap.querySelector('#transfer-create-btn').addEventListener('click', () => {
      toast.info('Feature Ready', 'Transfers are structured for multi-shop synchronization API.');
    });

    const transfers = await db.inventory_transfers.toArray();

    if (transfers.length === 0) {
      outlet.innerHTML = `
        <div class="empty-state">
          ${icon('icon-package', 'empty-state-icon')}
          <h3>No Branch Transfers</h3>
          <p>Transfers module prepared. Once connected online, you can transfer items between shops.</p>
        </div>`;
      return;
    }
  }
}

// ── Expiry Batch Add Modal ────────────────────────────────────
async function showAddBatchModal(pageContainer) {
  const allItems = await db.items.filter(it => !it.is_composite).toArray();

  const bodyHTML = `
    <div class="form-group">
      <label class="form-label">Product Item <span class="required">*</span></label>
      <select class="form-select" id="batch-item-select">
        <option value="">— Select Product —</option>
        ${allItems.map(it => `<option value="${it.id}">${it.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Batch Number / Lot <span class="required">*</span></label>
        <input class="form-input" id="batch-number" placeholder="e.g. B-901">
      </div>
      <div class="form-group">
        <label class="form-label">Expiry Date <span class="required">*</span></label>
        <input type="date" class="form-input" id="batch-expiry">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Batch Quantity <span class="required">*</span></label>
      <input type="number" class="form-input" id="batch-qty" placeholder="10" min="1" step="1">
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="batch-submit-btn">${icon('icon-check')} Save Batch Record</button>
  `;

  openModal({
    title: 'Add Product Batch', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#batch-submit-btn').addEventListener('click', async () => {
        const itemId = parseInt(backdrop.querySelector('#batch-item-select').value);
        const batchNum = backdrop.querySelector('#batch-number').value.trim();
        const expiry = backdrop.querySelector('#batch-expiry').value;
        const qty = parseFloat(backdrop.querySelector('#batch-qty').value) || 0;

        if (!itemId || !batchNum || !expiry || qty <= 0) {
          toast.error('Validation Error', 'Please complete all required fields.');
          return;
        }

        await db.batches.add({
          shop_id: 1,
          item_id: itemId,
          batch_number: batchNum,
          expiry_date: expiry,
          quantity: qty,
          created_at: new Date().toISOString()
        });

        closeModal();
        toast.success('Batch Saved', 'Batch details logged.');
        await renderActiveAdvTab(pageContainer);
      });
    }
  });
}

// ── Physical Count Create Modal ───────────────────────────────
async function showCountCreateModal(pageContainer) {
  const bodyHTML = `
    <div class="form-group">
      <label class="form-label">Auditor / Manager Notes</label>
      <input class="form-input" id="count-notes" placeholder="e.g. End of month physical inventory count">
    </div>
    <p class="text-sm text-secondary">Creating this audit sheet will capture all current stock values from the ledger. You can then enter the actual counted physical inventory levels.</p>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="count-start-btn">Start Count Sheet</button>
  `;

  openModal({
    title: 'Perform Stock Audit', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#count-start-btn').addEventListener('click', async () => {
        const notes = backdrop.querySelector('#count-notes').value.trim() || 'Physical inventory audit';
        const items = await db.items.filter(it => !it.is_composite).toArray();

        // Save count master
        const countId = await db.inventory_counts.add({
          shop_id: 1,
          date: new Date().toISOString(),
          status: 'DRAFT',
          notes: notes
        });

        // Save count items
        const countItems = items.map(it => ({
          shop_id: 1,
          count_id: countId,
          item_id: it.id,
          system_qty: it.stock_quantity || 0,
          physical_qty: it.stock_quantity || 0,
          difference: 0
        }));

        await db.inventory_count_items.bulkAdd(countItems);

        closeModal();
        toast.success('Audit Sheet Created', `AUD-#${countId} opened.`);

        // Show detail counts edit modal immediately
        const countObj = await db.inventory_counts.get(countId);
        showCountDetailsModal(countObj, pageContainer);
      });
    }
  });
}

// ── Audit sheet details & adjustment workflow ──────────────────
async function showCountDetailsModal(count, pageContainer) {
  const [countItems, allItems] = await Promise.all([
    db.inventory_count_items.where('count_id').equals(count.id).toArray(),
    db.items.toArray()
  ]);

  const itemMap = {};
  allItems.forEach(i => { itemMap[i.id] = i; });

  const isDraft = count.status === 'DRAFT';

  // Compute total discrepancy
  const calcTotals = () => {
    let diffs = 0;
    countItems.forEach(ci => { diffs += Math.abs(ci.physical_qty - ci.system_qty); });
    return diffs;
  };

  const bodyHTML = `
    <div style="background:var(--canvas);padding:var(--space-3);border-radius:var(--radius-md);margin-bottom:var(--space-4)">
      <div style="font-weight:700">Audit AUD-#${count.id} (${count.status})</div>
      <div class="text-xs text-secondary">Opened: ${fmtDateTime(count.date)} · ${count.notes || 'No description'}</div>
    </div>
    
    <div class="table-scroll" style="max-height:360px">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>System Qty</th>
            <th style="width:120px">Counted Qty</th>
            <th>Discrepancy</th>
          </tr>
        </thead>
        <tbody id="audit-items-tbody">
          ${countItems.map((ci, idx) => {
    const it = itemMap[ci.item_id];
    const diff = ci.physical_qty - ci.system_qty;
    const diffColor = diff < 0 ? 'color:var(--danger)' : diff > 0 ? 'color:var(--stock-in)' : '';
    return `
              <tr data-ci-id="${ci.id}">
                <td class="font-semibold">${it ? it.name : 'Unknown Item'}</td>
                <td class="mono">${ci.system_qty} ${it ? it.unit : ''}</td>
                <td>
                  <input type="number" class="form-input count-actual-input" data-idx="${idx}" value="${ci.physical_qty}" step="0.01" min="0" ${!isDraft ? 'readonly style="background:var(--canvas);cursor:not-allowed"' : ''}>
                </td>
                <td class="mono font-bold count-diff-cell" style="${diffColor}">
                  ${diff > 0 ? '+' : ''}${diff}
                </td>
              </tr>`;
  }).join('')}
        </tbody>
      </table>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    ${isDraft ? `
      <button class="btn btn-primary" id="audit-save-draft">Save Progress</button>
      <button class="btn btn-success" id="audit-complete">Confirm Adjustments</button>
    ` : ''}
  `;

  openModal({
    title: `Audit count details: AUD-#${count.id}`, bodyHTML, footerHTML, size: 'modal-lg',
    onOpen: (backdrop) => {
      const inputs = backdrop.querySelectorAll('.count-actual-input');
      const diffCells = backdrop.querySelectorAll('.count-diff-cell');

      inputs.forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = parseInt(e.target.dataset.idx);
          const val = parseFloat(e.target.value) || 0;
          countItems[idx].physical_qty = val;
          const diff = val - countItems[idx].system_qty;
          countItems[idx].difference = diff;

          const diffCell = diffCells[idx];
          diffCell.textContent = (diff > 0 ? '+' : '') + diff;
          diffCell.style.color = diff < 0 ? 'var(--danger)' : diff > 0 ? 'var(--stock-in)' : '';
        });
      });

      backdrop.querySelector('#audit-save-draft')?.addEventListener('click', async () => {
        // Save quantities to IndexedDB
        for (const ci of countItems) {
          await db.inventory_count_items.update(ci.id, {
            physical_qty: ci.physical_qty,
            difference: ci.difference
          });
        }
        closeModal();
        toast.success('Progress Saved', 'Count draft updated.');
        await renderActiveAdvTab(pageContainer);
      });

      backdrop.querySelector('#audit-complete')?.addEventListener('click', async () => {
        closeModal();
        showConfirm('Complete this physical audit? Any stock differences will automatically generate logs adjustments.', async () => {
          for (const ci of countItems) {
            // Update items actual database
            await db.inventory_count_items.update(ci.id, {
              physical_qty: ci.physical_qty,
              difference: ci.difference
            });

            if (ci.difference !== 0) {
              const it = itemMap[ci.item_id];
              // Adjust inventory log entry
              await recordStockEvent({
                itemId: ci.item_id,
                changeType: CHANGE_TYPE.ADJUSTMENT,
                qty: ci.difference, // difference can be positive/negative
                notes: `Physical audit adjustment (AUD-#${count.id})`
              });
            }
          }

          // Mark count completed
          await db.inventory_counts.update(count.id, { status: 'COMPLETED' });

          toast.success('Audit Completed', 'Discrepancies reconciled and stock levels corrected.');
          await renderActiveAdvTab(pageContainer);
        });
      });
    }
  });
}

// ── Stock adjustment add modal ─────────────────────────────────
async function showAddAdjustmentModal(pageContainer) {
  const allItems = await db.items.filter(it => !it.is_composite).toArray();

  const bodyHTML = `
    <div class="form-group">
      <label class="form-label">Product Item <span class="required">*</span></label>
      <select class="form-select" id="adj-item-select">
        <option value="">— Select Product —</option>
        ${allItems.map(it => `<option value="${it.id}">${it.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Loss Quantity <span class="required">*</span></label>
        <input type="number" class="form-input" id="adj-qty" placeholder="10" min="0.01" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Deduction Reason <span class="required">*</span></label>
        <select class="form-select" id="adj-type">
          <option value="SPOILAGE">Spoilage (Expired/Rotten)</option>
          <option value="DAMAGE">Damaged (Broken Packaging)</option>
          <option value="THEFT">Theft / Shoplift / Shrinkage</option>
          <option value="EXPIRED">Expired Stock</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Details / Explanations <span class="required">*</span></label>
      <input class="form-input" id="adj-notes" placeholder="e.g. Found damaged in delivery box C">
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" id="adj-submit-btn">${icon('icon-trash')} Record Stock Loss</button>
  `;

  openModal({
    title: 'Record Inventory Stock Loss', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#adj-submit-btn').addEventListener('click', async () => {
        const itemId = parseInt(backdrop.querySelector('#adj-item-select').value);
        const qty = parseFloat(backdrop.querySelector('#adj-qty').value) || 0;
        const type = backdrop.querySelector('#adj-type').value;
        const notes = backdrop.querySelector('#adj-notes').value.trim();

        if (!itemId || qty <= 0 || !notes) {
          toast.error('Validation Error', 'Ensure all required fields are filled.');
          return;
        }

        const matched = allItems.find(it => it.id === itemId);
        if (matched && matched.stock_quantity < qty) {
          toast.error('Insufficient Stock', `Only ${matched.stock_quantity} in stock, cannot deduct ${qty}.`);
          return;
        }

        // Add adjustment record
        await db.stock_adjustments.add({
          shop_id: 1,
          item_id: itemId,
          qty: -qty, // deduct
          type: type,
          timestamp: new Date().toISOString(),
          notes: notes
        });

        // Record stock event
        await recordStockEvent({
          itemId: itemId,
          changeType: type === 'SPOILAGE' ? CHANGE_TYPE.SPOILAGE : CHANGE_TYPE.OUT,
          qty: qty,
          notes: `Stock loss: ${type} (${notes})`
        });

        closeModal();
        toast.success('Deduction Recorded', `Deducted −${qty} ${matched.unit} from ${matched.name}.`);
        await renderActiveAdvTab(pageContainer);
      });
    }
  });
}
