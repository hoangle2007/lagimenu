import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { Clock, LogOut } from 'lucide-react';

function statusMessage(status: string | undefined) {
  switch (status) {
    case 'pending':
      return {
        title: 'Tài khoản đang chờ duyệt',
        body: 'Đăng ký của bạn đã được ghi nhận. Admin sẽ duyệt trong thời gian sớm nhất. Bạn có thể đăng nhập lại để kiểm tra trạng thái.',
      };
    case 'rejected':
      return {
        title: 'Tài khoản bị từ chối',
        body: 'Vui lòng liên hệ hỗ trợ nếu bạn cần thêm thông tin.',
      };
    case 'suspended':
      return {
        title: 'Tài khoản tạm ngưng',
        body: 'Vui lòng liên hệ hỗ trợ để được mở lại.',
      };
    default:
      return {
        title: 'Không thể truy cập dashboard',
        body: 'Trạng thái tài khoản không cho phép vào khu vực merchant.',
      };
  }
}

/** Shown when merchant JWT exists but account is not approved, or after email/password register (no session). */
export const MerchantPendingPage: React.FC<{
  variant?: 'post_register';
  emailHint?: string;
}> = ({ variant, emailHint }) => {
  const { user, logout } = useAuth();
  const status = (user as { accountStatus?: string } | null)?.accountStatus ?? 'pending';
  const { title, body } =
    variant === 'post_register'
      ? {
          title: 'Đăng ký thành công',
          body:
            'Tài khoản đang chờ admin duyệt. Khi được duyệt, bạn có thể đăng nhập và vào dashboard merchant.' +
            (emailHint ? ` Email: ${emailHint}` : ''),
        }
      : statusMessage(status);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full rounded-2xl bg-surface p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="text-amber-700" size={28} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
        <div className="flex flex-col gap-2 pt-4">
          {user ? (
            <Button variant="secondary" className="w-full gap-2" onClick={() => void logout()}>
              <LogOut size={18} />
              Đăng xuất
            </Button>
          ) : (
            <Button className="w-full" onClick={() => (window.location.href = '/login')}>
              Đến trang đăng nhập
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
