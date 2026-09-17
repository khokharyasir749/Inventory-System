/**
 * cart.js — POS Cart State Management
 * Cart persists to sessionStorage to survive accidental refreshes.
 */

const Cart = (() => {
  const STORAGE_KEY = 'pos_cart';
  let items = []; // [{item, qty, unit_price}]

  // ── Persistence ──────────────────────────────────────────
  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(
        items.map(ci => ({
          itemId:     ci.item.id,
          qty:        ci.qty,
          unit_price: ci.unit_price,
          discount:   ci.discount || 0
        }))
      ));
    } catch (e) { /* Storage full or unavailable */ }
  }

  async function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      items = [];
      for (const s of saved) {
        const item = await db.items.get(s.itemId);
        if (item) {
          items.push({
            item,
            qty: s.qty,
            unit_price: s.unit_price,
            discount: s.discount || 0
          });
        }
      }
    } catch (e) {
      items = [];
    }
  }

  // ── Mutations ─────────────────────────────────────────────
  function add(item, qty = 1) {
    const existing = items.find(ci => ci.item.id === item.id);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ item, qty, unit_price: item.selling_price, discount: 0 });
    }
    save();
    emit();
  }

  function setQty(itemId, qty) {
    const ci = items.find(ci => ci.item.id === itemId);
    if (ci) {
      ci.qty = Math.max(1, qty);
      if (ci.discount > ci.unit_price * ci.qty) {
        ci.discount = ci.unit_price * ci.qty;
      }
      save();
      emit();
    }
  }

  function setItemDiscount(itemId, discountAmt) {
    const ci = items.find(ci => ci.item.id === itemId);
    if (ci) {
      const lineGross = ci.unit_price * ci.qty;
      ci.discount = Math.max(0, Math.min(lineGross, Math.round(discountAmt * 100) / 100));
      save();
      emit();
    }
  }

  function remove(itemId) {
    items = items.filter(ci => ci.item.id !== itemId);
    save();
    emit();
  }

  function clear() {
    items = [];
    save();
    emit();
  }

  // ── Read ──────────────────────────────────────────────────
  function getItems() { return [...items]; }

  function getGrossSubtotal() {
    return items.reduce((sum, ci) => sum + ci.unit_price * ci.qty, 0);
  }

  function getTotalLineDiscounts() {
    return items.reduce((sum, ci) => sum + (ci.discount || 0), 0);
  }

  function getSubtotal() {
    return items.reduce((sum, ci) => sum + Math.max(0, (ci.unit_price * ci.qty) - (ci.discount || 0)), 0);
  }

  function getItemCount() {
    return items.reduce((sum, ci) => sum + ci.qty, 0);
  }

  // ── Events ────────────────────────────────────────────────
  function emit() {
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: getItems() } }));
  }

  return { add, setQty, setItemDiscount, remove, clear, getItems, getGrossSubtotal, getTotalLineDiscounts, getSubtotal, getItemCount, load, save };
})();
