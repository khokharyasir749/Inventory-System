/**
 * settings.js — Enterprise Store Configuration & Customization Engine
 * Tabs:
 * 1. Store Identity & Logo (Brand Name, Logo upload/preview/reset, Address, Phone, Footer)
 * 2. Tax & NTN Registration (Tax Rate, Tax Label GST/VAT, NTN ID, Currency Symbol)
 * 3. POS Hardware & Printers (Receipt size, Auto-print, Audio feedback)
 * 4. Security, Backup & Seeding (PIN Lock, JSON Export/Import with Preview, Demo Data, Reset)
 */

let activeSettingsTab = 'identity'; // 'identity' | 'tax' | 'hardware' | 'system'

async function renderSettings(container) {
  // Fetch current settings in parallel
  const [
    name, logo, addr, phone, tax, taxLabel, curr, footer, pin, currentProfile, ntn, defaultPaper, autoPrint, soundFeedback
  ] = await Promise.all([
    getSetting('store_name', 'Zeploy POS'),
    getSetting('store_logo', ''),
    getSetting('store_address', 'Sector F-7, Islamabad'),
    getSetting('store_phone', '+92 300 1234567'),
    getSetting('tax_rate', 0),
    getSetting('tax_label', 'GST'),
    getSetting('currency', 'Rs.'),
    getSetting('receipt_footer', 'Thank you for shopping with us!'),
    getSetting('app_pin', '1234'),
    getSetting('demo_business', 'grocery'),
    getSetting('ntn_tax_id', 'NTN-9842104-7'),
    getSetting('default_paper_size', '80mm'),
    getSetting('pos_auto_print', false),
    getSetting('sound_feedback', true)
  ]);

  let currentLogoData = logo || '';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Enterprise Configuration</h1>
        <p>Manage brand identity, tax & legal records, POS hardware, and offline database resilience</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-ghost btn-sm" id="settings-quick-brand-btn">${icon('icon-edit')} Quick Brand Edit</button>
      </div>
    </div>

    <!-- Enterprise Tab Navigation -->
    <div class="settings-tabs-header">
      <button class="settings-tab-btn ${activeSettingsTab === 'identity' ? 'active' : ''}" data-set-tab="identity">
        ${icon('icon-store')} Store Identity & Logo
      </button>
      <button class="settings-tab-btn ${activeSettingsTab === 'tax' ? 'active' : ''}" data-set-tab="tax">
        ${icon('icon-reports')} Tax & Legal NTN
      </button>
      <button class="settings-tab-btn ${activeSettingsTab === 'hardware' ? 'active' : ''}" data-set-tab="hardware">
        ${icon('icon-settings')} POS Hardware & Printers
      </button>
      <button class="settings-tab-btn ${activeSettingsTab === 'system' ? 'active' : ''}" data-set-tab="system">
        ${icon('icon-backup')} Security & Data
      </button>
    </div>

    <!-- Tab Contents Container -->
    <div id="settings-tab-content-wrap" class="animate-fade-in">
      <!-- Injected dynamically below -->
    </div>
  `;

  // Bind tab switching
  container.querySelectorAll('[data-set-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSettingsTab = btn.dataset.setTab;
      container.querySelectorAll('[data-set-tab]').forEach(b => b.classList.toggle('active', b === btn));
      renderSettingsActiveTab(container, {
        name, logo: currentLogoData, addr, phone, tax, taxLabel, curr, footer, pin, currentProfile, ntn, defaultPaper, autoPrint, soundFeedback
      });
    });
  });

  // Quick brand trigger
  container.querySelector('#settings-quick-brand-btn').addEventListener('click', () => {
    openQuickBrandModal();
  });

  // Render initial active tab
  renderSettingsActiveTab(container, {
    name, logo: currentLogoData, addr, phone, tax, taxLabel, curr, footer, pin, currentProfile, ntn, defaultPaper, autoPrint, soundFeedback
  });
}

function renderSettingsActiveTab(container, state) {
  const contentWrap = container.querySelector('#settings-tab-content-wrap');
  if (!contentWrap) return;

  if (activeSettingsTab === 'identity') {
    contentWrap.innerHTML = `
      <div class="grid-2">
        <!-- Store Branding Form -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-4)">
            <span class="section-card-title">${icon('icon-store')} Brand Identity & Store Details</span>
          </div>

          <form id="form-identity" style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="form-group">
              <label class="form-label" for="set-store-name">Store / Brand Name <span class="required">*</span></label>
              <input type="text" class="form-input" id="set-store-name" value="${state.name}" required placeholder="e.g. Metro Supermarket">
              <div class="form-hint">Updates Sidebar, Topbar header, Setup Wizard, and Thermal Receipts instantly.</div>
            </div>

            <!-- Brand Logo Uploader Section -->
            <div class="form-group">
              <label class="form-label">Brand Logo (PNG, SVG, JPG, WebP)</label>
              <div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
                <div id="set-logo-preview-box" class="brand-logo-preview-box">
                  ${state.logo 
                    ? `<img src="${state.logo}" id="set-logo-img" alt="Logo" class="brand-logo-preview-img" />`
                    : `<div class="text-xs text-muted" style="text-align:center;padding:8px">Default Mark</div>`
                  }
                </div>
                <div style="display:flex;flex-direction:column;gap:var(--space-2);flex:1;min-width:200px">
                  <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
                    <label class="btn btn-ghost btn-sm" style="cursor:pointer">
                      ${icon('icon-plus')} Upload New Logo
                      <input type="file" id="set-logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none">
                    </label>
                    <button type="button" class="btn btn-ghost-danger btn-sm" id="set-logo-reset-btn" ${!state.logo ? 'style="display:none"' : ''}>
                      ${icon('icon-trash')} Reset to Default Mark
                    </button>
                  </div>
                  <div class="text-xs text-secondary">Optimal size: 300x300px. Stored locally offline in IndexedDB.</div>
                </div>
              </div>
            </div>

            <div class="grid-2" style="gap:var(--space-3)">
              <div class="form-group">
                <label class="form-label">Store Phone Number</label>
                <input type="text" class="form-input" id="set-phone" value="${state.phone}" placeholder="e.g. +92 300 1234567">
              </div>
              <div class="form-group">
                <label class="form-label">Store Location / City</label>
                <input type="text" class="form-input" id="set-address" value="${state.addr}" placeholder="e.g. DHA Phase 6, Lahore">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Thermal Receipt Footer Notes</label>
              <textarea class="form-input" id="set-footer" style="resize:vertical;min-height:70px" placeholder="e.g. Goods once sold can be exchanged within 3 days. Thank you!">${state.footer}</textarea>
            </div>

            <div style="margin-top:var(--space-2)">
              <button class="btn btn-primary" type="submit" style="width:100%">${icon('icon-check')} Save Store Identity</button>
            </div>
          </form>
        </div>

        <!-- Live Thermal Receipt Branding Preview -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-4)">
            <span class="section-card-title">${icon('icon-print')} Thermal Receipt Branding Preview</span>
          </div>
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-3)">This preview reflects how your logo and store metadata render on 80mm & 58mm thermal receipts.</p>

          <div style="background:#FFFFFF;color:#0F172A;border:1px dashed #000;border-radius:var(--radius-md);padding:16px;max-width:280px;margin:0 auto;box-shadow:var(--shadow-sm);font-family:'Courier New', monospace;text-align:center">
            <div id="receipt-preview-logo-wrap" style="margin-bottom:8px">
              ${state.logo 
                ? `<img src="${state.logo}" style="max-height:44px;max-width:130px;object-fit:contain;filter:grayscale(100%) contrast(140%)" alt="Receipt Logo" />` 
                : `<div style="font-size:0.75rem;color:#777">[ DEFAULT LOGO MARK ]</div>`
              }
            </div>
            <div id="receipt-preview-name" style="font-weight:900;font-size:1rem;letter-spacing:0.04em">${state.name.toUpperCase()}</div>
            <div id="receipt-preview-addr" style="font-size:0.75rem;color:#444">${state.addr}</div>
            <div id="receipt-preview-phone" style="font-size:0.75rem;color:#444">Phone: ${state.phone}</div>
            <div id="receipt-preview-ntn" style="font-size:0.75rem;font-weight:700;margin-top:2px">NTN: ${state.ntn}</div>
            <div style="border-top:1px dashed #000;margin:8px 0"></div>
            <div style="font-size:0.75rem;display:flex;justify-content:space-between">
              <span>INV #1042</span>
              <span>17-09-2026</span>
            </div>
            <div style="border-top:1px dashed #000;margin:8px 0"></div>
            <div style="font-size:0.75rem;display:flex;justify-content:space-between;font-weight:700">
              <span>SAMPLE ITEM (1x)</span>
              <span>${state.curr} 250</span>
            </div>
            <div style="border-top:1px solid #000;margin:8px 0"></div>
            <div style="font-size:0.8rem;display:flex;justify-content:space-between;font-weight:900">
              <span>TOTAL</span>
              <span>${state.curr} 250</span>
            </div>
            <div style="border-top:1px dashed #000;margin:8px 0"></div>
            <div id="receipt-preview-footer" style="font-size:0.7rem;color:#555">${state.footer}</div>
          </div>
        </div>
      </div>
    `;

    // Bind Logo file upload
    const fileInp = contentWrap.querySelector('#set-logo-file');
    const resetBtn = contentWrap.querySelector('#set-logo-reset-btn');
    const prevBox  = contentWrap.querySelector('#set-logo-preview-box');
    const rcptLogoWrap = contentWrap.querySelector('#receipt-preview-logo-wrap');

    fileInp?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const compressed = await compressImageFile(file, 360, 360, 0.88);
        state.logo = compressed;
        prevBox.innerHTML = `<img src="${compressed}" id="set-logo-img" alt="Logo" class="brand-logo-preview-img" />`;
        rcptLogoWrap.innerHTML = `<img src="${compressed}" style="max-height:44px;max-width:130px;object-fit:contain;filter:grayscale(100%) contrast(140%)" alt="Receipt Logo" />`;
        resetBtn.style.display = 'inline-flex';
        toast.success('Logo Ready', 'New logo uploaded. Click "Save Store Identity" to finalize.');
      } catch (err) {
        toast.error('Upload Error', err.message);
      }
    });

    resetBtn?.addEventListener('click', () => {
      state.logo = '';
      if (fileInp) fileInp.value = '';
      prevBox.innerHTML = `<div class="text-xs text-muted" style="text-align:center;padding:8px">Default Mark</div>`;
      rcptLogoWrap.innerHTML = `<div style="font-size:0.75rem;color:#777">[ DEFAULT LOGO MARK ]</div>`;
      resetBtn.style.display = 'none';
      toast.info('Logo Reset', 'Logo cleared. Click Save to apply default icon.');
    });

    // Bind Identity form submission
    contentWrap.querySelector('#form-identity').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const newName = contentWrap.querySelector('#set-store-name').value.trim();
      const newPhone = contentWrap.querySelector('#set-phone').value.trim();
      const newAddr = contentWrap.querySelector('#set-address').value.trim();
      const newFooter = contentWrap.querySelector('#set-footer').value.trim();

      try {
        await Promise.all([
          setSetting('store_name', newName),
          setSetting('store_logo', state.logo || ''),
          setSetting('store_phone', newPhone),
          setSetting('store_address', newAddr),
          setSetting('receipt_footer', newFooter)
        ]);

        state.name = newName;
        state.phone = newPhone;
        state.addr = newAddr;
        state.footer = newFooter;

        // Instant global synchronization
        await applyStoreBranding(newName, state.logo || '');

        toast.success('Brand Identity Saved', 'Store branding synchronized across topbar, sidebar, and receipts.');
      } catch (err) {
        toast.error('Save Failed', err.message);
      } finally {
        submitBtn.disabled = false;
      }
    });

  } else if (activeSettingsTab === 'tax') {
    contentWrap.innerHTML = `
      <div class="grid-2">
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-4)">
            <span class="section-card-title">${icon('icon-reports')} Sales Tax, NTN & Currency</span>
          </div>

          <form id="form-tax" style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="grid-2" style="gap:var(--space-3)">
              <div class="form-group">
                <label class="form-label">Currency Symbol</label>
                <input type="text" class="form-input" id="set-currency" value="${state.curr}" required placeholder="e.g. Rs., $, €, £">
                <div class="form-hint">Used in price displays and ledgers.</div>
              </div>

              <div class="form-group">
                <label class="form-label">Sales Tax Rate (%)</label>
                <input type="number" class="form-input" id="set-tax" value="${state.tax}" min="0" max="100" step="0.5" required>
                <div class="form-hint">Standard rate for taxable items (e.g. 18%).</div>
              </div>
            </div>

            <div class="grid-2" style="gap:var(--space-3)">
              <div class="form-group">
                <label class="form-label">Tax Label Name</label>
                <input type="text" class="form-input" id="set-tax-label" value="${state.taxLabel}" placeholder="e.g. GST, VAT, Sales Tax">
              </div>

              <div class="form-group">
                <label class="form-label">NTN / STRN Tax Registration ID</label>
                <input type="text" class="form-input" id="set-ntn" value="${state.ntn}" placeholder="e.g. NTN-9842104-7">
                <div class="form-hint">Printed on customer receipts for FBR/tax audit compliance.</div>
              </div>
            </div>

            <div style="margin-top:var(--space-2)">
              <button class="btn btn-primary" type="submit" style="width:100%">${icon('icon-check')} Save Tax Configurations</button>
            </div>
          </form>
        </div>

        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-info')} Regulatory & Audit Compliance</span>
          </div>
          <p class="text-sm text-secondary" style="margin-bottom:var(--space-3)">
            Configuring your National Tax Number (NTN) and GST percentage enables detailed reporting under the <strong>Reports & Export</strong> module:
          </p>
          <ul class="text-xs text-secondary" style="line-height:1.8;padding-left:var(--space-4)">
            <li>Dynamic QR verification barcodes printed on POS receipts.</li>
            <li>Separation of Gross Taxable Turnover vs Zero-Rated sales.</li>
            <li>Calculated Output Tax collected for monthly reconciliation.</li>
          </ul>
        </div>
      </div>
    `;

    contentWrap.querySelector('#form-tax').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const newCurr = contentWrap.querySelector('#set-currency').value.trim();
      const newTax = parseFloat(contentWrap.querySelector('#set-tax').value) || 0;
      const newTaxLabel = contentWrap.querySelector('#set-tax-label').value.trim() || 'GST';
      const newNtn = contentWrap.querySelector('#set-ntn').value.trim();

      try {
        await Promise.all([
          setSetting('currency', newCurr),
          setSetting('tax_rate', newTax),
          setSetting('tax_label', newTaxLabel),
          setSetting('ntn_tax_id', newNtn)
        ]);

        state.curr = newCurr;
        state.tax = newTax;
        state.taxLabel = newTaxLabel;
        state.ntn = newNtn;

        await loadCurrencySymbol();
        toast.success('Tax Settings Saved', 'Currency and tax rates updated across register and reports.');
      } catch (err) {
        toast.error('Save Failed', err.message);
      } finally {
        submitBtn.disabled = false;
      }
    });

  } else if (activeSettingsTab === 'hardware') {
    contentWrap.innerHTML = `
      <div class="grid-2">
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-4)">
            <span class="section-card-title">${icon('icon-settings')} POS Hardware & Peripheral Settings</span>
          </div>

          <form id="form-hardware" style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="form-group">
              <label class="form-label">Default Thermal Receipt Paper Format</label>
              <select class="form-select" id="set-paper-size">
                <option value="80mm" ${state.defaultPaper === '80mm' ? 'selected' : ''}>80mm Standard POS Printer (Epson, Bixolon, Star)</option>
                <option value="58mm" ${state.defaultPaper === '58mm' ? 'selected' : ''}>58mm Compact Desktop / Bluetooth Printer</option>
              </select>
            </div>

            <div class="form-group">
              <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer">
                <input type="checkbox" id="set-auto-print" ${state.autoPrint ? 'checked' : ''} style="width:18px;height:18px">
                <div>
                  <div class="font-semibold text-sm">Auto-Trigger Thermal Print Dialog on Checkout</div>
                  <div class="text-xs text-secondary">Automatically opens print dialog when a cash or card sale completes.</div>
                </div>
              </label>
            </div>

            <div class="form-group">
              <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer">
                <input type="checkbox" id="set-sound" ${state.soundFeedback ? 'checked' : ''} style="width:18px;height:18px">
                <div>
                  <div class="font-semibold text-sm">Web Audio POS Beep Sound Effects</div>
                  <div class="text-xs text-secondary">Plays audible confirmation chime on barcode scan and sale completion.</div>
                </div>
              </label>
            </div>

            <div style="margin-top:var(--space-2)">
              <button class="btn btn-primary" type="submit" style="width:100%">${icon('icon-check')} Save Hardware Preferences</button>
            </div>
          </form>
        </div>

        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-package')} Hardware Integration Guidelines</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-3);font-size:0.8125rem;color:var(--text-secondary)">
            <div style="background:var(--surface-raised);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--border-soft)">
              <strong style="color:var(--text-primary)">Barcode Scanners:</strong>
              <div>Supports standard USB HID & Bluetooth keyboard wedge scanners. Scanners should emit an Enter terminator suffix.</div>
            </div>
            <div style="background:var(--surface-raised);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--border-soft)">
              <strong style="color:var(--text-primary)">Thermal Printers:</strong>
              <div>Compatible with standard ESC/POS thermal printers via Windows System Print Spooler or Web USB.</div>
            </div>
            <div style="background:var(--surface-raised);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--border-soft)">
              <strong style="color:var(--text-primary)">Camera Scanner:</strong>
              <div>Built-in camera scanner uses native hardware acceleration (BarcodeDetector API) with video stream fallback.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    contentWrap.querySelector('#form-hardware').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      const newPaper = contentWrap.querySelector('#set-paper-size').value;
      const newAutoPrint = contentWrap.querySelector('#set-auto-print').checked;
      const newSound = contentWrap.querySelector('#set-sound').checked;

      try {
        await Promise.all([
          setSetting('default_paper_size', newPaper),
          setSetting('pos_auto_print', newAutoPrint),
          setSetting('sound_feedback', newSound)
        ]);

        state.defaultPaper = newPaper;
        state.autoPrint = newAutoPrint;
        state.soundFeedback = newSound;

        toast.success('Preferences Saved', 'Peripheral settings updated.');
      } catch (err) {
        toast.error('Save Failed', err.message);
      } finally {
        submitBtn.disabled = false;
      }
    });

  } else if (activeSettingsTab === 'system') {
    contentWrap.innerHTML = `
      <div class="grid-2">
        <!-- Security Pin Card -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-x-circle')} 4-Digit Security Screen PIN</span>
          </div>
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-3)">Protect settings changes and lock the POS screen during cashier shifts.</p>
          
          <div style="display:flex;gap:var(--space-3);align-items:flex-end">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">4-Digit PIN</label>
              <input type="password" class="form-input" id="set-pin" value="${state.pin}" maxlength="4" style="letter-spacing:6px;text-align:center;font-size:1.2rem;width:130px;font-weight:700">
            </div>
            <button class="btn btn-primary" id="set-pin-btn" style="height:42px">${icon('icon-check')} Save PIN</button>
          </div>
          <div class="text-xs text-muted" style="margin-top:8px">Leave blank to disable the security lock screen.</div>
        </div>

        <!-- Database Backup & Disaster Recovery -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-backup')} Offline Database Disaster Recovery</span>
          </div>
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-3)">Export a full JSON snapshot of your 18 IndexedDB tables for safekeeping or cross-device migration.</p>

          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
            <button class="btn btn-ghost" id="set-export-btn">
              ${icon('icon-download')} Backup to JSON File
            </button>
            <label class="btn btn-ghost" style="cursor:pointer">
              ${icon('icon-upload')} Restore from JSON File
              <input type="file" id="set-restore-file" accept=".json,application/json" style="display:none">
            </label>
          </div>
        </div>

        <!-- Demo Data & Reset Seeding -->
        <div class="section-card" style="border-left:4px solid var(--danger);grid-column:1 / -1">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title text-red">${icon('icon-refresh')} Demo Seeding & Factory Reset</span>
          </div>
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-4)">
            Regenerate realistic 30-day transactions for client presentations, or clear the local database to launch the initial startup setup wizard.
          </p>

          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
            <button class="btn btn-ghost" id="set-demo-data-btn">
              ${icon('icon-refresh')} Regenerate 30 Days Sales Data
            </button>
            <button class="btn btn-danger" id="set-reset-db-btn">
              ${icon('icon-trash')} Factory Reset & Launch Setup Wizard
            </button>
          </div>
        </div>
      </div>
    `;

    // Save PIN
    contentWrap.querySelector('#set-pin-btn').addEventListener('click', async () => {
      const newPin = contentWrap.querySelector('#set-pin').value.trim();
      if (newPin && (newPin.length !== 4 || !/^\d{4}$/.test(newPin))) {
        toast.error('Invalid PIN', 'PIN code must be exactly 4 numerical digits.');
        return;
      }

      try {
        await setSetting('app_pin', newPin);
        state.pin = newPin;
        toast.success('PIN Saved', newPin ? 'Screen lock PIN updated.' : 'Screen lock disabled.');
      } catch (err) {
        toast.error('Save Failed', err.message);
      }
    });

    // Backup Export
    contentWrap.querySelector('#set-export-btn').addEventListener('click', async () => {
      await exportDatabaseToFile();
    });

    // Restore File Upload with validation preview
    contentWrap.querySelector('#set-restore-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await restoreDatabaseFromFile(file);
    });

    // Regenerate Demo Data
    contentWrap.querySelector('#set-demo-data-btn').addEventListener('click', async () => {
      const btn = contentWrap.querySelector('#set-demo-data-btn');
      btn.disabled = true;
      btn.innerHTML = `⌛ Generating Transactions...`;

      try {
        await db.transaction('rw', [db.sales, db.sale_items, db.logs, db.customer_transactions, db.cash_sessions], async () => {
          await Promise.all([
            db.sales.clear(),
            db.sale_items.clear(),
            db.logs.clear(),
            db.customer_transactions.clear(),
            db.cash_sessions.clear()
          ]);
        });

        await generate30DaysDemoTransactions();
        toast.success('Demo Data Generated', 'Successfully generated 30 days of sales history.');
      } catch (err) {
        toast.error('Generation Failed', err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${icon('icon-refresh')} Regenerate 30 Days Sales Data`;
      }
    });

    // Reset Database
    contentWrap.querySelector('#set-reset-db-btn').addEventListener('click', () => {
      showConfirm('Clear all current database records and re-open the initial setup wizard?', async () => {
        await window.resetAndTriggerTemplatePicker();
      });
    });
  }
}
