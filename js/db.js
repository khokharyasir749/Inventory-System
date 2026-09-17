/**
 * db.js — Dexie.js Database Schema, Seed Data, and Stock Engine
 * Local-First Inventory & POS App — Version 2 Upgrade with Phase 3 Demo Profiles
 */

// ── Database Initialization ──────────────────────────────────
const db = new Dexie('InventoryPOS');

db.version(1).stores({
  items:    '++id, barcode, name, category, unit, cost_price, selling_price, min_stock_alert, stock_quantity, photo_blob, is_composite, created_at',
  recipes:  '++id, composite_item_id, ingredient_item_id, qty_required',
  logs:     '++id, item_id, change_type, qty_changed, timestamp, sync_status, notes, sale_id',
  sales:    '++id, timestamp, items_json, subtotal, discount, tax_rate, tax_amount, total, payment_method, cash_tendered, change_due, receipt_no',
  settings: 'key'
});

db.version(2).stores({
  items:    '++id, shop_id, barcode, name, category, unit, cost_price, selling_price, min_stock_alert, stock_quantity, photo_blob, is_composite, created_at',
  recipes:  '++id, shop_id, composite_item_id, ingredient_item_id, qty_required',
  logs:     '++id, shop_id, item_id, change_type, qty_changed, timestamp, sync_status, notes, sale_id',
  sales:    '++id, shop_id, invoice_no, timestamp, subtotal, discount, tax, total, payment_method, customer_id, cash_received, change_returned, session_id',
  sale_items: '++id, shop_id, sale_id, item_id, quantity, unit_price, cost_price, line_total',
  settings: 'key',
  customers: '++id, shop_id, name, phone, address, current_balance, created_at',
  customer_transactions: '++id, shop_id, customer_id, sale_id, amount, transaction_type, timestamp',
  cash_sessions: '++id, shop_id, opened_at, closed_at, opening_cash, expected_cash, actual_cash, difference, status',
  suppliers: '++id, shop_id, name, phone, email, address',
  purchase_orders: '++id, shop_id, supplier_id, date, status, total',
  purchase_order_items: '++id, shop_id, purchase_order_id, item_id, quantity, cost_price',
  inventory_counts: '++id, shop_id, date, status, notes',
  inventory_count_items: '++id, shop_id, count_id, item_id, system_qty, physical_qty, difference',
  stock_adjustments: '++id, shop_id, item_id, qty, type, timestamp, notes',
  inventory_transfers: '++id, shop_id, from_shop_id, to_shop_id, status, created_at, sent_at, received_at',
  inventory_transfer_items: '++id, shop_id, transfer_id, item_id, quantity',
  batches: '++id, shop_id, item_id, batch_number, expiry_date, quantity, created_at'
}).upgrade(async (tx) => {
  console.log('[DB] Migrating to V2 database schema...');
  
  // 1. Migrate items
  await tx.items.toCollection().modify(item => {
    item.shop_id = 1;
    if (item.cost_price === undefined) item.cost_price = 0;
  });

  // 2. Migrate recipes
  await tx.recipes.toCollection().modify(rec => {
    rec.shop_id = 1;
  });

  // 3. Migrate logs
  await tx.logs.toCollection().modify(log => {
    log.shop_id = 1;
  });

  // 4. Migrate sales and split into sale_items
  const oldSales = await tx.sales.toArray();
  for (const sale of oldSales) {
    const saleId = sale.id;
    const invoice_no = sale.receipt_no || `RCP-${sale.timestamp ? new Date(sale.timestamp).getTime() : Date.now()}`;
    const tax = sale.tax_amount || 0;
    const cash_received = sale.cash_tendered || 0;
    const change_returned = sale.change_due || 0;

    // Migrate items_json to sale_items
    if (sale.items_json) {
      try {
        const cart = JSON.parse(sale.items_json);
        for (const c of cart) {
          const dbItem = await tx.table('items').get(c.item_id);
          const cost_price = dbItem ? dbItem.cost_price : 0;
          await tx.table('sale_items').add({
            shop_id: 1,
            sale_id: saleId,
            item_id: c.item_id,
            quantity: c.qty || 1,
            unit_price: c.unit_price || 0,
            cost_price: cost_price,
            line_total: c.line_total || ((c.unit_price || 0) * (c.qty || 1))
          });
        }
      } catch (e) {
        console.error('[DB] Error parsing items_json for old sale ID ' + saleId, e);
      }
    }

    // Save updated sales record
    await tx.sales.put({
      id: saleId,
      shop_id: 1,
      invoice_no: invoice_no,
      timestamp: sale.timestamp || new Date().toISOString(),
      subtotal: sale.subtotal || 0,
      discount: sale.discount || 0,
      tax: tax,
      total: sale.total || 0,
      payment_method: sale.payment_method || 'Cash',
      customer_id: null,
      cash_received: cash_received,
      change_returned: change_returned,
      session_id: null
    });
  }
  console.log('[DB] V2 schema migration complete!');
});

// ── Enums and Constants ──────────────────────────────────────
const CHANGE_TYPE = {
  IN:         'IN',
  OUT:        'OUT',
  SALE:       'SALE',
  ADJUSTMENT: 'ADJUSTMENT',
  SPOILAGE:   'SPOILAGE'
};

const CATEGORIES = [
  'All',
  'Dairy',
  'Bakery',
  'Drinks',
  'Snacks',
  'Raw Ingredients',
  'Fast Food',
  'Grocery',
  'Pharmacy',
  'Electronics',
  'Vapes',
  'Other'
];

const UNITS = ['pcs', 'kg', 'g', 'ml', 'L', 'pack', 'box', 'dozen', 'bottle'];

const CATEGORY_ICON = {
  'Dairy':           'icon-cat-dairy',
  'Bakery':          'icon-cat-bakery',
  'Drinks':          'icon-cat-drinks',
  'Snacks':          'icon-cat-snacks',
  'Raw Ingredients': 'icon-cat-raw',
  'Fast Food':       'icon-cat-food',
  'Grocery':         'icon-cat-default',
  'Pharmacy':        'icon-cat-raw',
  'Electronics':     'icon-package',
  'Vapes':           'icon-mobile',
  'Other':           'icon-cat-default'
};

// ── Session Helpers ──────────────────────────────────────────
async function getActiveSession() {
  return await db.cash_sessions.where('status').equals('OPEN').first();
}

// ── Stock Engine ─────────────────────────────────────────────
async function recalcStock(itemId) {
  const logs = await db.logs.where('item_id').equals(itemId).toArray();
  const item = await db.items.get(itemId);
  if (!item) return 0;

  let stock = item.initial_stock || 0;
  for (const log of logs) {
    switch (log.change_type) {
      case CHANGE_TYPE.IN:
        stock += log.qty_changed;
        break;
      case CHANGE_TYPE.OUT:
      case CHANGE_TYPE.SALE:
      case CHANGE_TYPE.SPOILAGE:
        stock -= log.qty_changed;
        break;
      case CHANGE_TYPE.ADJUSTMENT:
        // Check if notes indicate negative shrinkage/adjustment or negative qty
        if (log.notes && (log.notes.startsWith('[-]') || log.notes.includes('Shrinkage') || log.notes.includes('Damage') || log.notes.includes('Theft') || log.notes.includes('Loss'))) {
          stock -= log.qty_changed;
        } else {
          stock += log.qty_changed;
        }
        break;
    }
  }
  return Math.max(0, stock);
}

async function recordStockEvent({ itemId, changeType, qty, notes = '', saleId = null, reason = '', unitCost = null }) {
  const timestamp = new Date().toISOString();
  const fullNotes = reason ? (notes ? `${reason}: ${notes}` : reason) : notes;

  await db.logs.add({
    shop_id:     1,
    item_id:     itemId,
    change_type: changeType,
    qty_changed: Math.abs(qty),
    timestamp,
    sync_status: 'PENDING',
    notes:       fullNotes,
    sale_id:     saleId
  });

  const liveStock = await recalcStock(itemId);
  const updateData = { stock_quantity: liveStock };
  if (unitCost !== null && unitCost !== undefined && !isNaN(unitCost) && unitCost > 0) {
    updateData.cost_price = parseFloat(unitCost);
  }
  await db.items.update(itemId, updateData);

  return liveStock;
}

async function processSale(cartItems, opts = {}) {
  const {
    discount = 0,
    taxRate = 0,
    paymentMethod = 'Cash',
    cashTendered = 0,
    storeName = 'My Shop',
    customerId = null,
    sessionId = null,
    splitDetails = null,
    cardRef = null,
    digitalProvider = null,
    digitalRef = null
  } = opts;

  // Calculate gross subtotal and line-level discounts
  const grossSubtotal = cartItems.reduce((sum, ci) => sum + (ci.unit_price * ci.qty), 0);
  const lineDiscounts = cartItems.reduce((sum, ci) => sum + (ci.discount || 0), 0);
  const netSubtotal = Math.max(0, grossSubtotal - lineDiscounts);

  const billDiscount = discount;
  const totalDiscount = lineDiscounts + billDiscount;
  const afterDiscount = Math.max(0, netSubtotal - billDiscount);
  const taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
  const total = afterDiscount + taxAmount;
  
  let cashReceived = 0;
  let changeReturned = 0;

  if (paymentMethod === 'Cash') {
    changeReturned = Math.max(0, cashTendered - total);
    cashReceived = Math.min(cashTendered, total);
  } else if (paymentMethod === 'Credit') {
    cashReceived = Math.min(cashTendered, total);
    changeReturned = 0;
  } else if (paymentMethod === 'Split' && Array.isArray(splitDetails)) {
    const cashSplit = splitDetails.find(s => s.method === 'Cash');
    const cashPortion = cashSplit ? parseFloat(cashSplit.amount) || 0 : 0;
    cashReceived = cashPortion;
    changeReturned = opts.changeDue !== undefined ? opts.changeDue : Math.max(0, cashTendered - cashPortion);
  } else {
    // Card, Digital Wallet, etc.
    cashReceived = 0;
    changeReturned = 0;
  }

  const invoiceNo = `RCP-${Date.now()}`;

  // 1. Create sale record (backward compatible with IndexedDB schema)
  const saleId = await db.sales.add({
    shop_id: 1,
    invoice_no: invoiceNo,
    timestamp: new Date().toISOString(),
    subtotal: netSubtotal,
    discount: totalDiscount,
    tax: taxAmount,
    total,
    payment_method: paymentMethod,
    customer_id: customerId,
    cash_received: cashReceived,
    change_returned: changeReturned,
    session_id: sessionId,
    split_details: splitDetails,
    card_ref: cardRef,
    digital_provider: digitalProvider,
    digital_ref: digitalRef
  });

  // 2. Create normalized sale items & record inventory events
  for (const ci of cartItems) {
    const item = ci.item;
    const lineGross = ci.unit_price * ci.qty;
    const itemDiscount = ci.discount || 0;
    const lineTotal = Math.max(0, lineGross - itemDiscount);

    await db.sale_items.add({
      shop_id: 1,
      sale_id: saleId,
      item_id: item.id,
      quantity: ci.qty,
      unit_price: ci.unit_price,
      cost_price: item.cost_price || 0,
      discount: itemDiscount,
      line_total: lineTotal
    });

    if (item.is_composite) {
      const recipe = await db.recipes
        .where('composite_item_id').equals(item.id)
        .toArray();

      for (const bom of recipe) {
        const qtyToDeduct = bom.qty_required * ci.qty;
        await recordStockEvent({
          itemId:     bom.ingredient_item_id,
          changeType: CHANGE_TYPE.SALE,
          qty:        qtyToDeduct,
          notes:      `BOM: ${ci.qty}x ${item.name} (Sale ${invoiceNo})`,
          saleId
        });
      }
    } else {
      await recordStockEvent({
        itemId:     item.id,
        changeType: CHANGE_TYPE.SALE,
        qty:        ci.qty,
        notes:      `Sale ${invoiceNo}`,
        saleId
      });
    }
  }

  // 3. Handle Customer Balance & transactions
  if (customerId) {
    const customer = await db.customers.get(customerId);
    if (customer) {
      if (paymentMethod === 'Credit') {
        const creditAmount = total - cashReceived;
        const newBalance = (customer.current_balance || 0) + creditAmount;
        await db.customers.update(customerId, { current_balance: newBalance });

        await db.customer_transactions.add({
          shop_id: 1,
          customer_id: customerId,
          sale_id: saleId,
          amount: total,
          transaction_type: 'CREDIT',
          timestamp: new Date().toISOString()
        });

        if (cashReceived > 0) {
          await db.customer_transactions.add({
            shop_id: 1,
            customer_id: customerId,
            sale_id: saleId,
            amount: cashReceived,
            transaction_type: 'PAYMENT',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Direct cash/card/digital payment with customer linked
        await db.customer_transactions.add({
          shop_id: 1,
          customer_id: customerId,
          sale_id: saleId,
          amount: total,
          transaction_type: 'PAYMENT',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // 4. Update Cash Register Session expected cash (if active)
  if (sessionId) {
    let cashAddedToDrawer = 0;
    if (paymentMethod === 'Cash') {
      cashAddedToDrawer = cashReceived;
    } else if (paymentMethod === 'Split' && Array.isArray(splitDetails)) {
      const cashSplit = splitDetails.find(s => s.method === 'Cash');
      if (cashSplit) cashAddedToDrawer = parseFloat(cashSplit.amount) || 0;
    }

    if (cashAddedToDrawer > 0) {
      const session = await db.cash_sessions.get(sessionId);
      if (session) {
        const expected = (session.expected_cash || session.opening_cash) + cashAddedToDrawer;
        await db.cash_sessions.update(sessionId, { expected_cash: expected });
      }
    }
  }

  return {
    saleId,
    receiptNo: invoiceNo,
    subtotal: netSubtotal,
    grossSubtotal,
    lineDiscounts,
    discountAmt: totalDiscount,
    taxAmount,
    total,
    changeDue: changeReturned,
    paymentMethod,
    cashReceived,
    splitDetails,
    cardRef,
    digitalProvider,
    digitalRef
  };
}

// ── Settings helpers ─────────────────────────────────────────
async function getSetting(key, defaultValue = null) {
  const row = await db.settings.get(key);
  return row ? row.value : defaultValue;
}

async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// ── Demo Business Seeding Presets ─────────────────────────────
const BUSINESS_PRESETS = {
  grocery: {
    name: 'Green Grocers & Supermarket',
    address: 'Corner Block D, DHA Phase 5, Lahore',
    phone: '+92 300 1234567',
    tax_rate: 8,
    currency: 'Rs.',
    items: [
      { name: '1L Milk (Full Cream)', barcode: '1001', category: 'Dairy', unit: 'pcs', cost_price: 180, selling_price: 220, min_stock_alert: 20, initial_stock: 150 },
      { name: 'Bread Loaf (White)', barcode: '1002', category: 'Bakery', unit: 'pcs', cost_price: 80, selling_price: 110, min_stock_alert: 15, initial_stock: 80 },
      { name: 'Cola 500ml Can', barcode: '1003', category: 'Drinks', unit: 'pcs', cost_price: 60, selling_price: 90, min_stock_alert: 24, initial_stock: 300 },
      { name: 'Classic Potato Chips 50g', barcode: '1004', category: 'Snacks', unit: 'pcs', cost_price: 40, selling_price: 60, min_stock_alert: 30, initial_stock: 200 },
      { name: 'Basmati Rice 1kg Pack', barcode: '1005', category: 'Grocery', unit: 'pcs', cost_price: 320, selling_price: 380, min_stock_alert: 10, initial_stock: 60 },
      { name: 'Farm Fresh Eggs (Dozen)', barcode: '1006', category: 'Dairy', unit: 'pcs', cost_price: 240, selling_price: 290, min_stock_alert: 15, initial_stock: 90 },
      { name: 'Organic Yogurt 500g', barcode: '1007', category: 'Dairy', unit: 'pcs', cost_price: 130, selling_price: 170, min_stock_alert: 12, initial_stock: 70 },
      { name: 'Orange Juice 1L', barcode: '1008', category: 'Drinks', unit: 'pcs', cost_price: 280, selling_price: 350, min_stock_alert: 10, initial_stock: 80 }
    ],
    customers: [
      { name: 'Ayesha Malik', phone: '03009998877', address: 'House 44, DHA', current_balance: 0 },
      { name: 'Haris Khan', phone: '03215556677', address: 'Apartment 9B, Sector G', current_balance: 1200 }
    ],
    suppliers: [
      { name: 'Metro Distributors', phone: '042-111-222', email: 'orders@metro.com', address: 'Thokar Niaz Baig, Lahore' }
    ]
  },
  bakery: {
    name: 'The French Crust Bakery',
    address: 'Commercial Plaza, Phase 3, Rawalpindi',
    phone: '+92 312 9876543',
    tax_rate: 5,
    currency: 'Rs.',
    items: [
      { name: 'Chocolate Fudge Cake 1kg', barcode: '2001', category: 'Bakery', unit: 'pcs', cost_price: 900, selling_price: 1400, min_stock_alert: 5, initial_stock: 20 },
      { name: 'Chocolate Chip Cookies (Bag)', barcode: '2002', category: 'Bakery', unit: 'pcs', cost_price: 180, selling_price: 280, min_stock_alert: 10, initial_stock: 45 },
      { name: 'Butter Croissant', barcode: '2003', category: 'Bakery', unit: 'pcs', cost_price: 70, selling_price: 130, min_stock_alert: 20, initial_stock: 80 },
      { name: 'Glazed Donut', barcode: '2004', category: 'Bakery', unit: 'pcs', cost_price: 50, selling_price: 95, min_stock_alert: 15, initial_stock: 60 },
      { name: 'Chicken Puff Pastry', barcode: '2005', category: 'Bakery', unit: 'pcs', cost_price: 90, selling_price: 160, min_stock_alert: 15, initial_stock: 50 },
      { name: 'Fresh Cream Cupcake', barcode: '2006', category: 'Bakery', unit: 'pcs', cost_price: 60, selling_price: 110, min_stock_alert: 10, initial_stock: 40 }
    ],
    customers: [
      { name: 'Zoya Shah', phone: '03332211000', address: 'Bahria Town, Islamabad', current_balance: 0 },
      { name: 'Kamran Sheikh', phone: '03126667778', address: 'Askari 11, Rawalpindi', current_balance: 850 }
    ],
    suppliers: [
      { name: 'National Flour Mills', phone: '051-555987', email: 'supply@nationalflour.com', address: 'Industrial Area, Kahuta' }
    ]
  },
  restaurant: {
    name: 'Sizzling Grillhouse & Cafe',
    address: 'F-7 Markaz, Islamabad',
    phone: '+92 334 1112223',
    tax_rate: 16,
    currency: 'Rs.',
    items: [
      // Ingredients
      { name: 'Burger Bun (Raw)', barcode: '3501', category: 'Raw Ingredients', unit: 'pcs', cost_price: 15, selling_price: 0, min_stock_alert: 50, initial_stock: 300 },
      { name: 'Beef Patty (Raw)', barcode: '3502', category: 'Raw Ingredients', unit: 'pcs', cost_price: 90, selling_price: 0, min_stock_alert: 50, initial_stock: 250 },
      { name: 'Cheese Slice (Raw)', barcode: '3503', category: 'Raw Ingredients', unit: 'pcs', cost_price: 12, selling_price: 0, min_stock_alert: 100, initial_stock: 400 },
      { name: 'Mozzarella Cheese 1kg', barcode: '3504', category: 'Raw Ingredients', unit: 'kg', cost_price: 900, selling_price: 0, min_stock_alert: 5, initial_stock: 15 },
      // Composite Fast Foods
      { name: 'Beef Cheeseburger', barcode: '3001', category: 'Fast Food', unit: 'pcs', cost_price: 120, selling_price: 490, min_stock_alert: 10, initial_stock: 0, is_composite: true },
      { name: 'Double Patty Melt', barcode: '3002', category: 'Fast Food', unit: 'pcs', cost_price: 210, selling_price: 790, min_stock_alert: 8, initial_stock: 0, is_composite: true },
      { name: 'Crispy Fries Regular', barcode: '3003', category: 'Fast Food', unit: 'pcs', cost_price: 40, selling_price: 180, min_stock_alert: 10, initial_stock: 120 },
      { name: 'Soft Drink 350ml Glass', barcode: '3004', category: 'Drinks', unit: 'pcs', cost_price: 35, selling_price: 90, min_stock_alert: 30, initial_stock: 200 }
    ],
    recipes: [
      { composite_item_name: 'Beef Cheeseburger', ingredient_name: 'Burger Bun (Raw)', qty: 1 },
      { composite_item_name: 'Beef Cheeseburger', ingredient_name: 'Beef Patty (Raw)', qty: 1 },
      { composite_item_name: 'Beef Cheeseburger', ingredient_name: 'Cheese Slice (Raw)', qty: 1 },
      { composite_item_name: 'Double Patty Melt', ingredient_name: 'Burger Bun (Raw)', qty: 1 },
      { composite_item_name: 'Double Patty Melt', ingredient_name: 'Beef Patty (Raw)', qty: 2 },
      { composite_item_name: 'Double Patty Melt', ingredient_name: 'Cheese Slice (Raw)', qty: 2 }
    ],
    customers: [
      { name: 'Ahmad Raza', phone: '03004561239', address: 'F-8/3, Islamabad', current_balance: 0 },
      { name: 'Samra Butt', phone: '03457788990', address: 'G-11, Islamabad', current_balance: 3100 }
    ],
    suppliers: [
      { name: 'Punjab Fresh Meat supplier', phone: '051-992011', email: 'meat@punjabfresh.com', address: 'Saddar, Rawalpindi' }
    ]
  },
  vape: {
    name: 'Cloud Vapes & E-Cigs',
    address: 'Shop 2, Beverly Centre, F-6, Islamabad',
    phone: '+92 321 4443332',
    tax_rate: 10,
    currency: 'Rs.',
    items: [
      { name: 'Caliburn G2 Pod System', barcode: '4001', category: 'Vapes', unit: 'pcs', cost_price: 3800, selling_price: 5500, min_stock_alert: 5, initial_stock: 25 },
      { name: 'Uwell replacement Coils 1.2ohm (Pack)', barcode: '4002', category: 'Vapes', unit: 'pcs', cost_price: 1600, selling_price: 2400, min_stock_alert: 10, initial_stock: 50 },
      { name: 'Mint Breeze E-Liquid 30ml (30mg Salt)', barcode: '4003', category: 'Vapes', unit: 'pcs', cost_price: 1900, selling_price: 3000, min_stock_alert: 12, initial_stock: 60 },
      { name: 'Grape Ice E-Liquid 30ml (50mg Salt)', barcode: '4004', category: 'Vapes', unit: 'pcs', cost_price: 1900, selling_price: 3000, min_stock_alert: 12, initial_stock: 45 },
      { name: 'Elf Bar 5000 Puffs Disposable', barcode: '4005', category: 'Vapes', unit: 'pcs', cost_price: 1800, selling_price: 2800, min_stock_alert: 15, initial_stock: 80 }
    ],
    customers: [
      { name: 'Bilal Malik', phone: '03218889900', address: 'Sector I-8, Islamabad', current_balance: 0 },
      { name: 'Saad Ahmed', phone: '03005553311', address: 'DHA Phase 2, Islamabad', current_balance: 4500 }
    ],
    suppliers: [
      { name: 'Vapor Wholesale PK', phone: '021-3456789', email: 'wholesale@vaporpk.com', address: 'Clifton, Karachi' }
    ]
  },
  pharmacy: {
    name: 'Shaheen Medical & Wellness',
    address: 'Plot 12-B, Super Market, F-6, Islamabad',
    phone: '+92 345 5556667',
    tax_rate: 0,
    currency: 'Rs.',
    items: [
      { name: 'Panadol 500mg (100 Tablets Box)', barcode: '5001', category: 'Pharmacy', unit: 'pcs', cost_price: 250, selling_price: 320, min_stock_alert: 20, initial_stock: 120 },
      { name: 'Surbex-Z Multivitamin (30 Tablets)', barcode: '5002', category: 'Pharmacy', unit: 'pcs', cost_price: 280, selling_price: 350, min_stock_alert: 15, initial_stock: 90 },
      { name: 'Hydryllin Cough Syrup 120ml', barcode: '5003', category: 'Pharmacy', unit: 'pcs', cost_price: 85, selling_price: 110, min_stock_alert: 25, initial_stock: 140 },
      { name: 'Brufen 400mg Suspension 90ml', barcode: '5004', category: 'Pharmacy', unit: 'pcs', cost_price: 90, selling_price: 120, min_stock_alert: 15, initial_stock: 80 },
      { name: 'Surgical Facemasks 3-Ply (Box of 50)', barcode: '5005', category: 'Pharmacy', unit: 'pcs', cost_price: 180, selling_price: 300, min_stock_alert: 10, initial_stock: 100 },
      { name: 'Band-Aid Tough Strips 20pk', barcode: '5006', category: 'Pharmacy', unit: 'pcs', cost_price: 70, selling_price: 115, min_stock_alert: 15, initial_stock: 75 }
    ],
    customers: [
      { name: 'Zafar Iqbal', phone: '03456781234', address: 'St 4, Sector E-11, Islamabad', current_balance: 0 },
      { name: 'Amna Begum', phone: '03009988112', address: 'Askari Flats, Rawalpindi', current_balance: 1800 }
    ],
    suppliers: [
      { name: 'GSK Pharma Distributors', phone: '021-111-gsk-11', email: 'supply@gsk.com.pk', address: 'Industrial Area, Korangi, Karachi' }
    ]
  },
  electronics: {
    name: 'ByteTech Gadgets & Gaming',
    address: 'Shop 14, Hafeez Centre, Gulberg, Lahore',
    phone: '+92 323 7776665',
    tax_rate: 17,
    currency: 'Rs.',
    items: [
      { name: 'Bluetooth ANC Headphones', barcode: '6001', category: 'Electronics', unit: 'pcs', cost_price: 4500, selling_price: 7500, min_stock_alert: 5, initial_stock: 15 },
      { name: 'USB-C Fast Charging Adapter 20W', barcode: '6002', category: 'Electronics', unit: 'pcs', cost_price: 800, selling_price: 1600, min_stock_alert: 15, initial_stock: 60 },
      { name: 'RGB Mechanical Gaming Keyboard', barcode: '6003', category: 'Electronics', unit: 'pcs', cost_price: 3500, selling_price: 5800, min_stock_alert: 5, initial_stock: 22 },
      { name: 'Wireless Ergonomic Optical Mouse', barcode: '6004', category: 'Electronics', unit: 'pcs', cost_price: 1200, selling_price: 2200, min_stock_alert: 10, initial_stock: 40 },
      { name: 'Heavy-Duty Braided Type-C Cable 2m', barcode: '6005', category: 'Electronics', unit: 'pcs', cost_price: 250, selling_price: 550, min_stock_alert: 20, initial_stock: 100 },
      { name: 'Ultra USB 3.0 Flash Drive 64GB', barcode: '6006', category: 'Electronics', unit: 'pcs', cost_price: 700, selling_price: 1300, min_stock_alert: 15, initial_stock: 80 }
    ],
    customers: [
      { name: 'Waleed Raza', phone: '03214455667', address: 'Gulberg 3, Lahore', current_balance: 0 },
      { name: 'Saad Mughal', phone: '03001122334', address: 'Samanabad, Lahore', current_balance: 6200 }
    ],
    suppliers: [
      { name: 'China Gadgets Import Ltd.', phone: '021-3245671', email: 'sales@chinagadgets.com', address: 'Saddar Market, Karachi' }
    ]
  }
};

// ── Master Demo Seeding Engine ────────────────────────────────
async function seedBusinessTemplate(templateType) {
  const preset = BUSINESS_PRESETS[templateType];
  if (!preset) return false;

  console.log(`[DB] Seeding template: ${templateType}...`);

  await db.transaction('rw', [
    db.items, db.recipes, db.logs, db.sales, db.sale_items, db.settings,
    db.customers, db.customer_transactions, db.suppliers, db.purchase_orders,
    db.purchase_order_items, db.cash_sessions, db.batches, db.stock_adjustments
  ], async () => {
    // 1. Clear database completely
    await Promise.all([
      db.items.clear(),
      db.recipes.clear(),
      db.logs.clear(),
      db.sales.clear(),
      db.sale_items.clear(),
      db.settings.clear(),
      db.customers.clear(),
      db.customer_transactions.clear(),
      db.suppliers.clear(),
      db.purchase_orders.clear(),
      db.purchase_order_items.clear(),
      db.cash_sessions.clear(),
      db.batches.clear(),
      db.stock_adjustments.clear()
    ]);

    // 2. Load settings configurations
    await db.settings.bulkPut([
      { key: 'store_name',      value: preset.name },
      { key: 'store_address',   value: preset.address },
      { key: 'store_phone',     value: preset.phone },
      { key: 'currency',        value: preset.currency },
      { key: 'tax_rate',        value: preset.tax_rate },
      { key: 'tax_label',       value: preset.tax_rate > 0 ? 'GST' : 'Tax' },
      { key: 'receipt_footer',  value: 'Thank you for shopping! Managed via LocalPOS' },
      { key: 'theme',           value: 'light' },
      { key: 'app_pin',         value: '1234' },
      { key: 'demo_business',   value: templateType }
    ]);

    // 3. Seed Suppliers
    const supplierKeys = await db.suppliers.bulkAdd(preset.suppliers.map(s => ({ ...s, shop_id: 1 })), { allKeys: true });
    
    // 4. Seed Customers
    const customerKeys = await db.customers.bulkAdd(preset.customers.map(c => ({ ...c, shop_id: 1, created_at: new Date(Date.now() - 30 * 86400000).toISOString() })), { allKeys: true });

    // 5. Seed Items
    const itemsData = preset.items.map(it => ({
      shop_id: 1,
      barcode: it.barcode,
      name: it.name,
      category: it.category,
      unit: it.unit,
      cost_price: it.cost_price,
      selling_price: it.selling_price,
      min_stock_alert: it.min_stock_alert,
      initial_stock: it.initial_stock || 0,
      stock_quantity: it.initial_stock || 0,
      photo_blob: null,
      is_composite: !!it.is_composite,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString()
    }));

    const itemKeys = await db.items.bulkAdd(itemsData, { allKeys: true });
    const addedItems = await db.items.toArray();
    const itemMapByName = {};
    addedItems.forEach(it => { itemMapByName[it.name] = it; });

    // 6. Seed BOM Recipes (if present)
    if (preset.recipes) {
      await db.recipes.bulkAdd(preset.recipes.map(r => {
        const comp = itemMapByName[r.composite_item_name];
        const ingr = itemMapByName[r.ingredient_name];
        return {
          shop_id: 1,
          composite_item_id: comp.id,
          ingredient_item_id: ingr.id,
          qty_required: r.qty
        };
      }));
    }

    // 7. Seed Initial Stock-In Logs
    const logEntries = [];
    addedItems.forEach(it => {
      if (it.initial_stock > 0) {
        logEntries.push({
          shop_id: 1,
          item_id: it.id,
          change_type: CHANGE_TYPE.IN,
          qty_changed: it.initial_stock,
          timestamp: new Date(Date.now() - 30 * 86400000).toISOString(),
          sync_status: 'SYNCED',
          notes: 'Opening inventory load',
          sale_id: null
        });
      }
    });

    if (logEntries.length > 0) {
      await db.logs.bulkAdd(logEntries);
    }

    // 8. Seed Expiry Batches (for pharmaceutical/food templates)
    const expiryItems = addedItems.filter(it => !it.is_composite && ['Dairy', 'Pharmacy', 'Bakery'].includes(it.category));
    const batchEntries = [];
    expiryItems.forEach((it, idx) => {
      // Add batches expiring soon
      const expDays = idx === 0 ? 5 : idx === 1 ? 25 : 60;
      batchEntries.push({
        shop_id: 1,
        item_id: it.id,
        batch_number: `LOT-${1000 + idx}`,
        expiry_date: new Date(Date.now() + expDays * 86400000).toISOString().split('T')[0],
        quantity: Math.round(it.stock_quantity / 2),
        created_at: new Date(Date.now() - 10 * 86400000).toISOString()
      });
    });
    if (batchEntries.length > 0) {
      await db.batches.bulkAdd(batchEntries);
    }
  });

  console.log(`[DB] Seeding completed for: ${templateType}`);
  return true;
}

// ── 30-Day Transactions Generator ─────────────────────────────
async function generate30DaysDemoTransactions() {
  console.log('[DB] Generating 30 days of realistic history transactions...');
  const items = await db.items.toArray();
  const sellableItems = items.filter(it => it.selling_price > 0 || it.is_composite);
  const customers = await db.customers.toArray();
  const taxRate   = await getSetting('tax_rate', 0);

  if (sellableItems.length === 0) return false;

  const salesArr    = [];
  const cartMetaArr = [];
  const sessionArr  = [];
  const custTxMetaArr = [];
  
  const now = new Date();

  for (let day = 30; day >= 0; day--) {
    const date = new Date(now - day * 86400000);
    date.setHours(9, 0, 0, 0);
    
    const openingCash = 5000 + (Math.floor(Math.random() * 5) * 1000);
    let expectedCash = openingCash;

    const numSales = Math.floor(Math.random() * 8) + 3;

    for (let s = 1; s <= numSales; s++) {
      const saleDate = new Date(date);
      saleDate.setHours(9 + Math.floor(Math.random() * 12));
      saleDate.setMinutes(Math.floor(Math.random() * 60));
      saleDate.setSeconds(Math.floor(Math.random() * 60));

      const invoiceNo = `RCP-${saleDate.getTime()}-${day}-${s}`;

      const numCart = Math.floor(Math.random() * 3) + 1;
      const cartItems = [];
      let subtotal = 0;

      for (let c = 0; c < numCart; c++) {
        const item = sellableItems[Math.floor(Math.random() * sellableItems.length)];
        if (cartItems.some(ci => ci.item.id === item.id)) continue;
        const qty = Math.floor(Math.random() * 3) + 1;
        cartItems.push({ item, qty, unit_price: item.selling_price });
        subtotal += item.selling_price * qty;
      }

      if (cartItems.length === 0) continue;

      const discountAmt = Math.random() > 0.7 ? (Math.random() > 0.5 ? 50 : 100) : 0;
      const afterDisc = Math.max(0, subtotal - discountAmt);
      const totalTax = Math.round(afterDisc * (taxRate / 100));
      const total = afterDisc + totalTax;

      const rPay = Math.random();
      let paymentMethod = 'Cash';
      let customerId = null;
      let cashReceived = total;
      let changeReturned = 0;

      if (rPay > 0.9 && customers.length > 0) {
        paymentMethod = 'Credit';
        customerId = customers[Math.floor(Math.random() * customers.length)].id;
        cashReceived = Math.random() > 0.5 ? Math.round(total / 2) : 0;
      } else if (rPay > 0.6) {
        paymentMethod = 'Card';
        cashReceived = total;
      }

      if (paymentMethod === 'Cash') {
        const mult = Math.ceil(total / 100) * 100;
        cashReceived = total < 100 ? 100 : total < 500 ? 500 : total < 1000 ? 1000 : mult;
        changeReturned = cashReceived - total;
        expectedCash += total;
      } else if (paymentMethod === 'Credit') {
        expectedCash += cashReceived;
      }

      salesArr.push({
        shop_id: 1,
        invoice_no: invoiceNo,
        timestamp: saleDate.toISOString(),
        subtotal,
        discount: discountAmt,
        tax: totalTax,
        total,
        payment_method: paymentMethod,
        customer_id: customerId,
        cash_received: cashReceived,
        change_returned: changeReturned,
        session_id: null
      });
      cartMetaArr.push(cartItems);
      custTxMetaArr.push({ customerId, total, cashReceived, paymentMethod, saleDate });
    }

    const isToday = day === 0;
    sessionArr.push({
      shop_id: 1,
      opened_at: date.toISOString(),
      closed_at: isToday ? null : new Date(date.getTime() + 10 * 3600000).toISOString(),
      opening_cash: openingCash,
      expected_cash: expectedCash,
      actual_cash: isToday ? 0 : expectedCash,
      difference: 0,
      status: isToday ? 'OPEN' : 'CLOSED'
    });
  }

  await db.transaction('rw', [
    db.sales, db.sale_items, db.logs, db.cash_sessions,
    db.customer_transactions, db.customers, db.items
  ], async () => {
    await db.cash_sessions.bulkAdd(sessionArr);

    // Insert sales — get auto-generated primary keys back in order
    const saleIds = await db.sales.bulkAdd(salesArr, { allKeys: true });

    // Build sale_items, logs, and customer transactions using real saleIds
    const saleItemsArr = [];
    const logsArr = [];
    const custTxArr = [];

    saleIds.forEach((saleId, idx) => {
      const cart = cartMetaArr[idx];
      const sale = salesArr[idx];
      const meta = custTxMetaArr[idx];

      cart.forEach(ci => {
        saleItemsArr.push({
          shop_id: 1,
          sale_id: saleId,
          item_id: ci.item.id,
          quantity: ci.qty,
          unit_price: ci.unit_price,
          cost_price: ci.item.cost_price || 0,
          line_total: ci.unit_price * ci.qty
        });
        logsArr.push({
          shop_id: 1,
          item_id: ci.item.id,
          change_type: CHANGE_TYPE.SALE,
          qty_changed: ci.qty,
          timestamp: sale.timestamp,
          sync_status: 'SYNCED',
          notes: `POS checkout: ${sale.invoice_no}`,
          sale_id: saleId
        });
      });

      if (meta.customerId && meta.paymentMethod === 'Credit') {
        custTxArr.push({
          shop_id: 1,
          customer_id: meta.customerId,
          sale_id: saleId,
          amount: meta.total,
          transaction_type: 'CREDIT',
          timestamp: meta.saleDate.toISOString()
        });
        if (meta.cashReceived > 0) {
          custTxArr.push({
            shop_id: 1,
            customer_id: meta.customerId,
            sale_id: saleId,
            amount: meta.cashReceived,
            transaction_type: 'PAYMENT',
            timestamp: meta.saleDate.toISOString()
          });
        }
      }
    });

    await db.sale_items.bulkAdd(saleItemsArr);
    await db.logs.bulkAdd(logsArr);
    if (custTxArr.length > 0) {
      await db.customer_transactions.bulkAdd(custTxArr);
    }

    // Update customer outstanding balances
    for (const c of customers) {
      const txs = custTxArr.filter(t => t.customer_id === c.id);
      if (txs.length === 0) continue;
      let balance = 0;
      txs.forEach(t => {
        if (t.transaction_type === 'CREDIT') balance += t.amount;
        else balance -= t.amount;
      });
      if (balance !== 0) {
        await db.customers.update(c.id, { current_balance: Math.max(0, balance) });
      }
    }

    // Recalculate and persist stock quantities
    const allItems = await db.items.toArray();
    for (const it of allItems) {
      const stock = await recalcStock(it.id);
      await db.items.update(it.id, { stock_quantity: stock });
    }
  });

  console.log('[DB] Demo data generation complete!');
  return true;
}

// ── Initialize DB ────────────────────────────────────────────
async function initDB() {
  // Seeding is initiated by the UI template picker when items count is zero.
}

// ── Bulletproof Backup & Disaster Recovery Engine ─────────────
const DB_TABLE_NAMES = [
  'items', 'recipes', 'logs', 'sales', 'sale_items', 'settings',
  'customers', 'customer_transactions', 'cash_sessions', 'suppliers',
  'purchase_orders', 'purchase_order_items', 'inventory_counts',
  'inventory_count_items', 'stock_adjustments', 'inventory_transfers',
  'inventory_transfer_items', 'batches'
];

async function exportDatabaseBackup() {
  const storeName = await getSetting('store_name', 'Retail Store');
  const backup = {
    app: 'InventoryPOS-Enterprise',
    version: '5.0',
    exported_at: new Date().toISOString(),
    store_name: storeName,
    tables: {}
  };

  for (const tableName of DB_TABLE_NAMES) {
    if (db[tableName]) {
      backup.tables[tableName] = await db[tableName].toArray();
    }
  }

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  a.href = url;
  a.download = `InventoryPOS-Backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return backup;
}

async function parseBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !data.tables) {
          throw new Error('Invalid backup format: Missing tables data.');
        }
        resolve(data);
      } catch (err) {
        reject(new Error('Corrupted or invalid JSON file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read backup file.'));
    reader.readAsText(file);
  });
}

async function restoreDatabaseFromBackup(backupData) {
  if (!backupData || !backupData.tables) {
    throw new Error('Invalid backup data payload.');
  }

  const tablesToRestore = DB_TABLE_NAMES.filter(name => db[name] && Array.isArray(backupData.tables[name]));
  
  await db.transaction('rw', tablesToRestore.map(name => db[name]), async () => {
    for (const tableName of tablesToRestore) {
      await db[tableName].clear();
      const records = backupData.tables[tableName];
      if (records && records.length > 0) {
        await db[tableName].bulkAdd(records);
      }
    }
  });

  return true;
}

// ── Database Health Diagnostics & Cleaner ─────────────────────
async function getStorageUsageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usedBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 0;
      const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
      const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(0);
      const pct = quotaBytes > 0 ? ((usedBytes / quotaBytes) * 100).toFixed(1) : 0;
      return { usedMB, quotaMB, pct, usedBytes, quotaBytes };
    } catch (e) {
      return { usedMB: '0', quotaMB: 'N/A', pct: '0' };
    }
  }
  return { usedMB: '0', quotaMB: 'N/A', pct: '0' };
}

async function cleanOrphanedRecords() {
  let cleanedLogs = 0;
  let cleanedSaleItems = 0;
  let cleanedRecipes = 0;

  const itemIds = new Set((await db.items.toArray()).map(it => it.id));
  const saleIds = new Set((await db.sales.toArray()).map(s => s.id));

  // Find logs referencing non-existent items
  const allLogs = await db.logs.toArray();
  const orphanedLogIds = allLogs.filter(l => l.item_id && !itemIds.has(l.item_id)).map(l => l.id);
  if (orphanedLogIds.length > 0) {
    await db.logs.bulkDelete(orphanedLogIds);
    cleanedLogs = orphanedLogIds.length;
  }

  // Find sale_items referencing non-existent sales
  const allSaleItems = await db.sale_items.toArray();
  const orphanedSaleItemIds = allSaleItems.filter(si => si.sale_id && !saleIds.has(si.sale_id)).map(si => si.id);
  if (orphanedSaleItemIds.length > 0) {
    await db.sale_items.bulkDelete(orphanedSaleItemIds);
    cleanedSaleItems = orphanedSaleItemIds.length;
  }

  // Find recipes referencing non-existent composite or ingredient items
  const allRecipes = await db.recipes.toArray();
  const orphanedRecipeIds = allRecipes.filter(r => !itemIds.has(r.composite_item_id) || !itemIds.has(r.ingredient_item_id)).map(r => r.id);
  if (orphanedRecipeIds.length > 0) {
    await db.recipes.bulkDelete(orphanedRecipeIds);
    cleanedRecipes = orphanedRecipeIds.length;
  }

  return { cleanedLogs, cleanedSaleItems, cleanedRecipes, totalCleaned: cleanedLogs + cleanedSaleItems + cleanedRecipes };
}

