/**
 * suppliers.js — Supplier Management, Vendor Procurement & PO Engine
 * Features:
 * 1. Vendor directory with instant WhatsApp (wa.me), Phone (tel:), and Email links
 * 2. Purchase Order (PO) creation with item cost auto-suggestion
 * 3. Inventory Stock Receiving workflow with automated stock event ledger logging
 * 4. Searchable clean tabular layout and Slate theme cards
 */

let suppliersList = [];
let purchaseOrdersList = [];
let activeSuppliersTab = 'suppliers'; // 'suppliers' | 'pos'
let supplierSearch = '';

async function renderSuppliers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Suppliers & Procurement</h1>
        <p>Manage wholesale vendors, draft purchase orders, and receive inventory stock</p>
      </div>
      <div class="page-header-actions" id="suppliers-header-actions">
        <button class="btn btn-primary btn-sm" id="supplier-add-btn">${icon('icon-plus')} Add Supplier</button>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="tab-nav" style="margin-bottom:var(--space-4)">
      <button class="tab-btn ${activeSuppliersTab === 'suppliers' ? 'active' : ''}" data-stab="suppliers">
        ${icon('icon-store')} Vendors & Suppliers (${suppliersList.length})
      </button>
      <button class="tab-btn ${activeSuppliersTab === 'pos' ? 'active' : ''}" data-stab="pos">
        ${icon('icon-package')} Purchase Orders (${purchaseOrdersList.length})
      </button>
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
  [suppliersList, purchaseOrdersList] = await Promise.all([
    db.suppliers.toArray(),
    db.purchase_orders.toArray()
  ]);

  // Update tab counts
  const supTab = container.querySelector('[data-stab="suppliers"]');
  const poTab = container.querySelector('[data-stab="pos"]');
  if (supTab) supTab.innerHTML = `${icon('icon-store')} Vendors & Suppliers (${suppliersList.length})`;
  if (poTab) poTab.innerHTML = `${icon('icon-package')} Purchase Orders (${purchaseOrdersList.length})`;

  renderActiveSuppliersTab(container);
}

function renderActiveSuppliersTab(container) {
  const outlet = container.querySelector('#suppliers-view-outlet');
  const actionBtnWrap = container.querySelector('#suppliers-header-actions');
  if (!outlet) return;

  if (activeSuppliersTab === 'suppliers') {
    actionBtnWrap.innerHTML = `
      <button class="btn btn-primary btn-sm" id="supplier-add-btn">${icon('icon-plus')} Add Supplier</button>
    `;
    actionBtnWrap.querySelector('#supplier-add-btn').addEventListener('click', () => showSupplierEditModal(null, container));

    if (suppliersList.length === 0) {
      outlet.innerHTML = `
        <div class="empty-state">
          ${icon('icon-users', 'empty-state-icon')}
          <h3>No Vendors Found</h3>
          <p>Register wholesale suppliers to track procurement and purchase orders.</p>
          <button class="btn btn-primary btn-sm" id="sup-empty-add-btn">${icon('icon-plus')} Add First Supplier</button>
        </div>`;
      outlet.querySelector('#sup-empty-add-btn')?.addEventListener('click', () => showSupplierEditModal(null, container));
      return;
    }

    outlet.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vendor / Company Name</th>
                <th>Direct Triggers</th>
                <th>Email</th>
                <th>Depot Address</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${suppliersList.map(s => {
                const cleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
                const waText = encodeURIComponent(`Hello ${s.name},\nInquiring about stock order availability and quotation from our store.`);

                return `
                  <tr>
                    <td class="font-semibold">
                      <div style="font-size:0.925rem;color:var(--text-primary)">${s.name}</div>
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        ${s.phone ? `
                          <a href="tel:${s.phone}" class="contact-btn-phone" title="Call ${s.phone}">
                            📞 ${s.phone}
                          </a>
                          ${cleanPhone.length >= 7 ? `
                            <a href="https://wa.me/${cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone}?text=${waText}" target="_blank" rel="noopener" class="contact-btn-wa" title="WhatsApp Vendor">
                              💬 WhatsApp
                            </a>
                          ` : ''}
                        ` : '<span class="text-muted text-xs">—</span>'}
                      </div>
                    </td>
                    <td>
                      ${s.email ? `
                        <a href="mailto:${s.email}" class="text-xs text-secondary hover-underline" style="color:var(--primary)">
                          ${s.email}
                        </a>
                      ` : '<span class="text-muted text-xs">—</span>'}
                    </td>
                    <td class="text-xs text-secondary truncate" style="max-width:240px" title="${s.address || ''}">${s.address || '—'}</td>
                    <td class="table-actions">
                      <button class="btn btn-ghost btn-sm" data-draft-po="${s.id}" title="New PO">
                        ${icon('icon-plus')} PO
                      </button>
                      <button class="btn btn-ghost btn-sm btn-icon" data-edit-sup="${s.id}" title="Edit Profile">
                        ${icon('icon-edit')}
                      </button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    outlet.querySelectorAll('[data-draft-po]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = parseInt(btn.dataset.draftPo);
        showPOCreateModal(container, sId);
      });
    });

    outlet.querySelectorAll('[data-edit-sup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = parseInt(btn.dataset.editSup);
        const s = suppliersList.find(x => x.id === sId);
        if (s) showSupplierEditModal(s, container);
      });
    });

  } else {
    // Purchase Orders Tab
    actionBtnWrap.innerHTML = `
      <button class="btn btn-primary btn-sm" id="po-create-btn">${icon('icon-plus')} New Purchase Order</button>
    `;
    actionBtnWrap.querySelector('#po-create-btn').addEventListener('click', () => showPOCreateModal(container));

    if (purchaseOrdersList.length === 0) {
      outlet.innerHTML = `
        <div class="empty-state">
          ${icon('icon-package', 'empty-state-icon')}
          <h3>No Purchase Orders</h3>
          <p>Draft purchase orders to replenish raw materials or catalog stock.</p>
          <button class="btn btn-primary btn-sm" id="po-empty-create-btn">${icon('icon-plus')} Draft First PO</button>
        </div>`;
      outlet.querySelector('#po-empty-create-btn')?.addEventListener('click', () => showPOCreateModal(container));
      return;
    }

    // Sort POs date descending
    purchaseOrdersList.sort((a, b) => new Date(b.date) - new Date(a.date));

    const supplierMap = {};
    suppliersList.forEach(s => { supplierMap[s.id] = s.name; });

    outlet.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Order Date</th>
                <th>Vendor / Supplier</th>
                <th>Status</th>
                <th>Total Order Value</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${purchaseOrdersList.map(po => {
                const isPending = po.status === 'PENDING';
                const badge = isPending
                  ? `<span class="badge badge-amber">Pending Delivery</span>`
                  : `<span class="badge badge-green">Received into Stock</span>`;
                return `
                  <tr>
                    <td class="mono text-xs font-bold" style="color:var(--text-primary)">PO-#${po.id}</td>
                    <td class="text-xs">${fmtDateTime(po.date)}</td>
                    <td class="font-medium">${supplierMap[po.supplier_id] || 'Unknown Vendor'}</td>
                    <td>${badge}</td>
                    <td class="mono font-bold text-sm" style="color:var(--primary)">${fmt(po.total)}</td>
                    <td class="table-actions">
                      <button class="btn ${isPending ? 'btn-success' : 'btn-ghost'} btn-sm" data-view-po="${po.id}">
                        ${icon(isPending ? 'icon-check' : 'icon-eye')} ${isPending ? 'Receive Stock' : 'View PO'}
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

// ── Supplier Edit / Create Modal ──────────────────────────────
function showSupplierEditModal(supplier, pageContainer) {
  const isEdit = !!supplier;
  const bodyHTML = `
    <div class="form-group">
      <label class="form-label" for="sup-name">Vendor / Supplier Company Name <span class="required">*</span></label>
      <input class="form-input" id="sup-name" value="${supplier?.name || ''}" placeholder="e.g. Metro Wholesale Distributors" required>
    </div>
    <div class="grid-2" style="gap:var(--space-3)">
      <div class="form-group">
        <label class="form-label" for="sup-phone">Phone / WhatsApp</label>
        <input class="form-input" id="sup-phone" value="${supplier?.phone || ''}" placeholder="e.g. 03001234567">
      </div>
      <div class="form-group">
        <label class="form-label" for="sup-email">Email Address</label>
        <input class="form-input" id="sup-email" type="email" value="${supplier?.email || ''}" placeholder="e.g. sales@vendor.com">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="sup-address">Depot / Warehouse Address</label>
      <textarea class="form-input" id="sup-address" placeholder="Physical wholesale depot or pickup address...">${supplier?.address || ''}</textarea>
    </div>
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-ghost-danger" id="sup-delete-btn">${icon('icon-trash')} Delete Vendor</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="sup-save-btn">${icon('icon-check')} ${isEdit ? 'Save Changes' : 'Register Supplier'}</button>
  `;

  openModal({ title: isEdit ? 'Edit Supplier Details' : 'Register Wholesale Vendor', bodyHTML, footerHTML,
    onOpen: (backdrop) => {
      backdrop.querySelector('#sup-save-btn').addEventListener('click', async () => {
        const name = backdrop.querySelector('#sup-name').value.trim();
        const phone = backdrop.querySelector('#sup-phone').value.trim();
        const email = backdrop.querySelector('#sup-email').value.trim();
        const address = backdrop.querySelector('#sup-address').value.trim();

        if (!name) {
          toast.error('Validation Error', 'Supplier Company Name is required.');
          return;
        }

        const data = { name, phone, email, address };

        if (isEdit) {
          await db.suppliers.update(supplier.id, data);
          toast.success('Supplier Saved', 'Vendor account updated.');
        } else {
          data.shop_id = 1;
          await db.suppliers.add(data);
          toast.success('Supplier Added', 'New wholesale vendor registered.');
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
async function showPOCreateModal(pageContainer, preselectedSupplierId = null) {
  if (suppliersList.length === 0) {
    toast.error('Error', 'Please register at least one vendor first.');
    return;
  }

  const allItems = await db.items.filter(it => !it.is_composite).toArray();

  let poItems = [];
  let nextPoItemKey = -1;

  function renderPOItemsRows(wrap) {
    if (poItems.length === 0) {
      wrap.innerHTML = `<div class="text-muted text-sm" style="padding:var(--space-3) 0">No items added to draft PO yet. Click "Add Item" below.</div>`;
      return;
    }

    wrap.innerHTML = poItems.map((pi, idx) => `
      <div class="flex items-center gap-3" style="padding:var(--space-2) 0;border-bottom:1px solid var(--border-soft)">
        <select class="form-select po-item-select flex-1" data-idx="${idx}">
          <option value="">— Select Product Item —</option>
          ${allItems.map(it => `<option value="${it.id}" ${pi.item_id === it.id ? 'selected' : ''}>${it.name} (${it.unit})</option>`).join('')}
        </select>
        <input type="number" class="form-input po-cost-input" data-idx="${idx}" value="${pi.cost_price}" min="0" step="0.5" style="width:110px;font-family:var(--font-mono)" placeholder="Cost Price">
        <input type="number" class="form-input po-qty-input" data-idx="${idx}" value="${pi.quantity}" min="0.01" step="0.01" style="width:90px;font-family:var(--font-mono)" placeholder="Quantity">
        <button class="btn btn-ghost btn-sm btn-icon" style="color:var(--danger)" data-po-remove-idx="${idx}">
          ${icon('icon-trash')}
        </button>
      </div>
    `).join('');

    wrap.querySelectorAll('.po-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const itemId = parseInt(e.target.value) || null;
        poItems[idx].item_id = itemId;
        const matched = allItems.find(it => it.id === itemId);
        if (matched) {
          poItems[idx].cost_price = matched.cost_price || 0;
          const costInp = wrap.querySelectorAll('.po-cost-input')[idx];
          if (costInp) costInp.value = matched.cost_price || 0;
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
      <label class="form-label" for="po-supplier-select">Vendor Supplier <span class="required">*</span></label>
      <select class="form-select" id="po-supplier-select">
        <option value="">— Select Vendor —</option>
        ${suppliersList.map(s => `<option value="${s.id}" ${preselectedSupplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
    </div>
    <hr>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)">
      <h4>Purchase Order Items</h4>
      <button class="btn btn-ghost btn-sm" id="po-add-row-btn">${icon('icon-plus')} Add Line Item</button>
    </div>
    <div id="po-draft-rows-wrap" style="max-height:280px;overflow-y:auto"></div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="po-save-draft-btn">${icon('icon-check')} Save Purchase Order</button>
  `;

  openModal({ title: 'Draft Purchase Order (PO)', bodyHTML, footerHTML, size: 'modal-lg',
    onOpen: (backdrop) => {
      const rowsWrap = backdrop.querySelector('#po-draft-rows-wrap');
      renderPOItemsRows(rowsWrap);

      backdrop.querySelector('#po-add-row-btn').addEventListener('click', () => {
        poItems.push({ item_id: null, quantity: 10, cost_price: 0, _key: nextPoItemKey-- });
        renderPOItemsRows(rowsWrap);
      });

      backdrop.querySelector('#po-save-draft-btn').addEventListener('click', async () => {
        const supplierId = parseInt(backdrop.querySelector('#po-supplier-select').value);
        if (!supplierId) {
          toast.error('Validation Error', 'Please select a supplier vendor.');
          return;
        }

        const valid = poItems.length > 0 && poItems.every(pi => pi.item_id && pi.quantity > 0);
        if (!valid) {
          toast.error('Validation Error', 'Add at least one item row with valid item and quantity.');
          return;
        }

        const total = poItems.reduce((sum, pi) => sum + (pi.cost_price * pi.quantity), 0);

        const poId = await db.purchase_orders.add({
          shop_id: 1,
          supplier_id: supplierId,
          date: new Date().toISOString(),
          status: 'PENDING',
          total: total
        });

        await db.purchase_order_items.bulkAdd(poItems.map(pi => ({
          shop_id: 1,
          purchase_order_id: poId,
          item_id: pi.item_id,
          quantity: pi.quantity,
          cost_price: pi.cost_price
        })));

        closeModal();
        toast.success('PO Created', `Purchase Order PO-#${poId} saved. Total: ${fmt(total)}`);
        activeSuppliersTab = 'pos';
        await loadProcurementData(pageContainer);
      });
    }
  });
}

// ── Purchase Order Details / Inventory Stock Receiving Modal ───
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
    <div class="grid-2" style="background:var(--surface-raised);padding:var(--space-4);border-radius:var(--radius-lg);margin-bottom:var(--space-4);border:1px solid var(--border)">
      <div>
        <div class="text-xs text-secondary">Supplier Vendor</div>
        <div class="font-bold text-base" style="color:var(--text-primary)">${supplier ? supplier.name : 'Unknown Vendor'}</div>
        <div class="text-xs text-secondary" style="margin-top:2px">${supplier?.phone || ''}</div>
      </div>
      <div style="text-align:right">
        <div class="text-xs text-secondary">Total PO Value</div>
        <div class="font-bold text-xl mono text-teal">${fmt(po.total)}</div>
        <div style="margin-top:4px">
          ${isPending 
            ? `<span class="badge badge-amber">Pending Receiving</span>` 
            : `<span class="badge badge-green">Stock Received</span>`
          }
        </div>
      </div>
    </div>
    
    <div style="font-weight:700;font-size:0.875rem;margin-bottom:var(--space-2)">Ordered Line Items:</div>
    <div class="table-scroll" style="margin-bottom:var(--space-2);max-height:220px">
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
                <td class="font-semibold text-xs">${it ? it.name : 'Deleted item'}</td>
                <td class="mono font-bold text-xs">${pi.quantity} ${it ? it.unit : ''}</td>
                <td class="mono text-xs">${fmt(pi.cost_price)}</td>
                <td class="mono font-bold text-xs">${fmt(pi.cost_price * pi.quantity)}</td>
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

  openModal({ title: `Purchase Order: PO-#${po.id}`, bodyHTML, footerHTML, size: 'modal-lg',
    onOpen: (backdrop) => {
      if (isPending) {
        backdrop.querySelector('#po-receive-btn').addEventListener('click', async () => {
          closeModal();
          showConfirm(`Confirm receiving PO-#${po.id}? This will automatically add stock quantities to ${poItems.length} products and update unit cost prices.`, async () => {
            for (const pi of poItems) {
              const it = itemMap[pi.item_id];
              if (it) {
                await recordStockEvent({
                  itemId: pi.item_id,
                  changeType: CHANGE_TYPE.IN,
                  qty: pi.quantity,
                  notes: `PO Received (PO-#${po.id})`
                });

                // Update cost price in inventory
                await db.items.update(pi.item_id, { cost_price: pi.cost_price });
              }
            }

            await db.purchase_orders.update(po.id, { status: 'RECEIVED' });

            toast.success('Stock Received', `PO-#${po.id} fulfilled. Inventory stock and costs updated.`);
            await loadProcurementData(pageContainer);
          });
        });
      }
    }
  });
}
