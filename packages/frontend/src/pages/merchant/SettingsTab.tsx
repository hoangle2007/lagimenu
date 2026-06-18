import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { MerchantGeoMapPicker } from '../../components/merchant/MerchantGeoMapPicker';
import { QrCode, Store, Copy, Check, Download, ExternalLink, Save, Pencil, Minus, Plus, CreditCard, BellRing, Image as ImageIcon, Loader2, Printer, User, Coffee, MapPin, Ban, Sparkles } from 'lucide-react';
import { QRPrintModal } from './QRPrintModal';
import { MenuTab } from './MenuTab';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input, Label, Separator
} from '../../components/ui';
import { cn } from '../../lib/utils';
import { employeesApi, type EmployeeWithUser, STAFF_NOTIFY_ROLE_LABELS } from '@/api/employees';
import EmployeeForm from '../../components/employee/EmployeeForm';
import Modal from '../../components/ui/Modal';
import { Badge } from '../../components/ui';

const QR_API = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&margin=10&color=006d37`;

// ── InfoRow Component (Defined outside to prevent re-renders on every keystroke) ──
const InfoRow = ({ 
  label, 
  value, 
  fieldKey, 
  type = 'text', 
  editMode, 
  onChange 
}: { 
  label: string; 
  value: string; 
  fieldKey: string; 
  type?: string; 
  editMode: boolean; 
  onChange: (key: string, val: any) => void 
}) => (
  <div className="space-y-1.5">
    <Label className="font-bold text-xs uppercase opacity-40">{label}</Label>
    {editMode ? (
      <Input
        type={type}
        value={value}
        onChange={e => onChange(fieldKey, e.target.value)}
        className="h-10 bg-surface border-primary/20 focus:border-primary shadow-sm"
        placeholder={`Nhập ${label.toLowerCase()}...`}
      />
    ) : (
      <p className="text-sm font-medium text-on-surface py-2.5 px-3 bg-surface-container-low rounded-xl border border-outline-variant/10 min-h-[42px] flex items-center">
        {value || <span className="opacity-30 italic font-normal">Chưa thiết lập</span>}
      </p>
    )}
  </div>
);

// ─── Employees Tab Section ──────────────────────────────────────────────────
const EmployeesTab: React.FC<{ merchantId: string; slug: string }> = ({ merchantId, slug }) => {
  const [employees, setEmployees] = useState<EmployeeWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithUser | null>(null);
  const [invites, setInvites] = useState<{ id: number; email: string; role: string; token: string; expires_at: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'cashier' | 'waiter' | 'kitchen'>('waiter');
  const [inviteBusy, setInviteBusy] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await employeesApi.list();
      setEmployees(data.employees);
    } catch {
      setError('Không thể tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const fetchInvites = useCallback(async () => {
    try {
      const { data } = await api.get(`/merchants/${merchantId}/staff-invites`);
      setInvites(data.invites ?? []);
    } catch {
      setInvites([]);
    }
  }, [merchantId]);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    try {
      await api.post(`/merchants/${merchantId}/staff-invites`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      await fetchInvites();
    } catch {
      alert('Không tạo được lời mời (kiểm tra email / đăng nhập merchant).');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreated = (newEmp: EmployeeWithUser) => {
    setEmployees(prev => [newEmp, ...prev]);
    setFormOpen(false);
  };

  const handleUpdated = (updated: EmployeeWithUser) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    setEditingEmployee(null);
    setFormOpen(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Bạn có chắc muốn vô hiệu hóa nhân viên này?')) return;
    try {
      await employeesApi.delete(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch {
      alert('Không thể thực hiện thao tác.');
    }
  };

  if (loading && employees.length === 0) return (
    <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800">Danh sách nhân viên</h2>
          <p className="text-sm font-medium text-slate-500">Vận hành cửa hàng {merchantId}</p>
        </div>
        <Button onClick={() => { setEditingEmployee(null); setFormOpen(true); }} className="rounded-xl font-black uppercase tracking-widest text-[10px] lg:text-xs h-10 px-4 lg:px-6">
          + Thêm nhân viên
        </Button>
      </div>

      {/* Employee Login Link - Moved here for visibility */}
      <Card className="border-none shadow-premium rounded-[1.5rem] overflow-hidden bg-slate-900 text-white">
        <div className="px-6 py-4 flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-primary shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white leading-none">Link đăng nhập nhân viên</p>
              <p className="text-[10px] font-bold uppercase tracking-tight text-white/40 mt-1">Dành riêng cho nhân viên cửa hàng</p>
            </div>
          </div>
          
          <div className="flex-1 max-w-md w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center justify-between group overflow-hidden">
            <code className="text-xs font-mono text-white/60 truncate mr-4">
              {slug ? `${window.location.origin}/shop/${slug}/login` : 'Chưa có mã quán (Thiết lập ở tab Cửa hàng)'}
            </code>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={async () => {
                if (!slug) {
                  alert('Vui lòng thiết lập Mã định danh (slug) ở tab Cửa hàng trước!');
                  return;
                }
                const link = `${window.location.origin}/shop/${slug}/login`;
                await navigator.clipboard.writeText(link);
                toast.success('Đã sao chép link đăng nhập nhân viên (nhận lời mời từ chủ quán).');
              }}
              disabled={!slug}
              className="rounded-lg h-8 px-3 bg-white/10 hover:bg-white text-white hover:text-slate-900 font-black text-[9px] uppercase tracking-widest transition-all shrink-0"
            >
              Sao chép
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-none shadow-premium rounded-[1.5rem] overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lời mời nhân viên (token)</CardTitle>
          <CardDescription className="text-xs">
            Gửi link có token cho nhân viên mới (lưu token an toàn). Token hết hạn sau 7 ngày.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="email@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="waiter">Phục vụ</option>
              <option value="kitchen">Bếp</option>
              <option value="cashier">Thu ngân</option>
            </select>
            <Button type="button" onClick={() => void sendInvite()} disabled={inviteBusy}>
              Tạo mời
            </Button>
          </div>
          <ul className="text-xs space-y-2 max-h-40 overflow-y-auto">
            {invites.map((inv) => (
              <li key={inv.id} className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="font-medium">{inv.email}</span>
                <span className="text-slate-500 truncate font-mono" title={inv.token}>
                  {inv.role} · {inv.expires_at?.slice(0, 10)}
                </span>
              </li>
            ))}
            {invites.length === 0 && <li className="text-slate-400">Chưa có lời mời.</li>}
          </ul>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchEmployees} className="text-red-600 hover:bg-red-100">Thử lại</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-surface/40 rounded-3xl border border-dashed border-outline-variant/30">
            <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Chưa có nhân viên nào</p>
          </div>
        ) : (
          employees.map(emp => (
            <Card key={emp.id} className="border-none shadow-premium hover:shadow-xl transition-all duration-300 rounded-[32px] overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-inner", emp.isActive ? "bg-slate-900" : "bg-slate-300")}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 tracking-tight leading-none">{emp.name}</h3>
                      <p className="text-xs font-bold text-slate-400 mt-2">{emp.email}</p>
                      <p className="text-[10px] font-bold text-indigo-600/80 mt-1">
                        TB: {STAFF_NOTIFY_ROLE_LABELS[emp.notifyRole] ?? emp.notifyRole}
                      </p>
                      {emp.phone && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{emp.phone}</p>}
                    </div>
                  </div>
                  <Badge variant={emp.isActive ? 'success' : 'outline'}>{emp.isActive ? 'Hoạt động' : 'Đã nghỉ'}</Badge>
                </div>
                
                <div className="flex items-center gap-2 mt-6">
                  <Button variant="outline" size="sm" onClick={() => { setEditingEmployee(emp); setFormOpen(true); }} className="flex-1 rounded-xl h-10 text-[10px] font-black uppercase tracking-widest">Sửa</Button>
                  {emp.isActive && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeactivate(emp.id)} className="flex-1 rounded-xl h-10 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 hover:text-red-600">Vô hiệu hóa</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingEmployee(null); }}
        title={editingEmployee ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}
      >
        <EmployeeForm
          employee={editingEmployee}
          onSuccess={editingEmployee ? handleUpdated : handleCreated}
          onCancel={() => { setFormOpen(false); setEditingEmployee(null); }}
        />
      </Modal>
    </div>
  );
};

type BlockedIpRow = { id: string; ip: string; note: string | null; created_at: string };

const BlockedIpsCard: React.FC<{ merchantId: string }> = ({ merchantId }) => {
  const [rows, setRows] = useState<BlockedIpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ip, setIp] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ blockedIps: BlockedIpRow[] }>(`/merchants/${merchantId}/blocked-ips`);
      setRows(data.blockedIps ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addIp = async () => {
    if (!ip.trim()) return;
    setBusy(true);
    try {
      await api.post(`/merchants/${merchantId}/blocked-ips`, { ip: ip.trim(), note: note.trim() || undefined });
      setIp('');
      setNote('');
      await load();
      toast.success('Đã chặn IP');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(typeof msg === 'string' ? msg : 'Không thể thêm IP');
    } finally {
      setBusy(false);
    }
  };

  const removeIp = async (id: string) => {
    setBusy(true);
    try {
      await api.delete(`/merchants/${merchantId}/blocked-ips/${id}`);
      await load();
      toast.success('Đã bỏ chặn IP');
    } catch {
      toast.error('Không thể bỏ chặn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-none shadow-premium rounded-3xl overflow-hidden bg-slate-900 text-white">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
            <Ban size={16} />
          </div>
          <div>
            <CardTitle className="text-base text-white">Chặn IP đặt món</CardTitle>
            <CardDescription className="text-[10px] font-bold text-white/50 uppercase">
              Khách từ IP này không thể tạo đơn công khai
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-white/60" size={22} /></div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="VD: 203.113.12.5"
                className="h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                disabled={busy}
              />
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                className="h-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 sm:flex-1"
                disabled={busy}
              />
              <Button type="button" onClick={() => void addIp()} disabled={busy || !ip.trim()} className="h-10 font-black uppercase text-[10px]">
                Chặn
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-xl border border-white/10 bg-white/5 p-2">
              {rows.length === 0 ? (
                <p className="text-xs text-white/50 text-center py-4">Chưa có IP bị chặn</p>
              ) : (
                rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <code className="text-xs font-mono text-emerald-300">{r.ip}</code>
                      {r.note && <p className="text-[10px] text-white/50 truncate">{r.note}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="shrink-0 text-rose-300 hover:text-rose-100 h-8" disabled={busy} onClick={() => void removeIp(r.id)}>
                      Bỏ chặn
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const SettingsTab: React.FC<{ merchantId: string; onUpdate?: () => void }> = ({ merchantId, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSettingTab, setActiveSettingTab] = useState<'info' | 'menu' | 'employees'>(
    (searchParams.get('section') as any) || 'info'
  );

  // Sync tab with URL parameter
  useEffect(() => {
    const section = searchParams.get('section');
    if (section && (section === 'info' || section === 'menu' || section === 'employees')) {
      setActiveSettingTab(section as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'info' | 'menu' | 'employees') => {
    setActiveSettingTab(tab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('section', tab);
    setSearchParams(newParams);
  };
  const [storeInfo, setStoreInfo] = useState({
    name: '',
    slogan: '',
    address: '',
    phone: '',
    openTime: '',
    closeTime: '',
    tableCount: 10,
    logoUrl: '',
    bannerUrl: '',
    bankName: '',
    bankAccount: '',
    bankOwner: '',
    autoAccept: true,
    notifySound: true,
    qrSecret: 'gukivo_secret',
    slug: '',
    wifiSsid: '',
    wifiPassword: '',
    timezone: 'Asia/Ho_Chi_Minh',
    openingHoursJson: '',
    featureFlagsJson: '',
    latitude: '',
    longitude: '',
    geoFenceRadiusM: '150',
    requireCustomerLocation: false,
  });
  const [mapsSyncUrl, setMapsSyncUrl] = useState('');

  const handleSyncFromMaps = () => {
    if (!mapsSyncUrl.trim()) return;
    const url = mapsSyncUrl.trim();
    let lat = '';
    let lng = '';
    let parsedAddress = '';

    try {
      const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        lat = coordMatch[1];
        lng = coordMatch[2];
      } else {
        const qMatch = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (qMatch) {
          lat = qMatch[1];
          lng = qMatch[2];
        }
      }

      const placeMatch = url.match(/\/place\/([^/]+)/);
      if (placeMatch && placeMatch[1]) {
        parsedAddress = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).split('/')[0] || '';
      }

      if (lat && lng) {
        handleInputChange('latitude', lat);
        handleInputChange('longitude', lng);
        if (parsedAddress && !storeInfo.address) {
          handleInputChange('address', parsedAddress);
        }
        toast.success(`Đã trích xuất vĩ độ ${lat} & kinh độ ${lng}! Hãy bấm Hoàn tất bên trên để lưu.`);
        setMapsSyncUrl('');
      } else {
        toast.error('Không tìm thấy tọa độ trong link này. Hãy chọn link Google Maps có chứa tọa độ @lat,lng');
      }
    } catch {
      toast.error('Lỗi phân tích URL Google Maps.');
    }
  };

  useEffect(() => {
    const lat = sessionStorage.getItem('prefilled_lat');
    const lng = sessionStorage.getItem('prefilled_lng');
    const addr = sessionStorage.getItem('prefilled_address');
    
    if (lat && lng && !storeInfo.latitude && !storeInfo.longitude) {
      handleInputChange('latitude', lat);
      handleInputChange('longitude', lng);
      if (addr && !storeInfo.address) {
        handleInputChange('address', addr);
      }
      toast.success('Đã áp dụng tọa độ & địa chỉ quét từ Google Maps khi đăng ký! Hãy bấm Chỉnh sửa và Hoàn tất để lưu.');
      
      sessionStorage.removeItem('prefilled_lat');
      sessionStorage.removeItem('prefilled_lng');
      sessionStorage.removeItem('prefilled_address');
    }
  }, [storeInfo.latitude, storeInfo.longitude]);

  const [tableTokens, setTableTokens] = useState<Record<string, string>>({});
  const [selectedTable, setSelectedTable] = useState(1);
  const [copiedTable, setCopiedTable] = useState<number | null>(null);
  const [isQRModalOpen, setQRModalOpen] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const SETTING_TABS: { id: 'info' | 'menu' | 'employees'; label: string; icon: any }[] = [
    { id: 'info', label: 'Cửa hàng', icon: Store },
    { id: 'menu', label: 'Thực đơn', icon: Coffee },
    { id: 'employees', label: 'Nhân viên', icon: User },
  ];

  const generateTokens = useCallback(async (secret: string, count: number) => {
    const tokens: Record<string, string> = {};
    for (let i = 1; i <= count; i++) {
      const tableNum = String(i).padStart(2, '0');
      try {
        const msgUint8 = new TextEncoder().encode(`${secret}:${tableNum}`);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        tokens[tableNum] = hashHex.substring(0, 10);
      } catch (e) {
        console.error('Token generation failed', e);
      }
    }
    setTableTokens(tokens);
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/merchants/${merchantId}`);
      const d = res.data;
      const info = {
        name: d.name || '',
        slogan: d.slogan || '',
        address: d.address || '',
        phone: d.phone || '',
        openTime: d.open_time || '07:00',
        closeTime: d.close_time || '22:00',
        tableCount: d.table_count || 10,
        logoUrl: d.logo_url || '',
        bannerUrl: d.banner_url || '',
        bankName: d.bank_name || '',
        bankAccount: d.bank_account || '',
        bankOwner: d.bank_owner || '',
        autoAccept: d.auto_accept ?? true,
        notifySound: d.notify_sound ?? true,
        qrSecret: d.qr_secret || 'gukivo_secret',
        slug: d.slug || '',
        wifiSsid: d.wifi_ssid || d.wifiSsid || '',
        wifiPassword: d.wifi_password || d.wifiPassword || '',
        timezone: d.timezone || 'Asia/Ho_Chi_Minh',
        openingHoursJson: d.opening_hours_json || d.openingHoursJson || '',
        featureFlagsJson: d.feature_flags_json || d.featureFlagsJson || '',
        latitude: d.latitude != null && d.latitude !== '' ? String(d.latitude) : '',
        longitude: d.longitude != null && d.longitude !== '' ? String(d.longitude) : '',
        geoFenceRadiusM:
          d.geo_fence_radius_m != null && d.geo_fence_radius_m !== ''
            ? String(d.geo_fence_radius_m)
            : '150',
        requireCustomerLocation: !!(d.require_customer_location ?? d.requireCustomerLocation),
      };
      setStoreInfo(info);
      generateTokens(info.qrSecret, info.tableCount);
    } catch (err) {
      console.error('Failed to fetch merchant settings:', err);
    } finally {
      setLoading(false);
    }
  }, [merchantId, generateTokens]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const baseUrl = window.location.origin;
  const tableUrl = (t: number) => {
    const tableNum = String(t).padStart(2, '0');
    const token = tableTokens[tableNum];
    return `${baseUrl}/m/${merchantId}/t/${tableNum}${token ? `?token=${token}` : ''}`;
  };

  const handleInputChange = (key: string, val: any) => {
    setStoreInfo(prev => ({ ...prev, [key]: val }));
  };

  const uploadAndSet = async (file: File, field: 'logoUrl' | 'bannerUrl') => {
    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/image', formData);
      handleInputChange(field, res.data.url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingField(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent, field: 'logoUrl' | 'bannerUrl') => {
    if (!editMode) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                uploadAndSet(file, field);
            }
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl') => {
      const file = e.target.files?.[0];
      if (file) {
          uploadAndSet(file, field);
      }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Map frontend camelCase to backend snake_case
      const latN = storeInfo.latitude.trim() ? Number(storeInfo.latitude) : null;
      const lngN = storeInfo.longitude.trim() ? Number(storeInfo.longitude) : null;
      const radN = storeInfo.geoFenceRadiusM.trim() ? Number(storeInfo.geoFenceRadiusM) : null;
      const payload = {
        name: storeInfo.name,
        slogan: storeInfo.slogan,
        address: storeInfo.address,
        phone: storeInfo.phone,
        open_time: storeInfo.openTime,
        close_time: storeInfo.closeTime,
        table_count: storeInfo.tableCount,
        logo_url: storeInfo.logoUrl,
        banner_url: storeInfo.bannerUrl,
        bank_name: storeInfo.bankName,
        bank_account: storeInfo.bankAccount,
        bank_owner: storeInfo.bankOwner,
        auto_accept: storeInfo.autoAccept,
        notify_sound: storeInfo.notifySound,
        qr_secret: storeInfo.qrSecret,
        slug: storeInfo.slug,
        latitude: latN !== null && Number.isFinite(latN) ? latN : null,
        longitude: lngN !== null && Number.isFinite(lngN) ? lngN : null,
        geo_fence_radius_m: radN !== null && Number.isFinite(radN) && radN > 0 ? radN : null,
        require_customer_location: storeInfo.requireCustomerLocation,
      };
      
      await api.patch(`/merchants/${merchantId}`, payload);
      await api.patch(`/merchants/${merchantId}/settings`, {
        wifi_ssid: storeInfo.wifiSsid || null,
        wifi_password: storeInfo.wifiPassword || null,
        timezone: storeInfo.timezone || 'Asia/Ho_Chi_Minh',
        opening_hours_json: storeInfo.openingHoursJson?.trim() || null,
        feature_flags_json: storeInfo.featureFlagsJson?.trim() || null,
      });
      setSaved(true);
      setEditMode(false);
      if (onUpdate) onUpdate();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to update settings:', err);
      toast.error('Không lưu được cài đặt.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (t: number) => {
    await navigator.clipboard.writeText(tableUrl(t));
    setCopiedTable(t);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  const copyEmployeeLink = async () => {
    if (!storeInfo.slug) return;
    const link = `${baseUrl}/shop/${storeInfo.slug}/login`;
    await navigator.clipboard.writeText(link);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const downloadQR = (t: number) => {
    const a = document.createElement('a');
    a.href = QR_API(tableUrl(t));
    a.download = `qr-ban-${t}.png`;
    a.click();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-primary" size={24} />
      <span className="ml-3 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Đang tải cài đặt...</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Settings Sub-Tabs ── */}
      <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-[1.5rem] w-fit border border-slate-100/50 shadow-inner">
        {SETTING_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2.5 px-6 py-2.5 rounded-[1.1rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300",
              activeSettingTab === tab.id
                ? "bg-surface text-slate-900 shadow-[0_8px_16px_rgba(0,0,0,0.06)] scale-100"
                : "text-slate-400 hover:text-slate-600 hover:bg-surface-container-low/50"
            )}
          >
            <tab.icon size={13} strokeWidth={2.5} className={activeSettingTab === tab.id ? "text-primary" : "opacity-40"} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSettingTab === 'info' && (
        <>
          {/* ── Brand Header (Banner + Logo) ── */}
          <Card className="overflow-hidden border-none shadow-premium rounded-3xl relative group">
            <div className="h-44 w-full bg-surface-container-low relative">
              {storeInfo.bannerUrl ? (
                <img src={storeInfo.bannerUrl} className="w-full h-full object-cover" alt="Banner" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center opacity-10 bg-slate-200">
                  <ImageIcon size={48} />
                </div>
              )}
              
              {editMode && (
                <div className="absolute top-4 right-4 z-30">
                  <Button
                    size="sm"
                    className="h-9 px-3 rounded-xl bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 font-black text-[10px] uppercase tracking-widest gap-2 shadow-xl"
                    onClick={() => document.getElementById('banner-upload')?.click()}
                    onPaste={(e) => handlePaste(e, 'bannerUrl')}
                  >
                    <ImageIcon size={14} />
                    Đổi ảnh bìa
                  </Button>
                  <input id="banner-upload" type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'bannerUrl')} />
                </div>
              )}

              {uploadingField === 'bannerUrl' && (
                <div className="absolute inset-0 bg-surface/40 flex items-center justify-center z-30">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              )}
            </div>
            
            {/* Logo Overlap */}
            <div className="absolute bottom-4 left-6 flex items-end gap-5 z-10 w-full">
              <div className="relative group/logo">
                <div 
                  className={cn(
                    "w-24 h-24 rounded-2xl bg-surface p-1 shadow-xl border-4 border-white overflow-hidden transition-transform",
                  )}
                >
                  {storeInfo.logoUrl ? (
                    <img src={storeInfo.logoUrl} className="w-full h-full object-cover rounded-xl" alt="Logo" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary rounded-xl">
                      <Store size={32} />
                    </div>
                  )}
                </div>

                {editMode && (
                  <button 
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center justify-center shadow-lg border-2 border-white z-20 transition-transform active:scale-90"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    <Pencil size={14} fill="white" />
                    <input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'logoUrl')} />
                  </button>
                )}

                {uploadingField === 'logoUrl' && (
                    <div className="absolute inset-0 bg-surface/60 flex items-center justify-center rounded-2xl z-10">
                        <Loader2 className="animate-spin text-primary" size={20} />
                    </div>
                )}
              </div>
              <div className="pb-2 flex-1 min-w-0 pr-10">
                <h2 className="text-2xl font-black text-white drop-shadow-lg leading-none truncate">{storeInfo.name || 'Tên cửa hàng'}</h2>
                <p className="text-white/80 text-xs font-bold mt-1.5 backdrop-blur-sm bg-black/10 px-2 py-0.5 rounded-md inline-block truncate max-w-full">
                  {storeInfo.slogan || 'Slogan của bạn'}
                </p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
            {/* ── Left Side: Store Info (3/5) ── */}
            <Card className="lg:col-span-3 border-none shadow-premium rounded-3xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <Store size={16} />
                  </div>
                  <CardTitle className="text-base">Thông tin chung</CardTitle>
                </div>
                <Button
                  variant={editMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => editMode ? handleSave() : setEditMode(true)}
                  disabled={saving}
                  className={cn("rounded-xl h-8 text-[11px] font-black uppercase tracking-widest transition-all", editMode && "shadow-lg shadow-primary/20")}
                >
                  {saving ? <Loader2 className="animate-spin mr-1.5" size={12} /> : editMode ? <Save className="mr-1.5" size={12} /> : <Pencil className="mr-1.5" size={12} />}
                  {saving ? 'Lưu...' : editMode ? 'Hoàn tất' : 'Chỉnh sửa'}
                </Button>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Tên cửa hàng" value={storeInfo.name} fieldKey="name" editMode={editMode} onChange={handleInputChange} />
                  <InfoRow label="Mã định danh (slug)" value={storeInfo.slug} fieldKey="slug" editMode={editMode} onChange={handleInputChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Số điện thoại" value={storeInfo.phone} fieldKey="phone" editMode={editMode} onChange={handleInputChange} />
                  <InfoRow label="Slogan / Lời chào" value={storeInfo.slogan} fieldKey="slogan" editMode={editMode} onChange={handleInputChange} />
                </div>
                <InfoRow label="Địa chỉ" value={storeInfo.address} fieldKey="address" editMode={editMode} onChange={handleInputChange} />
                <div className="grid grid-cols-3 gap-4">
                  <InfoRow label="Mở cửa" value={storeInfo.openTime} fieldKey="openTime" type="time" editMode={editMode} onChange={handleInputChange} />
                  <InfoRow label="Đóng cửa" value={storeInfo.closeTime} fieldKey="closeTime" type="time" editMode={editMode} onChange={handleInputChange} />
                  <div className="space-y-1.5">
                    <Label className="font-bold text-[10px] uppercase opacity-40">Số bàn</Label>
                    {editMode ? (
                      <div className="flex items-center gap-2 h-10 bg-surface-container-low px-1.5 rounded-xl border border-outline-variant/10">
                        <button onClick={() => handleInputChange('tableCount', Math.max(1, storeInfo.tableCount - 1))} className="w-7 h-7 rounded-lg bg-surface border border-outline-variant/20 flex items-center justify-center text-slate-500"><Minus size={12} /></button>
                        <span className="text-sm font-black text-primary flex-1 text-center">{storeInfo.tableCount}</span>
                        <button onClick={() => handleInputChange('tableCount', storeInfo.tableCount + 1)} className="w-7 h-7 rounded-lg bg-surface border border-primary/20 flex items-center justify-center text-primary"><Plus size={12} /></button>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-primary/70 py-2.5 px-3 bg-surface-container-low rounded-xl border border-outline-variant/10 h-[42px] flex items-center">{storeInfo.tableCount} Bàn</p>
                    )}
                  </div>
                </div>
                {saved && (
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1.5 animate-in slide-in-from-left-2 transition-all">
                    <Check size={12} className="stroke-[3]" /> Cập nhật thành công
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── Right Side: Operational + Payment (2/5) ── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Vận hành */}
              <Card className="border-none shadow-premium rounded-3xl bg-amber-50/20 overflow-hidden">
                 <CardHeader className="pb-3 border-b border-amber-500/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                        <BellRing size={16} />
                      </div>
                      <CardTitle className="text-base text-amber-900">Vận hành</CardTitle>
                    </div>
                 </CardHeader>
                 <CardContent className="pt-4 space-y-3">
                    {[
                      { key: 'autoAccept', label: 'Tự động nhận đơn', sub: 'Tiếp nhận đơn ngay', color: 'amber' },
                      { key: 'notifySound', label: 'Âm thanh thông báo', sub: 'Rung chuông khi có đơn', color: 'emerald' }
                    ].map((item: any) => (
                      <label key={item.key} className={cn(
                        "flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border",
                        storeInfo[item.key as keyof typeof storeInfo] ? `bg-${item.color}-500/10 border-${item.color}-500/10` : "bg-surface border-slate-50"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", storeInfo[item.key as keyof typeof storeInfo] ? `bg-${item.color}-500 animate-pulse shadow-[0_0_8px_rgba(var(--${item.color}),0.5)]` : "bg-slate-200")}></div>
                          <div>
                            <p className="text-xs font-black text-on-surface leading-none">{item.label}</p>
                            <p className="text-[9px] text-on-surface-variant/40 font-bold uppercase mt-1">{item.sub}</p>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={storeInfo[item.key as keyof typeof storeInfo] as boolean} 
                          disabled={!editMode}
                          onChange={() => handleInputChange(item.key, !storeInfo[item.key as keyof typeof storeInfo])}
                          className={cn("w-5 h-5 rounded-lg border-slate-200 focus:ring-opacity-50 cursor-pointer disabled:opacity-20", `text-${item.color}-600 focus:ring-${item.color}-500`)}
                        />
                      </label>
                    ))}
                 </CardContent>
              </Card>

              {/* Thanh toán */}
              <Card className="border-none shadow-premium rounded-3xl bg-indigo-50/30 overflow-hidden">
                 <CardHeader className="pb-3 border-b border-indigo-500/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600">
                        <CreditCard size={16} />
                      </div>
                      <CardTitle className="text-base text-indigo-900">Thanh toán (VietQR)</CardTitle>
                    </div>
                 </CardHeader>
                 <CardContent className="pt-4 space-y-4">
                    <div className="space-y-3">
                       <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase opacity-40 text-indigo-900/60">Ngân hàng</Label>
                          <Input value={storeInfo.bankName} onChange={e => handleInputChange('bankName', e.target.value)} placeholder="VD: MB Bank" disabled={!editMode} className="h-9 text-sm bg-surface" />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase opacity-40 text-indigo-900/60">Số tài khoản</Label>
                          <Input value={storeInfo.bankAccount} onChange={e => handleInputChange('bankAccount', e.target.value)} placeholder="0909123XXX" disabled={!editMode} className="h-9 text-sm bg-surface" />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase opacity-40 text-indigo-900/60">Tên thụ hưởng</Label>
                          <Input value={storeInfo.bankOwner} onChange={e => handleInputChange('bankOwner', e.target.value)} placeholder="VIET HOA KHONG DAU" disabled={!editMode} className="h-9 text-sm bg-surface font-black" />
                       </div>
                    </div>
                 </CardContent>
              </Card>

              <Card className="border-none shadow-premium rounded-3xl bg-emerald-50/30 overflow-hidden">
                <CardHeader className="pb-3 border-b border-emerald-500/5">
                  <CardTitle className="text-base text-emerald-900">WiFi cho khách</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase">
                    Hiển thị popup trên trang đặt món (mỗi phiên 1 lần)
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-40">Múi giờ báo cáo</Label>
                    <Input
                      value={storeInfo.timezone}
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                      disabled={!editMode}
                      className="h-9 text-sm bg-surface"
                      placeholder="Asia/Ho_Chi_Minh"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-40">Tên WiFi (SSID)</Label>
                    <Input
                      value={storeInfo.wifiSsid}
                      onChange={(e) => handleInputChange('wifiSsid', e.target.value)}
                      disabled={!editMode}
                      className="h-9 text-sm bg-surface"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-40">Mật khẩu WiFi</Label>
                    <Input
                      type="text"
                      value={storeInfo.wifiPassword}
                      onChange={(e) => handleInputChange('wifiPassword', e.target.value)}
                      disabled={!editMode}
                      className="h-9 text-sm bg-surface"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-40">Giờ mở cửa (JSON)</Label>
                    <textarea
                      value={storeInfo.openingHoursJson}
                      onChange={(e) => handleInputChange('openingHoursJson', e.target.value)}
                      disabled={!editMode}
                      rows={3}
                      className="w-full rounded-lg border border-emerald-200/80 bg-surface p-2 text-xs font-mono"
                      placeholder='{"mon":{"open":"07:00","close":"22:00"}}'
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-40">Feature flags (JSON)</Label>
                    <textarea
                      value={storeInfo.featureFlagsJson}
                      onChange={(e) => handleInputChange('featureFlagsJson', e.target.value)}
                      disabled={!editMode}
                      rows={2}
                      className="w-full rounded-lg border border-emerald-200/80 bg-surface p-2 text-xs font-mono"
                      placeholder='{"betaPos":false}'
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border-none shadow-premium rounded-3xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Vị trí quán &amp; đơn khách</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-tight">
                      Bắt buộc GPS khi đặt món (trong bán kính so với tọa độ quán)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-surface-container-low/50 cursor-pointer">
                  <div>
                    <p className="text-xs font-black text-slate-800">Bắt buộc vị trí khi đặt món</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Khách phải gửi GPS (trình duyệt)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={storeInfo.requireCustomerLocation}
                    disabled={!editMode}
                    onChange={() => handleInputChange('requireCustomerLocation', !storeInfo.requireCustomerLocation)}
                    className="w-5 h-5 rounded-lg border-slate-200 text-primary focus:ring-primary"
                  />
                </label>
                {/* Google Maps Sync input */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/60 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-primary animate-pulse" />
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Tự động đồng bộ từ Google Maps</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Dán link Google Maps..."
                      className="h-9 text-xs bg-white flex-1"
                      value={mapsSyncUrl}
                      onChange={(e) => setMapsSyncUrl(e.target.value)}
                      disabled={!editMode}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!editMode || !mapsSyncUrl.trim()}
                      onClick={handleSyncFromMaps}
                      className="h-9 px-4 text-[10px] font-black uppercase tracking-wider"
                    >
                      Đồng bộ
                    </Button>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold leading-normal">
                    Trích xuất trực tiếp Tọa độ (Vĩ độ, Kinh độ) từ link Google Maps để cập nhật nhanh vị trí của quán.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-40">Vĩ độ (lat)</Label>
                    <Input
                      value={storeInfo.latitude}
                      onChange={(e) => handleInputChange('latitude', e.target.value)}
                      disabled={!editMode}
                      placeholder="10.7769"
                      className="h-10 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-40">Kinh độ (lng)</Label>
                    <Input
                      value={storeInfo.longitude}
                      onChange={(e) => handleInputChange('longitude', e.target.value)}
                      disabled={!editMode}
                      placeholder="106.7009"
                      className="h-10 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase opacity-40">Bán kính cho phép (m)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={5000}
                    value={storeInfo.geoFenceRadiusM}
                    onChange={(e) => handleInputChange('geoFenceRadiusM', e.target.value)}
                    disabled={!editMode}
                    className="h-10 text-sm"
                  />
                </div>
                {GOOGLE_MAPS_KEY ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Bản đồ — chọn điểm tâm quán</p>
                    <MerchantGeoMapPicker
                      apiKey={GOOGLE_MAPS_KEY}
                      latitude={storeInfo.latitude.trim() ? Number(storeInfo.latitude) : null}
                      longitude={storeInfo.longitude.trim() ? Number(storeInfo.longitude) : null}
                      radiusM={Math.max(10, Number(storeInfo.geoFenceRadiusM) || 150)}
                      disabled={!editMode}
                      onPositionChange={(lat, lng) => {
                        handleInputChange('latitude', String(lat));
                        handleInputChange('longitude', String(lng));
                      }}
                    />
                  </div>
                ) : (
                  <a
                    href={
                      storeInfo.latitude && storeInfo.longitude
                        ? `https://www.google.com/maps?q=${encodeURIComponent(`${storeInfo.latitude},${storeInfo.longitude}`)}`
                        : 'https://www.google.com/maps'
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                  >
                    <ExternalLink size={14} /> Mở Google Maps để copy tọa độ (khi chưa có API key)
                  </a>
                )}
              </CardContent>
            </Card>

            <BlockedIpsCard merchantId={merchantId} />
          </div>

          {/* ── QR Code Generator ── */}
          <Card className="border-none shadow-premium rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-50">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2.5">
                   <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm">
                     <QrCode size={16} />
                   </div>
                   <div>
                     <CardTitle className="text-base">Mã QR Gọi Món</CardTitle>
                     <CardDescription className="text-[10px] font-bold uppercase tracking-tight">In QR theo từng bàn riêng biệt</CardDescription>
                   </div>
                 </div>
                 <Button 
                   onClick={() => setQRModalOpen(true)}
                   variant="outline" 
                   size="sm"
                   className="rounded-xl h-8 px-4 border-primary/20 text-primary font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-primary/5"
                 >
                    <Printer size={13} /> Thiết kế QR
                 </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Table Selector */}
              <div>
                <Label className="mb-3 text-[10px] font-black uppercase tracking-widest opacity-40 block">Chọn bàn hiển thị</Label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: storeInfo.tableCount }, (_, i) => i + 1).map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTable(t)}
                      className={cn(
                        "w-10 h-10 rounded-xl text-xs font-black transition-all border-2",
                        selectedTable === t
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105"
                          : "bg-surface-container-low border-transparent text-on-surface-variant hover:border-primary/20 hover:text-primary"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Separator className="opacity-5" />

              {/* QR Preview + Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="flex flex-col items-center justify-center p-6 bg-surface-container-low rounded-3xl border border-slate-100 shadow-inner">
                    <div className="p-3 bg-surface rounded-2xl shadow-xl">
                      <img 
                        src={QR_API(tableUrl(selectedTable))} 
                        alt={`QR Bàn ${selectedTable}`} 
                        className="w-40 h-40" 
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <span className="inline-block px-3 py-1 bg-primary text-white font-black rounded-lg text-[10px] shadow-sm">
                        BÀN {String(selectedTable).padStart(2, '0')}
                      </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Thao tác nhanh</p>
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        variant="outline"
                        className="h-10 justify-between px-4 rounded-xl group border-slate-100 hover:border-primary/20 bg-surface"
                        onClick={() => copyLink(selectedTable)}
                      >
                        <div className="flex items-center gap-3">
                          {copiedTable === selectedTable ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="opacity-40 group-hover:text-primary" />}
                          <span className="font-bold text-[13px]">Sao chép link</span>
                        </div>
                        {copiedTable === selectedTable && <span className="text-[9px] uppercase font-black text-emerald-600">Xong</span>}
                      </Button>

                      <Button
                        className="h-10 justify-start gap-3 px-4 rounded-xl shadow-sm active:scale-95 transition-transform"
                        onClick={() => downloadQR(selectedTable)}
                      >
                        <Download size={14} />
                        <span className="font-bold text-[13px]">Tải ảnh QR</span>
                      </Button>

                      <Button
                        variant="secondary"
                        className="h-10 justify-start gap-3 px-4 rounded-xl border-none bg-surface-container-low/50 hover:bg-surface-container-low"
                        onClick={() => window.open(tableUrl(selectedTable), '_blank')}
                      >
                        <ExternalLink size={14} className="opacity-40" />
                        <span className="font-bold text-[13px]">Mở thử menu</span>
                      </Button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50 max-h-32 overflow-y-auto no-scrollbar">
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Truy cập nhanh bàn khác</p>
                       <div className="grid grid-cols-3 gap-2">
                          {Array.from({ length: Math.min(6, storeInfo.tableCount) }, (_, i) => i + 1).map(t => (
                            <button key={t} onClick={() => setSelectedTable(t)} className={cn("py-1.5 rounded-lg text-[10px] font-black border transition-all", selectedTable === t ? "bg-primary/10 border-primary/20 text-primary" : "bg-surface border-slate-100 text-slate-400")}>Bàn {t}</button>
                          ))}
                       </div>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Employee Login Link ── */}
          <Card className="border-none shadow-premium rounded-[2rem] overflow-hidden bg-slate-900 text-white">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-primary shadow-sm">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-white">Link đăng nhập nhân viên</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-tight text-white/40">Chia sẻ link này cho nhân viên của bạn</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group overflow-hidden">
                  <code className="text-xs font-mono text-white/60 truncate mr-4">
                    {storeInfo.slug ? `${baseUrl}/shop/${storeInfo.slug}/login` : 'Chưa có mã quán (slug)'}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={copyEmployeeLink}
                    disabled={!storeInfo.slug}
                    className="rounded-xl h-9 px-4 bg-white/10 hover:bg-white text-white hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all shrink-0"
                  >
                    {saved ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
                    {saved ? 'Đã chép' : 'Sao chép'}
                  </Button>
                </div>
                <div className="text-center md:text-left flex-shrink-0">
                   <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] leading-relaxed">
                      Nhân viên sử dụng email cá nhân <br/> & mã PIN được cấp để vào ca.
                   </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Quản lý thực đơn ── */}
      {activeSettingTab === 'menu' && (
        <Card className="border-none shadow-premium rounded-[2rem] overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white shadow-sm">
                <Coffee size={16} />
              </div>
              <div>
                <CardTitle className="text-base">Quản lý thực đơn</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Cấu hình món ăn & bảng giá</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <MenuTab merchantId={merchantId} />
          </CardContent>
        </Card>
      )}

      {/* ── Quản lý nhân viên ── */}
      {activeSettingTab === 'employees' && (
        <Card className="border-none shadow-premium rounded-[2rem] overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-sm">
                <User size={16} />
              </div>
              <div>
                <CardTitle className="text-base">Quản lý nhân viên</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-tight">Vận hành & phục vụ khách hàng</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <EmployeesTab merchantId={merchantId} slug={storeInfo.slug} />
          </CardContent>
        </Card>
      )}

      <QRPrintModal 
        isOpen={isQRModalOpen}
        onClose={() => setQRModalOpen(false)}
        merchantId={merchantId}
        merchantName={storeInfo.name}
        merchantSlogan={storeInfo.slogan}
        merchantLogo={storeInfo.logoUrl}
        tableCount={storeInfo.tableCount}
        tableTokens={tableTokens}
      />
    </div>
  );
};
