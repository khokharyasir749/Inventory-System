/**
 * business_value.js — Commercial Value Proposition Page
 * Highlights ROI, stock loss reduction, profit visibility, and Zeploy Tech deployment advantages
 */

async function renderBusinessValue(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>How This System Helps Your Business</h1>
        <p>Key financial, operational, and deployment value delivered by Zeploy POS & Inventory</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="value-start-tour-btn">
          ${icon('icon-rocket')} Start Interactive Product Tour
        </button>
      </div>
    </div>

    <!-- Hero Banner -->
    <div class="section-card" style="background:var(--surface);border:1px solid var(--border);padding:var(--space-6);margin-bottom:var(--space-6);border-radius:var(--radius-lg)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap">
        <div style="max-width:640px">
          <div class="badge badge-primary" style="margin-bottom:var(--space-2)">
            POWERED BY ZEPLOY TECH
          </div>
          <h2 style="font-size:1.75rem;font-weight:800;color:var(--text-primary);margin-bottom:var(--space-2);letter-spacing:-0.02em">
            Commercial Business Edition
          </h2>
          <p style="color:var(--text-secondary);font-size:0.95rem;line-height:1.6">
            Eliminate inventory shrinkage, prevent out-of-stock losses, and maintain complete real-time profit visibility across your retail store operations — completely offline with zero monthly cloud fees.
          </p>
        </div>
        <div>
          <a href="#proposal" class="btn btn-primary" style="padding:12px 24px">
            ${icon('icon-print')} View Printable Proposal
          </a>
        </div>
      </div>
    </div>

    <!-- 8 Core Business Value Cards -->
    <div class="grid-2" style="gap:var(--space-4)">
      
      <!-- Card 1 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-x-circle')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">Reduce Stock Loss & Shrinkage</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            Audit trails log every item reduction, spoilage event, and manual stock adjustment. Discrepancies are flagged immediately before end-of-month reconciliations.
          </p>
        </div>
      </div>

      <!-- Card 2 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(16,185,129,0.1);color:var(--stock-in);border:1px solid rgba(16,185,129,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-package')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">Real-Time Batch & Expiry Tracking</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            FIFO batch management tracks expiring lots for pharmaceuticals, food, and perishables. Automated alerts prevent selling expired stock and minimize waste.
          </p>
        </div>
      </div>

      <!-- Card 3 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(245,158,11,0.1);color:var(--primary);border:1px solid rgba(245,158,11,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-trending-up')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">Instant Profit & COGS Visibility</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            Know exact gross profit daily ($Gross = Revenue - COGS$). Track margin percentages per item and identify top-earning categories instantly.
          </p>
        </div>
      </div>

      <!-- Card 4 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(245,158,11,0.1);color:var(--alert);border:1px solid rgba(245,158,11,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-zap')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">Rapid Touch POS & Receipt Printing</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            Quick 1-tap checkout grids, instant discount presets (5%, 10%, 15%), and thermal receipt printing complete transactions in seconds during peak rush hours.
          </p>
        </div>
      </div>

      <!-- Card 5 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:var(--surface-raised);color:var(--text-primary);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-users')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">Customer Credit & Ledger Statements</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            Allow trusted customers to buy on credit. Full ledger balance accounting, payoff tracking, and printable statements ensure zero unpaid debt confusion.
          </p>
        </div>
      </div>

      <!-- Card 6 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(245,158,11,0.1);color:var(--warning);border:1px solid rgba(245,158,11,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-layers')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">Automated BOM Recipe Deductions</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            Ideal for restaurants and bakeries. Selling 1 composite item (e.g. Burger) automatically deducts raw ingredients (Patty, Bun, Cheese) from stock.
          </p>
        </div>
      </div>

      <!-- Card 7 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:var(--surface-raised);color:var(--text-primary);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-shield')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">100% Offline Local-First Reliability</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            Never lose sales during internet outages. Data stays 100% local inside high-speed browser IndexedDB without recurring cloud subscription dependencies.
          </p>
        </div>
      </div>

      <!-- Card 8 -->
      <div class="section-card" style="display:flex;gap:var(--space-4);align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(16,185,129,0.1);color:var(--stock-in);border:1px solid rgba(16,185,129,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('icon-backup')}
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:4px">One-Click Encrypted Backups</h3>
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5">
            Export complete database JSON backups in seconds. Easily restore business state on new devices or store locations with zero technical hassle.
          </p>
        </div>
      </div>

    </div>
  `;

  container.querySelector('#value-start-tour-btn').addEventListener('click', () => {
    if (window.startGuidedTour) {
      window.startGuidedTour();
    } else {
      toast.info('Tour Initializing', 'Launching guided walkthrough...');
    }
  });
}
