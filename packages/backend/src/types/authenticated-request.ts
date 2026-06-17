import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    name: string;
    role: string;
    shopId?: string | null;
    merchantId?: string;
    accountStatus?: string;
    /** Present when role === EMPLOYEE — socket notification audience */
    notifyRole?: string;
  };
}
