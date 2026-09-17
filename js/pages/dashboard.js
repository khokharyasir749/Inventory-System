/**
 * dashboard.js — Enterprise Executive Analytics & KPI Intelligence Panel
 * Features:
 * 1. Real-time KPI summary cards: Revenue (growth vs yesterday), Net Profit & Margin %, Basket Size, Stock Risk
 * 2. Responsive 7-Day / 30-Day Sales & Profit dual-metric trendline with interactive view toggle
 * 3. 24-Hour Hourly Sales Heatmap / Peak Rush Hours visualization
 * 4. Top 5 Best-Selling Products & Inventory Categories distribution
 * 5. Multi-tender payment method breakdown (Cash vs Card vs Digital vs Split)
 */

let dashTrendPeriod = '7d'; // '7d' | '30d'

async function renderDashboard(container) {
  // Initial loading skeleton
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
      ${[1,2,3,4,5,6].map(() => `<div class="kpi-card"><div class="skeleton" style="height:60px"></div></div>`).join('')}
    </div>
  `;

  await refreshDashboardContent(container);
}

async function refreshDashboardContent(container) {
  // Fetch required tables in parallel
  const [items, sales, saleItems, logs, batches, storeName, storeLogo, currency, currentTemplate] = await Promise.all([
    db.items.toArray(),
    db.sales.toArray(),
    db.sale_items.toArray(),
    db.logs.orderBy('timestamp').reverse().limit(60).toArray(),
    db.batches.toArray(),
    getSetting('store_name', 'Executive Store'),
    getSetting('store_logo', ''),
    getSetting('currency', 'Rs.'),
    getSetting('demo_business', 'grocery')
  ]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const yestStart  = new Date(todayStart.getTime() - 86400000);
  const yestEnd    = new Date(todayStart.getTime() - 1);

  // Filter Today & Yesterday Sales
  const todaySales = sales.filter(s => new Date(s.timestamp) >= todayStart);
  const yestSales  = sales.filter(s => {
    const t = new Date(s.timestamp);
    return t >= yestStart && t <= yestEnd;
  });

  const todayRev = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const yestRev  = yestSales.reduce((sum, s) => sum + (s.total || 0), 0);

  // Revenue Growth % vs Yesterday
  let growthPct = 0;
  if (yestRev > 0) {
    growthPct = (((todayRev - yestRev) / yestRev) * 100).toFixed(1);
  } else if (todayRev > 0) {
    growthPct = 100;
  }

  // Today Profit & Margin Calculation (Net Revenue - COGS)
  const todaySaleIds = new Set(todaySales.map(s => s.id));
  const todaySaleItems = saleItems.filter(si => todaySaleIds.has(si.sale_id));
  const todayCogs = todaySaleItems.reduce((sum, si) => sum + ((si.cost_price || 0) * si.quantity), 0);
  const todayProfit = Math.max(0, todaySales.reduce((sum, s) => sum + (s.subtotal - s.discount), 0) - todayCogs);
  const marginPct = todayRev > 0 ? ((todayProfit / todayRev) * 100).toFixed(1) : '0.0';

  // Transaction count & average basket size
  const txCount = todaySales.length;
  const avgBasket = txCount > 0 ? Math.round(todayRev / txCount) : 0;

  // Stock Risk Counts
  const outOfStockItems = items.filter(it => !it.is_composite && it.stock_quantity <= 0);
  const lowStockItems = items.filter(it => !it.is_composite && it.stock_quantity > 0 && it.stock_quantity <= it.min_stock_alert);

  // Month-to-date & total valuation
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSales   = sales.filter(s => new Date(s.timestamp) >= startOfMonth);
  const monthRev     = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalStockVal = items.filter(it => !it.is_composite).reduce((sum, it) => sum + ((it.cost_price || 0) * (it.stock_quantity || 0)), 0);

  // Expiring Batches
  const expiringLots = batches.filter(b => {
    const diff = Math.ceil((new Date(b.expiry_date) - now) / 86400000);
    return diff >= 0 && diff <= 30;
  });

  // Render Dashboard HTML
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1 style="display:flex;align-items:center;gap:10px;">
          ${storeLogo ? `<img src="${storeLogo}" alt="Logo" id="dash-brand-logo-img" style="width:34px;height:34px;border-radius:var(--radius-md);object-fit:cover;border:1px solid var(--border-soft);background:white;" />` : ''}
          <span id="dash-brand-store-name">${storeName}</span>
          <span class="health-pulse-dot" title="Local-First Node Active"></span>
        </h1>
        <p class="text-secondary text-sm">Enterprise Executive Analytics · ${currentTemplate.toUpperCase()} Profile</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" id="dash-switch-profile">${icon('icon-store')} Change Template</button>
        <button class="btn btn-primary btn-sm" id="dash-goto-pos">${icon('icon-pos')} Open POS [F2]</button>
      </div>
    </div>

    <!-- Row 1: Interactive Executive KPI Grid -->
    <div class="kpi-grid" style="margin-bottom:var(--space-4)">
      <!-- KPI 1: Today Revenue -->
      <div class="kpi-card" style="border-left:4px solid var(--primary)">
        <div class="kpi-card-body">
          <div class="kpi-value text-primary mono">${fmt(todayRev)}</div>
          <div class="kpi-label">Today's Revenue</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
            <span class="kpi-growth-badge ${growthPct >= 0 ? 'positive' : 'negative'}">
              ${growthPct >= 0 ? '▲ +' : '▼ '}${growthPct}% vs yest.
            </span>
            <span class="kpi-subtext">Yest: ${fmt(yestRev)}</span>
          </div>
        </div>
      </div>

      <!-- KPI 2: Today Net Profit & Margin -->
      <div class="kpi-card" style="border-left:4px solid var(--emerald, #10b981)">
        <div class="kpi-card-body">
          <div class="kpi-value text-green mono">${fmt(todayProfit)}</div>
          <div class="kpi-label">Net Profit Today</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
            <span class="kpi-growth-badge positive">Gross Margin: ${marginPct}%</span>
            <span class="kpi-subtext">COGS: ${fmt(todayCogs)}</span>
          </div>
        </div>
      </div>

      <!-- KPI 3: Volume & Basket Size -->
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value mono">${txCount} <span style="font-size:0.9rem;font-weight:600;color:var(--text-muted)">Orders</span></div>
          <div class="kpi-label">Order Volume Today</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
            <span class="kpi-growth-badge neutral">Avg Basket: ${fmt(avgBasket)}</span>
            <span class="kpi-subtext">${monthSales.length} this month</span>
          </div>
        </div>
      </div>

      <!-- KPI 4: Stock Risk Counter -->
      <div class="kpi-card" style="border-left:4px solid var(--danger);cursor:pointer;" id="kpi-stock-risk" title="Click to view low/out-of-stock items">
        <div class="kpi-card-body">
          <div class="kpi-value text-red mono">${outOfStockItems.length + lowStockItems.length}</div>
          <div class="kpi-label">Stock Risk Items</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
            <span class="kpi-growth-badge negative">${outOfStockItems.length} Out · ${lowStockItems.length} Low</span>
            <span class="kpi-subtext text-primary" style="font-weight:600;">View &gt;</span>
          </div>
        </div>
      </div>

      <!-- KPI 5: Month-to-date Revenue -->
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-indigo mono">${fmt(monthRev)}</div>
          <div class="kpi-label">Month-to-Date Revenue</div>
          <div class="kpi-subtext">Current billing cycle</div>
        </div>
      </div>

      <!-- KPI 6: Total Inventory Value -->
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-secondary mono">${fmt(totalStockVal)}</div>
          <div class="kpi-label">Inventory Asset Value</div>
          <div class="kpi-subtext">${items.length} SKUs cataloged</div>
        </div>
      </div>
    </div>

    <!-- Row 2: Sales Trendline & Peak Hours Heatmap -->
    <div class="grid-2" style="margin-bottom:var(--space-4)">
      <!-- Sales & Profit Trendline with 7D / 30D Toggle -->
      <div class="section-card">
        <div class="section-card-header" style="display:flex;align-items:center;justify-content:space-between">
          <span class="section-card-title">${icon('icon-trending-up')} Revenue & Profit Velocity</span>
          <div style="display:flex;gap:4px;background:var(--surface-raised);padding:2px;border-radius:var(--radius-md);border:1px solid var(--border)">
            <button class="btn btn-ghost btn-xs ${dashTrendPeriod === '7d' ? 'active' : ''}" id="btn-trend-7d" style="padding:2px 8px;font-size:0.75rem;">7 Days</button>
            <button class="btn btn-ghost btn-xs ${dashTrendPeriod === '30d' ? 'active' : ''}" id="btn-trend-30d" style="padding:2px 8px;font-size:0.75rem;">30 Days</button>
          </div>
        </div>
        <div id="trendline-chart-container" style="height:210px;display:flex;align-items:center;justify-content:center;position:relative;">
          ${renderTrendlineChart(sales, saleItems, dashTrendPeriod)}
        </div>
        <div style="display:flex;justify-content:center;gap:var(--space-4);margin-top:var(--space-2);font-size:0.75rem;">
          <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:var(--primary);border-radius:2px;display:inline-block;"></span> Revenue</span>
          <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;background:var(--emerald, #10b981);border-radius:2px;display:inline-block;"></span> Net Profit</span>
        </div>
      </div>

      <!-- 24-Hour Peak Rush Hours Heatmap -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-clock')} Hourly Sales Heatmap (Peak Rush Hours)</span>
        </div>
        <div style="height:210px;display:flex;flex-direction:column;justify-content:space-between;">
          ${renderHourlyHeatmap(sales)}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:var(--text-muted);margin-top:var(--space-2);">
          <span>12 AM (Midnight)</span>
          <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;background:var(--warning, #f59e0b);border-radius:2px;display:inline-block;"></span> Peak Volume</span>
          <span>11 PM (Night)</span>
        </div>
      </div>
    </div>

    <!-- Row 3: Best Sellers & Payment Method Breakdown -->
    <div class="grid-2" style="margin-bottom:var(--space-4)">
      <!-- Top 5 Best Selling Items -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-star')} Top 5 Best-Selling Products</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-1) 0;">
          ${renderTopProducts(sales, saleItems, items)}
        </div>
      </div>

      <!-- Payment Method Split -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-card')} Tender Method Breakdown</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-1) 0;">
          ${renderPaymentBreakdown(sales)}
        </div>
      </div>
    </div>

    <!-- Row 4: Expiring Batches & Recent Sales Ledger -->
    <div class="grid-2">
      <!-- Expiring Products Alerts -->
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title text-amber">${icon('icon-alert')} Expiring Batches (Next 30 Days)</span>
        </div>
        <div class="table-scroll" style="max-height:220px">
          ${expiringLots.length === 0
            ? '<p class="text-xs text-secondary" style="padding:16px;text-align:center">No batches expiring within 30 days.</p>'
            : `<table>
                <thead><tr><th>Product</th><th>Batch #</th><th>Expiry</th></tr></thead>
                <tbody>
                  ${expiringLots.slice(0, 5).map(b => {
                    const matchedItem = items.find(it => it.id === b.item_id);
                    return `
                      <tr>
                        <td class="font-semibold text-xs">${matchedItem ? matchedItem.name : 'Product'}</td>
                        <td class="mono text-xs">${b.batch_number}</td>
                        <td class="mono text-xs text-red font-bold">${fmtDate(b.expiry_date)}</td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>

      <!-- Recent Drawer Transactions -->
      <div class="section-card">
        <div class="section-card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <span class="section-card-title">${icon('icon-reports')} Recent Completed Transactions</span>
          <button class="btn btn-ghost btn-xs" onclick="navigate('reports')">View All</button>
        </div>
        <div class="table-scroll" style="max-height:220px">
          ${sales.length === 0
            ? '<p class="text-xs text-secondary" style="padding:16px;text-align:center">No transactions registered yet.</p>'
            : `<table>
                <thead><tr><th>Invoice</th><th>Time</th><th>Method</th><th>Total</th></tr></thead>
                <tbody>
                  ${sales.slice(-5).reverse().map(s => `
                    <tr>
                      <td class="mono text-xs font-semibold">${s.invoice_no.split('-')[1] || s.invoice_no}</td>
                      <td class="text-xs text-secondary">${fmtTime(s.timestamp)}</td>
                      <td><span class="badge badge-gray text-xs">${s.payment_method || 'Cash'}</span></td>
                      <td class="mono text-xs font-bold text-primary">${fmt(s.total)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`
          }
        </div>
      </div>
    </div>
  `;

  // ── Event Bindings ──────────────────────────────────────────
  container.querySelector('#kpi-stock-risk')?.addEventListener('click', () => {
    navigate('inventory');
  });

  container.querySelector('#dash-switch-profile')?.addEventListener('click', () => {
    showConfirm('Reset database and choose a different business profile template?', () => {
      window.resetAndTriggerTemplatePicker();
    });
  });

  container.querySelector('#dash-goto-pos')?.addEventListener('click', () => {
    navigate('pos');
  });

  // Trendline toggle (7d vs 30d)
  container.querySelector('#btn-trend-7d')?.addEventListener('click', () => {
    dashTrendPeriod = '7d';
    container.querySelector('#btn-trend-7d').classList.add('active');
    container.querySelector('#btn-trend-30d').classList.remove('active');
    const chartBox = container.querySelector('#trendline-chart-container');
    if (chartBox) chartBox.innerHTML = renderTrendlineChart(sales, saleItems, '7d');
  });

  container.querySelector('#btn-trend-30d')?.addEventListener('click', () => {
    dashTrendPeriod = '30d';
    container.querySelector('#btn-trend-30d').classList.add('active');
    container.querySelector('#btn-trend-7d').classList.remove('active');
    const chartBox = container.querySelector('#trendline-chart-container');
    if (chartBox) chartBox.innerHTML = renderTrendlineChart(sales, saleItems, '30d');
  });
}

// ── Responsive SVG Trendline Chart (Dual Metric) ──────────────
function renderTrendlineChart(sales, saleItems, period = '7d') {
  const days = period === '7d' ? 7 : 30;
  const points = [];
  const now = new Date();

  // Create item cost map
  const costMap = {};
  saleItems.forEach(si => { costMap[si.sale_id] = (costMap[si.sale_id] || 0) + ((si.cost_price || 0) * si.quantity); });

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toDateString();

    const matchingSales = sales.filter(s => new Date(s.timestamp).toDateString() === dateStr);
    const dayRev = matchingSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const dayCogs = matchingSales.reduce((sum, s) => sum + (costMap[s.id] || 0), 0);
    const dayProfit = Math.max(0, dayRev - dayCogs);

    points.push({
      label: days === 7 ? d.toLocaleDateString('en-PK', { weekday: 'short' }) : `${d.getDate()}/${d.getMonth()+1}`,
      rev: dayRev,
      profit: dayProfit
    });
  }

  const maxVal = Math.max(...points.map(p => Math.max(p.rev, p.profit)), 2000);
  const w = 520;
  const h = 180;
  const p = 20;

  const cw = w - p * 2;
  const ch = h - p * 2;

  const coords = points.map((pt, idx) => {
    const x = p + (idx / (days - 1)) * cw;
    const yRev = p + ch - (pt.rev / maxVal) * ch;
    const yProfit = p + ch - (pt.profit / maxVal) * ch;
    return { x, yRev, yProfit, label: pt.label, rev: pt.rev, profit: pt.profit };
  });

  const revPath = coords.reduce((acc, c, idx) => `${acc}${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yRev.toFixed(1)} `, '');
  const profitPath = coords.reduce((acc, c, idx) => `${acc}${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yProfit.toFixed(1)} `, '');
  const profitArea = profitPath + `L ${coords[coords.length-1].x.toFixed(1)} ${h - p} L ${coords[0].x.toFixed(1)} ${h - p} Z`;

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%;overflow:visible;">
      <!-- Grid Lines -->
      <line x1="${p}" y1="${p}" x2="${w - p}" y2="${p}" stroke="var(--border-soft)" stroke-dasharray="3,3"/>
      <line x1="${p}" y1="${p + ch/2}" x2="${w - p}" y2="${p + ch/2}" stroke="var(--border-soft)" stroke-dasharray="3,3"/>
      <line x1="${p}" y1="${h - p}" x2="${w - p}" y2="${h - p}" stroke="var(--border)" stroke-width="1"/>

      <!-- Profit Fill Area -->
      <path d="${profitArea}" fill="rgba(16, 185, 129, 0.12)"/>

      <!-- Revenue Line -->
      <path d="${revPath}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Profit Line -->
      <path d="${profitPath}" fill="none" stroke="var(--emerald, #10b981)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${period === '30d' ? '4,2' : 'none'}"/>

      <!-- Interactive Data Dots -->
      ${coords.filter((_, idx) => period === '7d' || idx % 4 === 0 || idx === coords.length - 1).map(c => `
        <circle cx="${c.x.toFixed(1)}" cy="${c.yRev.toFixed(1)}" r="3" fill="var(--surface)" stroke="var(--primary)" stroke-width="2">
          <title>${c.label}: Rev ${fmt(c.rev)} | Profit ${fmt(c.profit)}</title>
        </circle>
        <text x="${c.x.toFixed(1)}" y="${h - 4}" font-size="8" fill="var(--text-muted)" text-anchor="middle" font-family="var(--font-mono)">${c.label}</text>
      `).join('')}

      <text x="${p + 4}" y="${p - 4}" font-size="8" fill="var(--text-muted)" font-family="var(--font-mono)">PEAK: ${fmt(maxVal)}</text>
    </svg>
  `;
}

// ── 24-Hour Hourly Sales Heatmap ──────────────────────────────
function renderHourlyHeatmap(sales) {
  const hourlyCounts = Array(24).fill(0);
  const hourlyRevenue = Array(24).fill(0);

  sales.forEach(s => {
    const hour = new Date(s.timestamp).getHours();
    hourlyCounts[hour]++;
    hourlyRevenue[hour] += (s.total || 0);
  });

  const maxCount = Math.max(...hourlyCounts, 1);

  return `
    <div class="hourly-heatmap-grid">
      ${hourlyCounts.map((count, hour) => {
        const heightPct = Math.max(8, (count / maxCount) * 100);
        const isPeak = count === maxCount && count > 0;
        const rev = hourlyRevenue[hour];
        const formattedHour = hour === 0 ? '12A' : hour < 12 ? `${hour}A` : hour === 12 ? '12P' : `${hour-12}P`;

        return `
          <div class="heatmap-col" title="${formattedHour}: ${count} Orders · ${fmt(rev)}">
            <div class="heatmap-bar ${isPeak ? 'peak' : ''}" style="height:${heightPct}%;"></div>
            <span class="heatmap-label">${hour % 3 === 0 ? formattedHour : ''}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Top 5 Best Selling Products ───────────────────────────────
function renderTopProducts(sales, saleItems, items) {
  const itemTotals = {};

  saleItems.forEach(si => {
    if (!itemTotals[si.item_id]) {
      itemTotals[si.item_id] = { qty: 0, revenue: 0 };
    }
    itemTotals[si.item_id].qty += si.quantity;
    itemTotals[si.item_id].revenue += si.line_total || (si.unit_price * si.quantity);
  });

  const sorted = Object.entries(itemTotals)
    .map(([id, data]) => {
      const it = items.find(i => i.id === parseInt(id));
      return {
        id,
        name: it ? it.name : 'Unknown Product',
        category: it ? it.category : 'General',
        qty: data.qty,
        revenue: data.revenue
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  if (sorted.length === 0) {
    return '<p class="text-xs text-secondary" style="padding:12px;text-align:center;">No product sales recorded yet.</p>';
  }

  const maxRev = Math.max(...sorted.map(s => s.revenue), 1);

  return sorted.map((prod, idx) => {
    const pct = Math.max(10, Math.round((prod.revenue / maxRev) * 100));
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;font-size:0.8125rem;">
          <div style="display:flex;align-items:center;gap:6px;max-width:65%;">
            <span class="mono font-bold text-xs text-muted" style="width:16px;">#${idx + 1}</span>
            <span class="font-bold text-primary truncate" title="${prod.name}">${prod.name}</span>
            <span class="badge badge-gray text-xs" style="font-size:0.65rem;">${prod.category}</span>
          </div>
          <div style="text-align:right;">
            <span class="mono font-bold text-xs">${fmt(prod.revenue)}</span>
            <span class="text-xs text-muted">(${prod.qty} sold)</span>
          </div>
        </div>
        <div style="height:6px;background:var(--canvas);border-radius:var(--radius-full);overflow:hidden;border:1px solid var(--border-soft);">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, var(--primary), var(--teal, #0d9488));border-radius:var(--radius-full);"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Payment Method Breakdown ──────────────────────────────────
function renderPaymentBreakdown(sales) {
  const methodTotals = {
    Cash: 0,
    Card: 0,
    Digital: 0,
    Split: 0
  };

  let totalVolume = 0;

  sales.forEach(s => {
    const amt = s.total || 0;
    totalVolume += amt;
    const m = (s.payment_method || 'Cash').toLowerCase();
    if (m.includes('cash')) methodTotals.Cash += amt;
    else if (m.includes('card')) methodTotals.Card += amt;
    else if (m.includes('split')) methodTotals.Split += amt;
    else methodTotals.Digital += amt;
  });

  if (totalVolume === 0) {
    return '<p class="text-xs text-secondary" style="padding:12px;text-align:center;">No payment transactions recorded yet.</p>';
  }

  const entries = [
    { name: 'Cash', val: methodTotals.Cash, color: 'var(--emerald, #10b981)', icon: '💵' },
    { name: 'Card', val: methodTotals.Card, color: 'var(--primary)', icon: '💳' },
    { name: 'Digital Wallet', val: methodTotals.Digital, color: 'var(--teal, #0d9488)', icon: '📱' },
    { name: 'Split Tender', val: methodTotals.Split, color: 'var(--warning, #f59e0b)', icon: '🔀' }
  ];

  return entries.map(item => {
    const pct = totalVolume > 0 ? ((item.val / totalVolume) * 100).toFixed(1) : '0.0';
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;font-size:0.8125rem;">
          <span style="display:flex;align-items:center;gap:6px;font-weight:600;">
            <span>${item.icon}</span> ${item.name}
          </span>
          <div style="text-align:right;">
            <span class="mono font-bold">${fmt(item.val)}</span>
            <span class="text-xs text-muted">(${pct}%)</span>
          </div>
        </div>
        <div style="height:6px;background:var(--canvas);border-radius:var(--radius-full);overflow:hidden;border:1px solid var(--border-soft);">
          <div style="width:${pct}%;height:100%;background:${item.color};border-radius:var(--radius-full);"></div>
        </div>
      </div>
    `;
  }).join('');
}
