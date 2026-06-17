import type { AxiosInstance } from 'axios';

export type OrderGuardConfig =
  | { requireLocation: false }
  | {
      requireLocation: true;
      centerLat: number | null;
      centerLng: number | null;
      radiusM: number;
    };

export async function fetchOrderGuard(api: AxiosInstance, merchantId: string): Promise<OrderGuardConfig> {
  try {
    const { data } = await api.get<OrderGuardConfig>(`merchants/${merchantId}/order-guard`);
    return data;
  } catch {
    return { requireLocation: false };
  }
}

export async function getCustomerGeoPayload(): Promise<{
  customerLat: number;
  customerLng: number;
  locationAccuracyM?: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          customerLat: pos.coords.latitude,
          customerLng: pos.coords.longitude,
          locationAccuracyM:
            pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : undefined,
        });
      },
      () => {
        reject(new Error('Vui lòng cho phép truy cập vị trí để quán xác nhận bạn đang tại cửa hàng.'));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export async function withOrderGeo<T extends Record<string, unknown>>(
  guard: OrderGuardConfig,
  body: T,
): Promise<T & { customerLat?: number; customerLng?: number; locationAccuracyM?: number }> {
  if (!guard.requireLocation) return body;
  const geo = await getCustomerGeoPayload();
  return { ...body, ...geo };
}
