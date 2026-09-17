/**
 * recipes.js — Recipe / Bill of Materials (BOM) & Batch Production Engine
 * Features:
 * 1. Raw material recipe builder with ingredient cost calculations
 * 2. Real-time Yield Calculation & Gross Profit Margin %
 * 3. Production Bottleneck Analysis (identifies stock limiting ingredient)
 * 4. Batch Production Modal: manufacturing workflow auto-deducting raw ingredients and crediting composite stock
 * 5. Modern micro-interactions and Slate theme cards
 */

async function renderRecipes(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Recipes & BOM Production</h1>
        <p>Bill of Materials (BOM), raw ingredient consumption, yield calculations, and batch manufacturing</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary btn-sm" id="recipe-add-btn">${icon('icon-plus')} New Recipe</button>
      </div>
    </div>
    <div id="recipes-list-container" class="animate-fade-in">
      <div class="section-card">
        <div class="skeleton" style="height:200px;border-radius:var(--radius-md)"></div>
      </div>
    </div>
  `;

  await renderRecipesList(container);

  container.querySelector('#recipe-add-btn').addEventListener('click', () => showRecipeModal(null, container));
}

async function renderRecipesList(container) {
  const [compositeItems, allRecipes, allItems] = await Promise.all([
    db.items.filter(it => it.is_composite).toArray(),
    db.recipes.toArray(),
    db.items.toArray()
  ]);

  const itemMap = {};
  allItems.forEach(it => { itemMap[it.id] = it; });

  const listEl = container.querySelector('#recipes-list-container');
  if (!listEl) return;

  if (compositeItems.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        ${icon('icon-recipes', 'empty-state-icon')}
        <h3>No Composite Recipes Defined</h3>
        <p>Mark products as "Composite / Recipe Item" in Inventory, then configure their raw material ingredients here.</p>
        <button class="btn btn-primary btn-sm" onclick="navigate('inventory')">${icon('icon-inventory')} Go to Inventory</button>
      </div>`;
    return;
  }

  listEl.innerHTML = compositeItems.map(composite => {
    const ingredients = allRecipes.filter(r => r.composite_item_id === composite.id);
    const thumb = composite.photo_blob
      ? `<img src="${composite.photo_blob}" alt="${composite.name}" style="width:100%;height:100%;object-fit:cover;">`
      : categoryIcon(composite.category);

    // Calculate BOM Unit Cost
    const bomCost = ingredients.reduce((sum, r) => {
      const ing = itemMap[r.ingredient_item_id];
      if (!ing) return sum;
      return sum + ((ing.cost_price || 0) * (r.qty_required || 0));
    }, 0);

    const marginPct = composite.selling_price > 0
      ? Math.round(((composite.selling_price - bomCost) / composite.selling_price) * 100)
      : 0;

    // Production Bottleneck & Max Yield
    let maxBatches = Infinity;
    let bottleneckItem = null;

    if (ingredients.length > 0) {
      ingredients.forEach(r => {
        const ing = itemMap[r.ingredient_item_id];
        if (ing && r.qty_required > 0) {
          const possible = Math.floor(Math.max(0, ing.stock_quantity) / r.qty_required);
          if (possible < maxBatches) {
            maxBatches = possible;
            bottleneckItem = ing.name;
          }
        }
      });
    } else {
      maxBatches = 0;
    }

    if (maxBatches === Infinity) maxBatches = 0;

    return `
      <div class="section-card animate-slide-up" style="margin-bottom:var(--space-4)">
        <div class="section-card-header">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div style="width:50px;height:50px;border-radius:var(--radius-md);background:var(--canvas);overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-soft);flex-shrink:0">
              ${thumb}
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:var(--space-2)">
                <h3 style="font-size:1.05rem;margin-bottom:0">${composite.name}</h3>
                <span class="badge badge-primary">Composite BOM</span>
              </div>
              <div style="display:flex;gap:var(--space-2);align-items:center;margin-top:4px;flex-wrap:wrap">
                <span class="text-secondary text-xs">Selling: <strong class="mono">${fmt(composite.selling_price)}</strong></span>
                <span class="text-secondary text-xs">· Raw Cost: <strong class="mono">${fmt(bomCost)}</strong></span>
                ${marginPct > 0 
                  ? `<span class="badge ${marginPct > 35 ? 'badge-green' : 'badge-amber'}">Margin: ${marginPct}%</span>` 
                  : ''}
                <span class="text-muted text-xs">· In Stock: <strong class="mono">${fmtNum(composite.stock_quantity)} ${composite.unit}</strong></span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:var(--space-2);align-items:center">
            ${ingredients.length > 0 ? `
              <button class="btn btn-success btn-sm" data-produce-recipe="${composite.id}">
                ${icon('icon-check')} Produce Batch
              </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm btn-icon" data-edit-recipe="${composite.id}" title="Edit recipe BOM">
              ${icon('icon-edit')}
            </button>
          </div>
        </div>

        ${ingredients.length === 0
          ? `<div style="padding:var(--space-4);text-align:center;color:var(--text-muted);font-size:0.875rem">
               No raw material ingredients mapped to this composite recipe.
               <button class="btn btn-ghost btn-sm" data-edit-recipe="${composite.id}" style="margin-left:var(--space-2)">Add Ingredients</button>
             </div>`
          : `<div>
              <div class="table-scroll" style="margin-bottom:var(--space-3)">
                <table>
                  <thead>
                    <tr>
                      <th>Raw Ingredient</th>
                      <th>Qty Required / Unit</th>
                      <th>Unit</th>
                      <th>Cost / Unit</th>
                      <th>Line Cost</th>
                      <th>In Stock</th>
                      <th>Max Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ingredients.map(r => {
                      const ing = itemMap[r.ingredient_item_id];
                      if (!ing) return `<tr><td colspan="7" class="text-muted">Ingredient deleted</td></tr>`;
                      const canMake = r.qty_required > 0 ? Math.floor(Math.max(0, ing.stock_quantity) / r.qty_required) : 0;
                      const isLimiting = canMake === maxBatches && ingredients.length > 1;
                      return `
                        <tr>
                          <td class="font-semibold">
                            ${ing.name}
                            ${isLimiting ? `<span class="badge badge-amber" style="margin-left:6px;font-size:0.65rem">Bottleneck</span>` : ''}
                          </td>
                          <td class="mono font-semibold">${r.qty_required}</td>
                          <td class="text-muted text-xs">${ing.unit}</td>
                          <td class="mono text-xs">${fmt(ing.cost_price)}</td>
                          <td class="mono text-xs font-semibold">${fmt((ing.cost_price || 0) * r.qty_required)}</td>
                          <td class="mono text-xs">${fmtNum(ing.stock_quantity)}</td>
                          <td class="font-bold mono text-xs" style="color:${canMake === 0 ? 'var(--danger)' : canMake < 10 ? 'var(--alert)' : 'var(--stock-in)'}">
                            ${canMake} ${composite.unit}
                          </td>
                        </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Yield & Production Bottleneck Banner -->
              <div class="yield-bottleneck-card">
                <div>
                  <div class="text-xs text-secondary font-semibold" style="text-transform:uppercase;letter-spacing:0.04em">Batch Production Capacity</div>
                  <div class="font-bold text-sm" style="color:var(--text-primary);margin-top:2px">
                    Maximum Yield: <strong class="mono ${maxBatches === 0 ? 'text-red' : 'text-green'}">${maxBatches} ${composite.unit}</strong>
                    ${bottleneckItem && maxBatches < 50 ? `<span class="text-xs text-muted" style="margin-left:6px">(Stock limited by <strong>${bottleneckItem}</strong>)</span>` : ''}
                  </div>
                </div>
                <div>
                  <button class="btn btn-ghost btn-sm" data-produce-recipe="${composite.id}">
                    ${icon('icon-check')} Run Production Batch
                  </button>
                </div>
              </div>
            </div>`
        }
      </div>`;
  }).join('');

  // Bind edit recipe modal
  listEl.querySelectorAll('[data-edit-recipe]').forEach(btn => {
    btn.addEventListener('click', () => {
      const compositeId = parseInt(btn.dataset.editRecipe);
      const composite   = compositeItems.find(it => it.id === compositeId);
      if (composite) showRecipeModal(composite, container);
    });
  });

  // Bind batch production modal
  listEl.querySelectorAll('[data-produce-recipe]').forEach(btn => {
    btn.addEventListener('click', () => {
      const compositeId = parseInt(btn.dataset.produceRecipe);
      const composite   = compositeItems.find(it => it.id === compositeId);
      if (composite) showBatchProductionModal(composite, allRecipes, allItems, container);
    });
  });
}

// ── Batch Production Modal (Manufacturing Workflow) ─────────────
function showBatchProductionModal(composite, allRecipes, allItems, pageContainer) {
  const ingredients = allRecipes.filter(r => r.composite_item_id === composite.id);
  const itemMap = {};
  allItems.forEach(it => { itemMap[it.id] = it; });

  let maxBatches = Infinity;
  ingredients.forEach(r => {
    const ing = itemMap[r.ingredient_item_id];
    if (ing && r.qty_required > 0) {
      const possible = Math.floor(Math.max(0, ing.stock_quantity) / r.qty_required);
      if (possible < maxBatches) maxBatches = possible;
    }
  });
  if (maxBatches === Infinity) maxBatches = 0;

  const defaultBatchQty = Math.min(10, Math.max(1, maxBatches));

  const bodyHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4)">
      <div style="display:flex;align-items:center;gap:var(--space-3);background:var(--surface-raised);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--border-soft)">
        <div style="flex:1">
          <div class="text-sm font-bold">${composite.name}</div>
          <div class="text-xs text-secondary">Current Stock: <strong class="mono">${fmtNum(composite.stock_quantity)} ${composite.unit}</strong> · Max Capacity: <strong class="mono">${maxBatches}</strong></div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="batch-produce-qty">Quantity to Manufacture / Cook <span class="required">*</span></label>
        <div class="input-group">
          <input type="number" class="form-input" id="batch-produce-qty" value="${defaultBatchQty}" min="1" step="1" style="font-size:1.2rem;font-weight:700">
          <span class="input-prefix">${composite.unit}</span>
        </div>
      </div>

      <div>
        <div class="text-xs font-semibold text-secondary" style="margin-bottom:var(--space-2);text-transform:uppercase">Required Raw Material Consumption:</div>
        <div id="batch-consumption-preview" class="table-scroll" style="max-height:180px">
          <!-- Injected dynamically based on qty -->
        </div>
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="batch-confirm-produce-btn">${icon('icon-check')} Confirm & Deduct Raw Stock</button>
  `;

  openModal({
    title: `Produce Batch: ${composite.name}`,
    bodyHTML,
    footerHTML,
    size: 'modal-lg',
    onOpen: (backdrop) => {
      const qtyInp = backdrop.querySelector('#batch-produce-qty');
      const previewWrap = backdrop.querySelector('#batch-consumption-preview');
      const confirmBtn = backdrop.querySelector('#batch-confirm-produce-btn');

      function updateConsumptionPreview() {
        const batchQty = parseFloat(qtyInp.value) || 0;
        let canFulfill = batchQty > 0;

        previewWrap.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Required for Batch</th>
                <th>Available</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${ingredients.map(r => {
                const ing = itemMap[r.ingredient_item_id];
                if (!ing) return '';
                const totalReq = r.qty_required * batchQty;
                const isShort = totalReq > ing.stock_quantity;
                if (isShort) canFulfill = false;
                return `
                  <tr>
                    <td class="font-medium text-xs">${ing.name}</td>
                    <td class="mono font-bold text-xs">${fmtNum(totalReq)} ${ing.unit}</td>
                    <td class="mono text-xs">${fmtNum(ing.stock_quantity)} ${ing.unit}</td>
                    <td>
                      ${isShort 
                        ? `<span class="badge badge-red">Short (${fmtNum(totalReq - ing.stock_quantity)} needed)</span>` 
                        : `<span class="badge badge-green">In Stock</span>`
                      }
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;

        confirmBtn.disabled = !canFulfill;
        if (!canFulfill) {
          confirmBtn.innerHTML = `${icon('icon-close')} Insufficient Raw Materials`;
        } else {
          confirmBtn.innerHTML = `${icon('icon-check')} Confirm & Deduct Raw Stock`;
        }
      }

      qtyInp.addEventListener('input', updateConsumptionPreview);
      updateConsumptionPreview();

      confirmBtn.addEventListener('click', async () => {
        const batchQty = parseFloat(qtyInp.value);
        if (isNaN(batchQty) || batchQty <= 0) {
          toast.error('Validation Error', 'Please enter a valid batch quantity.');
          return;
        }

        confirmBtn.disabled = true;
        try {
          // 1. Deduct raw ingredients
          for (const r of ingredients) {
            const ing = itemMap[r.ingredient_item_id];
            if (ing) {
              const deductQty = r.qty_required * batchQty;
              await recordStockEvent({
                itemId: ing.id,
                changeType: CHANGE_TYPE.OUT,
                qty: deductQty,
                notes: `BOM Batch Production: ${batchQty} ${composite.name}`
              });
            }
          }

          // 2. Add finished composite units to inventory stock
          await recordStockEvent({
            itemId: composite.id,
            changeType: CHANGE_TYPE.IN,
            qty: batchQty,
            notes: `Manufactured batch (${batchQty} units)`
          });

          closeModal();
          toast.success('Production Complete', `Successfully manufactured ${batchQty} ${composite.unit} of ${composite.name}.`);
          await renderRecipesList(pageContainer);
        } catch (err) {
          toast.error('Production Failed', err.message);
          confirmBtn.disabled = false;
        }
      });
    }
  });
}

// ── Recipe Edit Modal ─────────────────────────────────────────
async function showRecipeModal(composite, pageContainer) {
  const [compositeItems, allItems, existingRecipes] = await Promise.all([
    db.items.filter(it => it.is_composite).toArray(),
    db.items.filter(it => !it.is_composite).toArray(),
    composite ? db.recipes.where('composite_item_id').equals(composite.id).toArray() : Promise.resolve([])
  ]);

  let ingredients = existingRecipes.map(r => ({ ...r, _key: r.id }));
  let nextKey = -1;

  function renderIngredientRows(wrap) {
    if (ingredients.length === 0) {
      wrap.innerHTML = `<div class="text-muted text-sm" style="padding:var(--space-3) 0">No ingredients mapped. Click "Add Ingredient" below.</div>`;
      return;
    }
    wrap.innerHTML = ingredients.map((ing, idx) => {
      const ingItem = allItems.find(it => it.id === ing.ingredient_item_id);
      return `
        <div class="flex items-center gap-3" data-ing-idx="${idx}" style="padding:var(--space-2) 0;border-bottom:1px solid var(--border-soft)">
          <select class="form-select ing-item-select flex-1" style="font-size:0.8125rem;" data-idx="${idx}">
            <option value="">— Select ingredient —</option>
            ${allItems.map(it => `<option value="${it.id}" ${ing.ingredient_item_id === it.id ? 'selected' : ''}>${it.name} (${it.unit})</option>`).join('')}
          </select>
          <input type="number" class="form-input ing-qty-input" data-idx="${idx}" value="${ing.qty_required || 1}" min="0.01" step="0.01" style="width:90px;font-family:var(--font-mono);" placeholder="Qty">
          <span class="text-muted text-xs" id="ing-unit-${idx}">${ingItem ? ingItem.unit : ''}</span>
          <button class="btn btn-ghost btn-sm btn-icon" style="color:var(--danger)" data-remove-idx="${idx}" title="Remove">${icon('icon-trash')}</button>
        </div>`;
    }).join('');

    wrap.querySelectorAll('.ing-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx  = parseInt(e.target.dataset.idx);
        const itemId = parseInt(e.target.value) || null;
        ingredients[idx].ingredient_item_id = itemId;
        const ingItem = allItems.find(it => it.id === itemId);
        const unitSpan = wrap.querySelector(`#ing-unit-${idx}`);
        if (unitSpan) unitSpan.textContent = ingItem ? ingItem.unit : '';
      });
    });

    wrap.querySelectorAll('.ing-qty-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        ingredients[idx].qty_required = parseFloat(e.target.value) || 1;
      });
    });

    wrap.querySelectorAll('[data-remove-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeIdx);
        ingredients.splice(idx, 1);
        renderIngredientRows(wrap);
      });
    });
  }

  const bodyHTML = `
    <div class="form-group">
      <label class="form-label">Composite Item <span class="required">*</span></label>
      <select class="form-select" id="recipe-composite-select">
        <option value="">— Select composite item —</option>
        ${compositeItems.map(it => `<option value="${it.id}" ${composite?.id === it.id ? 'selected' : ''}>${it.name}</option>`).join('')}
      </select>
      <div class="form-hint">Items marked as "Composite / Recipe" in Inventory appear here.</div>
    </div>
    <hr>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
      <h4>Raw Material Ingredients</h4>
      <button class="btn btn-ghost btn-sm" id="add-ingredient-btn">${icon('icon-plus')} Add Ingredient</button>
    </div>
    <div id="ing-rows-wrap"></div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="save-recipe-btn">${icon('icon-check')} Save Recipe BOM</button>
  `;

  openModal({ title: composite ? `Edit BOM: ${composite.name}` : 'New Recipe BOM', bodyHTML, footerHTML, size: 'modal-lg',
    onOpen: (backdrop) => {
      const ingWrap = backdrop.querySelector('#ing-rows-wrap');
      renderIngredientRows(ingWrap);

      backdrop.querySelector('#add-ingredient-btn').addEventListener('click', () => {
        ingredients.push({ composite_item_id: null, ingredient_item_id: null, qty_required: 1, _key: nextKey-- });
        renderIngredientRows(ingWrap);
      });

      backdrop.querySelector('#save-recipe-btn').addEventListener('click', async () => {
        const compositeId = parseInt(backdrop.querySelector('#recipe-composite-select').value);
        if (!compositeId) { toast.error('Error', 'Select a composite item.'); return; }

        const valid = ingredients.every(r => r.ingredient_item_id && r.qty_required > 0);
        if (!valid && ingredients.length > 0) {
          toast.error('Error', 'All ingredient rows must have an item and qty > 0 selected.');
          return;
        }

        await db.recipes.where('composite_item_id').equals(compositeId).delete();

        if (ingredients.length > 0) {
          await db.recipes.bulkAdd(ingredients.map(r => ({
            composite_item_id:  compositeId,
            ingredient_item_id: r.ingredient_item_id,
            qty_required:       r.qty_required
          })));
        }

        closeModal();
        toast.success('Recipe Saved', 'Bill of Materials updated successfully.');
        await renderRecipesList(pageContainer);
      });
    }
  });
}
