/**
 * proposal.js — Printable Client Proposal Document
 * Zeploy Tech branded proposal for retail client presentations & PDF printing
 */

async function renderProposal(container) {
  const storeName = await getSetting('store_name', 'Retail Business');
  const currency  = await getSetting('currency', 'Rs.');
  const taxRate   = await getSetting('tax_rate', 0);

  container.innerHTML = `
    <div class="page-header no-print">
      <div class="page-header-left">
        <h1>Client Commercial Proposal</h1>
        <p>Printable sales proposal and solution overview for client deployment</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="window.print()">
          ${icon('icon-print')} Print / Export to PDF
        </button>
      </div>
    </div>

    <!-- Printable Document Shell -->
    <div class="section-card" id="printable-proposal-doc" style="max-width:850px;margin:0 auto;padding:var(--space-8);background:white;color:#0F172A;box-shadow:var(--shadow-lg);border-radius:var(--radius-lg)">
      
      <!-- Header / Logo -->
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid var(--zeploy-navy);padding-bottom:var(--space-5);margin-bottom:var(--space-6)">
        <div>
          <div style="font-size:1.75rem;font-weight:900;color:var(--zeploy-navy);letter-spacing:-0.03em">
            ZEPLOY TECH
          </div>
          <div style="font-size:0.875rem;font-weight:600;color:var(--primary);letter-spacing:0.05em;text-transform:uppercase">
            We Deploy Your Vision
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:0.875rem;font-weight:700;color:var(--text-secondary)">COMMERCIAL PROPOSAL</div>
          <div style="font-size:0.8125rem;color:var(--text-muted)">Date: ${new Date().toLocaleDateString()}</div>
          <div style="font-size:0.8125rem;color:var(--text-muted)">Ref: ZP-POS-2026</div>
        </div>
      </div>

      <!-- Prepared For -->
      <div style="background:var(--surface-raised);padding:var(--space-4);border-radius:var(--radius-md);border-left:4px solid var(--primary);margin-bottom:var(--space-6)">
        <div class="text-xs text-muted font-bold" style="text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Prepared For</div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--zeploy-navy)">${storeName}</div>
        <div style="font-size:0.875rem;color:var(--text-secondary)">Turnkey LocalPOS & Inventory System Deployment</div>
      </div>

      <!-- Solution Overview -->
      <div style="margin-bottom:var(--space-6)">
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--zeploy-navy);margin-bottom:var(--space-3);border-bottom:1px solid var(--border-soft);padding-bottom:6px">
          1. Executive Summary
        </h3>
        <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;margin-bottom:var(--space-3)">
          Zeploy Tech proposes a local-first, high-performance Point of Sale (POS) and Inventory Management System customized specifically for <strong>${storeName}</strong>. This solution operates 100% offline, eliminating monthly cloud subscription fees while guaranteeing zero downtime during internet outages.
        </p>
      </div>

      <!-- Core Features Grid -->
      <div style="margin-bottom:var(--space-6)">
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--zeploy-navy);margin-bottom:var(--space-3);border-bottom:1px solid var(--border-soft);padding-bottom:6px">
          2. Core System Capabilities
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
          <thead>
            <tr style="background:var(--zeploy-navy);color:white">
              <th style="padding:10px;text-align:left;border-radius:var(--radius-sm) 0 0 0">Module</th>
              <th style="padding:10px;text-align:left">Business Functionality</th>
              <th style="padding:10px;text-align:left;border-radius:0 var(--radius-sm) 0 0">Key Benefit</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border-soft)">
              <td style="padding:10px;font-weight:700">Point of Sale (POS)</td>
              <td style="padding:10px">Barcode scanning, popular items grid, quick discount presets, thermal receipts with dynamic QR codes.</td>
              <td style="padding:10px;color:var(--stock-in);font-weight:600">3x Faster Checkout Rush</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-soft)">
              <td style="padding:10px;font-weight:700">Inventory & FIFO</td>
              <td style="padding:10px">Batch expiry tracking, stock valuation, min-stock alerts, grid/table catalog view toggles.</td>
              <td style="padding:10px;color:var(--stock-in);font-weight:600">Eliminate Stock Shrinkage</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-soft)">
              <td style="padding:10px;font-weight:700">Recipe / BOM Engine</td>
              <td style="padding:10px">Composite item deductions (raw materials automatically reduced on sales).</td>
              <td style="padding:10px;color:var(--stock-in);font-weight:600">Exact Food & Recipe COGS</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-soft)">
              <td style="padding:10px;font-weight:700">Customer Credit Ledger</td>
              <td style="padding:10px">Individual credit balance tracking, partial payments, printable account statements.</td>
              <td style="padding:10px;color:var(--stock-in);font-weight:600">Zero Untracked Receivables</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-soft)">
              <td style="padding:10px;font-weight:700">Analytics & Reports</td>
              <td style="padding:10px">Daily net revenue, gross profit margin calculations, CSV export, sales history trends.</td>
              <td style="padding:10px;color:var(--stock-in);font-weight:600">Complete Profit Transparency</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pricing & Commercial Terms -->
      <div style="margin-bottom:var(--space-6)">
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--zeploy-navy);margin-bottom:var(--space-3);border-bottom:1px solid var(--border-soft);padding-bottom:6px">
          3. Deployment & Commercial Terms
        </h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
          <div style="border:1px solid var(--border-soft);padding:var(--space-4);border-radius:var(--radius-md)">
            <div style="font-weight:700;color:var(--zeploy-navy);margin-bottom:4px">Software License</div>
            <div style="font-size:1.25rem;font-weight:800;color:var(--primary)">One-Time License</div>
            <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:4px">No monthly recurring SaaS fees</div>
          </div>
          <div style="border:1px solid var(--border-soft);padding:var(--space-4);border-radius:var(--radius-md)">
            <div style="font-weight:700;color:var(--zeploy-navy);margin-bottom:4px">Onsite Setup & Support</div>
            <div style="font-size:1.25rem;font-weight:800;color:var(--stock-in)">Included</div>
            <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:4px">Data seeding, hardware pairing & training</div>
          </div>
        </div>
      </div>

      <!-- Footer & Sign-off -->
      <div style="border-top:2px solid var(--border-soft);padding-top:var(--space-5);margin-top:var(--space-6);display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:800;color:var(--zeploy-navy)">Zeploy Tech Deployment Team</div>
          <div style="font-size:0.8125rem;color:var(--text-secondary)">Email: contact@zeploy.tech | Web: www.zeploy.tech</div>
          <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:2px">We Deploy Your Vision</div>
        </div>
        <div style="text-align:right">
          <div style="border-bottom:1px solid #94A3B8;width:160px;margin-bottom:4px"></div>
          <div style="font-size:0.8125rem;color:var(--text-muted)">Client Acceptance Signature</div>
        </div>
      </div>

    </div>
  `;
}
