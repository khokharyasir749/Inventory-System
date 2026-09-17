/**
 * proposal.js — Printable Client Proposal Document
 * Zeploy Tech branded proposal for retail client presentations & PDF printing
 * Modernized with dynamic Light/Dark mode theme adaptation and print styling
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
    <div class="proposal-doc" id="printable-proposal-doc">
      
      <!-- Header / Logo -->
      <div class="proposal-header">
        <div>
          <div class="proposal-brand-title">
            ZEPLOY TECH
          </div>
          <div class="proposal-brand-sub">
            We Deploy Your Vision
          </div>
        </div>
        <div style="text-align:right">
          <div class="proposal-meta-title">COMMERCIAL PROPOSAL</div>
          <div class="proposal-meta-sub">Date: ${new Date().toLocaleDateString()}</div>
          <div class="proposal-meta-sub">Ref: ZP-POS-2026</div>
        </div>
      </div>

      <!-- Prepared For Callout Card -->
      <div class="proposal-callout">
        <div class="proposal-callout-label">Prepared For</div>
        <div class="proposal-callout-name">${storeName}</div>
        <div class="proposal-callout-desc">Turnkey LocalPOS & Inventory System Deployment</div>
      </div>

      <!-- 1. Solution Overview -->
      <div style="margin-bottom:var(--space-6)">
        <h3 class="proposal-section-title">
          1. Executive Summary
        </h3>
        <p class="proposal-body-text">
          Zeploy Tech proposes a local-first, high-performance Point of Sale (POS) and Inventory Management System customized specifically for <strong>${storeName}</strong>. This solution operates 100% offline, eliminating monthly cloud subscription fees while guaranteeing zero downtime during internet outages.
        </p>
      </div>

      <!-- 2. Core Features Grid -->
      <div style="margin-bottom:var(--space-6)">
        <h3 class="proposal-section-title">
          2. Core System Capabilities
        </h3>
        <table class="proposal-table">
          <thead>
            <tr>
              <th style="width:25%">Module</th>
              <th style="width:48%">Business Functionality</th>
              <th style="width:27%">Key Benefit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="module-name">Point of Sale (POS)</td>
              <td>Barcode scanning, popular items grid, quick discount presets, thermal receipts with dynamic QR codes.</td>
              <td class="benefit-pill">3x Faster Checkout Rush</td>
            </tr>
            <tr>
              <td class="module-name">Inventory & FIFO</td>
              <td>Batch expiry tracking, stock valuation, min-stock alerts, grid/table catalog view toggles.</td>
              <td class="benefit-pill">Eliminate Stock Shrinkage</td>
            </tr>
            <tr>
              <td class="module-name">Recipe / BOM Engine</td>
              <td>Composite item deductions (raw materials automatically reduced on sales).</td>
              <td class="benefit-pill">Exact Food & Recipe COGS</td>
            </tr>
            <tr>
              <td class="module-name">Customer Credit Ledger</td>
              <td>Individual credit balance tracking, partial payments, printable account statements.</td>
              <td class="benefit-pill">Zero Untracked Receivables</td>
            </tr>
            <tr>
              <td class="module-name">Analytics & Reports</td>
              <td>Daily net revenue, gross profit margin calculations, CSV export, sales history trends.</td>
              <td class="benefit-pill">Complete Profit Transparency</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. Pricing & Commercial Terms -->
      <div style="margin-bottom:var(--space-6)">
        <h3 class="proposal-section-title">
          3. Deployment & Commercial Terms
        </h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
          <div class="proposal-terms-card">
            <div class="proposal-terms-title">Software License</div>
            <div class="proposal-terms-val" style="color:var(--primary)">One-Time License</div>
            <div class="proposal-terms-desc">No monthly recurring SaaS fees</div>
          </div>
          <div class="proposal-terms-card">
            <div class="proposal-terms-title">Onsite Setup & Support</div>
            <div class="proposal-terms-val" style="color:var(--stock-in)">Included</div>
            <div class="proposal-terms-desc">Data seeding, hardware pairing & staff training</div>
          </div>
        </div>
      </div>

      <!-- 4. Footer & Sign-off -->
      <div class="proposal-footer">
        <div>
          <div class="proposal-footer-team">Zeploy Tech Deployment Team</div>
          <div class="proposal-footer-contact">Email: contact@zeploy.tech | Web: www.zeploy.tech</div>
          <div class="proposal-footer-vision">We Deploy Your Vision</div>
        </div>
        <div style="text-align:right">
          <div class="proposal-sig-line"></div>
          <div class="proposal-meta-sub">Client Acceptance Signature</div>
        </div>
      </div>

    </div>
  `;
}
