/**
 * settings.js — Store Configuration & Seeding Page
 * Allows editing store metadata, logos, tax rates, PIN security, and triggers profile resets
 */

async function renderSettings(container) {
  // Fetch current settings
  const [name, addr, phone, tax, curr, footer, pin, currentProfile] = await Promise.all([
    getSetting('store_name', 'Premium Retail Store'),
    getSetting('store_address', ''),
    getSetting('store_phone', ''),
    getSetting('tax_rate', 0),
    getSetting('currency', 'Rs.'),
    getSetting('receipt_footer', 'Thank you!'),
    getSetting('app_pin', '1234'),
    getSetting('demo_business', 'grocery')
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>App Configuration</h1>
        <p>Manage store identity, branding details, and system locks</p>
      </div>
    </div>

    <div class="grid-2">
      <!-- Store Branding Form -->
      <div class="section-card">
        <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-4)">
          <span class="section-card-title">${icon('icon-settings')} Branding & Print Settings</span>
        </div>
        
        <form id="settings-form" style="display:flex;flex-direction:column;gap:var(--space-3)">
          <div class="form-group">
            <label class="form-label">Store / Company Name</label>
            <input type="text" class="form-input" id="set-store-name" value="${name}" required placeholder="e.g. Metro Supermarket">
          </div>
          
          <div class="grid-2" style="gap:var(--space-3)">
            <div class="form-group">
              <label class="form-label">Currency Symbol</label>
              <input type="text" class="form-input" id="set-currency" value="${curr}" required placeholder="e.g. Rs., $, £">
            </div>
            
            <div class="form-group">
              <label class="form-label">Sales Tax Rate (%)</label>
              <input type="number" class="form-input" id="set-tax" value="${tax}" min="0" max="100" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Store Phone Number</label>
            <input type="text" class="form-input" id="set-phone" value="${phone}" placeholder="e.g. +92 300 1234567">
          </div>

          <div class="form-group">
            <label class="form-label">Address</label>
            <input type="text" class="form-input" id="set-address" value="${addr}" placeholder="e.g. DHA Phase 6, Lahore">
          </div>

          <div class="form-group">
            <label class="form-label">Receipt Footer Notes</label>
            <textarea class="form-input" id="set-footer" style="resize:vertical;min-height:60px" placeholder="e.g. Thank you for shopping!">${footer}</textarea>
          </div>

          <div style="margin-top:var(--space-2)">
            <button class="btn btn-primary" type="submit" style="width:100%">${icon('icon-check')} Save Configurations</button>
          </div>
        </form>
      </div>

      <!-- Security PIN & Demo Resets -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <!-- Security Pin Card -->
        <div class="section-card">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title">${icon('icon-x-circle')} PIN Code Security Lock</span>
          </div>
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-3)">Protect settings changes and prevent unauthorized POS drawer access by setting a 4-digit PIN.</p>
          
          <div style="display:flex;gap:var(--space-3);align-items:flex-end">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">4-Digit PIN</label>
              <input type="password" class="form-input" id="set-pin" value="${pin}" maxlength="4" style="letter-spacing:4px;text-align:center;font-size:1.15rem;width:120px">
            </div>
            <button class="btn btn-ghost" id="set-pin-btn" style="height:38px">${icon('icon-check')} Save PIN</button>
          </div>
          <div class="text-xs text-muted" style="margin-top:8px">Leave empty or delete PIN to disable locking mechanism.</div>
        </div>

        <!-- Reset Demo Card -->
        <div class="section-card" style="border-left:4px solid var(--danger)">
          <div class="section-card-header" style="border-bottom:1px solid var(--border-soft);padding-bottom:var(--space-2);margin-bottom:var(--space-3)">
            <span class="section-card-title text-red">${icon('icon-refresh')} Reset Database & Seeding</span>
          </div>
          <p class="text-xs text-secondary" style="margin-bottom:var(--space-4)">This action clears all database records and shows the startup profile screen, allowing you to load fresh retail profiles for another demo.</p>
          
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <button class="btn btn-ghost" id="set-demo-data-btn" style="width:100%">
              ${icon('icon-backup')} Regenerate 30 Days Demo Data
            </button>
            <button class="btn btn-danger" id="set-reset-db-btn" style="width:100%">
              ${icon('icon-trash')} Reset & Seed Another Template
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind settings form submit
  container.querySelector('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const newName = container.querySelector('#set-store-name').value;
    const newCurr = container.querySelector('#set-currency').value;
    const newTax = parseFloat(container.querySelector('#set-tax').value) || 0;
    const newPhone = container.querySelector('#set-phone').value;
    const newAddr = container.querySelector('#set-address').value;
    const newFooter = container.querySelector('#set-footer').value;

    try {
      await Promise.all([
        setSetting('store_name', newName),
        setSetting('currency', newCurr),
        setSetting('tax_rate', newTax),
        setSetting('store_phone', newPhone),
        setSetting('store_address', newAddr),
        setSetting('receipt_footer', newFooter)
      ]);

      // Instantly update topbar & sidebar UI names
      document.getElementById('topbar-store-name').textContent = newName;
      document.getElementById('sidebar-store-name').textContent = newName;
      
      // Reload currency symbol helper variables
      await loadCurrencySymbol();

      toast.success('Settings Saved', 'Configurations updated across POS and reports.');
    } catch(err) {
      toast.error('Save Failed', err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Save PIN Button
  container.querySelector('#set-pin-btn').addEventListener('click', async () => {
    const newPin = container.querySelector('#set-pin').value.trim();
    if (newPin && newPin.length !== 4 && !/^\d{4}$/.test(newPin)) {
      toast.error('Invalid PIN', 'PIN code must be exactly 4 numerical digits.');
      return;
    }

    try {
      await setSetting('app_pin', newPin);
      toast.success('PIN Saved', newPin ? 'Security screen PIN enabled.' : 'Screen lock disabled.');
    } catch(err) {
      toast.error('Save Failed', err.message);
    }
  });

  // Regenerate 30 Days Demo Data button
  container.querySelector('#set-demo-data-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#set-demo-data-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin" style="display:inline-block;animation:spin 1s linear infinite">⌛</span> Generating Transactions...`;
    
    try {
      // Clear previous transactions
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
      toast.success('Demo Data Generated', 'Successfully populated 30 days of sales history.');
    } catch(err) {
      toast.error('Generation Failed', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('icon-backup')} Regenerate 30 Days Demo Data`;
    }
  });

  // Reset Database Button
  container.querySelector('#set-reset-db-btn').addEventListener('click', () => {
    showConfirm('Clear all current database records and re-open template chooser overlay?', async () => {
      await window.resetAndTriggerTemplatePicker();
    });
  });
}
