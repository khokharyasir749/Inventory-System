/**
 * recipes.js — Recipe / Bill of Materials (BOM) Manager
 * Map composite items to their raw ingredients with quantities
 */

async function renderRecipes(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Recipes</h1>
        <p>Define how composite items (e.g. Zinger Burger) consume raw ingredients</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary btn-sm" id="recipe-add-btn">${icon('icon-plus')} New Recipe</button>
      </div>
    </div>
    <div id="recipes-list-container">
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
        <h3>No Recipes Yet</h3>
        <p>First, add products and mark them as "Composite / Recipe Items" in the Inventory page, then define their ingredients here.</p>
        <button class="btn btn-primary btn-sm" onclick="navigate('inventory')">${icon('icon-inventory')} Go to Inventory</button>
      </div>`;
    return;
  }

  listEl.innerHTML = compositeItems.map(composite => {
    const ingredients = allRecipes.filter(r => r.composite_item_id === composite.id);
    const thumb = composite.photo_blob
      ? `<img src="${composite.photo_blob}" alt="${composite.name}" style="width:100%;height:100%;object-fit:cover;">`
      : categoryIcon(composite.category);

    // Calculate cost from BOM
    const bomCost = ingredients.reduce((sum, r) => {
      const ing = itemMap[r.ingredient_item_id];
      if (!ing) return sum;
      return sum + (ing.cost_price * r.qty_required);
    }, 0);

    const margin = composite.selling_price > 0
      ? ((composite.selling_price - bomCost) / composite.selling_price * 100).toFixed(0)
      : 0;

    return `
      <div class="section-card animate-slide-up" style="margin-bottom:var(--space-4)">
        <div class="section-card-header">
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div style="width:48px;height:48px;border-radius:var(--radius-md);background:var(--canvas);overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-soft)">
              ${thumb}
            </div>
            <div>
              <h3 style="font-size:1rem;margin-bottom:2px">${composite.name}</h3>
              <div style="display:flex;gap:var(--space-2);align-items:center">
                <span class="badge badge-primary">Recipe</span>
                <span class="text-muted text-xs">Sell @ ${fmt(composite.selling_price)}</span>
                ${bomCost > 0 ? `<span class="text-muted text-xs">· Cost: ${fmt(bomCost)}</span>` : ''}
                ${margin > 0 ? `<span class="badge badge-green">Margin: ${margin}%</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-ghost btn-sm btn-icon" data-edit-recipe="${composite.id}" title="Edit recipe">
              ${icon('icon-edit')}
            </button>
          </div>
        </div>

        ${ingredients.length === 0
          ? `<div style="padding:var(--space-4);text-align:center;color:var(--text-muted);font-size:0.875rem">
               No ingredients defined yet.
               <button class="btn btn-ghost btn-sm" data-edit-recipe="${composite.id}" style="margin-left:var(--space-2)">Add Ingredients</button>
             </div>`
          : `<div>
               <div class="text-sm font-semibold text-muted" style="margin-bottom:var(--space-3)">
                 Selling 1 ${composite.name} consumes:
               </div>
               <div class="table-scroll">
                 <table>
                   <thead>
                     <tr>
                       <th>Ingredient</th>
                       <th>Qty Required</th>
                       <th>Unit</th>
                       <th>Cost/Unit</th>
                       <th>Line Cost</th>
                       <th>In Stock</th>
                       <th>Can Make</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${ingredients.map(r => {
                       const ing = itemMap[r.ingredient_item_id];
                       if (!ing) return `<tr><td colspan="7" class="text-muted">Ingredient deleted</td></tr>`;
                       const canMake = Math.floor(ing.stock_quantity / r.qty_required);
                       const lineColor = canMake === 0 ? 'color:var(--danger)' : canMake < 10 ? 'color:var(--alert)' : 'color:var(--stock-in)';
                       return `
                         <tr>
                           <td class="font-semibold">${ing.name}</td>
                           <td class="mono">${r.qty_required}</td>
                           <td class="text-muted">${ing.unit}</td>
                           <td class="mono">${fmt(ing.cost_price)}</td>
                           <td class="mono">${fmt(ing.cost_price * r.qty_required)}</td>
                           <td class="mono">${fmtNum(ing.stock_quantity)}</td>
                           <td class="font-bold mono" style="${lineColor}">${canMake} pcs</td>
                         </tr>`;
                     }).join('')}
                   </tbody>
                 </table>
               </div>
             </div>`
        }
      </div>`;
  }).join('');

  listEl.querySelectorAll('[data-edit-recipe]').forEach(btn => {
    btn.addEventListener('click', () => {
      const compositeId = parseInt(btn.dataset.editRecipe);
      const composite   = compositeItems.find(it => it.id === compositeId);
      if (composite) showRecipeModal(composite, container);
    });
  });
}

// ── Recipe Edit Modal ─────────────────────────────────────────
async function showRecipeModal(composite, pageContainer) {
  const [compositeItems, allItems, existingRecipes] = await Promise.all([
    db.items.filter(it => it.is_composite).toArray(),
    db.items.filter(it => !it.is_composite).toArray(),
    composite ? db.recipes.where('composite_item_id').equals(composite.id).toArray() : Promise.resolve([])
  ]);

  // Working copy of ingredients
  let ingredients = existingRecipes.map(r => ({ ...r, _key: r.id }));
  let nextKey = -1;

  function renderIngredientRows(wrap) {
    if (ingredients.length === 0) {
      wrap.innerHTML = `<div class="text-muted text-sm" style="padding:var(--space-3) 0">No ingredients yet. Click "Add Ingredient" below.</div>`;
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
      <div class="form-hint">Only items marked as "Composite / Recipe" in Inventory appear here.</div>
    </div>
    <hr>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
      <h4>Ingredients</h4>
      <button class="btn btn-ghost btn-sm" id="add-ingredient-btn">${icon('icon-plus')} Add Ingredient</button>
    </div>
    <div id="ing-rows-wrap"></div>
  `;

  const footerHTML = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="save-recipe-btn">${icon('icon-check')} Save Recipe</button>
  `;

  openModal({ title: composite ? `Edit Recipe: ${composite.name}` : 'New Recipe', bodyHTML, footerHTML, size: 'modal-lg',
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

        // Validate all ingredients have items selected
        const valid = ingredients.every(r => r.ingredient_item_id && r.qty_required > 0);
        if (!valid && ingredients.length > 0) {
          toast.error('Error', 'All ingredient rows must have an item and qty > 0 selected.');
          return;
        }

        // Delete existing BOM for this composite, then re-insert
        await db.recipes.where('composite_item_id').equals(compositeId).delete();

        if (ingredients.length > 0) {
          await db.recipes.bulkAdd(ingredients.map(r => ({
            composite_item_id:  compositeId,
            ingredient_item_id: r.ingredient_item_id,
            qty_required:       r.qty_required
          })));
        }

        closeModal();
        toast.success('Recipe Saved', 'BOM updated successfully.');
        await renderRecipesList(pageContainer);
      });
    }
  });
}
