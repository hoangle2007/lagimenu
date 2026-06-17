import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** GET /api/reviews/merchant/:merchantId */
  @Get('merchant/:merchantId')
  async getMerchantReviews(@Param('merchantId') merchantId: string) {
    return this.reviewsService.getMerchantReviews(merchantId);
  }

  /** POST /api/reviews — authenticated user submits a review */
  @Post()
  async createReview(
    @Body()
    body: {
      merchantId: string;
      tableNumber?: string;
      rating: number;
      comment?: string;
    },
  ) {
    return this.reviewsService.createReview(body);
  }
}
