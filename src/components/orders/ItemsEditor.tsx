import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeItemTotal } from "@/services/orders";
import { formatCurrency } from "@/lib/utils";
import type { DraftOrderItem } from "@/types/order";

interface Props {
  items: DraftOrderItem[];
  onChange: (items: DraftOrderItem[]) => void;
}

const PRODUCT_LIST = [
  "Sesame Oil",
  "Groundnut Oil",
  "Coconut Oil",
  "Deepam Oil",
  "Castor Oil",
  "Neem Oil",
  "Peanut",
  "Gram",
  "Sunflower Oil",
];

function blankItem(): DraftOrderItem {
  return { id: crypto.randomUUID(), product_name: "", quantity: "1", unit: "litres", price: "" };
}

export function ItemsEditor({ items, onChange }: Props) {
  const update = (id: string, patch: Partial<DraftOrderItem>) => {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const remove = (id: string) => {
    onChange(items.length > 1 ? items.filter((i) => i.id !== id) : [blankItem()]);
  };

  const add = () => onChange([...items, blankItem()]);

  const grandTotal = items.reduce((sum, i) => sum + computeItemTotal(i.quantity, i.price), 0);

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_90px_90px_110px_110px_40px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
        <span>Product</span>
        <span>Qty</span>
        <span>Litres</span>
        <span>Price</span>
        <span>Total</span>
        <span />
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:grid-cols-[1fr_90px_90px_110px_110px_40px] md:items-center md:rounded-none md:border-0 md:border-b md:p-1 md:pb-3"
        >
          <div className="col-span-2 md:col-span-1">
            <Input
              list="order-product-list"
              placeholder="Type or select product"
              value={item.product_name}
              onChange={(e) => update(item.id, { product_name: e.target.value })}
            />
          </div>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Qty"
            value={item.quantity}
            onChange={(e) => update(item.id, { quantity: e.target.value })}
          />
          <Input
            placeholder="Litres"
            value={item.unit}
            onChange={(e) => update(item.id, { unit: e.target.value })}
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={item.price}
            onChange={(e) => update(item.id, { price: e.target.value })}
          />
          <div className="flex items-center justify-between text-sm font-medium md:justify-start">
            <span className="text-muted-foreground md:hidden">Total</span>
            {formatCurrency(computeItemTotal(item.quantity, item.price))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => remove(item.id)} className="justify-self-end text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <datalist id="order-product-list">
        {PRODUCT_LIST.map((product) => (
          <option key={product} value={product} />
        ))}
      </datalist>

      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          Add Another Product
        </Button>
        <p className="text-sm font-semibold">Computed Total: {formatCurrency(grandTotal)}</p>
      </div>
    </div>
  );
}

export { blankItem };
