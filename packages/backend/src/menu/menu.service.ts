import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from '../db/index';
import { getCanonicalMerchantId } from '../lib/shop-utils';
import { MerchantsService } from '../merchants/merchants.service';
import {
  assertSaleBodyValid,
  computeSalePricing,
  parseProductBasePriceNumber,
} from './sale-pricing';

interface DbCategory {
  id: number;
  merchant_id: string;
  name: string;
  order: number;
  created_at: Date;
}

interface DbProduct {
  id: number;
  merchant_id: string;
  category_id: number;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_new: boolean;
  options: unknown;
  created_at: Date;
  sale_enabled: boolean;
  sale_discount_type: string | null;
  sale_discount_value: string | null;
  sale_starts_at: Date | string | null;
  sale_ends_at: Date | string | null;
  sale_pinned: boolean;
}

export interface CategoryWithProducts {
  id: number;
  merchantId: string;
  name: string;
  order: number;
  products: ProductItem[];
}

export interface ProductItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  isNew: boolean;
  options: unknown;
  saleEnabled: boolean;
  saleDiscountType: string | null;
  saleDiscountValue: string | number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  salePinned: boolean;
  saleActive: boolean;
  originalPrice: string;
  salePrice: number;
  discountLabel: string | null;
}

function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapDbProductToItem(prod: DbProduct): ProductItem {
  const price = prod.price;
  const saleVal =
    prod.sale_discount_value == null || prod.sale_discount_value === ''
      ? null
      : prod.sale_discount_value;
  const priced = computeSalePricing({
    basePrice: price,
    saleEnabled: prod.sale_enabled,
    saleDiscountType: prod.sale_discount_type,
    saleDiscountValue: saleVal,
    saleStartsAt: prod.sale_starts_at,
    saleEndsAt: prod.sale_ends_at,
  });
  let optionsOut: unknown = prod.options;
  if (optionsOut == null) {
    optionsOut = null;
  } else if (typeof optionsOut === 'string') {
    try {
      optionsOut = JSON.parse(optionsOut);
    } catch {
      optionsOut = optionsOut;
    }
  }
  return {
    id: prod.id,
    name: prod.name,
    description: prod.description,
    price,
    imageUrl: prod.image_url,
    isAvailable: prod.is_available,
    isFeatured: prod.is_featured,
    isNew: prod.is_new,
    options: optionsOut,
    saleEnabled: prod.sale_enabled,
    saleDiscountType: prod.sale_discount_type,
    saleDiscountValue: saleVal,
    saleStartsAt: toIsoOrNull(prod.sale_starts_at),
    saleEndsAt: toIsoOrNull(prod.sale_ends_at),
    salePinned: prod.sale_pinned,
    saleActive: priced.saleActive,
    originalPrice: priced.originalPrice,
    salePrice: priced.salePrice,
    discountLabel: priced.discountLabel,
  };
}

/** JSON từ `json_agg` — field camelCase đã build trong SQL. */
function enrichProductFromJsonAgg(p: Record<string, unknown>): ProductItem {
  const price = String(p.price ?? '');
  const saleVal = p.saleDiscountValue;
  const priced = computeSalePricing({
    basePrice: price,
    saleEnabled: Boolean(p.saleEnabled),
    saleDiscountType: (p.saleDiscountType as string) ?? null,
    saleDiscountValue:
      saleVal === undefined || saleVal === null ? null : (saleVal as string | number),
    saleStartsAt: (p.saleStartsAt as string) ?? null,
    saleEndsAt: (p.saleEndsAt as string) ?? null,
  });
  let optionsOut: unknown = p.options;
  if (optionsOut == null) {
    optionsOut = null;
  } else if (typeof optionsOut === 'string') {
    optionsOut = optionsOut;
  } else {
    optionsOut = JSON.stringify(optionsOut);
  }
  return {
    id: Number(p.id),
    name: String(p.name ?? ''),
    description: (p.description as string) ?? null,
    price,
    imageUrl: (p.imageUrl as string) ?? null,
    isAvailable: Boolean(p.isAvailable),
    isFeatured: Boolean(p.isFeatured),
    isNew: Boolean(p.isNew),
    options: optionsOut,
    saleEnabled: Boolean(p.saleEnabled),
    saleDiscountType: (p.saleDiscountType as string) ?? null,
    saleDiscountValue:
      saleVal === undefined || saleVal === null ? null : (saleVal as string | number),
    saleStartsAt: p.saleStartsAt != null ? String(p.saleStartsAt) : null,
    saleEndsAt: p.saleEndsAt != null ? String(p.saleEndsAt) : null,
    salePinned: Boolean(p.salePinned),
    saleActive: priced.saleActive,
    originalPrice: priced.originalPrice,
    salePrice: priced.salePrice,
    discountLabel: priced.discountLabel,
  };
}

export type ProductCreateBody = {
  categoryId: number;
  name: string;
  description?: string;
  price: string | number;
  imageUrl?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
  options?: unknown;
  saleEnabled?: boolean;
  saleDiscountType?: string | null;
  saleDiscountValue?: string | number | null;
  saleStartsAt?: string | Date | null;
  saleEndsAt?: string | Date | null;
  salePinned?: boolean;
};

export type ProductUpdateBody = Partial<ProductCreateBody>;

@Injectable()
export class MenuService {
  constructor(private readonly merchantsService: MerchantsService) {}

  async getCategories(
    incomingMerchantId: string,
  ): Promise<CategoryWithProducts[]> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);

    const rows = (await sql`
      SELECT
        c.id AS cat_id,
        c.merchant_id,
        c.name AS cat_name,
        c."order" AS cat_order,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'description', p.description,
              'price', p.price,
              'imageUrl', p.image_url,
              'isAvailable', p.is_available,
              'isFeatured', p.is_featured,
              'isNew', p.is_new,
              'options', p.options,
              'saleEnabled', p.sale_enabled,
              'saleDiscountType', p.sale_discount_type,
              'saleDiscountValue', p.sale_discount_value,
              'saleStartsAt', p.sale_starts_at,
              'saleEndsAt', p.sale_ends_at,
              'salePinned', p.sale_pinned
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS products
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      WHERE c.merchant_id = ${merchantId}
      GROUP BY c.id
      ORDER BY c."order" ASC, c.id ASC
    `) as unknown as {
      cat_id: number;
      merchant_id: string;
      cat_name: string;
      cat_order: number;
      products: Record<string, unknown>[];
    }[];

    return rows.map((r) => ({
      id: r.cat_id,
      merchantId: r.merchant_id,
      name: r.cat_name,
      order: r.cat_order,
      products: r.products.map((p) => enrichProductFromJsonAgg(p)),
    }));
  }

  async createCategory(
    incomingMerchantId: string,
    data: { name: string; order?: number },
  ): Promise<CategoryWithProducts> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);

    const [maxResult] = (await sql`
      SELECT COALESCE(MAX("order"), 0) + 1 AS next_order
      FROM categories WHERE merchant_id = ${merchantId}
    `) as unknown as { next_order: number }[];

    const [cat] = (await sql`
      INSERT INTO categories (merchant_id, name, "order")
      VALUES (${merchantId}, ${data.name}, ${data.order ?? maxResult.next_order})
      RETURNING id, merchant_id, name, "order", created_at
    `) as unknown as DbCategory[];

    return {
      id: cat.id,
      merchantId: cat.merchant_id,
      name: cat.name,
      order: cat.order,
      products: [],
    };
  }

  async updateCategory(
    incomingMerchantId: string,
    id: number,
    data: { name?: string; order?: number },
  ): Promise<CategoryWithProducts> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);

    const existing =
      (await sql`SELECT * FROM categories WHERE id = ${id} AND merchant_id = ${merchantId}`) as unknown as DbCategory[];
    if (!existing.length) throw new NotFoundException('Category not found');

    if (data.name === undefined && data.order === undefined) {
      const c = existing[0];
      return {
        id: c.id,
        merchantId: c.merchant_id,
        name: c.name,
        order: c.order,
        products: [],
      };
    }

    const newName = data.name ?? existing[0].name;
    const newOrder = data.order ?? existing[0].order;

    const [cat] = (await sql`
      UPDATE categories SET name = ${newName}, "order" = ${newOrder}
      WHERE id = ${id} AND merchant_id = ${merchantId}
      RETURNING id, merchant_id, name, "order", created_at
    `) as unknown as DbCategory[];

    return {
      id: cat.id,
      merchantId: cat.merchant_id,
      name: cat.name,
      order: cat.order,
      products: [],
    };
  }

  async deleteCategory(incomingMerchantId: string, id: number): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    await sql`DELETE FROM categories WHERE id = ${id} AND merchant_id = ${merchantId}`;
  }

  async createProduct(
    incomingMerchantId: string,
    data: ProductCreateBody,
  ): Promise<ProductItem> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const priceStr = String(data.price);
    const baseNum = parseProductBasePriceNumber(priceStr);
    const saleEnabled = data.saleEnabled ?? false;
    assertSaleBodyValid(
      {
        saleEnabled,
        saleDiscountType: data.saleDiscountType,
        saleDiscountValue: data.saleDiscountValue,
        saleStartsAt: data.saleStartsAt,
        saleEndsAt: data.saleEndsAt,
        salePinned: data.salePinned,
      },
      baseNum,
    );

    const starts =
      data.saleStartsAt != null && String(data.saleStartsAt) !== ''
        ? new Date(data.saleStartsAt)
        : null;
    const ends =
      data.saleEndsAt != null && String(data.saleEndsAt) !== ''
        ? new Date(data.saleEndsAt)
        : null;

    const [prod] = (await sql`
      INSERT INTO products (
        merchant_id, category_id, name, description, price, image_url,
        is_available, is_featured, is_new, options,
        sale_enabled, sale_discount_type, sale_discount_value,
        sale_starts_at, sale_ends_at, sale_pinned
      )
      VALUES (
        ${merchantId},
        ${data.categoryId},
        ${data.name},
        ${data.description ?? null},
        ${priceStr},
        ${data.imageUrl ?? null},
        ${data.isAvailable ?? true},
        ${data.isFeatured ?? false},
        ${data.isNew ?? false},
        ${data.options != null ? JSON.stringify(data.options) : null}::text,
        ${saleEnabled},
        ${saleEnabled ? data.saleDiscountType ?? null : null},
        ${saleEnabled && data.saleDiscountValue != null && String(data.saleDiscountValue) !== '' ? String(data.saleDiscountValue) : null},
        ${starts && !Number.isNaN(starts.getTime()) ? starts : null},
        ${ends && !Number.isNaN(ends.getTime()) ? ends : null},
        ${data.salePinned ?? false}
      )
      RETURNING id, category_id, name, description, price, image_url, is_available, is_featured, is_new, options,
        sale_enabled, sale_discount_type, sale_discount_value, sale_starts_at, sale_ends_at, sale_pinned
    `) as unknown as DbProduct[];

    return mapDbProductToItem(prod);
  }

  async updateProduct(
    incomingMerchantId: string,
    id: number,
    data: ProductUpdateBody,
  ): Promise<ProductItem> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);

    const existing =
      (await sql`SELECT * FROM products WHERE id = ${id} AND merchant_id = ${merchantId}`) as unknown as DbProduct[];
    if (!existing.length) throw new NotFoundException('Product not found');
    const e = existing[0];

    const priceStr =
      data.price !== undefined ? String(data.price) : e.price;
    const baseNum = parseProductBasePriceNumber(priceStr);

    const saleEnabled =
      data.saleEnabled !== undefined ? data.saleEnabled : e.sale_enabled;
    const saleDiscountType =
      data.saleDiscountType !== undefined
        ? data.saleDiscountType
        : e.sale_discount_type;
    const saleDiscountValue =
      data.saleDiscountValue !== undefined
        ? data.saleDiscountValue
        : e.sale_discount_value;
    const saleStartsAt =
      data.saleStartsAt !== undefined
        ? data.saleStartsAt
        : e.sale_starts_at;
    const saleEndsAt =
      data.saleEndsAt !== undefined ? data.saleEndsAt : e.sale_ends_at;
    const salePinned =
      data.salePinned !== undefined ? data.salePinned : e.sale_pinned;

    assertSaleBodyValid(
      {
        saleEnabled,
        saleDiscountType,
        saleDiscountValue:
          saleDiscountValue === '' ? null : saleDiscountValue,
        saleStartsAt,
        saleEndsAt,
        salePinned,
      },
      baseNum,
    );

    const mergedStarts =
      data.saleStartsAt !== undefined
        ? data.saleStartsAt != null && String(data.saleStartsAt) !== ''
          ? new Date(data.saleStartsAt)
          : null
        : e.sale_starts_at
          ? new Date(e.sale_starts_at as string | Date)
          : null;
    const mergedEnds =
      data.saleEndsAt !== undefined
        ? data.saleEndsAt != null && String(data.saleEndsAt) !== ''
          ? new Date(data.saleEndsAt)
          : null
        : e.sale_ends_at
          ? new Date(e.sale_ends_at as string | Date)
          : null;

    const startsSql =
      data.saleStartsAt !== undefined
        ? mergedStarts && !Number.isNaN(mergedStarts.getTime())
          ? mergedStarts
          : null
        : e.sale_starts_at ?? null;
    const endsSql =
      data.saleEndsAt !== undefined
        ? mergedEnds && !Number.isNaN(mergedEnds.getTime())
          ? mergedEnds
          : null
        : e.sale_ends_at ?? null;

    const discValForSql =
      saleEnabled &&
      saleDiscountValue != null &&
      String(saleDiscountValue) !== ''
        ? String(saleDiscountValue)
        : null;

    const [prod] = (await sql`
      UPDATE products
      SET category_id = ${data.categoryId ?? e.category_id},
          name = ${data.name ?? e.name},
          description = ${data.description ?? e.description},
          price = ${priceStr},
          image_url = ${data.imageUrl ?? e.image_url},
          is_available = ${data.isAvailable ?? e.is_available},
          is_featured = ${data.isFeatured ?? e.is_featured},
          is_new = ${data.isNew ?? e.is_new},
          options = ${data.options !== undefined ? JSON.stringify(data.options) : (e.options as string | null)},
          sale_enabled = ${saleEnabled},
          sale_discount_type = ${saleEnabled ? saleDiscountType : null},
          sale_discount_value = ${discValForSql},
          sale_starts_at = ${startsSql},
          sale_ends_at = ${endsSql},
          sale_pinned = ${salePinned}
      WHERE id = ${id} AND merchant_id = ${merchantId}
      RETURNING id, category_id, name, description, price, image_url, is_available, is_featured, is_new, options,
        sale_enabled, sale_discount_type, sale_discount_value, sale_starts_at, sale_ends_at, sale_pinned
    `) as unknown as DbProduct[];

    if (!prod) throw new NotFoundException('Product not found');
    return mapDbProductToItem(prod);
  }

  async deleteProduct(incomingMerchantId: string, id: number): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    await sql`DELETE FROM products WHERE id = ${id} AND merchant_id = ${merchantId}`;
  }

  async reorderCategories(
    incomingMerchantId: string,
    orderedIds: number[],
  ): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    let ord = 0;
    for (const cid of orderedIds) {
      await sql`
        UPDATE categories SET "order" = ${ord}
        WHERE id = ${cid} AND merchant_id = ${merchantId}
      `;
      ord += 1;
    }
  }

  async bulkUpdateProductPrices(
    incomingMerchantId: string,
    updates: { id: number; price: string }[],
  ): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    for (const u of updates) {
      await sql`
        UPDATE products SET price = ${String(u.price)}
        WHERE id = ${u.id} AND merchant_id = ${merchantId}
      `;
    }
  }

  /** Same JSON as GET /api/public/menu/:merchantId — used by /api/menu/:merchantId alias. */
  async buildPublicMenuResponse(incomingMerchantId: string) {
    const merchant =
      await this.merchantsService.getMerchant(incomingMerchantId);
    const mRaw = merchant as unknown as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, fcm_token, qr_secret, ...publicMerchant } = mRaw;
    const m = mRaw;
    const categories = await this.getCategories(incomingMerchantId);
    return {
      merchant: {
        ...publicMerchant,
        wifiSsid: (m.wifi_ssid as string) ?? (m.wifiSsid as string) ?? null,
        wifiPassword:
          (m.wifi_password as string) ?? (m.wifiPassword as string) ?? null,
      },
      categories,
    };
  }
}
