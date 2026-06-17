import { Injectable } from '@nestjs/common';
import { sql } from '../db/index';

@Injectable()
export class UsersService {
  async updateFcmToken(userId: string, fcmToken: string) {
    await sql`UPDATE merchants SET fcm_token = ${fcmToken} WHERE id = ${userId}`;
    await sql`UPDATE "User" SET fcm_token = ${fcmToken} WHERE id = ${userId}`;
  }

  async clearFcmToken(userId: string) {
    await sql`UPDATE merchants SET fcm_token = NULL WHERE id = ${userId}`;
    await sql`UPDATE "User" SET fcm_token = NULL WHERE id = ${userId}`;
  }
}
