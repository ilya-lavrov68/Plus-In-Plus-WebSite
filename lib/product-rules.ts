import { randomUUID } from "node:crypto";

import { rows, run } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/slug";

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

function assertPriceAndStock(price: number, stock: number): void {
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) {
    throw new ProductRuleError("Цена: от 0 до 10 000 000 ₽.", "price_range");
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
    throw new ProductRuleError("Остаток: целое число от 0 до 1 000 000.", "stock_range");
  }
}

export async function updateProduct(input: ProductUpdate): Promise<void> {
  assertPriceAndStock(input.price, input.stock);

  const [current] = await rows<{ id: string }>(`select id from products where id = ?`, [input.id]);
  if (!current) throw new ProductRuleError("Товар не найден.", "not_found");

  const slug = slugify(input.slug || input.name, `product-${input.id.slice(0, 8)}`);
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

export interface ProductCreate {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  isActive: boolean;
}

/** Создаёт товар и возвращает его id. Слаг подбирается свободный. */
export async function insertProduct(input: ProductCreate): Promise<string> {
  if (input.name.length < 2 || input.name.length > 120) {
    throw new ProductRuleError("Название: от 2 до 120 символов.", "name_length");
  }
  assertPriceAndStock(input.price, input.stock);

  const id = randomUUID();
  const slug = await uniqueSlug(
    input.slug || input.name,
    async (candidate) => (await rows(`select 1 from products where slug = ? limit 1`, [candidate])).length > 0,
    "product",
    id,
  );
  const now = new Date().toISOString();

  await run(
    `insert into products (id, name, slug, description, price, category, is_active, stock, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      slug,
      input.description,
      Math.round(input.price),
      input.category,
      input.isActive ? 1 : 0,
      input.stock,
      now,
      now,
    ],
  );
  return id;
}
