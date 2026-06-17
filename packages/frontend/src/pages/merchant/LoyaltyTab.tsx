import React, { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Gift, Loader2, Plus, Trash2, Pencil, Save, Users, Coins, Sparkles, Settings, SlidersHorizontal } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import { normalizeVnCustomerPhone } from '../../lib/phoneUtils';

type Reward = {
  id: number;
  title: string;
  description: string | null;
  imageUrl?: string | null;
  highlightLabel?: string | null;
  pointsCost: number;
  active: boolean;
  sortOrder: number;
  productId?: number | null;
  productName?: string | null;
};

type MenuCategory = {
  id: number;
  name: string;
  products: { id: number; name: string }[];
};

type Overview = {
  memberCount: number;
  totalPointsHeld: number;
  activeRewardsCount: number;
  earnRuleLabel: string;
  vndPerPoint?: number;
};

type EarnSettings = {
  vndPerPoint: number;
  earnRuleLabel: string;
};

function readJwtRole(): string | null {
  const t = localStorage.getItem('token');
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as { role?: string };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function previewEarnRuleLabel(vndRaw: string): string {
  const v = parseInt(vndRaw.replace(/\D/g, ''), 10);
  const n = Number.isFinite(v) ? Math.min(10_000_000, Math.max(1, v)) : 1000;
  const money = new Intl.NumberFormat('vi-VN').format(n);
  return `1 điểm / ${money}₫ giá trị đơn (khi đơn chuyển trạng thái đã thanh toán)`;
}

export const LoyaltyTab: React.FC<{ merchantId: string }> = ({ merchantId }) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    highlightLabel: '',
    productId: '',
    pointsCost: '100',
    active: true,
    sortOrder: '0',
  });

  const [earnSettings, setEarnSettings] = useState<EarnSettings | null>(null);
  const [earnVndDraft, setEarnVndDraft] = useState('1000');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [adjustPhone, setAdjustPhone] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const jwtRole = readJwtRole();
  const canEditEarnRule = jwtRole !== 'EMPLOYEE';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rw, ov, st] = await Promise.all([
        api.get<Reward[]>('/orders/loyalty/rewards'),
        api.get<Overview>('/orders/loyalty/overview'),
        api.get<EarnSettings>('/orders/loyalty/settings'),
      ]);
      setRewards(Array.isArray(rw.data) ? rw.data : []);
      setOverview(ov.data ?? null);
      const es = st.data ?? null;
      setEarnSettings(es);
      if (es?.vndPerPoint != null) {
        setEarnVndDraft(String(es.vndPerPoint));
      }
    } catch {
      toast.error('Không tải được dữ liệu tích điểm');
      setRewards([]);
      setOverview(null);
      setEarnSettings(null);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    void load();
  }, [load, merchantId]);

  useEffect(() => {
    if (!merchantId) return;
    void (async () => {
      try {
        const { data } = await api.get<MenuCategory[]>(`/menu/merchant/${merchantId}/categories`);
        setMenuCategories(Array.isArray(data) ? data : []);
      } catch {
        setMenuCategories([]);
      }
    })();
  }, [merchantId]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      description: '',
      imageUrl: '',
      highlightLabel: '',
      productId: '',
      pointsCost: '100',
      active: true,
      sortOrder: '0',
    });
  };

  const startEdit = (r: Reward) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      description: r.description ?? '',
      imageUrl: r.imageUrl ?? '',
      highlightLabel: r.highlightLabel ?? '',
      productId: r.productId != null ? String(r.productId) : '',
      pointsCost: String(r.pointsCost),
      active: r.active,
      sortOrder: String(r.sortOrder ?? 0),
    });
  };

  const payloadFromForm = (
    mode: 'create' | 'patch',
  ):
    | { ok: true; body: Record<string, unknown> }
    | { ok: false; error: string } => {
    const pts = parseInt(form.pointsCost, 10);
    const rawPid = form.productId.trim();
    let productId: number | null | undefined = undefined;
    if (rawPid !== '') {
      const p = parseInt(rawPid, 10);
      if (!Number.isFinite(p) || p < 1) {
        return { ok: false, error: 'Mã món không hợp lệ' };
      }
      productId = p;
    } else if (mode === 'patch') {
      productId = null;
    }
    const base = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      highlightLabel: form.highlightLabel.trim() || undefined,
      pointsCost: pts,
      active: form.active,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };
    if (mode === 'create') {
      return {
        ok: true,
        body: productId != null ? { ...base, productId } : base,
      };
    }
    return { ok: true, body: { ...base, productId } };
  };

  const submitCreate = async () => {
    const pts = parseInt(form.pointsCost, 10);
    if (!form.title.trim() || !Number.isFinite(pts) || pts < 1) {
      toast.error('Nhập tên quà và điểm ≥ 1');
      return;
    }
    const built = payloadFromForm('create');
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    try {
      await api.post('/orders/loyalty/rewards', built.body);
      toast.success('Đã thêm quà');
      resetForm();
      void load();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : '';
      toast.error(msg || 'Không thêm được');
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async () => {
    if (editingId == null) return;
    const pts = parseInt(form.pointsCost, 10);
    if (!form.title.trim() || !Number.isFinite(pts) || pts < 1) {
      toast.error('Nhập tên quà và điểm ≥ 1');
      return;
    }
    const built = payloadFromForm('patch');
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/orders/loyalty/rewards/${editingId}`, built.body);
      toast.success('Đã cập nhật');
      resetForm();
      void load();
    } catch {
      toast.error('Không cập nhật được');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Xóa phần quà này?')) return;
    try {
      await api.delete(`/orders/loyalty/rewards/${id}`);
      toast.success('Đã xóa');
      if (editingId === id) resetForm();
      void load();
    } catch {
      toast.error('Không xóa được');
    }
  };

  const submitEarnSettings = async () => {
    if (!canEditEarnRule) {
      toast.error('Chỉ chủ quán mới chỉnh được quy tắc tích điểm.');
      return;
    }
    const v = parseInt(earnVndDraft.replace(/\D/g, ''), 10);
    if (!Number.isFinite(v) || v < 1) {
      toast.error('Nhập số tiền (VNĐ) cho 1 điểm từ 1 trở lên');
      return;
    }
    if (v > 10_000_000) {
      toast.error('Giá trị tối đa là 10.000.000₫ / 1 điểm');
      return;
    }
    setSettingsSaving(true);
    try {
      const { data } = await api.patch<EarnSettings>('/orders/loyalty/settings', {
        vndPerPoint: v,
      });
      setEarnSettings(data);
      if (data?.vndPerPoint != null) setEarnVndDraft(String(data.vndPerPoint));
      toast.success('Đã cập nhật quy tắc tích điểm');
      void load();
    } catch (e: unknown) {
      const status =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 403) {
        toast.error('Chỉ chủ quán mới chỉnh được quy tắc tích điểm.');
      } else {
        const msg =
          typeof e === 'object' && e !== null && 'response' in e
            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
            : '';
        toast.error(msg || 'Không lưu được quy tắc');
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  const submitAdjustLoyalty = async () => {
    if (!canEditEarnRule) {
      toast.error('Chỉ chủ quán mới điều chỉnh điểm thủ công.');
      return;
    }
    const phone =
      normalizeVnCustomerPhone(adjustPhone.trim()) ?? adjustPhone.replace(/\D/g, '');
    if (!phone || phone.length < 8) {
      toast.error('Nhập số điện thoại khách hợp lệ');
      return;
    }
    const raw = adjustDelta.trim().replace(/\s/g, '');
    const delta = Number(raw);
    if (!Number.isFinite(delta) || delta === 0 || !Number.isInteger(delta)) {
      toast.error('Nhập điểm cộng/trừ (số nguyên, khác 0)');
      return;
    }
    if (delta < -500_000 || delta > 500_000) {
      toast.error('Mỗi lần chỉnh tối đa ±500.000 điểm');
      return;
    }
    setAdjustSaving(true);
    try {
      await api.post<{ points: number }>('/orders/loyalty/adjust', {
        phone,
        deltaPoints: delta,
        note: adjustNote.trim() || undefined,
      });
      toast.success('Đã cập nhật điểm cho khách');
      setAdjustDelta('');
      setAdjustNote('');
    } catch (e: unknown) {
      const status =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 403) {
        toast.error('Chỉ chủ quán mới điều chỉnh điểm thủ công.');
      } else {
        const msg =
          typeof e === 'object' && e !== null && 'response' in e
            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
            : '';
        toast.error(msg || 'Không cập nhật được điểm');
      }
    } finally {
      setAdjustSaving(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-on-surface tracking-tight flex items-center gap-2">
          <Gift className="text-primary" size={28} />
          Tích điểm & đổi quà
        </h1>
        <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
          Chương trình Web2: khách tích điểm khi đơn <strong className="text-on-surface">đã thanh toán</strong>, tra cứu
          bằng SĐT tại màn bàn và đổi quà (nhân viên xác nhận tại quầy).
        </p>
      </div>

      {overview && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-primary/15 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
                <Users size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-on-surface-variant">Khách có tài khoản</p>
                <p className="text-2xl font-black text-on-surface tabular-nums">{fmt(overview.memberCount)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200/60 bg-amber-50/40">
            <CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="rounded-xl bg-amber-200/80 p-2.5 text-amber-900">
                <Coins size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-amber-900/70">Tổng điểm đang lưu</p>
                <p className="text-2xl font-black text-amber-950 tabular-nums">{fmt(overview.totalPointsHeld)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200/60 bg-emerald-50/40">
            <CardContent className="pt-5 pb-4 flex items-start gap-3">
              <div className="rounded-xl bg-emerald-200/80 p-2.5 text-emerald-900">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-900/70">Quà đang mở</p>
                <p className="text-2xl font-black text-emerald-950 tabular-nums">
                  {fmt(overview.activeRewardsCount)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {overview?.earnRuleLabel && (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface">
          <span className="font-black text-primary mr-1">Quy tắc tích:</span>
          {overview.earnRuleLabel}
        </div>
      )}

      <Card className="border-outline-variant/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings size={20} className="text-primary" />
            Cấu hình quy tắc tích điểm
          </CardTitle>
          <CardDescription>
            Cứ bao nhiêu đồng giá trị đơn (sau thanh toán) thì được 1 điểm — áp dụng cho toàn bộ khách của quán.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {earnSettings && (
            <p className="text-xs text-on-surface-variant">
              Đang áp dụng: <span className="font-bold text-on-surface">{earnSettings.earnRuleLabel}</span>
            </p>
          )}
          <div className="space-y-1.5 max-w-sm">
            <Label>Số tiền (VNĐ) cho 1 điểm</Label>
            <Input
              type="number"
              min={1}
              max={10_000_000}
              value={earnVndDraft}
              onChange={(e) => setEarnVndDraft(e.target.value)}
              disabled={loading || !canEditEarnRule}
              placeholder="1000"
            />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Xem trước: {previewEarnRuleLabel(earnVndDraft)}
            </p>
          </div>
          {!canEditEarnRule && (
            <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
              Tài khoản nhân viên chỉ xem quy tắc; chỉ chủ quán mới chỉnh được.
            </p>
          )}
          <Button
            type="button"
            onClick={() => void submitEarnSettings()}
            disabled={settingsSaving || loading || !canEditEarnRule}
            className="gap-2"
          >
            {settingsSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Lưu quy tắc
          </Button>
        </CardContent>
      </Card>

      <Card className="border-outline-variant/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-primary" />
            Điều chỉnh điểm thủ công
          </CardTitle>
          <CardDescription>
            Cộng hoặc trừ điểm theo SĐT khách (ví dụ xử lý khiếu nại, thưởng tay). Giao dịch ghi lại trong lịch sử
            tích điểm của khách.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEditEarnRule && (
            <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
              Chỉ chủ quán mới dùng được chức năng này.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Số điện thoại khách</Label>
              <Input
                value={adjustPhone}
                onChange={(e) => setAdjustPhone(e.target.value)}
                placeholder="09…"
                disabled={!canEditEarnRule}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Điểm (+ cộng / − trừ)</Label>
              <Input
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="VD: 50 hoặc -20"
                disabled={!canEditEarnRule}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ghi chú (tuỳ chọn)</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Lý do điều chỉnh…"
                maxLength={500}
                disabled={!canEditEarnRule}
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void submitAdjustLoyalty()}
            disabled={adjustSaving || !canEditEarnRule}
            className="gap-2"
          >
            {adjustSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Áp dụng điểm
          </Button>
        </CardContent>
      </Card>

      <Card className="border-outline-variant/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId != null ? 'Sửa phần quà' : 'Thêm phần quà mới'}
          </CardTitle>
          <CardDescription>
            Ảnh &amp; nhãn nổi bật hiển thị trên màn khách; có thể gắn quà với một món trong menu (nước, topping…).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tên quà</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="VD: Ly trà đào"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mô tả (tuỳ chọn)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Điều kiện áp dụng…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>URL ảnh quà (tuỳ chọn)</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Gắn với món trong menu (tuỳ chọn)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              >
                <option value="">— Không gắn món (mô tả tự do) —</option>
                {menuCategories.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {(c.products ?? []).map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-[10px] text-on-surface-variant leading-snug">
                Chọn nước / topping / món cụ thể để nhân viên biết cần xuất gì khi khách đổi điểm trên điện thoại.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Nhãn nổi (tuỳ chọn)</Label>
              <Input
                value={form.highlightLabel}
                onChange={(e) => setForm((f) => ({ ...f, highlightLabel: e.target.value }))}
                placeholder="VD: Hot · Mới"
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Điểm cần đổi</Label>
              <Input
                type="number"
                min={1}
                value={form.pointsCost}
                onChange={(e) => setForm((f) => ({ ...f, pointsCost: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Thứ tự hiển thị</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="rounded border-outline-variant"
              />
              Đang áp dụng (hiện cho khách trên màn bàn)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {editingId != null ? (
              <>
                <Button
                  type="button"
                  onClick={() => void submitUpdate()}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Lưu
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  Huỷ sửa
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => void submitCreate()}
                disabled={saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Thêm quà
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-outline-variant/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách quà đổi</CardTitle>
          <CardDescription>
            {loading ? 'Đang tải…' : `${rewards.length} mục (cả đang tắt)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12 text-on-surface-variant">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : rewards.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-6 text-center">
              Chưa có quà. Thêm ít nhất một phần để khách thấy trong mục &quot;Điểm &amp; đổi quà&quot; trên điện thoại.
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant/15">
              {rewards.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    'py-4 flex flex-col sm:flex-row sm:items-center gap-3',
                    !r.active && 'opacity-60',
                  )}
                >
                  {r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover border border-outline-variant/20 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <Gift className="text-primary" size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-on-surface">{r.title}</p>
                      {r.highlightLabel ? (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-500 text-white">
                          {r.highlightLabel}
                        </span>
                      ) : null}
                    </div>
                    {r.description ? (
                      <p className="text-xs text-on-surface-variant mt-0.5">{r.description}</p>
                    ) : null}
                    {r.productName ? (
                      <p className="text-[10px] font-bold text-emerald-800 mt-0.5">
                        Món menu: {r.productName}
                      </p>
                    ) : null}
                    <p className="text-xs font-black text-primary mt-1">
                      {r.pointsCost} điểm / lượt đổi
                      {!r.active ? ' · đang tắt' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => startEdit(r)}
                    >
                      <Pencil size={14} />
                      Sửa
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => void remove(r.id)}
                    >
                      <Trash2 size={14} />
                      Xóa
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
