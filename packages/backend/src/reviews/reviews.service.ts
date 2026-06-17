import { Injectable } from '@nestjs/common';
import { sql } from '../db/index';

export interface ReviewRow {
  id: number;
  merchant_id: string;
  table_number: string | null;
  rating: number;
  comment: string | null;
  created_at: Date;
}

@Injectable()
export class ReviewsService {
  async getMerchantReviews(merchantId: string): Promise<ReviewRow[]> {
    return (await sql`
      SELECT * FROM reviews
      WHERE merchant_id = ${merchantId}
      ORDER BY created_at DESC
    `) as unknown as ReviewRow[];
  }

  async createReview(data: {
    merchantId: string;
    tableNumber?: string;
    rating: number;
    comment?: string;
  }): Promise<ReviewRow> {
    const [row] = (await sql`
      INSERT INTO reviews (merchant_id, table_number, rating, comment)
      VALUES (${data.merchantId}, ${data.tableNumber ?? null}, ${data.rating}, ${data.comment ?? null})
      RETURNING id, merchant_id, table_number, rating, comment, created_at
    `) as unknown as ReviewRow[];
    return row;
  }
}
