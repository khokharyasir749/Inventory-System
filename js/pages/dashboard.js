/**
 * dashboard.js — Premium SaaS-style Business Dashboard
 * KPIs, Profit Today, Revenue This Week/Month, SVG charts, low stock alerts, expiring batches, quick demo tools
 */

async function renderDashboard(container) {
  // Loading skeleton
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 id="dash-header-title">Executive Dashboard</h1>
        <p id="dash-header-sub">Real-time SaaS inventory & sales analytics overview</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" id="dash-switch-profile">${icon('icon-store')} Change Template</button>
        <button class="btn btn-primary btn-sm" id="dash-goto-pos">${icon('icon-pos')} Open POS</button>
      </div>
    </div>
    <div class="kpi-grid">
      ${[1,2,3,4,5,6].map(() => `<div class="kpi-card"><div class="skeleton" style="height:50px"></div></div>`).join('')}
    </div>
  `;

  await refreshDashboardContent(container);
}

async function refreshDashboardContent(container) {
  // 1. Fetch tables in parallel
  const [items, sales, saleItems, logs, batches, storeName, currency, currentTemplate] = await Promise.all([
    db.items.toArray(),
    db.sales.toArray(),
    db.sale_items.toArray(),
    db.logs.orderBy('timestamp').reverse().limit(50).toArray(),
    db.batches.toArray(),
    getSetting('store_name', 'My Shop'),
    getSetting('currency', 'Rs.'),
    getSetting('demo_business', 'grocery')
  ]);

  // Update header text based on template
  const titleEl = container.querySelector('#dash-header-title');
  const subEl   = container.querySelector('#dash-header-sub');
  if (titleEl) titleEl.textContent = storeName;
  if (subEl) subEl.textContent = `SaaS Executive Panel · ${currentTemplate.toUpperCase()} PROFILE`;

  // 2. Setup dates variables
  const now = new Date();
  const todayStr = now.toDateString();
  
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay() || 7;
  startOfWeek.setDate(startOfWeek.getDate() - day + 1);
  startOfWeek.setHours(0,0,0,0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 3. Compute sales KPIs
  const todaySales = sales.filter(s => new Date(s.timestamp).toDateString() === todayStr);
  const todayRev   = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  
  // Profit Today calculations (Net revenue - COGS of items sold today)
  const todaySaleIds = new Set(todaySales.map(s => s.id));
  const todaySaleItems = saleItems.filter(si => todaySaleIds.has(si.sale_id));
  const todayCogs = todaySaleItems.reduce((sum, si) => sum + ((si.cost_price || 0) * si.quantity), 0);
  const todayProfit = todaySales.reduce((sum, s) => sum + (s.subtotal - s.discount), 0) - todayCogs;

  // Revenue Week / Month
  const weekSales = sales.filter(s => new Date(s.timestamp) >= startOfWeek);
  const weekRev   = weekSales.reduce((sum, s) => sum + (s.total || 0), 0);

  const monthSales = sales.filter(s => new Date(s.timestamp) >= startOfMonth);
  const monthRev   = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);

  // 4. Stock values
  const totalStockVal = items.filter(it => !it.is_composite).reduce((sum, it) => sum + (it.cost_price * (it.stock_quantity || 0)), 0);
  const lowStockItems = items.filter(it => !it.is_composite && it.stock_quantity <= it.min_stock_alert);

  // 5. Expiring soon count (within 30 days)
  const expiringLots = batches.filter(b => {
    const diff = Math.ceil((new Date(b.expiry_date) - now) / 86400000);
    return diff >= 0 && diff <= 30;
  });

  // ── Render Dashboard HTML ──────────────────────────────────────
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>${storeName}</h1>
        <p class="text-secondary text-sm">SaaS Executive Dashboard · ${currentTemplate.toUpperCase()} Presets</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" id="dash-switch-profile">${icon('icon-store')} Change Template</button>
        <button class="btn btn-primary btn-sm" id="dash-goto-pos">${icon('icon-pos')} Open POS</button>
      </div>
    </div>

    <!-- Row 1: Premium KPIs Grids -->
    <div class="kpi-grid" style="margin-bottom:var(--space-5)">
      <div class="kpi-card" style="border-left:4px solid var(--primary)">
        <div class="kpi-card-body">
          <div class="kpi-value text-teal">${fmt(todayRev)}</div>
          <div class="kpi-label">Revenue Today</div>
        </div>
      </div>
      <div class="kpi-card" style="border-left:4px solid var(--primary)">
        <div class="kpi-card-body">
          <div class="kpi-value text-green">${fmt(todayProfit)}</div>
          <div class="kpi-label">Gross Profit Today</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-primary">${fmt(weekRev)}</div>
          <div class="kpi-label">Revenue This Week</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-indigo">${fmt(monthRev)}</div>
          <div class="kpi-label">Revenue This Month</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-secondary mono" style="font-size:1.35rem">${fmt(totalStockVal)}</div>
          <div class="kpi-label">Inventory Asset Value</div>
        </div>
      </div>
      <div class="kpi-card" style="border-left:4px solid var(--danger)">
        <div class="kpi-card-body">
          <div class="kpi-value text-red">${lowStockItems.length}</div>
          <div class="kpi-label">Low Stock Items</div>
        </div>
      </div>
    </div>

    <!-- Row 2: Charts and Category splits -->
    <div class="grid-2" style="margin-bottom:var(--space-5)">
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-trending-up')} Sales & Revenue Trend (Past 7 Days)</span>
        </div>
        <div style="height:220px;display:flex;align-items:center;justify-content:center">
          ${renderTrendline(sales)}
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-package')} Inventory Categories Split</span>
        </div>
        <div style="height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-2);justify-content:center">
          ${renderCategorySplit(items)}
        </div>
      </div>
    </div>

    <!-- Row 3: Grid columns of alerts & events -->
    <div class="grid-3">
      <!-- Expiring Products Alerts -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-alert', 'text-amber')} Expiring Batches (30d)</span>
        </div>
        <div class="table-scroll" style="max-height:240px">
          ${expiringLots.length === 0
            ? '<p class="text-xs text-secondary" style="padding:16px;text-align:center">No batches expiring within 30 days.</p>'
            : `<table>
                <thead>
                  <tr><th>Item</th><th>Batch</th><th>Exp</th></tr>
                </thead>
                <tbody>
                  ${expiringLots.slice(0, 5).map(b => {
                    const matchedItem = items.find(it => it.id === b.item_id);
                    return `
                      <tr>
                        <td class="font-semibold text-xs">${matchedItem ? matchedItem.name : 'Unknown'}</td>
                        <td class="mono text-xs">${b.batch_number}</td>
                        <td class="mono text-xs text-red">${fmtDate(b.expiry_date)}</td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>

      <!-- Low Stock Alerts -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-alert', 'text-red')} Stock Warnings</span>
        </div>
        <div class="table-scroll" style="max-height:240px">
          ${lowStockItems.length === 0
            ? '<p class="text-xs text-secondary" style="padding:16px;text-align:center">All stock levels healthy.</p>'
            : `<table>
                <thead>
                  <tr><th>Item</th><th>Alert</th><th>Stock</th></tr>
                </thead>
                <tbody>
                  ${lowStockItems.slice(0, 5).map(it => `
                    <tr>
                      <td class="font-semibold text-xs">${it.name}</td>
                      <td class="mono text-xs text-secondary">${it.min_stock_alert} ${it.unit}</td>
                      <td class="mono text-xs font-bold text-red">${it.stock_quantity} ${it.unit}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-clock')} Recent Transactions</span>
        </div>
        <div class="table-scroll" style="max-height:240px">
          ${sales.length === 0
            ? '<p class="text-xs text-secondary" style="padding:16px;text-align:center">No sales registered yet.</p>'
            : `<table>
                <thead>
                  <tr><th>Invoice</th><th>Time</th><th>Total</th></tr>
                </thead>
                <tbody>
                  ${sales.slice(0, 5).map(s => `
                    <tr>
                      <td class="mono text-xs font-semibold">${s.invoice_no.split('-')[1] || s.invoice_no}</td>
                      <td class="text-xs text-secondary">${fmtTime(s.timestamp)}</td>
                      <td class="mono text-xs font-bold text-teal">${fmt(s.total)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>
    </div>
  `;

  // Bind Switch template action
  container.querySelector('#dash-switch-profile').addEventListener('click', () => {
    showConfirm('Reset current database and choose another demo business template?', () => {
      window.resetAndTriggerTemplatePicker();
    });
  });

  // Bind Open POS
  container.querySelector('#dash-goto-pos').addEventListener('click', () => {
    navigate('pos');
  });
}

// ── SVG line chart trendline ────────────────────────────────────
function renderTrendline(sales) {
  const points = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dayRev = sales
      .filter(s => new Date(s.timestamp).toDateString() === d.toDateString())
      .reduce((sum, s) => sum + (s.total || 0), 0);
    
    points.push({
      label: d.toLocaleDateString('en-PK', { weekday: 'short' }),
      val: dayRev
    });
  }

  const maxVal = Math.max(...points.map(p => p.val), 2000);
  const w = 480;
  const h = 180;
  const p = 15;

  const cw = w - p * 2;
  const ch = h - p * 2;

  const coords = points.map((pt, idx) => {
    const x = p + (idx / 6) * cw;
    const y = p + ch - (pt.val / maxVal) * ch;
    return { x, y, label: pt.label, val: pt.val };
  });

  const path = coords.reduce((acc, c, idx) => `${acc}${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y} `, '');
  const area = path + `L ${coords[coords.length-1].x} ${h - p} L ${coords[0].x} ${h - p} Z`;

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%">
      <line x1="${p}" y1="${p}" x2="${w - p}" y2="${p}" stroke="var(--border-soft)" stroke-dasharray="3,3"/>
      <line x1="${p}" y1="${p + ch/2}" x2="${w - p}" y2="${p + ch/2}" stroke="var(--border-soft)" stroke-dasharray="3,3"/>
      <line x1="${p}" y1="${h - p}" x2="${w - p}" y2="${h - p}" stroke="var(--border)" stroke-width="1"/>

      <path d="${area}" fill="rgb(15 118 110 / 0.04)"/>
      <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

      ${coords.map(c => `
        <circle cx="${c.x}" cy="${c.y}" r="3.5" fill="white" stroke="var(--primary)" stroke-width="1.5">
          <title>${c.label}: ${fmt(c.val)}</title>
        </circle>
        <text x="${c.x}" y="${h - 2}" font-size="8" fill="var(--text-secondary)" text-anchor="middle">${c.label}</text>
      `).join('')}
      
      <text x="${p + 5}" y="${p + 8}" font-size="8" fill="var(--text-muted)">MAX: ${fmt(maxVal)}</text>
    </svg>
  `;
}

// ── Render Category progress bars ────────────────────────────────
function renderCategorySplit(items) {
  const cats = {};
  items.forEach(it => {
    if (!it.is_composite) {
      if (!cats[it.category]) cats[it.category] = 0;
      cats[it.category]++;
    }
  });

  const sorted = Object.entries(cats)
    .map(([cat, count]) => ({ cat, count }))
    .sort((a,b) => b.count - a.count);

  if (sorted.length === 0) return '<p class="text-xs text-secondary" style="text-align:center">No inventory items loaded.</p>';

  const maxVal = Math.max(...sorted.map(s => s.count), 1);

  return sorted.slice(0, 5).map(c => {
    const pct = (c.count / maxVal * 100).toFixed(0);
    return `
      <div style="display:flex;align-items:center;gap:var(--space-2)">
        <div class="text-xs font-semibold truncate" style="width:100px;text-align:right">${c.cat}</div>
        <div style="flex:1;background:var(--canvas);height:8px;border-radius:var(--radius-full);overflow:hidden">
          <div style="width:${pct}%;background:var(--primary);height:100%;border-radius:var(--radius-full)"></div>
        </div>
        <div class="text-xs mono font-bold" style="width:50px">${c.count} items</div>
      </div>
    `;
  }).join('');
}
