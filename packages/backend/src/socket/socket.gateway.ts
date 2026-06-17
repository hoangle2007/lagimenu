import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import {
  normalizeStaffNotifyRole,
  staffRoomSuffixesForSocketEvent,
} from './shop-notification.constants';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/',
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SocketGateway.name);
  private merchantRooms = new Map<string, Set<string>>();

  constructor(private jwtService: JwtService) {}

  /** Approximate count of connected Socket.IO clients (all namespaces on this server). */
  getApproxConnectedClients(): number {
    try {
      return (this.server as any)?.engine?.clientsCount ?? 0;
    } catch {
      return 0;
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (token) {
        try {
          const payload = this.jwtService.verify(token);
          client.data.user = payload;

          const shopId = payload.shopId as string | undefined;
          if (!shopId) {
            this.logger.log(
              `Authorized client ${client.id} has no shopId, skipping room join`,
            );
          } else if (payload.role === 'EMPLOYEE') {
            const nr = normalizeStaffNotifyRole(payload.notifyRole);
            const staffRoom = `merchant:${shopId}:staff:${nr}`;
            client.join(staffRoom);
            if (!this.merchantRooms.has(shopId)) {
              this.merchantRooms.set(shopId, new Set());
            }
            this.merchantRooms.get(shopId)!.add(client.id);
            this.logger.log(
              `Authorized employee ${client.id} joined ${staffRoom}`,
            );
          } else {
            client.join(`merchant:${shopId}`);
            if (!this.merchantRooms.has(shopId)) {
              this.merchantRooms.set(shopId, new Set());
            }
            this.merchantRooms.get(shopId)!.add(client.id);
            this.logger.log(
              `Authorized client ${client.id} joined shop room: merchant:${shopId}`,
            );
          }
        } catch {
          this.logger.warn(
            `Invalid token from client ${client.id}, treating as guest`,
          );
        }
      } else {
        this.logger.log(`Guest client connected: ${client.id}`);
      }

      client.emit('connected', { status: 'ok', socketId: client.id });
    } catch (e: any) {
      this.logger.error(
        `Connection error for client ${client.id}: ${e?.message ?? e}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const u = client.data.user as
      | {
          role?: string;
          shopId?: string;
          merchantId?: string;
          sub?: string;
          name?: string;
        }
      | undefined;
    const shopId = u?.shopId || u?.merchantId;
    if (u?.role === 'EMPLOYEE' && shopId && u.sub) {
      this.server.to(`merchant:${shopId}`).emit('staffPresenceUpdate', {
        employeeId: String(u.sub),
        name: String(u.name ?? ''),
        presence: 'offline',
        at: new Date().toISOString(),
      });
    }
    const merchantId = shopId || u?.sub;
    const reason =
      (client as any)?.conn?.readyState === 'closed'
        ? 'transport_closed'
        : 'client_disconnected';
    if (merchantId) {
      this.merchantRooms.get(merchantId)?.delete(client.id);
      this.logger.log(
        `Client ${client.id} left merchant:${merchantId} (reason=${reason})`,
      );
    }
  }

  @SubscribeMessage('staffPresenceUpdate')
  handleStaffPresenceUpdate(
    @MessageBody() body: { merchantId: string; presence: string },
    @ConnectedSocket() client: Socket,
  ) {
    const u = client.data.user as
      | {
          role?: string;
          shopId?: string;
          merchantId?: string;
          sub?: string;
          name?: string;
        }
      | undefined;
    if (!u || u.role !== 'EMPLOYEE') {
      return { ok: false };
    }
    const shopId = u.shopId || u.merchantId;
    if (!shopId || body?.merchantId !== shopId) {
      return { ok: false };
    }
    const allowed = ['online', 'away', 'offline'] as const;
    const presence = body?.presence as (typeof allowed)[number];
    if (!allowed.includes(presence)) {
      return { ok: false };
    }
    this.server.to(`merchant:${shopId}`).emit('staffPresenceUpdate', {
      employeeId: String(u.sub),
      name: String(u.name ?? ''),
      presence,
      at: new Date().toISOString(),
    });
    return { ok: true };
  }

  @SubscribeMessage('joinMerchant')
  handleJoinMerchant(
    @MessageBody() data: { merchantId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.merchantId) {
      return { event: 'joined', data: { merchantId: '' } };
    }
    const role = client.data.user?.role as string | undefined;
    if (role === 'EMPLOYEE') {
      client.emit('joined', { merchantId: data.merchantId });
      return { event: 'joined', data: { merchantId: data.merchantId } };
    }
    client.join(`merchant:${data.merchantId}`);
    client.emit('joined', { merchantId: data.merchantId });
    return { event: 'joined', data: { merchantId: data.merchantId } };
  }

  @SubscribeMessage('paymentPendingVerification')
  handlePaymentPending(
    @MessageBody()
    data: {
      merchantId: string;
      orderId: number;
      tableNumber: string;
      amount: number;
    },
  ) {
    if (!data?.merchantId) return { ok: false };
    this.emitShopNotification(
      data.merchantId,
      'paymentPendingVerification',
      data,
    );
    return { ok: true };
  }

  /**
   * Owners: room merchant:{id}. Staff: merchant:{id}:staff:{notifyRole}.
   * Always targets staff:all plus role-specific rooms from the event matrix.
   */
  emitShopNotification(merchantId: string, event: string, data: unknown) {
    this.server.to(`merchant:${merchantId}`).emit(event, data);
    this.server.to(`merchant:${merchantId}:staff:all`).emit(event, data);
    for (const suffix of staffRoomSuffixesForSocketEvent(event)) {
      this.server
        .to(`merchant:${merchantId}:staff:${suffix}`)
        .emit(event, data);
    }
  }

  /** @deprecated Prefer emitShopNotification — kept for call sites */
  broadcastToMerchant(merchantId: string, event: string, data: unknown) {
    this.emitShopNotification(merchantId, event, data);
  }
}
