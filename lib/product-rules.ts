import { rows, run } from "@/lib/db";

/**
 * Товары магазина: цена хранится в рублях, остаток — целое число.
 * Правки идут через эту функцию, чтобы валидация была одна на панель и тесты.
 */

export class ProductRuleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ProductRuleError";
  }
}

export interface ProductUpdate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  isActive: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function updateProduct(input: ProductUpdate): Promise<void> {
  if (!Number.isFinite(input.price) || input.price < 0 || input.price > 10_000_000) {
    throw new ProductRuleError("Цена: от 0 до 10 000 000 ₽.", "price_range");
  }
  if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 1_000_000) {
    throw new ProductRuleError("Остаток: целое число от 0 до 1 000 000.", "stock_range");
  }

  const [current] = await rows<{ id: string }>(`select id from products where id = ?`, [input.id]);
  if (!current) throw new ProductRuleError("Товар не найден.", "not_found");

  const slug = slugify(input.slug || input.name) || `product-${input.id.slice(0, 8)}`;
  const changed = await run(
    `update products set name = ?, slug = ?, description = ?, price = ?, stock = ?, category = ?,
       is_active = ?, updated_at = ?
     where id = ?`,
    [
      input.name,
      slug,
      input.description,
      Math.round(input.price),
      input.stock,
      input.category,
      input.isActive ? 1 : 0,
      new Date().toISOString(),
      input.id,
    ],
  );
  if (changed !== 1) throw new ProductRuleError("Товар не найден.", "not_found");
}
