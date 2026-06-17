import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { sql } from '../db/index';
import { getCanonicalMerchantId } from '../lib/shop-utils';

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private initialized = false;
  private readonly logger = new Logger(PushNotificationService.name);

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    if (this.initialized) return;

    const hasCredentials =
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY;

    if (!hasCredentials) {
      this.logger.warn(
        'Firebase credentials not found. Push notifications disabled.',
      );
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized.');
    } catch (error) {
      this.logger.error('Firebase init failed:', (error as Error).message);
    }
  }

  async notifyShop(
    incomingMerchantId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
      type:
        | 'new_order'
        | 'call_staff'
        | 'call_payment'
        | 'loyalty_pay'
        | 'loyalty_redeem'
        | 'order_ready';
    },
  ): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized. Skipping notification.');
      return;
    }

    try {
      const merchantId = await getCanonicalMerchantId(incomingMerchantId);

      // Get FCM tokens from merchants table (owners) and User table (staff) using Employee join
      // We use the merchantId (Owner ID) directly as it matches the primary identifiers
      const tokenRows = (await sql`
        SELECT m.fcm_token 
        FROM merchants m 
        WHERE m.id::text = ${merchantId}::text AND m.fcm_token IS NOT NULL AND m.fcm_token != ''
        UNION
        SELECT u.fcm_token 
        FROM "User" u 
        JOIN "Employee" e ON u.id = e."userId" 
        WHERE e."shopId"::text = ${merchantId}::text AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
      `) as unknown as { fcm_token: string }[];

      const tokens = Array.from(
        new Set(tokenRows.map((r) => r.fcm_token).filter(Boolean)),
      );

      if (!tokens.length) {
        this.logger.log(`No FCM tokens for merchant ${merchantId}.`);
        return;
      }

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: { type: payload.type, merchantId, ...payload.data },
        android: {
          priority: 'high',
          notification: {
            channelId: 'orders',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title: payload.title, body: payload.body },
              sound: 'default',
              badge: 1,
              'content-available': 1,
            },
          },
        },
        webpush: {
          fcmOptions: {
            link: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/admin`,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Sent ${response.successCount}/${tokens.length} to merchant ${merchantId}. Failed: ${response.failureCount}`,
      );

      if (response.failureCount > 0) {
        for (let i = 0; i < response.responses.length; i++) {
          const resp = response.responses[i];
          if (!resp.success) {
            const errCode = resp.error?.code;
            const errMsg = resp.error?.message;
            this.logger.warn(`Token[${i}] failed: ${errCode} - ${errMsg}`);

            if (
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-argument'
            ) {
              const failedToken = tokens[i];
              if (failedToken) {
                this.logger.log(
                  `Removing invalid token from DB: ${failedToken.slice(0, 15)}...`,
                );
                await sql`UPDATE merchants SET fcm_token = NULL WHERE fcm_token = ${failedToken}`;
                await sql`UPDATE "User" SET fcm_token = NULL WHERE fcm_token = ${failedToken}`;
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error:', (error as Error).message);
    }
  }

  async notifyUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
      type: string;
    },
  ): Promise<void> {
    if (!this.initialized) return;

    const [row] = (await sql`
      SELECT fcm_token FROM merchants WHERE id = ${userId}
    `) as unknown as { fcm_token: string | null }[];

    if (!row?.fcm_token) return;

    try {
      await admin.messaging().send({
        token: row.fcm_token,
        notification: { title: payload.title, body: payload.body },
        data: { type: payload.type, ...payload.data },
        android: {
          priority: 'high',
          notification: {
            channelId: 'orders',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title: payload.title, body: payload.body },
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error notifying user ${userId}:`,
        (error as Error).message,
      );
    }
  }
}
