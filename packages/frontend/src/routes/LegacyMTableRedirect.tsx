import { Navigate, useParams } from 'react-router-dom';

/** Redirect old /m/:merchantId/t/:tableId URLs to canonical /order/... */
export function LegacyMTableRedirect({ menu }: { menu?: boolean }) {
  const { merchantId, tableId } = useParams<{ merchantId: string; tableId: string }>();
  if (!merchantId || !tableId) {
    return <Navigate to="/" replace />;
  }
  const path = menu ? `/order/${merchantId}/${tableId}/menu` : `/order/${merchantId}/${tableId}`;
  return <Navigate to={path} replace />;
}
