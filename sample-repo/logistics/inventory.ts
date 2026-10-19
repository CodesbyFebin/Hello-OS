// hello.forge sample repository — InventoryTracker
// Clean, type-correct module for AST symbol exploration.

export interface StockItem {
  sku: string;
  quantity: number;
  warehouse: string;
  reservedAt: number | null;
}

export class InventoryTracker {
  private stock: Map<string, StockItem> = new Map();

  reserve(sku: string, qty: number): boolean {
    const item = this.stock.get(sku);
    if (!item || item.quantity < qty) return false;
    item.quantity -= qty;
    item.reservedAt = Date.now();
    return true;
  }

  restock(sku: string, qty: number, warehouse: string): void {
    const existing = this.stock.get(sku);
    if (existing) {
      existing.quantity += qty;
    } else {
      this.stock.set(sku, { sku, quantity: qty, warehouse, reservedAt: null });
    }
  }

  getStock(sku: string): StockItem | undefined {
    return this.stock.get(sku);
  }

  totalSkus(): number {
    return this.stock.size;
  }

  lowStockReport(threshold: number): StockItem[] {
    const result: StockItem[] = [];
    for (const item of this.stock.values()) {
      if (item.quantity < threshold) result.push(item);
    }
    return result;
  }
}
