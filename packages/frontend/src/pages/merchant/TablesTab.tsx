import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, CheckCircle2, 
  Coffee, Loader2,  
  ChefHat, BellRing, Receipt, Search, RefreshCw, Download, Printer,
  GitMerge, Scissors,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { 
  Card, CardContent, Badge, Button,
  Dialog, DialogContent, DialogTitle, DialogDescription,
  Input,
  TooltipProvider
} from '../../components/ui';
import { cn } from '../../lib/utils';

function normalizeTableNumber(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim().replace(/^(bàn|ban|table)\s*/i, '');
  const num = parseInt(str, 10);
  return !isNaN(num) ? String(num).padStart(2, '0') : str.toLowerCase();
}

interface OrderItem { id?: number; product: { name: string }; quantity: number; price: string; note?: string; }
interface Order {
  id: number; tableNumber: string;
  customerName?: string;
  customerPhone?: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'paid' | 'cancelled';
  totalPrice: string; items: OrderItem[]; createdAt: string;
  /** Bàn vật lý gốc khi đơn đã được ghép vào bàn chính */
  mergedFromTableNumber?: string | null;
}

type TableStatus = 'empty' | 'pending' | 'preparing' | 'ready' | 'busy';

interface TableState {
  number: string;
  status: TableStatus;
  orders: Order[];
  totalAmount: number;
  lastUpdate: string;
  readyItemsCount: number;
}

export const TablesTab: React.FC<{ merchantId: string; refreshKey: number; tableCount: number }> = ({ merchantId, refreshKey, tableCount }) => {
  const [tables, setTables] = useState<TableState[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TableStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [qrForTable, setQrForTable] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [mergeModal, setMergeModal] = useState<{ source: string; master: string } | null>(null);
  const [splitModal, setSplitModal] = useState<{ order: Order; itemIds: string; newTable: string } | null>(null);
  const [hubTableModalOpen, setHubTableModalOpen] = useState(false);
  const [hubMergeSource, setHubMergeSource] = useState('');
  const [hubMergeMaster, setHubMergeMaster] = useState('');
  const [hubSplitSource, setHubSplitSource] = useState('');
  const [hubSplitMaster, setHubSplitMaster] = useState('');
  const [hubBillModalOpen, setHubBillModalOpen] = useState(false);
  const [hubBillOrderId, setHubBillOrderId] = useState('');
  const [hubBillItemIds, setHubBillItemIds] = useState('');
  const [hubBillNewTable, setHubBillNewTable] = useState('');

  const publicBase = (import.meta.env.VITE_PUBLIC_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const qrTableSegment = qrForTable ? String(parseInt(qrForTable, 10) || qrForTable) : '';
  const orderQrUrl = qrForTable && merchantId ? `${publicBase}/order/${merchantId}/${qrTableSegment}` : '';
  const qrImageSrc = orderQrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(orderQrUrl)}`
    : '';

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/orders/merchant/${merchantId}/tables`);
      // Backend returns { orders: [...] }
      const data = res.data?.orders || (Array.isArray(res.data) ? res.data : []);
      const orders: Order[] = data.map((o: any) => ({
        id: o.id,
        tableNumber: o.tableNumber || o.table_number,
        customerName: o.customerName || o.customer_name,
        customerPhone: o.customerPhone || o.customer_phone,
        status: o.status,
        totalPrice: String(o.totalPrice || o.total_price),
        items: (o.items || []).map((it: any) => ({
          ...it,
          id:
            typeof it.id === 'number' && Number.isFinite(it.id)
              ? it.id
              : it.id != null && String(it.id).trim() !== ''
                ? Number(it.id)
                : undefined,
          product: it.product || { name: it.name || 'Sản phẩm' },
        })),
        createdAt: o.createdAt || o.created_at,
        type: o.type,
        mergedFromTableNumber: o.mergedFromTableNumber ?? o.merged_from_table_number ?? null,
      }));
      
      const newTables: TableState[] = Array.from({ length: tableCount }, (_, i) => {
        const tableNum = String(i + 1).padStart(2, '0');
        const activeOrders = orders.filter(o => 
          normalizeTableNumber(o.tableNumber) === normalizeTableNumber(tableNum) && 
          o.status !== 'cancelled' && 
          o.status !== 'paid'
        );
        
        let status: TableStatus = 'empty';
        if (activeOrders.some(o => o.status === 'ready')) {
          status = 'ready';
        } else if (activeOrders.some(o => o.status === 'pending')) {
          status = 'pending';
        } else if (activeOrders.some(o => o.status === 'preparing')) {
          status = 'preparing';
        } else if (activeOrders.length > 0) {
          status = 'busy';
        }

        const totalAmount = activeOrders.reduce((sum, o) => sum + parseInt(o.totalPrice), 0);
        const readyItemsCount = activeOrders.filter(o => o.status === 'ready').length;
        const lastUpdate = activeOrders.length > 0
          ? activeOrders.reduce((latest, current) =>
            new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime() ? current : latest
          ).createdAt
          : '';

        return {
          number: tableNum,
          status,
          orders: activeOrders,
          totalAmount,
          lastUpdate,
          readyItemsCount
        };
      });

      setTables(newTables);
    } catch (err) {
      console.error('Fetch status error:', err);
      // Do not show mock orders in production UI; keep real state only.
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [merchantId, tableCount]);

  useEffect(() => {
    if (selectedTable) {
      const updated = tables.find(t => t.number === selectedTable.number);
      if (updated) {
        if (JSON.stringify(updated) !== JSON.stringify(selectedTable)) {
          setSelectedTable(updated);
        }
      } else {
        setSelectedTable(null);
      }
    }
  }, [tables, selectedTable]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, refreshKey]); 

  const handleUpdateStatus = async (orderId: number, status: Order['status']) => {
    if (!orderId) {
      console.warn('[TablesTab] Attempted to update status with no orderId');
      return;
    }
    setUpdatingId(orderId);
    try {
      await api.put(`/orders/merchant/${merchantId}/${orderId}/status`, { status });
      await fetchStatus();
    } catch (err) {
      console.error('Update status error:', err);
      setTables(prev => prev.map(t => ({
        ...t,
        orders: t.orders.map(o => o.id === orderId ? { ...o, status } : o)
      })));
    } finally {
      setUpdatingId(null);
    }
  };

  const elapsed = (iso: string) => {
    if (!iso) return '';
    let dateStr = iso.replace(' ', 'T'); // Normalize space to T
    if (!dateStr.includes('Z') && !dateStr.includes('+')) {
      dateStr += 'Z';
    }
    
    let diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    
    // Auto-fix for 7-hour timezone shift common in Vietnam (25200 seconds)
    if (Math.abs(diff - 25200) < 600) diff -= 25200;
    
    const m = Math.floor(Math.max(0, diff) / 60);
    if (m < 1) return 'vừa mới đây';
    if (m < 60) return `${m} phút`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}ph` : `${h} giờ`;
  };

  const filteredTables = tables.filter(t => {
    const matchesSearch = t.number.includes(searchQuery);
    const matchesFilter = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: tables.length,
    empty: tables.filter(t => t.status === 'empty').length,
    occupied: tables.filter(t => t.status !== 'empty').length,
    pending: tables.reduce((acc, t) => acc + t.orders.filter(o => o.status === 'pending').length, 0),
    preparing: tables.reduce((acc, t) => acc + t.orders.filter(o => o.status === 'preparing').length, 0),
    ready: tables.reduce((acc, t) => acc + t.orders.filter(o => o.status === 'ready').length, 0),
    revenue: tables.reduce((acc, t) => acc + t.totalAmount, 0)
  };

  const downloadQrPng = async () => {
    if (!qrImageSrc || !orderQrUrl) return;
    try {
      const res = await fetch(qrImageSrc);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qr-ban-${qrTableSegment}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(qrImageSrc, '_blank');
    }
  };

  const printQr = () => {
    if (!qrImageSrc) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>In QR bàn ${qrTableSegment}</title></head><body style="text-align:center"><img src="${qrImageSrc}" alt="QR" /><p style="font-family:sans-serif;font-size:12px">${orderQrUrl}</p></body></html>`);
    w.document.close();
    w.print();
  };

  const confirmMergeTables = async () => {
    if (!mergeModal?.master.trim()) return;
    setProcessingAction(true);
    try {
      const src = normalizeTableNumber(mergeModal.source) || mergeModal.source;
      const master = normalizeTableNumber(mergeModal.master.trim()) || mergeModal.master.trim();
      await api.post('/orders/tables/merge', {
        masterTableNumber: master,
        sourceTableNumbers: [src],
      });
      toast.success(`Đã ghép Bàn ${src} → Bàn ${master}`);
      await fetchStatus();
      setMergeModal(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Không thể ghép bàn';
      toast.error(typeof msg === 'string' ? msg : 'Không thể ghép bàn');
    } finally {
      setProcessingAction(false);
    }
  };

  const splitTableFrom = async (sourceTable: string, masterTable: string) => {
    setProcessingAction(true);
    try {
      const src = normalizeTableNumber(sourceTable) || sourceTable;
      const master = normalizeTableNumber(masterTable) || masterTable;
      await api.post('/orders/tables/split', {
        masterTableNumber: master,
        sourceTableNumber: src,
      });
      toast.success(`Đã tách Bàn ${src} khỏi Bàn ${master}`);
      await fetchStatus();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Không thể tách bàn';
      toast.error(typeof msg === 'string' ? msg : 'Không thể tách bàn');
    } finally {
      setProcessingAction(false);
    }
  };

  const confirmSplitBillItems = async () => {
    if (!splitModal) return;
    const itemIds = splitModal.itemIds
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    if (itemIds.length === 0) return;
    setProcessingAction(true);
    try {
      await api.post('/orders/bills/split-items', {
        sourceOrderId: splitModal.order.id,
        itemIds,
        newTableNumber: splitModal.newTable.trim() || undefined,
      });
      await fetchStatus();
      setSelectedTable(null);
      setSplitModal(null);
    } finally {
      setProcessingAction(false);
    }
  };

  const submitHubMergeTables = async () => {
    const src = normalizeTableNumber(hubMergeSource);
    const master = normalizeTableNumber(hubMergeMaster);
    if (!src || !master) {
      toast.error('Nhập đủ bàn phụ và bàn chính.');
      return;
    }
    setProcessingAction(true);
    try {
      await api.post('/orders/tables/merge', {
        masterTableNumber: master,
        sourceTableNumbers: [src],
      });
      toast.success(`Đã ghép Bàn ${src} → Bàn ${master}`);
      setHubMergeSource('');
      setHubMergeMaster('');
      setHubTableModalOpen(false);
      await fetchStatus();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Không thể ghép bàn';
      toast.error(typeof msg === 'string' ? msg : 'Không thể ghép bàn');
    } finally {
      setProcessingAction(false);
    }
  };

  const submitHubSplitTable = async () => {
    const src = normalizeTableNumber(hubSplitSource);
    const master = normalizeTableNumber(hubSplitMaster);
    if (!src || !master) {
      toast.error('Nhập đủ bàn phụ và bàn chính.');
      return;
    }
    setProcessingAction(true);
    try {
      await api.post('/orders/tables/split', {
        masterTableNumber: master,
        sourceTableNumber: src,
      });
      toast.success(`Đã tách bàn phụ Bàn ${src} khỏi Bàn ${master}`);
      setHubSplitSource('');
      setHubSplitMaster('');
      setHubTableModalOpen(false);
      await fetchStatus();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Không thể tách bàn';
      toast.error(typeof msg === 'string' ? msg : 'Không thể tách bàn');
    } finally {
      setProcessingAction(false);
    }
  };

  const submitHubSplitBill = async () => {
    const oid = parseInt(String(hubBillOrderId).trim(), 10);
    const itemIds = hubBillItemIds
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!Number.isFinite(oid) || oid <= 0) {
      toast.error('Nhập mã đơn hợp lệ.');
      return;
    }
    if (itemIds.length === 0) {
      toast.error('Nhập ít nhất một ID dòng món (order_items).');
      return;
    }
    setProcessingAction(true);
    try {
      await api.post('/orders/bills/split-items', {
        sourceOrderId: oid,
        itemIds,
        newTableNumber: hubBillNewTable.trim() || undefined,
      });
      toast.success('Đã tách bill / món sang đơn mới.');
      setHubBillOrderId('');
      setHubBillItemIds('');
      setHubBillNewTable('');
      setHubBillModalOpen(false);
      await fetchStatus();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Không thể tách bill';
      toast.error(typeof msg === 'string' ? msg : 'Không thể tách bill');
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={!!mergeModal} onOpenChange={(open) => !open && setMergeModal(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Ghép bàn</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Đơn đang mở ở bàn phụ <span className="font-bold text-slate-800">Bàn {mergeModal?.source}</span> sẽ được gộp
            vào bàn chính bạn nhập bên dưới. Khách quét QR bàn phụ vẫn thấy nhãn ghép bàn trên menu.
          </DialogDescription>
          <div className="space-y-2 py-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bàn chính (master)</label>
            <Input
              value={mergeModal?.master ?? ''}
              onChange={(e) => mergeModal && setMergeModal({ ...mergeModal, master: e.target.value })}
              placeholder="Ví dụ: 01"
              className="rounded-xl"
            />
          </div>
          <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
            Xác nhận: ghép Bàn {mergeModal?.source} → Bàn {mergeModal?.master?.trim() || '…'}
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setMergeModal(null)} disabled={processingAction}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void confirmMergeTables()} disabled={processingAction || !mergeModal?.master.trim()}>
              {processingAction ? <Loader2 size={14} className="animate-spin" /> : 'Xác nhận ghép'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!splitModal} onOpenChange={(open) => !open && setSplitModal(null)}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Tách món — Đơn #{splitModal?.order.id}</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Nhập ID dòng món (order_items), cách nhau bằng dấu phẩy. Gợi ý từ đơn hiện tại:
          </DialogDescription>
          {splitModal && (
            <>
              <ul className="text-xs bg-surface-container-low rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto border border-slate-100">
                {splitModal.order.items.map((it, idx) => (
                  <li key={idx} className="flex justify-between gap-2">
                    <span>
                      {it.id != null ? <span className="font-mono text-primary font-bold mr-1">{it.id}</span> : null}
                      {it.quantity}× {it.product.name}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">ID món (phân tách bằng dấu phẩy)</label>
                <Input
                  value={splitModal.itemIds}
                  onChange={(e) => setSplitModal({ ...splitModal, itemIds: e.target.value })}
                  placeholder="vd: 12, 13"
                  className="rounded-xl font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Tách sang bàn (để trống = giữ bàn hiện tại)</label>
                <Input
                  value={splitModal.newTable}
                  onChange={(e) => setSplitModal({ ...splitModal, newTable: e.target.value })}
                  placeholder="vd: 03"
                  className="rounded-xl"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setSplitModal(null)} disabled={processingAction}>
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={() => void confirmSplitBillItems()}
                  disabled={processingAction || !splitModal.itemIds.trim()}
                >
                  {processingAction ? <Loader2 size={14} className="animate-spin" /> : 'Xác nhận tách'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={hubTableModalOpen} onOpenChange={(open) => !open && setHubTableModalOpen(false)}>
        <DialogContent className="max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="flex items-center gap-2">
            <GitMerge size={20} className="text-indigo-600" />
            Ghép bàn / Tách bàn
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            API: <span className="font-mono text-xs">POST /orders/tables/merge</span> và{' '}
            <span className="font-mono text-xs">POST /orders/tables/split</span>
          </DialogDescription>

          <div className="space-y-6 pt-2">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Ghép bàn</p>
              <p className="text-xs text-slate-600">Gộp đơn từ bàn phụ vào bàn chính (khách quét QR bàn phụ vẫn thấy nhãn ghép).</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Bàn phụ</label>
                  <Input
                    value={hubMergeSource}
                    onChange={(e) => setHubMergeSource(e.target.value)}
                    placeholder="vd: 02"
                    className="rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Bàn chính</label>
                  <Input
                    value={hubMergeMaster}
                    onChange={(e) => setHubMergeMaster(e.target.value)}
                    placeholder="vd: 01"
                    className="rounded-xl text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                className="w-full rounded-xl font-black"
                onClick={() => void submitHubMergeTables()}
                disabled={processingAction}
              >
                {processingAction ? <Loader2 size={14} className="animate-spin" /> : 'Xác nhận ghép bàn'}
              </Button>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Tách bàn</p>
              <p className="text-xs text-slate-600">Tách bàn phụ đã ghép về lại bàn riêng.</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Bàn phụ</label>
                  <Input
                    value={hubSplitSource}
                    onChange={(e) => setHubSplitSource(e.target.value)}
                    placeholder="vd: 02"
                    className="rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Bàn chính</label>
                  <Input
                    value={hubSplitMaster}
                    onChange={(e) => setHubSplitMaster(e.target.value)}
                    placeholder="vd: 01"
                    className="rounded-xl text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl font-black border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={() => void submitHubSplitTable()}
                disabled={processingAction}
              >
                {processingAction ? <Loader2 size={14} className="animate-spin" /> : 'Xác nhận tách bàn'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hubBillModalOpen} onOpenChange={(open) => !open && setHubBillModalOpen(false)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle className="flex items-center gap-2">
            <Scissors size={20} className="text-primary" />
            Tách bill / Tách món
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            API: <span className="font-mono text-xs">POST /orders/bills/split-items</span> — tách các dòng{' '}
            <span className="font-mono">order_items</span> sang đơn mới.
          </DialogDescription>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mã đơn</label>
              <Input
                inputMode="numeric"
                value={hubBillOrderId}
                onChange={(e) => setHubBillOrderId(e.target.value)}
                placeholder="vd: 21"
                className="rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">ID dòng món (phẩy)</label>
              <Input
                value={hubBillItemIds}
                onChange={(e) => setHubBillItemIds(e.target.value)}
                placeholder="vd: 12, 13"
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bàn đích (tuỳ chọn)</label>
              <Input
                value={hubBillNewTable}
                onChange={(e) => setHubBillNewTable(e.target.value)}
                placeholder="Để trống = giữ bàn hiện tại"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setHubBillModalOpen(false)} disabled={processingAction}>
              Đóng
            </Button>
            <Button type="button" onClick={() => void submitHubSplitBill()} disabled={processingAction}>
              {processingAction ? <Loader2 size={14} className="animate-spin" /> : 'Xác nhận tách'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrForTable} onOpenChange={(open) => !open && setQrForTable(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogTitle className="text-center">Mã QR — Bàn {qrTableSegment}</DialogTitle>
          {orderQrUrl && (
            <div className="flex flex-col items-center gap-4 py-2">
              <img src={qrImageSrc} alt="QR đặt món" className="w-[300px] h-[300px] rounded-xl border border-slate-100" />
              <p className="text-[10px] font-mono break-all text-slate-600 text-center px-2">{orderQrUrl}</p>
              <div className="flex gap-2 w-full justify-center">
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={downloadQrPng}>
                  <Download size={14} /> Tải PNG
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={printQr}>
                  <Printer size={14} /> In
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-8 animate-fade-in">
        
        {/* Hàng 1–2: 4 chỉ số (mobile 2×2 giống layout cũ) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Có khách', val: `${stats.occupied}/${stats.total}`, icon: Coffee, color: 'text-slate-400', bg: 'bg-surface-container-low', badge: `${stats.empty} Trống` },
            { label: 'Đơn mới', val: stats.pending, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', badge: stats.pending > 0 ? 'Cần xử lý' : 'Ổn định', pulse: stats.pending > 0 },
            { label: 'Chờ giao', val: stats.ready, icon: BellRing, color: 'text-emerald-500', bg: 'bg-emerald-50', badge: `${stats.ready} Món` },
            { label: 'Tạm tính', val: `${Intl.NumberFormat('vi-VN').format(stats.revenue)}đ`, icon: Receipt, color: 'text-white', bg: 'bg-primary', isDark: true }
          ].map((s, i) => (
            <Card key={i} className={cn("border-none shadow-sm overflow-hidden", s.isDark ? "bg-primary text-white" : "bg-surface")}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", s.isDark ? "bg-surface/20" : s.bg, s.color)}>
                  <s.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-[9px] font-black uppercase tracking-widest opacity-60", s.isDark ? "text-white/60" : "text-slate-500")}>{s.label}</p>
                  <p className="text-xl font-black tracking-tighter truncate">{s.val}</p>
                </div>
                {s.pulse && <span className="ml-auto flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Hàng riêng: 2 ô thao tác — luôn ngay dưới 4 ô thống kê (mobile không bị trôi xuống hàng 3 của grid 6 cột) */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setHubTableModalOpen(true)}
            className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
          >
            <Card className="border-none shadow-sm overflow-hidden bg-surface h-full min-h-[88px] transition-all hover:shadow-md hover:ring-2 hover:ring-indigo-200 active:scale-[0.98]">
              <CardContent className="p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600">
                  <GitMerge size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Thao tác</p>
                  <p className="text-sm font-black tracking-tight text-indigo-900 leading-snug">Tách bàn / Ghép bàn</p>
                  <p className="text-[9px] font-bold text-indigo-500/80 mt-0.5 hidden sm:block">Merge · Split table</p>
                </div>
              </CardContent>
            </Card>
          </button>
          <button
            type="button"
            onClick={() => setHubBillModalOpen(true)}
            className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Card className="border-none shadow-sm overflow-hidden bg-surface h-full min-h-[88px] transition-all hover:shadow-md hover:ring-2 hover:ring-primary/25 active:scale-[0.98]">
              <CardContent className="p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50 text-primary">
                  <Scissors size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Thao tác</p>
                  <p className="text-sm font-black tracking-tight text-on-surface leading-snug">Tách bill / Tách món</p>
                  <p className="text-[9px] font-bold text-primary/80 mt-0.5 hidden sm:block">Split bill · order_items</p>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          <div className="w-full lg:flex-1 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-surface/50 backdrop-blur-sm p-3 rounded-2xl border border-white shadow-sm">
              <div className="relative w-full md:w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  placeholder="Số bàn..." 
                  className="w-full pl-9 h-9 text-xs rounded-xl border-none bg-surface focus:ring-1 focus:ring-primary outline-none" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
              <div className="flex gap-1 overflow-x-auto no-scrollbar w-full md:w-auto items-center">
                {['all', 'empty', 'pending', 'ready'].map(k => (
                  <button key={k} onClick={() => setFilterStatus(k as any)} className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    filterStatus === k ? "bg-primary text-white" : "text-slate-400 hover:bg-surface-container-low"
                  )}>
                    {k === 'all' ? 'Tất cả' : k === 'empty' ? 'Trống' : k === 'pending' ? 'Mới' : 'Xong'}
                  </button>
                ))}
                
                <div className="h-4 w-[1px] bg-slate-200 mx-1 shrink-0" />
                
                <button 
                  onClick={() => fetchStatus()}
                  className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors active:scale-90"
                  title="Làm mới"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6 bg-surface-container-low/40 p-4 rounded-3xl border border-slate-100 shadow-inner">
              {!loading && filteredTables.map(table => {
                const s = table.status;
                const statusColors = {
                  empty: {
                    bg: 'bg-surface',
                    border: 'border-slate-200/80',
                    dot: 'bg-slate-300',
                    chair: 'bg-slate-200/50',
                    text: 'text-slate-400'
                  },
                  pending: {
                    bg: 'bg-amber-50/80',
                    border: 'border-amber-400',
                    dot: 'bg-amber-500 animate-pulse',
                    chair: 'bg-amber-300/80',
                    text: 'text-amber-800'
                  },
                  preparing: {
                    bg: 'bg-indigo-50/80',
                    border: 'border-indigo-400',
                    dot: 'bg-indigo-500 animate-pulse',
                    chair: 'bg-indigo-300/80',
                    text: 'text-indigo-800'
                  },
                  ready: {
                    bg: 'bg-emerald-50/80',
                    border: 'border-emerald-500',
                    dot: 'bg-emerald-500',
                    chair: 'bg-emerald-300/80',
                    text: 'text-emerald-800'
                  },
                  busy: {
                    bg: 'bg-surface',
                    border: 'border-primary/30',
                    dot: 'bg-primary',
                    chair: 'bg-primary/30',
                    text: 'text-primary'
                  }
                };
                const colors = statusColors[s] || statusColors.empty;
                return (
                  <div
                    key={table.number}
                    className="relative aspect-square flex items-center justify-center group select-none transition-transform duration-200"
                  >
                    {/* Chairs */}
                    <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2.5 rounded-t-full transition-colors duration-300", colors.chair)} />
                    <div className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-2.5 rounded-b-full transition-colors duration-300", colors.chair)} />
                    <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-8 rounded-l-full transition-colors duration-300", colors.chair)} />
                    <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-8 rounded-r-full transition-colors duration-300", colors.chair)} />
                    
                    {/* Round Table Container */}
                    <div
                      onClick={() => table.status !== 'empty' ? setSelectedTable(table) : setQrForTable(table.number)}
                      className={cn(
                        "w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex flex-col items-center justify-center relative cursor-pointer shadow-md transition-all duration-300 group-hover:scale-105 active:scale-95 overflow-hidden",
                        colors.bg, colors.border
                      )}
                    >
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">Bàn</span>
                      <span className={cn("text-lg sm:text-2xl font-black tracking-tighter leading-none my-0.5", colors.text)}>{table.number}</span>
                      
                      {/* Status Dot */}
                      <div className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                        <span className="text-[6px] font-black uppercase tracking-wider text-slate-400">
                          {s === 'empty' ? 'TRỐNG' : s === 'pending' ? 'MỚI' : s === 'preparing' ? 'NẤU' : s === 'ready' ? 'XONG' : 'ĐANG'}
                        </span>
                      </div>

                      {/* Hover Action Menu */}
                      <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-1 p-1 z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQrForTable(table.number);
                          }}
                          className="px-2 py-0.5 rounded bg-primary text-white text-[8px] font-black uppercase tracking-wide hover:bg-primary-hover active:scale-90 transition-all"
                        >
                          Mã QR
                        </button>
                        {table.status !== 'empty' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTable(table);
                            }}
                            className="px-2 py-0.5 rounded bg-white text-slate-800 text-[8px] font-black uppercase tracking-wide hover:bg-slate-100 active:scale-90 transition-all"
                          >
                            Xem Đơn
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="hidden lg:flex w-80 xl:w-96 sticky top-4 self-start max-h-[calc(100vh-40px)] overflow-hidden flex-col bg-surface rounded-[2.5rem] shadow-premium border border-slate-50">
             <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-surface-container-low/50">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
                      <BellRing size={14} />
                   </div>
                   <p className="text-xs font-black uppercase tracking-widest">Đơn hàng mới nhận</p>
                </div>
                <Badge variant="secondary" className="bg-surface text-[10px]">{tables.reduce((acc, t) => acc + t.orders.length, 0)} Đơn</Badge>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {tables.flatMap(t => t.orders).filter(o => o.status !== 'completed' && o.status !== 'paid').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => (
                  <div key={order.id} className="bg-surface-container-low/50 rounded-2xl p-4 border border-white hover:border-primary/20 transition-all group">
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col gap-0.5 items-start min-w-0">
                          <Badge className={cn("text-[9px] font-black text-white", 
                            order.status === 'pending' ? "bg-amber-500" : 
                            order.status === 'preparing' ? "bg-indigo-500" : "bg-emerald-500")}>
                            BÀN {order.tableNumber}
                          </Badge>
                          {order.customerName && <p className="text-[9px] font-black text-primary/80 truncate max-w-full">👤 {order.customerName.split(' ')[0]}</p>}
                        </div>
                        <span className="text-[8px] font-black text-slate-300 uppercase shrink-0 ml-2">{elapsed(order.createdAt)}</span>
                     </div>
                     <div className="space-y-1 mb-3">
                        {order.items.map((it, i) => (
                          <p key={i} className="text-xs font-bold text-on-surface truncate"><span className="text-primary mr-1">{it.quantity}×</span> {it.product.name}</p>
                        ))}
                     </div>
                     
                     <div className="flex gap-2">
                        {order.status === 'pending' && <Button size="sm" className="flex-1 h-8 text-[10px] font-black bg-amber-500 text-white" onClick={() => handleUpdateStatus(order.id, 'preparing')}>TIẾP NHẬN</Button>}
                        {order.status === 'preparing' && <Button size="sm" className="flex-1 h-8 text-[10px] font-black bg-indigo-500 text-white" onClick={() => handleUpdateStatus(order.id, 'ready')}>NẤU XONG</Button>}
                        {order.status === 'ready' && <Button size="sm" className="flex-1 h-8 text-[10px] font-black bg-emerald-500 text-white" onClick={() => handleUpdateStatus(order.id, 'completed')}>ĐÃ GIAO</Button>}
                     </div>
                  </div>
                ))}
                {!loading && tables.every(t => t.orders.length === 0) && (
                  <div className="py-20 text-center opacity-20">
                     <ChefHat size={40} className="mx-auto mb-2" />
                     <p className="text-[10px] font-black uppercase tracking-widest">Không có đơn mới</p>
                  </div>
                )}
             </div>
          </aside>
        </div>

        {/* Mobile Live Feed Section */}
        <div className="lg:hidden mt-12 space-y-6">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
                    <BellRing size={14} />
                 </div>
                 <h3 className="text-xs font-black uppercase tracking-widest">Đơn hàng mới nhất</h3>
              </div>
              <Badge variant="secondary" className="bg-surface text-[10px]">{tables.reduce((acc, t) => acc + t.orders.filter(o => o.status !== 'completed' && o.status !== 'paid').length, 0)} Đơn</Badge>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tables.flatMap(t => t.orders).filter(o => o.status !== 'completed' && o.status !== 'paid').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => (
                <div key={order.id} className="bg-surface rounded-3xl p-5 border border-slate-100 shadow-sm transition-all active:scale-[0.98]">
                   <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge className={cn("text-[10px] font-black text-white px-3 py-1", 
                          order.status === 'pending' ? "bg-amber-500" : 
                          order.status === 'preparing' ? "bg-indigo-500" : "bg-emerald-500")}>
                          BÀN {order.tableNumber}
                        </Badge>
                        {order.customerName && <p className="text-[10px] font-black text-primary px-1 mt-1">👤 {order.customerName}</p>}
                      </div>
                      <span className="text-[9px] font-black text-slate-300 uppercase">{elapsed(order.createdAt)}</span>
                   </div>
                   <div className="space-y-1.5 mb-4">
                      {order.items.map((it, i) => (
                        <p key={i} className="text-sm font-bold text-on-surface truncate"><span className="text-primary mr-1">{it.quantity}×</span> {it.product.name}</p>
                      ))}
                   </div>
                   
                   <div className="flex gap-2">
                      {order.status === 'pending' && <Button className="flex-1 h-10 rounded-xl text-xs font-black bg-amber-500 text-white" onClick={() => handleUpdateStatus(order.id, 'preparing')}>TIẾP NHẬN</Button>}
                      {order.status === 'preparing' && <Button className="flex-1 h-10 rounded-xl text-xs font-black bg-indigo-500 text-white" onClick={() => handleUpdateStatus(order.id, 'ready')}>NẤU XONG</Button>}
                      {order.status === 'ready' && <Button className="flex-1 h-10 rounded-xl text-xs font-black bg-emerald-500 text-white" onClick={() => handleUpdateStatus(order.id, 'completed')}>ĐÃ GIAO</Button>}
                   </div>
                </div>
              ))}
              {tables.every(t => t.orders.filter(o => o.status !== 'completed' && o.status !== 'paid').length === 0) && (
                <div className="col-span-full py-12 text-center bg-surface/50 rounded-3xl border border-dashed border-slate-200">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Không có đơn mới</p>
                </div>
              )}
           </div>
        </div>

        <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-[2rem] shadow-2xl">
            {selectedTable && (
              <div className="flex flex-col max-h-[85vh]">
                <div className="p-8 bg-surface-container-low border-b border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-[1.5rem] bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <h4 className="text-3xl font-black tracking-tighter">{selectedTable.number}</h4>
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-black text-on-surface tracking-tight">Chi tiết bàn phục vụ</DialogTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[9px]">{selectedTable.orders.length} Đơn hàng</Badge>
                          <span className="text-xs font-bold text-slate-500">Khách ngồi được {elapsed(selectedTable.lastUpdate)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tạm tính</p>
                       <p className="text-3xl font-black text-primary tracking-tighter">{Intl.NumberFormat('vi-VN').format(selectedTable.totalAmount)}đ</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                  {selectedTable.orders.map((order) => (
                    <div key={order.id} className="relative pl-8 border-l-2 border-slate-100">
                       <div className={cn(
                         "absolute -left-[11px] top-0 w-5 h-5 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-100",
                         order.status === 'pending' ? "bg-amber-400" : 
                         order.status === 'preparing' ? "bg-indigo-500" :
                         order.status === 'ready' ? "bg-emerald-500" : "bg-primary"
                       )} />

                       <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                          <div className="flex-1 space-y-4">
                             <div className="flex flex-col">
                               <div className="flex items-center gap-3">
                                  <span className="text-sm font-black text-on-surface">Đơn #{order.id}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                               {order.customerName && (
                                 <p className="text-[10px] font-black text-primary mt-1 flex items-center gap-1.5">
                                   👤 {order.customerName} 
                                   {order.customerPhone && <span className="text-slate-300 font-normal">| {order.customerPhone}</span>}
                                 </p>
                               )}
                             </div>

                            <div className="bg-surface-container-low rounded-2xl p-4 space-y-3">
                               {order.items.map((item, i) => (
                                 <div key={i} className="flex justify-between items-center">
                                    <p className="text-sm font-bold text-on-surface">
                                       <span className="text-primary mr-2">{item.quantity}×</span>
                                       {item.product.name}
                                    </p>
                                    <span className="text-xs font-black text-slate-400">{Intl.NumberFormat('vi-VN').format(parseInt(item.price || '0'))}đ</span>
                                 </div>
                               ))}
                            </div>
                         </div>

                         <div className="w-full md:w-56 flex flex-col gap-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tiến độ phục vụ</p>
                            
                            {order.status === 'pending' && (
                              <Button className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-100" onClick={() => handleUpdateStatus(order.id, 'preparing')} disabled={updatingId === order.id}>
                                {updatingId === order.id ? <Loader2 size={14} className="animate-spin" /> : <ChefHat size={16} className="mr-2" />}
                                Tiếp nhận nấu
                              </Button>
                            )}

                            {order.status === 'preparing' && (
                              <Button className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100" onClick={() => handleUpdateStatus(order.id, 'ready')} disabled={updatingId === order.id}>
                                {updatingId === order.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={16} className="mr-2" />}
                                Báo nấu xong (Sẵn sàng)
                              </Button>
                            )}

                            {order.status === 'ready' && (
                              <Button className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 animate-pulse" onClick={() => handleUpdateStatus(order.id, 'completed')} disabled={updatingId === order.id}>
                                {updatingId === order.id ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={16} className="mr-2" />}
                                Đã giao cho khách
                              </Button>
                            )}

                            {order.status === 'completed' && (
                              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                                <CheckCircle2 size={16} /> Đã hoàn thành
                              </div>
                            )}
                         </div>
                       </div>
                    </div>
                  ))}
                </div>

                <div className="p-8 bg-surface border-t border-slate-100 flex items-center justify-between gap-4">
                   <div className="hidden sm:block">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng cộng các đơn</p>
                      <p className="text-2xl font-black text-primary tracking-tighter">{Intl.NumberFormat('vi-VN').format(selectedTable.totalAmount)}đ</p>
                   </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="flex-1 sm:flex-initial h-12 px-6 rounded-2xl border-indigo-200 text-indigo-700 font-bold"
                      onClick={() => setMergeModal({ source: selectedTable.number, master: '01' })}
                      disabled={processingAction}
                    >
                      Ghép vào bàn khác
                    </Button>
                    {(() => {
                      const slaveSet = new Set<string>();
                      for (const o of selectedTable.orders) {
                        const m = o.mergedFromTableNumber;
                        if (m != null && String(m).trim() !== '') slaveSet.add(String(m).trim());
                      }
                      const slaves = [...slaveSet];
                      if (slaves.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-2 justify-end sm:justify-start">
                          {slaves.map((slave) => (
                            <Button
                              key={`split-slave-${slave}`}
                              variant="outline"
                              className="flex-1 sm:flex-initial h-12 px-4 rounded-2xl border-amber-200 text-amber-700 font-bold text-xs"
                              onClick={() => void splitTableFrom(slave, selectedTable.number)}
                              disabled={processingAction}
                            >
                              Tách bàn {parseInt(slave, 10) || slave}
                            </Button>
                          ))}
                        </div>
                      );
                    })()}
                    <Button variant="outline" className="flex-1 sm:flex-initial h-12 px-8 rounded-2xl border-slate-200 text-slate-500 font-bold" onClick={() => setSelectedTable(null)}>Đóng</Button>
                    <Button 
                      className="flex-1 sm:flex-initial h-12 px-8 rounded-2xl shadow-xl shadow-primary/20 font-black text-base" 
                      onClick={async () => {
                        setUpdatingId(99999); // temporary id for loading
                        try {
                          await api.post(`/orders/merchant/${merchantId}/table/${selectedTable.number}/pay`);
                          setSelectedTable(null);
                          await fetchStatus();
                        } catch (err) {
                          console.error('Pay error:', err);
                        } finally {
                          setUpdatingId(null);
                        }
                      }}
                      disabled={updatingId !== null}
                    >
                      {updatingId === 99999 ? <Loader2 size={16} className="animate-spin" /> : 'Thanh toán & Dọn bàn'}
                    </Button>
                  </div>
                </div>
                <div className="px-8 pb-6">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Tách bill theo món</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTable.orders.map((order) => (
                      <Button
                        key={`split-order-${order.id}`}
                        size="sm"
                        variant="outline"
                        className="text-[10px] font-bold"
                        onClick={() => setSplitModal({ order, itemIds: '', newTable: '' })}
                        disabled={processingAction}
                      >
                        Tách món đơn #{order.id}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
