You are an expert Principal Frontend Architect and HCI (Human-Computer Interaction) Specialist. 

Build a complete, production-ready, ultra-fast Local-First Inventory & POS Web Application optimized for small-to-medium retail and fast-food shops (e.g., grocery stores, burger joints, food stalls). The app must be fully offline-capable, responsive across mobile and desktop, and cost $0 to host.

---

### 1. CORE ARCHITECTURE & TECH STACK
* **Model:** Local-First Event Ledger. The local database is the primary source of truth; all read/write operations execute locally in 0ms without waiting for a server.
* **Storage:** IndexedDB via Dexie.js (for Web/PWA) or SQLite/Isar DB. All product data, photos (compressed WebP base64/blobs), cart states, and transaction logs are stored directly on the device.
* **Offline Sync Queue & Conflict Resolution:** Store every inventory transaction (IN, OUT, SALE, SPOILAGE) as an append-only event log. 
  * **Deterministic Conflict Resolution:** Never overwrite raw stock numbers directly. Calculate live stock as `Initial Stock + SUM(IN) - SUM(OUT)`. When syncing online, merge independent offline event queues without data loss.
* **Disaster Recovery (Local Backup):** Include a 1-tap "Backup Database to File" (JSON export) and "Restore Database from File" function so users can protect their data against browser cache clears or phone upgrades.
* **Zero-Downtime Reliability:** The UI must NEVER freeze, lock, or show a blocking spinner while waiting for an internet connection or network call.

---

### 2. DATA MODEL & INVENTORY ENGINE
Create a clean, unified schema that handles both simple retail and fast-food composite items:

1. **Items Table:**
   * `id`, `barcode`, `name`, `category`, `unit` (pcs, kg, grams, ml), `cost_price`, `selling_price`, `min_stock_alert`, `stock_quantity`, `photo_blob`
2. **Recipes / Bill of Materials (BOM) Table:**
   * Maps composite items (e.g., "Zinger Burger") to raw ingredient items (e.g., 1 Bun, 1 Patty, 20g Sauce).
   * **Rule:** Selling 1 Zinger Burger must automatically decrement its linked raw ingredients from stock based on the BOM ratios.
3. **Inventory Logs (Append-Only Event Ledger):**
   * `id`, `item_id`, `change_type` (IN / OUT / SALE / ADJUSTMENT), `qty_changed`, `timestamp`, `sync_status` (PENDING / SYNCED).

---

### 3. EXPORTS, IMPORTS & PRINTING
* **Excel / CSV Export:** 1-tap download buttons to export current inventory levels, low-stock lists, and sales history logs directly to `.csv` / `.xlsx` files locally on the device without requiring an internet connection.
* **Bulk Inventory CSV Import:** Allow shop managers to upload a CSV file to bulk-create or update items, prices, and initial stock counts in seconds.
* **Thermal Receipt & Document Printing:** Include print-optimized CSS (`@media print`) designed for:
  1. *58mm / 80mm POS Thermal Printers:* Clean, compact receipt layout featuring store name, itemized list, subtotal, tax/discount, total, and timestamp.
  2. *Standard A4 Inventory Sheets:* Formatted product and stock audit tables for record-keeping.

---

### 4. HCI & INTERFACE DESIGN SYSTEM (ZERO LEARNING CURVE)
The user must be able to operate the app immediately on a touch screen or desktop without reading a manual or searching through complex sub-menus.

* **UI Layout & POS Workflows:**
  * **Visual Product Grid:** Large, high-contrast product cards displaying the product photo (or automatic category SVG icon if no photo exists), name, current stock count, and formatted price (e.g., `Rs. 250`).
  * **Dual Sales Mode:**
    1. *Quick 1-Tap Sale:* Direct `[ + ]` (Stock In) and `[ - ]` (Quick Single Sale) buttons right on each product tile.
    2. *Multi-Item POS Cart:* Tapping a product card adds it to a side cart drawer for multi-item orders, calculating totals and change due in real time.
  * **Global Fast Search & Barcode Input:** A persistent top bar with auto-focused live search (supporting physical USB/Bluetooth barcode scanner inputs) and 1-tap category pills ("All", "Drinks", "Snacks", "Raw Ingredients").
  * **Touch-Optimized:** Minimum touch target size of 48px for fast mobile and tablet operation under busy store conditions.
  * **Low-Stock Visual Alerts:** Items below their minimum threshold display an unmissable warm warning badge on their card.

* **Color & Visual Palette (Minimalist Enterprise — 0% Blue, Zero Shine):**
  * Avoid neon colors, saturated blues, ambient glow orbs, and radial gradients. Use a calm, high-contrast, distraction-free enterprise palette:
  * **Dark Mode:**
    * **Canvas Background:** Deep Matte Carbon (`#0D0F12`).
    * **Surface Cards:** Solid Dark Slate surfaces (`#15181E` / `#181B22`) with razor-thin hairline borders (`1px solid rgba(255, 255, 255, 0.08)`).
    * **Primary Action & Navigation:** High-contrast Pure White (`#FFFFFF` with `#0D0F12` pitch text) or Muted Warm Amber (`#D97706`). Active navigation pill: solid `#222630`.
  * **Light Mode:**
    * **Canvas Background:** Clean Studio Alabaster (`#F8FAFC`).
    * **Surface Cards:** Pure White (`#FFFFFF`) with subtle slate borders (`1px solid #E2E8F0`).
    * **Primary Action & Navigation:** Solid Dark Slate (`#15181E` with `#FFFFFF` text) or Muted Warm Amber (`#D97706`). Active navigation pill: solid `#E2E8F0`.
  * **Status & Inventory Flows:**
    * **Stock In / Add Flow:** Muted Sage Green (`#059669` / `#10B981`).
    * **Sale / Warning / Spoilage:** Warm Amber (`#D97706` / `#F59E0B`).
    * **Critical Out-of-Stock / Danger:** Muted Brick Red (`#DC2626` / `#EF4444`).

---

### 5. IMAGE HANDLING & PERFORMANCE
* Compress uploaded product images locally on the client side (max resolution 300x300, WebP format, target size < 20KB per image) before saving to IndexedDB.
* Fall back to crisp, lightweight inline SVG icons if no photo is uploaded so the layout never breaks or looks empty.
* Use lazy-loaded thumbnail rendering to guarantee 60fps scrolling performance, even with 1,000+ stored inventory items.

---

### 6. CODE OUTPUT REQUIREMENTS
* Provide a fully functional, complete application implementation with zero placeholders, truncated sections, or `// TODO` comments.
* Include complete IndexedDB database initialization setup with Dexie.js (or equivalent local storage engine).
* Include fully populated, realistic mock data for both a retail grocery store item (e.g., "1L Milk") and a fast-food recipe item (e.g., "Zinger Burger" linked to raw ingredient deductions).