import { randomUUID } from 'crypto';
import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { sql } from '../db/index';
import { MerchantsService } from '../merchants/merchants.service';

interface SessionRow {
  id: number;
  merchant_id: string;
  table_number: string;
  status: string;
  created_at: Date;
  completed_at: Date | null;
}

function padTableId(id: string): string {
  if (!id || isNaN(Number(id))) return id;
  return id.padStart(2, '0');
}

/** Human label e.g. "Bàn 1" / "Bàn 05" for padded table codes. */
function tableDisplayLabel(padded: string): string {
  const n = parseInt(padded, 10);
  const displayNum = Number.isNaN(n) ? padded : String(n);
  return `Bàn ${displayNum}`;
}

@Controller('public')
export class PublicSessionController {
  constructor(private readonly merchantsService: MerchantsService) {}

  /** GET /api/public/table/:merchantId/:tableNumber — label for customer UI (no DB table row). */
  @Get('table/:merchantId/:tableNumber')
  async getTableInfo(
    @Param('merchantId') incomingId: string,
    @Param('tableNumber') tableNumber: string,
  ) {
    const merchant = await this.merchantsService.getMerchant(incomingId);
    const merchantId = merchant.id;
    const tn = padTableId(tableNumber);
    const n = parseInt(tn, 10);
    const max = merchant.table_count ?? 99;
    if (!Number.isNaN(n) && max && n > max) {
      throw new BadRequestException(`Bàn không hợp lệ (tối đa ${max} bàn).`);
    }
    const baseDisplayName = tableDisplayLabel(tn);

    const [mergeRow] = (await sql`
      SELECT parent_table_number
      FROM table_sessions
      WHERE merchant_id = ${merchantId}
        AND table_number = ${tn}
        AND status = 'active'
        AND parent_table_number IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `) as unknown as { parent_table_number: string | null }[];

    const parentRaw = mergeRow?.parent_table_number?.trim();
    if (parentRaw) {
      const masterPadded = padTableId(parentRaw);
      const masterLabel = tableDisplayLabel(masterPadded);
      const slaveLabel = baseDisplayName;
      return {
        tableNumber: tn,
        displayName: `${masterLabel} (ghép ${slaveLabel})`,
        shopName: merchant.name,
        isMerged: true as const,
        parentTableNumber: masterPadded,
        scannedTableNumber: tn,
      };
    }

    return {
      tableNumber: tn,
      displayName: baseDisplayName,
      shopName: merchant.name,
      isMerged: false as const,
      parentTableNumber: null,
      scannedTableNumber: tn,
    };
  }

  /** GET /api/public/session/:merchantId/:tableId */
  @Get('session/:merchantId/:tableId')
  async getSession(
    @Param('merchantId') incomingId: string,
    @Param('tableId') incomingTableId: string,
    @Query('sessionId') existingSessionId?: string,
    @Query('token') providedToken?: string,
  ) {
    const merchant = await this.merchantsService.getMerchant(incomingId);
    const merchantId = merchant.id;
    // Use merchant's qr_secret if set; otherwise fall back to incomingId so token
    // validation still works (frontend generates token using incomingId as secret).
    const qrSecret = merchant.qr_secret || incomingId;
    const tableId = padTableId(incomingTableId);

    // 1. If an existing sessionId is provided, check its specific status
    if (
      existingSessionId &&
      existingSessionId !== 'null' &&
      existingSessionId !== 'undefined'
    ) {
      const [existingSession] = (await sql`
        SELECT * FROM table_sessions WHERE id = ${existingSessionId}
      `) as unknown as SessionRow[];

      if (existingSession) {
        if (existingSession.status === 'active') {
          return {
            ...existingSession,
            canOrder: true,
          };
        } else if (
          existingSession.status === 'completed' ||
          existingSession.status === 'paid'
        ) {
          // If the guest is refreshing a PAID session, they should NOT get a new one automatically
          // unless they re-scan (providedToken logic below)
          if (!providedToken) {
            return {
              canOrder: false,
              message:
                'Phiên đặt món này đã kết thúc. Vui lòng quét lại mã QR tại bàn để bắt đầu lượt mới.',
            };
          }
        }
      }
    }

    // 2. Check for an active session at the table (join existing group)
    const [latestSession] = (await sql`
      SELECT * FROM table_sessions
      WHERE merchant_id = ${merchantId}
        AND table_number = ${tableId}
      ORDER BY created_at DESC
      LIMIT 1
    `) as unknown as SessionRow[];

    if (latestSession && latestSession.status === 'active') {
      return {
        ...latestSession,
        canOrder: true,
      };
    }

    // 3. No active session — start a new one.
    // Table QR from merchant uses /order/:shopId/:table without ?token=; guests must still be able to order.
    // If ?token= is present it must match (legacy / signed links); wrong token → do not open a session.
    if (providedToken) {
      const { createHash } = await import('crypto');
      const hash = createHash('sha256')
        .update(`${qrSecret}:${tableId}`)
        .digest('hex');
      const expectedToken = hash.substring(0, 10);

      if (providedToken !== expectedToken) {
        return {
          canOrder: false,
          message: 'Liên kết không hợp lệ. Vui lòng quét mã QR tại bàn.',
        };
      }
    }

    const [newSession] = (await sql`
      INSERT INTO table_sessions (id, merchant_id, table_number, status)
      VALUES (${randomUUID()}, ${merchantId}, ${tableId}, 'active')
      RETURNING *
    `) as unknown as SessionRow[];

    return {
      ...newSession,
      canOrder: true,
      message: 'Chào mừng quý khách!',
    };
  }
}
