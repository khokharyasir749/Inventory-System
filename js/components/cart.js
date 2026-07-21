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
          unit_price: ci.unit_price
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
        if (item) items.push({ item, qty: s.qty, unit_price: s.unit_price });
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
      items.push({ item, qty, unit_price: item.selling_price });
    }
    save();
    emit();
  }

  function setQty(itemId, qty) {
    const ci = items.find(ci => ci.item.id === itemId);
    if (ci) {
      ci.qty = Math.max(1, qty);
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

  function getSubtotal() {
    return items.reduce((sum, ci) => sum + ci.unit_price * ci.qty, 0);
  }

  function getItemCount() {
    return items.reduce((sum, ci) => sum + ci.qty, 0);
  }

  // ── Events ────────────────────────────────────────────────
  function emit() {
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: getItems() } }));
  }

  return { add, setQty, remove, clear, getItems, getSubtotal, getItemCount, load, save };
})();
