import { ForbiddenException } from '@nestjs/common';
import { sql } from '../db/index';

/** UUID regex — used to distinguish ID types */
export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/**
 * Resolves a merchant identifier (merchant UUID, slug, legacy shop UUID, employee UUID)
 * to the canonical `merchants.id`.
 *
 * `Employee.shopId` references `merchants.id` directly (no `Shop` table).
 */
export async function getCanonicalMerchantId(
  id: string,
  throwOnMissing = true,
): Promise<string> {
  if (!id || id === 'undefined') {
    if (throwOnMissing)
      throw new ForbiddenException('Invalid Merchant context');
    return id;
  }

  if (isUuid(id)) {
    const [merch] = await sql<
      { id: string }[]
    >`SELECT id FROM merchants WHERE id = ${id}`;
    if (merch) return String(merch.id);

    const [emp] = await sql<{ shopId: string }[]>`
      SELECT e."shopId"
      FROM "Employee" e
      WHERE e.id = ${id}
    `;
    if (emp) return String(emp.shopId);
  } else {
    const [merch] = await sql<
      { id: string }[]
    >`SELECT id FROM merchants WHERE slug = ${id}`;
    if (merch) return String(merch.id);
  }

  if (throwOnMissing) {
    throw new ForbiddenException('Merchant not found or invalid access');
  }
  return id;
}
