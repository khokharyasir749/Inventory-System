/**
 * analytics.js — Profit & Business Analytics
 * Metrics: Revenue, COGS, Gross Profit, margins, top-selling/slow-moving, category stats, inventory value.
 * Charts: Pure responsive SVG trendlines and bar graphs.
 */

let analyticsRange = 'month'; // 'today' | 'week' | 'month' | 'custom'
let analyticsCustomFrom = '';
let analyticsCustomTo = '';

async function renderAnalytics(container) {
  // Set custom dates to past month by default
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  analyticsCustomFrom = monthAgo;
  analyticsCustomTo = today;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Business Analytics</h1>
        <p>Real-time reports on sales margins, profit trends, and stock valuation</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar" style="gap:var(--space-3)">
      <div class="filter-pills" id="analytics-range-pills">
        <button class="btn btn-pill btn-ghost ${analyticsRange === 'today' ? 'active' : ''}" data-arange="today">Today</button>
        <button class="btn btn-pill btn-ghost ${analyticsRange === 'week' ? 'active' : ''}" data-arange="week">This Week</button>
        <button class="btn btn-pill btn-ghost ${analyticsRange === 'month' ? 'active' : ''}" data-arange="month">This Month</button>
        <button class="btn btn-pill btn-ghost ${analyticsRange === 'custom' ? 'active' : ''}" data-arange="custom">Custom Range</button>
      </div>
      <div id="analytics-custom-dates" class="flex gap-2 items-center ${analyticsRange !== 'custom' ? 'hidden' : ''}">
        <input type="date" class="form-input" id="analytics-from" value="${analyticsCustomFrom}" style="width:auto;padding:7px 10px;font-size:0.8125rem;">
        <span class="text-sm text-secondary">to</span>
        <input type="date" class="form-input" id="analytics-to" value="${analyticsCustomTo}" style="width:auto;padding:7px 10px;font-size:0.8125rem;">
      </div>
    </div>

    <div id="analytics-outlet" class="animate-fade-in">
      <div class="section-card"><div class="skeleton" style="height:300px"></div></div>
    </div>
  `;

  const rangePills = container.querySelector('#analytics-range-pills');
  const customDates = container.querySelector('#analytics-custom-dates');

  rangePills.querySelectorAll('[data-arange]').forEach(btn => {
    btn.addEventListener('click', async () => {
      analyticsRange = btn.dataset.arange;
      rangePills.querySelectorAll('[data-arange]').forEach(b => b.classList.toggle('active', b === btn));
      customDates.classList.toggle('hidden', analyticsRange !== 'custom');
      await refreshAnalytics(container);
    });
  });

  container.querySelector('#analytics-from').addEventListener('change', async (e) => {
    analyticsCustomFrom = e.target.value;
    await refreshAnalytics(container);
  });

  container.querySelector('#analytics-to').addEventListener('change', async (e) => {
    analyticsCustomTo = e.target.value;
    await refreshAnalytics(container);
  });

  await refreshAnalytics(container);
}

async function refreshAnalytics(container) {
  const outlet = container.querySelector('#analytics-outlet');
  if (!outlet) return;

  // 1. Determine date bounds
  let fromDate = new Date();
  let toDate = new Date();
  const now = new Date();

  if (analyticsRange === 'today') {
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
  } else if (analyticsRange === 'week') {
    // Start of current week (Monday)
    const day = fromDate.getDay() || 7;
    fromDate.setDate(fromDate.getDate() - day + 1);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
  } else if (analyticsRange === 'month') {
    fromDate.setDate(1);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
  } else if (analyticsRange === 'custom') {
    fromDate = new Date(analyticsCustomFrom || now);
    fromDate.setHours(0, 0, 0, 0);
    toDate = new Date(analyticsCustomTo || now);
    toDate.setHours(23, 59, 59, 999);
  }

  // 2. Fetch sales, items, sale_items, and logs
  const [sales, saleItems, items] = await Promise.all([
    db.sales.toArray(),
    db.sale_items.toArray(),
    db.items.toArray()
  ]);

  // Filter sales inside date bounds
  const rangeSales = sales.filter(s => {
    const d = new Date(s.timestamp);
    return d >= fromDate && d <= toDate;
  });

  const saleIds = new Set(rangeSales.map(s => s.id));
  const rangeSaleItems = saleItems.filter(si => saleIds.has(si.sale_id));

  // 3. Perform Metric Calculations
  const grossRevenue = rangeSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const netRevenue = rangeSales.reduce((sum, s) => sum + (s.subtotal - s.discount), 0);
  const totalCogs = rangeSaleItems.reduce((sum, si) => sum + ((si.cost_price || 0) * si.quantity), 0);
  const grossProfit = netRevenue - totalCogs;
  const profitMargin = netRevenue > 0 ? (grossProfit / netRevenue * 100) : 0;

  // Valuation
  const totalStockValCost = items.filter(it => !it.is_composite).reduce((sum, it) => sum + (it.cost_price * (it.stock_quantity || 0)), 0);
  const totalStockValRetail = items.filter(it => !it.is_composite).reduce((sum, it) => sum + (it.selling_price * (it.stock_quantity || 0)), 0);
  const potentialProfit = totalStockValRetail - totalStockValCost;
  const lowStockCount = items.filter(it => !it.is_composite && it.stock_quantity <= it.min_stock_alert).length;

  // 4. Product Sales Grouping
  const prodSalesMap = {};
  items.forEach(it => {
    prodSalesMap[it.id] = { name: it.name, category: it.category, qty: 0, revenue: 0, cost: 0, profit: 0, stock: it.stock_quantity };
  });

  rangeSaleItems.forEach(si => {
    if (!prodSalesMap[si.item_id]) {
      prodSalesMap[si.item_id] = { name: 'Deleted Item', category: 'Other', qty: 0, revenue: 0, cost: 0, profit: 0, stock: 0 };
    }
    const o = prodSalesMap[si.item_id];
    o.qty += si.quantity;
    o.revenue += si.line_total;
    o.cost += (si.cost_price || 0) * si.quantity;
    o.profit += si.line_total - ((si.cost_price || 0) * si.quantity);
  });

  const productStats = Object.values(prodSalesMap);
  const topSelling = [...productStats].filter(p => p.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const slowMoving = [...productStats].filter(p => p.stock > 0).sort((a, b) => a.qty - b.qty).slice(0, 5);

  // 5. Category Performance
  const catSales = {};
  productStats.forEach(p => {
    if (!catSales[p.category]) catSales[p.category] = 0;
    catSales[p.category] += p.revenue;
  });

  const categoriesChartData = Object.entries(catSales)
    .map(([cat, rev]) => ({ cat, rev }))
    .sort((a, b) => b.rev - a.rev)
    .filter(c => c.rev > 0);

  // 6. Draw line chart of daily sales trend in range
  const daysDiff = Math.ceil((toDate - fromDate) / 86400000);
  const dailyPoints = [];

  for (let i = 0; i <= daysDiff; i++) {
    const loopDate = new Date(fromDate);
    loopDate.setDate(fromDate.getDate() + i);
    const dayLabel = loopDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
    const dayRev = rangeSales
      .filter(s => new Date(s.timestamp).toDateString() === loopDate.toDateString())
      .reduce((sum, s) => sum + (s.total || 0), 0);

    dailyPoints.push({ label: dayLabel, revenue: dayRev });
  }

  // Generate SVG Line Chart
  const svgLineChart = generateSVGLineChart(dailyPoints);

  // Render Page Content
  outlet.innerHTML = `
    <!-- Top KPI Cards -->
    <div class="kpi-grid" style="margin-bottom:var(--space-6)">
      <div class="kpi-card">
        <div class="kpi-card-header"><div class="kpi-icon kpi-icon-teal">${icon('icon-dollar')}</div></div>
        <div class="kpi-card-body">
          <div class="kpi-value text-teal">${fmt(grossRevenue)}</div>
          <div class="kpi-label">Gross Revenue (incl. Tax)</div>
          <div class="text-xs text-muted" style="margin-top:2px">Net Sales: ${fmt(netRevenue)}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-header"><div class="kpi-icon kpi-icon-indigo">${icon('icon-package')}</div></div>
        <div class="kpi-card-body">
          <div class="kpi-value text-indigo">${fmt(totalCogs)}</div>
          <div class="kpi-label">Cost of Goods Sold (COGS)</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-header"><div class="kpi-icon kpi-icon-green">${icon('icon-trending-up')}</div></div>
        <div class="kpi-card-body">
          <div class="kpi-value text-green">${fmt(grossProfit)}</div>
          <div class="kpi-label">Gross Profit margin</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-header"><div class="kpi-icon kpi-icon-amber">${icon('icon-info')}</div></div>
        <div class="kpi-card-body">
          <div class="kpi-value text-amber">${profitMargin.toFixed(1)}%</div>
          <div class="kpi-label">Profit Margin %</div>
        </div>
      </div>
    </div>

    <!-- Chart row -->
    <div class="grid-2" style="margin-bottom:var(--space-6)">
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-trending-up')} Sales & Revenue Trend</span>
        </div>
        <div style="height:250px;width:100%;display:flex;align-items:center;justify-content:center">
          ${svgLineChart}
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-reports')} Category Revenue Performance</span>
        </div>
        <div style="height:250px;width:100%;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-2);justify-content:center">
          ${categoriesChartData.length === 0
      ? '<p class="text-sm text-secondary" style="text-align:center">No category data for this period.</p>'
      : generateSVGBars(categoriesChartData)
    }
        </div>
      </div>
    </div>

    <!-- Inventory valuation row -->
    <div class="grid-3" style="margin-bottom:var(--space-6)">
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-primary mono">${fmt(totalStockValCost)}</div>
          <div class="kpi-label">Inventory Asset Value (Cost)</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-teal mono">${fmt(totalStockValRetail)}</div>
          <div class="kpi-label">Inventory Sales Potential (Retail)</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-body">
          <div class="kpi-value text-green mono">${fmt(potentialProfit)}</div>
          <div class="kpi-label">Valuation Potential Profit</div>
        </div>
      </div>
    </div>

    <!-- Products grids -->
    <div class="grid-2">
      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-trending-up', 'text-green')} Top Selling Products</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
                <th>Profit Margin</th>
              </tr>
            </thead>
            <tbody>
              ${topSelling.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No items sold</td></tr>'
      : topSelling.map(p => {
        const margin = p.revenue > 0 ? (p.profit / p.revenue * 100).toFixed(0) : 0;
        return `
                      <tr>
                        <td class="font-semibold">${p.name}</td>
                        <td class="mono font-bold">${p.qty}</td>
                        <td class="mono">${fmt(p.revenue)}</td>
                        <td class="mono"><span class="badge badge-green">${margin}%</span></td>
                      </tr>`;
      }).join('')
    }
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-header">
          <span class="section-card-title">${icon('icon-alert', 'text-amber')} Slow-Moving Inventory Items</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Current Stock</th>
                <th>Qty Sold</th>
                <th>Potential Loss / Dead Value</th>
              </tr>
            </thead>
            <tbody>
              ${slowMoving.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">All items sold out</td></tr>'
      : slowMoving.map(p => `
                    <tr>
                      <td class="font-semibold">${p.name}</td>
                      <td class="mono font-bold">${p.stock}</td>
                      <td class="mono text-muted">${p.qty} sold</td>
                      <td class="mono text-red">${fmt(p.stock * (p.revenue / (p.qty || 1) || 0))}</td>
                    </tr>`).join('')
    }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ── SVG Charts Generation ──────────────────────────────────────
function generateSVGLineChart(points) {
  if (points.length === 0) return '<p class="text-sm text-secondary">No data to display.</p>';

  const maxVal = Math.max(...points.map(p => p.revenue), 1000);
  const width = 500;
  const height = 200;
  const padding = 20;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Map to SVG coordinates
  const coords = points.map((p, idx) => {
    const x = padding + (idx / (points.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - (p.revenue / maxVal) * chartHeight;
    return { x, y, label: p.label, val: p.revenue };
  });

  const pathD = coords.reduce((acc, c, idx) => {
    return acc + `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y} `;
  }, '');

  const areaD = pathD + `L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:100%">
      <!-- Grid lines -->
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="var(--border-soft)" stroke-dasharray="3,3" />
      <line x1="${padding}" y1="${padding + chartHeight / 2}" x2="${width - padding}" y2="${padding + chartHeight / 2}" stroke="var(--border-soft)" stroke-dasharray="3,3" />
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border)" stroke-width="1.5"/>

      <!-- Fill area under trend -->
      <path d="${areaD}" fill="rgb(15 118 110 / 0.05)" />

      <!-- Plot Line -->
      <path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Data Dots -->
      ${coords.length < 35 ? coords.map(c => `
        <circle cx="${c.x}" cy="${c.y}" r="4" fill="white" stroke="var(--primary)" stroke-width="2" style="cursor:pointer">
          <title>${c.label}: ${fmt(c.val)}</title>
        </circle>
      `).join('') : ''}

      <!-- Axis Labels (First & Last) -->
      ${coords.length > 0 ? `
        <text x="${coords[0].x}" y="${height - 4}" font-size="9" fill="var(--text-secondary)" text-anchor="start">${coords[0].label}</text>
        <text x="${coords[coords.length - 1].x}" y="${height - 4}" font-size="9" fill="var(--text-secondary)" text-anchor="end">${coords[coords.length - 1].label}</text>
        <text x="${padding + 5}" y="${padding + 10}" font-size="8" fill="var(--text-muted)" font-weight="700">MAX: ${fmt(maxVal)}</text>
      ` : ''}
    </svg>
  `;
}

function generateSVGBars(data) {
  const maxVal = Math.max(...data.map(d => d.rev), 1);
  return data.map(d => {
    const pct = (d.rev / maxVal * 100).toFixed(0);
    return `
      <div style="display:flex;align-items:center;gap:var(--space-3);width:100%">
        <div class="text-sm font-semibold truncate" style="width:120px;text-align:right" title="${d.cat}">${d.cat}</div>
        <div style="flex:1;background:var(--canvas);height:14px;border-radius:var(--radius-full);overflow:hidden;position:relative">
          <div style="width:${pct}%;background:var(--primary);height:100%;border-radius:var(--radius-full);transition:width var(--transition-slow)"></div>
        </div>
        <div class="mono font-bold text-sm" style="width:110px">${fmt(d.rev)}</div>
      </div>`;
  }).join('');
}
