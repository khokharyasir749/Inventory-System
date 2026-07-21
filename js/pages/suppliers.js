/**
 * suppliers.js — Supplier Management & Purchase Orders (BOM / Stock replenishment)
 * CRUD, PO creation, inventory receiving, PO histories
 */

let suppliersList = [];
let purchaseOrdersList = [];
let activeSuppliersTab = 'suppliers'; // 'suppliers' | 'pos'

async function renderSuppliers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Suppliers & Procurement</h1>
        <p>Manage vendors, draft purchase orders, and receive inventory stock</p>
      </div>
      <div class="page-header-actions" id="suppliers-header-actions">
        <button class="btn btn-primary btn-sm" id="supplier-add-btn">${icon('icon-plus')} Add Supplier</button>
      </div>
    </div>

    <div class="tab-nav" style="margin-bottom:var(--space-4)">
      <button class="tab-btn active" data-stab="suppliers">Suppliers List</button>
      <button class="tab-btn" data-stab="pos">Purchase Orders</button>
    </div>

    <div id="suppliers-view-outlet" class="animate-fade-in">
      <div class="section-card">
        <div class="skeleton" style="height:250px"></div>
      </div>
    </div>
  `;

  // Bind tab switching
  container.querySelectorAll('[data-stab]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-stab]').forEach(b => b.classList.toggle('active', b === btn));
      activeSuppliersTab = btn.dataset.stab;
      renderActiveSuppliersTab(container);
    });
  });

  await loadProcurementData(container);
}

async function loadProcurementData(container) {
  suppliersList = await db.suppliers.toArray();
  purchaseOrdersList = await db.purchase_orders.toArray();
  renderActiveSuppliersTab(container);
}

function renderActiveSuppliersTab(container) {
  const outlet = container.querySelector('#suppliers-view-outlet');
  const actionBtnWrap = container.querySelector('#suppliers-header-actions');
  if (!outlet) return;

  if (activeSuppliersTab === 'suppliers') {
    actionBtnWrap.innerHTML = `<button class="btn btn-primary btn-sm" id="supplier-add-btn">${icon('icon-plus')} Add Supplier</button>`;
    actionBtnWrap.querySelector('#supplier-add-btn').addEventListener('click', () => showSupplierEditModal(null, container));

    if (suppliersList.length === 0) {
      outlet.innerHTML = `
        <div class="empty-state">
          ${icon('icon-users', 'empty-state-icon')}
          <h3>No Suppliers Found</h3>
          <p>Add vendors to start drafting purchase orders and receiving stock.</p>
        </div>`;
      return;
    }

    outlet.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${suppliersList.map(s => `
                <tr>
                  <td class="font-semibold">${s.name}</td>
                  <td>${s.phone || '—'}</td>
                  <td>${s.email || '—'}</td>
                  <td class="text-sm text-secondary truncate" style="max-width:260px">${s.address || '—'}</td>
                  <td class="table-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" data-edit-sup="${s.id}" title="Edit profile">
                      ${icon('icon-edit')}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    outlet.querySelectorAll('[data-edit-sup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = parseInt(btn.dataset.editSup);
        const s = suppliersList.find(x => x.id === sId);
        if (s) showSupplierEditModal(s, container);
      });
    });

  } else {
    // Purchase orders tab
    actionBtnWrap.innerHTML = `<button class="btn btn-primary btn-sm" id="po-create-btn">${icon('icon-plus')} New Purchase Order</button>`;
    actionBtnWrap.querySelector('#po-create-btn').addEventListener('click', () => showPOCreateModal(container));

    if (purchaseOrdersList.length === 0) {
      outlet.innerHTML = `
        <div class="empty-state">
          ${icon('icon-package', 'empty-state-icon')}
          <h3>No Purchase Orders</h3>
          <p>Draft purchase orders to replenish raw materials or catalog inventory.</p>
        </div>`;
      return;
    }

    // Sort POs date desc
    purchaseOrdersList.sort((a, b) => new Date(b.date) - new Date(a.date));

    const supplierMap = {};
    suppliersList.forEach(s => { supplierMap[s.id] = s.name; });

    outlet.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PO ID</th>
                <th>Date</th>
                <th>Supplier / Vendor</th>
                <th>Status</th>
                <th>Total Value</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${purchaseOrdersList.map(po => {
                const isPending = po.status === 'PENDING';
                const badge = isPending
                  ? `<span class="badge badge-amber">Pending Receipt</span>`
                  : `<span class="badge badge-green">Received</span>`;
                return `
                  <tr>
                    <td class="mono text-xs font-semibold">PO-#${po.id}</td>
                    <td class="text-sm">${fmtDate(po.date)}</td>
                    <td class="font-medium">${supplierMap[po.supplier_id] || 'Unknown Vendor'}</td>
                    <td>${badge}</td>
                    <td class="mono font-bold">${fmt(po.total)}</td>
                    <td class="table-actions">
                      <button class="btn btn-ghost btn-sm" data-view-po="${po.id}">
                        ${icon(isPending ? 'icon-edit' : 'icon-eye')} ${isPending ? 'Receive' : 'View'}
                      </button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    outlet.querySelectorAll('[data-view-po]').forEach(btn => {
      btn.addEventListener('click', () => {
        const poId = parseInt(btn.dataset.viewPo);
        const po   = purchaseOrdersList.find(x => x.id === poId);
        if (po) showPODetailsModal(po, container);
      });
    });
  }
}

// ── Supplier Edit Modal ───────────────────────────────────────
function showSupplierEditModal(supplier, pageContainer) {
  const isEdit = !!supplier;
  const bodyHTML = `
    <div class="form-group">
      <label class="form-label">Vendor / Supplier Name <span class="required">*</span></label>
      <input class="form-input" id="sup-name" value="${supplier?.name || ''}" placeholder="e.g. Metro Wholesale Traders">
    </div>
    <div class="form-group">
      <label class="form-label">Phone Number</label>
      <input class="form-input" id="sup-phone" value="${supplier?.phone || ''}" placeholder="e.g. 051-111-222-333">
    </div>
    <div class="form-group">
      <label class="form-label">Email Address</label>
      <input class="form-input" id="sup-email" type="email" value="${supplier?.email || ''}" placeholder="e.g. sales@vendor.com">
    </div>
    <div class="form-group">
      <label class="form-label">Postal Address</label>
      <textarea class="form-input" id="sup-address" placeholder="Physical wholesale depot or office address...">${supplier?.address || ''}</textarea>
    </div>
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-ghost-danger" id="sup-delete-btn">${icon('icon-trash')} Delete</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="sup-save-btn">${icon('icon-check')} ${isEdit ? 'Save Changes' : 'Add Supplier'}</button>
  `;

  openModal({ title: isEdit ? 'Edit Supplier Details' : 'Register Supplier Account', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#sup-save-btn').addEventListener('click', async () => {
        const name = backdrop.querySelector('#sup-name').value.trim();
        const phone = backdrop.querySelector('#sup-phone').value.trim();
        const email = backdrop.querySelector('#sup-email').value.trim();
        const address = backdrop.querySelector('#sup-address').value.trim();

        if (!name) {
          toast.error('Validation Error', 'Supplier Name is required.');
          return;
        }

        const data = { name, phone, email, address };

        if (isEdit) {
          await db.suppliers.update(supplier.id, data);
          toast.success('Supplier Saved', 'Vendor account updated.');
        } else {
          data.shop_id = 1;
          await db.suppliers.add(data);
          toast.success('Supplier Added', 'New vendor registered.');
        }

        closeModal();
        await loadProcurementData(pageContainer);
      });

      if (isEdit) {
        backdrop.querySelector('#sup-delete-btn').addEventListener('click', () => {
          closeModal();
          showConfirm(`Permanently delete vendor account for "${supplier.name}"?`, async () => {
            await db.suppliers.delete(supplier.id);
            toast.success('Deleted', 'Supplier profile removed.');
            await loadProcurementData(pageContainer);
          });
        });
      }
    }
  });
}

// ── Purchase Order Creation Modal ─────────────────────────────
async function showPOCreateModal(pageContainer) {
  if (suppliersList.length === 0) {
    toast.error('Error', 'Please add at least one supplier first.');
    return;
  }

  const allItems = await db.items.filter(it => !it.is_composite).toArray();

  let poItems = [];
  let nextPoItemKey = -1;

  function renderPOItemsRows(wrap) {
    if (poItems.length === 0) {
      wrap.innerHTML = `<div class="text-muted text-sm" style="padding:var(--space-3) 0">No items added to PO draft yet. Click "Add Item" below.</div>`;
      return;
    }

    wrap.innerHTML = poItems.map((pi, idx) => `
      <div class="flex items-center gap-3" style="padding:var(--space-2) 0;border-bottom:1px solid var(--border-soft)">
        <select class="form-select po-item-select flex-1" data-idx="${idx}">
          <option value="">— Select Item —</option>
          ${allItems.map(it => `<option value="${it.id}" ${pi.item_id === it.id ? 'selected' : ''}>${it.name} (${it.unit})</option>`).join('')}
        </select>
        <input type="number" class="form-input po-cost-input" data-idx="${idx}" value="${pi.cost_price}" min="0" step="0.5" style="width:100px;font-family:var(--font-mono)" placeholder="Cost Price">
        <input type="number" class="form-input po-qty-input" data-idx="${idx}" value="${pi.quantity}" min="0.01" step="0.01" style="width:90px;font-family:var(--font-mono)" placeholder="Quantity">
        <button class="btn btn-ghost btn-sm btn-icon" style="color:var(--danger)" data-po-remove-idx="${idx}">
          ${icon('icon-trash')}
        </button>
      </div>
    `).join('');

    // Bind row events
    wrap.querySelectorAll('.po-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const itemId = parseInt(e.target.value) || null;
        poItems[idx].item_id = itemId;
        // Auto pull current cost price as default suggestion
        const matched = allItems.find(it => it.id === itemId);
        if (matched) {
          poItems[idx].cost_price = matched.cost_price || 0;
          wrap.querySelectorAll('.po-cost-input')[idx].value = matched.cost_price || 0;
        }
      });
    });

    wrap.querySelectorAll('.po-cost-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        poItems[idx].cost_price = parseFloat(e.target.value) || 0;
      });
    });

    wrap.querySelectorAll('.po-qty-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        poItems[idx].quantity = parseFloat(e.target.value) || 0;
      });
    });

    wrap.querySelectorAll('[data-po-remove-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.poRemoveIdx);
        poItems.splice(idx, 1);
        renderPOItemsRows(wrap);
      });
    });
  }

  const bodyHTML = `
    <div class="form-group">
      <label class="form-label">Vendor Supplier <span class="required">*</span></label>
      <select class="form-select" id="po-supplier-select">
        <option value="">— Select Vendor —</option>
        ${suppliersList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
    </div>
    <hr>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)">
      <h4>Order Items</h4>
      <button class="btn btn-ghost btn-sm" id="po-add-row-btn">${icon('icon-plus')} Add Item</button>
    </div>
    <div id="po-draft-rows-wrap" style="max-height:280px;overflow-y:auto"></div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="po-save-draft-btn">${icon('icon-check')} Save Draft PO</button>
  `;

  openModal({ title: 'Draft Purchase Order', bodyHTML, footerHTML, size: 'modal-lg',
    onOpen: (backdrop) => {
      const rowsWrap = backdrop.querySelector('#po-draft-rows-wrap');
      renderPOItemsRows(rowsWrap);

      backdrop.querySelector('#po-add-row-btn').addEventListener('click', () => {
        poItems.push({ item_id: null, quantity: 1, cost_price: 0, _key: nextPoItemKey-- });
        renderPOItemsRows(rowsWrap);
      });

      backdrop.querySelector('#po-save-draft-btn').addEventListener('click', async () => {
        const supplierId = parseInt(backdrop.querySelector('#po-supplier-select').value);
        if (!supplierId) {
          toast.error('Error', 'Please select a supplier.');
          return;
        }

        const valid = poItems.length > 0 && poItems.every(pi => pi.item_id && pi.quantity > 0);
        if (!valid) {
          toast.error('Error', 'Ensure all PO items rows have an item and quantity selected.');
          return;
        }

        // Calculate PO total
        const total = poItems.reduce((sum, pi) => sum + (pi.cost_price * pi.quantity), 0);

        // Add PO draft
        const poId = await db.purchase_orders.add({
          shop_id: 1,
          supplier_id: supplierId,
          date: new Date().toISOString(),
          status: 'PENDING',
          total: total
        });

        // Add PO items
        await db.purchase_order_items.bulkAdd(poItems.map(pi => ({
          shop_id: 1,
          purchase_order_id: poId,
          item_id: pi.item_id,
          quantity: pi.quantity,
          cost_price: pi.cost_price
        })));

        closeModal();
        toast.success('PO Created', `Draft PO-#${poId} successfully saved.`);
        await loadProcurementData(pageContainer);
      });
    }
  });
}

// ── Purchase Order Details / Inventory Receive Modal ───────────
async function showPODetailsModal(po, pageContainer) {
  const [poItems, allItems, supplier] = await Promise.all([
    db.purchase_order_items.where('purchase_order_id').equals(po.id).toArray(),
    db.items.toArray(),
    db.suppliers.get(po.supplier_id)
  ]);

  const itemMap = {};
  allItems.forEach(i => { itemMap[i.id] = i; });

  const isPending = po.status === 'PENDING';

  const bodyHTML = `
    <div class="grid-2" style="background:var(--canvas);padding:var(--space-3);border-radius:var(--radius-md);margin-bottom:var(--space-4)">
      <div>
        <div class="text-sm text-secondary">Supplier Vendor</div>
        <div class="font-semibold">${supplier ? supplier.name : 'Unknown Vendor'}</div>
        <div class="text-xs text-secondary">${supplier?.phone || ''}</div>
      </div>
      <div>
        <div class="text-sm text-secondary">Order Value</div>
        <div class="font-bold text-base mono text-teal">${fmt(po.total)}</div>
        <div class="text-xs text-secondary">PO Status: ${po.status}</div>
      </div>
    </div>
    
    <div style="font-weight:600;margin-bottom:var(--space-2)">Purchase Items:</div>
    <div class="table-scroll" style="margin-bottom:var(--space-2)">
      <table>
        <thead>
          <tr>
            <th>Product Item</th>
            <th>Qty Ordered</th>
            <th>Cost Price / Unit</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${poItems.map(pi => {
            const it = itemMap[pi.item_id];
            return `
              <tr>
                <td class="font-semibold">${it ? it.name : 'Deleted item'}</td>
                <td class="mono">${pi.quantity} ${it ? it.unit : ''}</td>
                <td class="mono">${fmt(pi.cost_price)}</td>
                <td class="mono font-bold">${fmt(pi.cost_price * pi.quantity)}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    ${isPending ? `<button class="btn btn-success" id="po-receive-btn">${icon('icon-check')} Receive Stock into Inventory</button>` : ''}
  `;

  openModal({ title: `Purchase Order details: PO-#${po.id}`, bodyHTML, footerHTML, size: 'modal-lg',
    onOpen: (backdrop) => {
      if (isPending) {
        backdrop.querySelector('#po-receive-btn').addEventListener('click', async () => {
          closeModal();
          showConfirm(`Confirm receiving PO-#${po.id}? This will add ${poItems.length} items to inventory stock and adjust their unit cost price records.`, async () => {
            // Update items inventory
            for (const pi of poItems) {
              const it = itemMap[pi.item_id];
              if (it) {
                // Record stock IN event
                await recordStockEvent({
                  itemId: pi.item_id,
                  changeType: CHANGE_TYPE.IN,
                  qty: pi.quantity,
                  notes: `PO Received (PO-#${po.id})`
                });

                // Update cost price of item record in database to PO's cost price
                await db.items.update(pi.item_id, { cost_price: pi.cost_price });
              }
            }

            // Set PO received
            await db.purchase_orders.update(po.id, { status: 'RECEIVED' });

            toast.success('Procurement Complete', `PO-#${po.id} received. Stock and cost values updated.`);
            await loadProcurementData(pageContainer);
          });
        });
      }
    }
  });
}
