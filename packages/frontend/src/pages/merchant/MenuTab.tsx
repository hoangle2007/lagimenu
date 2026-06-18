import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { arrayMove } from '@dnd-kit/sortable';
import {
  Plus, Search, Tag, Coffee, Pencil, Trash2, ChevronDown, ChevronRight,
  AlertCircle, Package, EyeOff, Loader2, Check, ArrowUp, ArrowDown, Pin, Percent,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Badge, Card, CardContent,
  Input, Label, Textarea, Switch, Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Tooltip, TooltipProvider, TooltipTrigger, TooltipContent,
  Avatar, AvatarImage, AvatarFallback,
} from '../../components/ui';

interface Product {
  id: number;
  name: string;
  price: string;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  categoryId: number;
  options?: string;
  saleEnabled?: boolean;
  saleDiscountType?: string | null;
  saleDiscountValue?: string | number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  salePinned?: boolean;
  saleActive?: boolean;
  discountLabel?: string | null;
}

interface Category {
  id: number;
  name: string;
  order: number;
  products: Product[];
}


type ProdFormState = {
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  categoryId: number;
  isAvailable: boolean;
  options: string;
  saleEnabled: boolean;
  saleDiscountType: 'percent' | 'amount';
  saleDiscountValue: string;
  saleStartsAtLocal: string;
  saleEndsAtLocal: string;
  salePinned: boolean;
};

const EMPTY_PROD: ProdFormState = {
  name: '',
  price: '',
  description: '',
  imageUrl: '',
  categoryId: 0,
  isAvailable: true,
  options: JSON.stringify({ sizes: [], toppings: [], sugarLevels: [] }),
  saleEnabled: false,
  saleDiscountType: 'percent',
  saleDiscountValue: '10',
  saleStartsAtLocal: '',
  saleEndsAtLocal: '',
  salePinned: false,
};

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildProductApiBody(form: ProdFormState, categoryId: number) {
  return {
    categoryId,
    name: form.name.trim(),
    price: form.price,
    description: form.description.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    isAvailable: form.isAvailable,
    options: JSON.parse(form.options || '{}'),
    saleEnabled: form.saleEnabled,
    saleDiscountType: form.saleEnabled ? form.saleDiscountType : null,
    saleDiscountValue:
      form.saleEnabled && form.saleDiscountValue.trim()
        ? Number(form.saleDiscountValue.replace(',', '.'))
        : null,
    saleStartsAt:
      form.saleEnabled && form.saleStartsAtLocal.trim()
        ? new Date(form.saleStartsAtLocal).toISOString()
        : null,
    saleEndsAt:
      form.saleEnabled && form.saleEndsAtLocal.trim()
        ? new Date(form.saleEndsAtLocal).toISOString()
        : null,
    salePinned: form.salePinned,
  };
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function validateProductImage(file: File): string | null {
  if (file.size > MAX_IMAGE_SIZE) return 'Ảnh tối đa 5MB.';
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return 'Chỉ dùng JPEG, PNG hoặc WebP.';
  }
  return null;
}

function uploadImageErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join(', ');
  }
  return 'Không tải được ảnh. Vui lòng thử lại.';
}

export const MenuTab: React.FC<{ merchantId: string }> = ({ merchantId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [filterSaleOnly, setFilterSaleOnly] = useState(false);
  const [filterHiddenOnly, setFilterHiddenOnly] = useState(false);

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // Product dialog
  const [prodDialog, setProdDialog] = useState(false);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [prodCatId, setProdCatId] = useState(0);
  const [prodForm, setProdForm] = useState<ProdFormState>({ ...EMPTY_PROD });
  const [savingProd, setSavingProd] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'cat' | 'prod'; id: number; catId?: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedProdIds, setSelectedProdIds] = useState<Set<number>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkSaleOpen, setBulkSaleOpen] = useState(false);
  const [bulkSaleSaving, setBulkSaleSaving] = useState(false);
  const [bulkSaleForm, setBulkSaleForm] = useState({
    saleDiscountType: 'percent' as 'percent' | 'amount',
    saleDiscountValue: '10',
    saleStartsAtLocal: '',
    saleEndsAtLocal: '',
    salePinned: false,
  });

  const fetchMenu = useCallback(async () => {
    try {
      const res = await api.get(`/menu/merchant/${merchantId}/categories`);
      const cats = Array.isArray(res.data) ? res.data : [];
      setCategories(
        cats.map((c: any) => ({
          ...c,
          products: (c.products ?? []).map((p: any) => ({
            ...p,
            categoryId: c.id,
          })),
        })),
      );
      if (cats.length > 0) setExpandedCats(prev => new Set([...prev, ...cats.map((c: any) => c.id)]));
    } catch {
      toast.error('Không tải được menu. Vui lòng thử lại!');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const openCatDialog = (cat?: Category) => {
    setEditCat(cat ?? null);
    setCatName(cat?.name ?? '');
    setCatDialog(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      if (editCat) {
        await api.put(`/menu/merchant/${merchantId}/categories/${editCat.id}`, { name: catName });
        toast.success('Đã cập nhật danh mục!');
      } else {
        await api.post(`/menu/merchant/${merchantId}/categories`, { name: catName, order: categories.length });
        toast.success('Đã thêm danh mục!');
      }
      setCatDialog(false);
      // Reload từ server để đảm bảo danh sách luôn đồng bộ
      await fetchMenu();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Lưu danh mục thất bại. Vui lòng thử lại!';
      toast.error(msg);
    } finally {
      setSavingCat(false);
    }
  };

  const openProdDialog = (catId: number, prod?: Product) => {
    setEditProd(prod ?? null);
    setProdCatId(catId);
    if (prod) {
      setProdForm({
        name: prod.name,
        price: prod.price,
        description: prod.description ?? '',
        imageUrl: prod.imageUrl ?? '',
        categoryId: prod.categoryId,
        isAvailable: prod.isAvailable,
        options: prod.options || EMPTY_PROD.options,
        saleEnabled: prod.saleEnabled ?? false,
        saleDiscountType: prod.saleDiscountType === 'amount' ? 'amount' : 'percent',
        saleDiscountValue:
          prod.saleDiscountValue != null && prod.saleDiscountValue !== ''
            ? String(prod.saleDiscountValue)
            : '10',
        saleStartsAtLocal: isoToDatetimeLocal(prod.saleStartsAt ?? undefined),
        saleEndsAtLocal: isoToDatetimeLocal(prod.saleEndsAt ?? undefined),
        salePinned: prod.salePinned ?? false,
      });
    } else {
      setProdForm({ ...EMPTY_PROD, categoryId: catId });
    }
    setProdDialog(true);
  };

  const saveProd = async () => {
    if (!prodForm.name.trim() || !prodForm.price) return;
    setSavingProd(true);
    const categoryId = editProd ? prodForm.categoryId : prodCatId;
    const body = buildProductApiBody(prodForm, categoryId);
    try {
      if (editProd) {
        const res = await api.put(`/menu/merchant/${merchantId}/products/${editProd.id}`, body);
        const raw = res.data as Product & { options?: unknown };
        const np: Product = {
          ...raw,
          categoryId: body.categoryId,
          options:
            typeof raw?.options === 'string'
              ? raw.options
              : JSON.stringify(raw?.options ?? {}),
        };
        setCategories((p) =>
          p.map((c) => ({
            ...c,
            products: c.products.map((pr) => (pr.id === editProd.id ? np : pr)),
          })),
        );
      } else {
        const res = await api.post(`/menu/merchant/${merchantId}/products`, body);
        const raw = res.data as Product & { options?: unknown };
        const np: Product = {
          ...raw,
          categoryId: prodCatId,
          options:
            typeof raw?.options === 'string'
              ? raw.options
              : JSON.stringify(raw?.options ?? {}),
        };
        setCategories((p) =>
          p.map((c) => (c.id === prodCatId ? { ...c, products: [...c.products, np] } : c)),
        );
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Lưu món thất bại. Vui lòng thử lại!';
      toast.error(msg);
    } finally {
      setSavingProd(false);
      setProdDialog(false);
    }
  };

  useEffect(() => {
    if (!prodDialog) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const bad = validateProductImage(file);
            if (bad) {
              toast.error(bad);
              return;
            }
            setSavingProd(true);
            try {
              const formData = new FormData();
              formData.append('file', file);
              const res = await api.post('/upload/image', formData);
              setProdForm(p => ({ ...p, imageUrl: res.data.url }));
            } catch (err) {
              console.error('Upload failed:', err);
              toast.error(uploadImageErrorMessage(err));
            } finally {
              setSavingProd(false);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [prodDialog]);

  useEffect(() => {
    // If dialog is open, the other effect covers it.
    if (prodDialog || catDialog) return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            // Pick a category to add to
            const firstCatId = categories.length > 0 ? categories[0].id : 0;
            if (!firstCatId) return;

            // Open dialog
            openProdDialog(firstCatId);
            
            // Wait for form to reset then set image
            // We use functional update to be safe if form state updates synchronously
            const bad = validateProductImage(file);
            if (bad) {
              toast.error(bad);
              return;
            }
            setSavingProd(true);
            try {
              const formData = new FormData();
              formData.append('file', file);
              const res = await api.post('/upload/image', formData);
              setProdForm(p => ({ ...p, imageUrl: res.data.url }));
            } catch (err) {
              console.error('Upload failed:', err);
              toast.error(uploadImageErrorMessage(err));
            } finally {
              setSavingProd(false);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [prodDialog, catDialog, categories, openProdDialog]);

  const toggleAvail = async (prod: Product) => {
    const val = !prod.isAvailable;
    setCategories(p => p.map(c => ({ ...c, products: c.products.map(pr => pr.id === prod.id ? { ...pr, isAvailable: val } : pr) })));
    try {
      await api.patch(`/menu/merchant/${merchantId}/products/${prod.id}`, { isAvailable: val });
    } catch {
      try {
        await api.put(`/menu/merchant/${merchantId}/products/${prod.id}`, { isAvailable: val });
      } catch { /* demo */ }
    }
  };

  const toggleProdSelect = (id: number) => {
    setSelectedProdIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const moveCategory = async (catId: number, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === catId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= categories.length) return;
    const prev = categories;
    const next = arrayMove(categories, idx, j);
    setCategories(next);
    try {
      await api.put(`/menu/merchant/${merchantId}/categories/reorder`, { orderedIds: next.map((c) => c.id) });
    } catch {
      setCategories(prev);
    }
  };

  const applyBulkPrice = async () => {
    const p = bulkPrice.trim();
    if (!p || selectedProdIds.size === 0) return;
    const items = [...selectedProdIds].map((id) => ({ id, price: p }));
    try {
      await api.patch(`/menu/merchant/${merchantId}/products/bulk-price`, { items });
      setCategories((cats) =>
        cats.map((c) => ({
          ...c,
          products: c.products.map((pr) =>
            selectedProdIds.has(pr.id) ? { ...pr, price: p } : pr,
          ),
        })),
      );
      setSelectedProdIds(new Set());
      setBulkPrice('');
    } catch { /* ignore */ }
  };

  const applyBulkSale = async () => {
    if (selectedProdIds.size === 0) return;
    const v = Number(bulkSaleForm.saleDiscountValue.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Nhập giá trị giảm hợp lệ');
      return;
    }
    setBulkSaleSaving(true);
    const ids = [...selectedProdIds];
    const payload = {
      saleEnabled: true,
      saleDiscountType: bulkSaleForm.saleDiscountType,
      saleDiscountValue: v,
      saleStartsAt:
        bulkSaleForm.saleStartsAtLocal.trim()
          ? new Date(bulkSaleForm.saleStartsAtLocal).toISOString()
          : null,
      saleEndsAt:
        bulkSaleForm.saleEndsAtLocal.trim()
          ? new Date(bulkSaleForm.saleEndsAtLocal).toISOString()
          : null,
      salePinned: bulkSaleForm.salePinned,
    };
    try {
      for (const id of ids) {
        await api.patch(`/menu/merchant/${merchantId}/products/${id}`, payload);
      }
      await fetchMenu();
      toast.success(`Đã bật sale cho ${ids.length} món`);
      setSelectedProdIds(new Set());
      setBulkSaleOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Không áp dụng sale hàng loạt được. Kiểm tra giá món / % / thời gian.');
    } finally {
      setBulkSaleSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      if (deleteDialog.type === 'cat') {
        await api.delete(`/menu/merchant/${merchantId}/categories/${deleteDialog.id}`);
        setCategories(p => p.filter(c => c.id !== deleteDialog.id));
      } else {
        await api.delete(`/menu/merchant/${merchantId}/products/${deleteDialog.id}`);
        setCategories(p => p.map(c => ({ ...c, products: c.products.filter(pr => pr.id !== deleteDialog.id) })));
      }
    } catch {
      if (deleteDialog.type === 'cat') setCategories(p => p.filter(c => c.id !== deleteDialog.id));
      else setCategories(p => p.map(c => ({ ...c, products: c.products.filter(pr => pr.id !== deleteDialog.id) })));
    } finally {
      setDeleting(false);
      setDeleteDialog(null);
    }
  };

  const totalProducts = categories.reduce((s, c) => s + c.products.length, 0);
  const hiddenProducts = categories.reduce((s, c) => s + c.products.filter(p => !p.isAvailable).length, 0);
  const saleProducts = categories.reduce((s, c) => s + c.products.filter(p => p.saleActive).length, 0);

  const filtered = categories
    .map(c => {
      let prods = c.products ?? [];
      if (search) {
        prods = prods.filter(p => p?.name?.toLowerCase().includes(search.toLowerCase()));
      }
      if (filterSaleOnly) {
        prods = prods.filter(p => p.saleActive);
      }
      if (filterHiddenOnly) {
        prods = prods.filter(p => !p.isAvailable);
      }
      return { ...c, products: prods };
    })
    // Chỉ ẩn category khi đang lọc theo search/sale/hidden và không còn sản phẩm nào khớp
    // Không ẩn category rỗng khi không có bộ lọc nào (category mới tạo chưa có món)
    .filter(c => {
      const isFiltering = !!search || filterSaleOnly || filterHiddenOnly;
      return isFiltering ? c.products.length > 0 : true;
    });

  if (loading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={24} /></div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* ─── Top Stats ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Danh mục',
              value: categories.length,
              icon: <Tag size={15} />,
              color: 'text-primary',
              isActive: !filterSaleOnly && !filterHiddenOnly,
              onClick: () => {
                setFilterSaleOnly(false);
                setFilterHiddenOnly(false);
              }
            },
            {
              label: 'Tổng món',
              value: totalProducts,
              icon: <Package size={15} />,
              color: 'text-slate-700',
              isActive: !filterSaleOnly && !filterHiddenOnly,
              onClick: () => {
                setFilterSaleOnly(false);
                setFilterHiddenOnly(false);
              }
            },
            {
              label: 'Đang ẩn',
              value: hiddenProducts,
              icon: <EyeOff size={15} />,
              color: 'text-amber-600',
              isActive: filterHiddenOnly,
              onClick: () => {
                setFilterHiddenOnly(!filterHiddenOnly);
                setFilterSaleOnly(false);
              }
            },
            {
              label: 'Đang giảm giá',
              value: saleProducts,
              icon: <Percent size={15} />,
              color: 'text-red-600',
              isActive: filterSaleOnly,
              onClick: () => {
                setFilterSaleOnly(!filterSaleOnly);
                setFilterHiddenOnly(false);
              }
            },
          ].map((s, i) => (
            <Card
              key={i}
              onClick={s.onClick}
              className={`cursor-pointer transition-all duration-200 border border-slate-100 hover:shadow-md ${
                s.isActive
                  ? 'ring-2 ring-primary shadow-sm bg-primary/[0.02]'
                  : 'hover:bg-slate-50'
              }`}
            >
              <CardContent className="py-4">
                <div className={`flex items-center gap-2 mb-2 ${s.color} opacity-80`}>
                  {s.icon}
                  <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                </div>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ─── Lọc Active Banner ─── */}
        {(filterSaleOnly || filterHiddenOnly) && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-2xl px-4 py-2 text-xs font-bold text-primary animate-in fade-in slide-in-from-top-1 duration-200">
            <span>
              Đang lọc hiển thị: {filterSaleOnly ? 'Món đang giảm giá' : 'Món đang ẩn'}
            </span>
            <button
              onClick={() => {
                setFilterSaleOnly(false);
                setFilterHiddenOnly(false);
              }}
              className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-primary transition-colors bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"
            >
              Xóa lọc
            </button>
          </div>
        )}

        {/* ─── Toolbar ─── */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm món..." className="pl-9" />
          </div>
          <Button onClick={() => openCatDialog()} size="sm" className="gap-1.5">
            <Plus size={14} /> Danh mục
          </Button>
          {selectedProdIds.size > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="Giá mới (VD 45000)"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="w-40"
              />
              <Button size="sm" type="button" onClick={() => void applyBulkPrice()}>
                Áp giá ({selectedProdIds.size})
              </Button>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setBulkSaleOpen(true)}
              >
                Bật sale ({selectedProdIds.size})
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setSelectedProdIds(new Set())}>
                Bỏ chọn
              </Button>
            </div>
          )}
        </div>

        {/* ─── Category Blocks ─── */}
        <div className="space-y-4">
          {filtered.map(cat => (
            <Card key={cat.id} className="overflow-hidden">
              {/* Category Header */}
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-surface-container-low transition-colors border-b border-outline-variant/8"
                onClick={() =>
                  setExpandedCats((p) => {
                    const n = new Set(p)
                    if (n.has(cat.id)) n.delete(cat.id)
                    else n.add(cat.id)
                    return n
                  })
                }
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Tag size={13} />
                  </div>
                  <span className="font-bold text-sm text-on-surface">{cat.name}</span>
                  <Badge variant="secondary">{cat.products.length} món</Badge>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {!search.trim() && (
                    <>
                      <Button variant="ghost" size="icon-sm" type="button" onClick={() => void moveCategory(cat.id, -1)} title="Lên">
                        <ArrowUp size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" type="button" onClick={() => void moveCategory(cat.id, 1)} title="Xuống">
                        <ArrowDown size={14} />
                      </Button>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" onClick={() => openProdDialog(cat.id)}>
                        <Plus size={14} className="text-primary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Thêm món</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" onClick={() => openCatDialog(cat)}>
                        <Pencil size={13} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sửa danh mục</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteDialog({ type: 'cat', id: cat.id })}>
                        <Trash2 size={13} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Xoá danh mục</TooltipContent>
                  </Tooltip>
                  {expandedCats.has(cat.id) ? <ChevronDown size={14} className="text-slate-400 ml-1" /> : <ChevronRight size={14} className="text-slate-400 ml-1" />}
                </div>
              </div>

              {/* Product Table */}
              {expandedCats.has(cat.id) && (
                cat.products.length === 0 ? (
                  <div className="py-10 text-center">
                    <Coffee size={22} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Chưa có món nào</p>
                    <Button variant="ghost" size="sm" className="mt-3 text-primary" onClick={() => openProdDialog(cat.id)}>
                      <Plus size={12} /> Thêm món đầu tiên
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 pr-0">
                          <span className="sr-only">Chọn</span>
                        </TableHead>
                        <TableHead className="w-10" />
                        <TableHead>Tên món</TableHead>
                        <TableHead className="text-right">Giá</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cat.products.map(prod => (
                        <TableRow key={prod.id} className={!prod.isAvailable ? 'opacity-50' : ''}>
                          <TableCell className="pr-0 w-8">
                            <input
                              type="checkbox"
                              checked={selectedProdIds.has(prod.id)}
                              onChange={() => toggleProdSelect(prod.id)}
                              className="rounded border-slate-300"
                            />
                          </TableCell>
                          <TableCell>
                            <Avatar className="w-9 h-9 rounded-lg">
                              <AvatarImage src={prod.imageUrl} />
                              <AvatarFallback className="rounded-lg text-[10px] bg-surface-container-low text-slate-300">
                                <Plus size={14} />
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-on-surface text-sm">{prod.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {prod.saleActive && (
                                <Badge className="text-[9px] px-1.5 py-0 h-5 bg-red-500 hover:bg-red-500">
                                  SALE
                                </Badge>
                              )}
                              {prod.salePinned && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700" title="Ghim sale">
                                  <Pin size={11} className="shrink-0" />
                                  Ghim
                                </span>
                              )}
                            </div>
                            {prod.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{prod.description}</p>}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-black text-primary text-sm">{Intl.NumberFormat('vi-VN').format(+prod.price)}đ</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={prod.isAvailable}
                                onCheckedChange={() => toggleAvail(prod)}
                              />
                              <span className="text-[10px] font-bold text-slate-400">
                                {prod.isAvailable ? 'Hiển thị' : 'Ẩn'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openProdDialog(cat.id, prod)}>
                                <Pencil size={13} />
                              </Button>
                              <Button variant="ghost" size="icon-sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteDialog({ type: 'prod', id: prod.id })}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}
            </Card>
          ))}

          {filtered.length === 0 && !loading && (
            <Card>
              <CardContent className="py-16 text-center">
                <Coffee size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-400">Chưa có danh mục nào</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => openCatDialog()}>
                  <Plus size={13} /> Tạo danh mục đầu tiên
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Dialog: Category ── */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCat ? 'Sửa danh mục' : 'Tạo danh mục mới'}</DialogTitle>
            <DialogDescription>Nhập tên cho danh mục thực đơn</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
            <Label htmlFor="cat-name">Tên danh mục</Label>
            <Input
              id="cat-name"
              autoFocus
              value={catName}
              onChange={e => setCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveCat()}
              placeholder="Ví dụ: Trà Sữa, Cà Phê..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCatDialog(false)}>Huỷ</Button>
            <Button size="sm" onClick={saveCat} disabled={savingCat || !catName.trim()}>
              {savingCat ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {editCat ? 'Lưu thay đổi' : 'Tạo danh mục'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Product ── */}
      <Dialog open={prodDialog} onOpenChange={setProdDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProd ? 'Sửa thông tin món' : 'Thêm món mới'}</DialogTitle>
            <DialogDescription>
              {editProd ? 'Cập nhật thông tin món trong thực đơn' : 'Điền thông tin để thêm món mới vào thực đơn'}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Hình ảnh món ăn</Label>
                <div 
                  className="relative group h-32 rounded-2xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all overflow-hidden"
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                >
                  {prodForm.imageUrl ? (
                    <img src={prodForm.imageUrl} alt="Product" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Plus size={24} className="text-slate-300 mb-1" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center px-4">Click để tải lên hoặc dán ảnh (Ctrl+V)</span>
                    </>
                  )}
                  {savingProd && (
                    <div className="absolute inset-0 bg-surface/60 flex items-center justify-center">
                      <Loader2 className="animate-spin text-primary" size={20} />
                    </div>
                  )}
                  <input 
                    id="product-image-upload" 
                    type="file" 
                    className="hidden" 
                    accept="image/jpeg,image/png,image/webp" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const bad = validateProductImage(file);
                        if (bad) {
                          toast.error(bad);
                          e.target.value = '';
                          return;
                        }
                        setSavingProd(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await api.post('/upload/image', formData);
                          setProdForm(p => ({ ...p, imageUrl: res.data.url }));
                        } catch (err) {
                          console.error('Upload failed:', err);
                          toast.error(uploadImageErrorMessage(err));
                        } finally {
                          setSavingProd(false);
                          e.target.value = '';
                        }
                      }
                    }} 
                  />
                  {prodForm.imageUrl && (
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                       <Pencil size={20} className="text-white" />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="col-span-2 space-y-1.5">
                <Label>Tên món *</Label>
                <Input value={prodForm.name} onChange={e => setProdForm(p => ({ ...p, name: e.target.value }))} placeholder="Trà Sữa Nhài..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Giá (₫) *</Label>
                <Input type="number" value={prodForm.price} onChange={e => setProdForm(p => ({ ...p, price: e.target.value }))} placeholder="45000" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Mô tả</Label>
                <Textarea
                  value={prodForm.description}
                  onChange={e => setProdForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Hương vị đặc trưng..."
                  rows={2}
                  className="min-h-[60px]"
                />
              </div>
              {/* Product Options Section (Topping/Size) */}
              <div className="col-span-2 pt-4 border-t mt-2">
                <Label className="text-xs font-black uppercase tracking-widest text-primary/60">Tùy chọn món (Topping & Size)</Label>
                <div className="mt-3 space-y-4">
                  {/* Sizes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Kích thước (Size)</p>
                      <Button variant="ghost" size="icon-sm" onClick={() => {
                        const opt = JSON.parse(prodForm.options);
                        opt.sizes.push({ label: 'M', extraPrice: 0 });
                        setProdForm({...prodForm, options: JSON.stringify(opt)});
                      }}><Plus size={12} /></Button>
                    </div>
                    <div className="space-y-2">
                      {(JSON.parse(prodForm.options).sizes || []).map((s: any, idx: number) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input size={10} className="h-8 text-xs" placeholder="Size M" value={s.label} onChange={e => {
                             const opt = JSON.parse(prodForm.options);
                             opt.sizes[idx].label = e.target.value;
                             setProdForm({...prodForm, options: JSON.stringify(opt)});
                          }} />
                          <Input type="number" size={10} className="h-8 text-xs" placeholder="+10000" value={s.extraPrice} onChange={e => {
                             const opt = JSON.parse(prodForm.options);
                             opt.sizes[idx].extraPrice = +e.target.value;
                             setProdForm({...prodForm, options: JSON.stringify(opt)});
                          }} />
                          <Button variant="ghost" size="icon-sm" onClick={() => {
                            const opt = JSON.parse(prodForm.options);
                            opt.sizes.splice(idx, 1);
                            setProdForm({...prodForm, options: JSON.stringify(opt)});
                          }}><Trash2 size={12} className="text-red-400" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Toppings */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Topping đi kèm</p>
                      <Button variant="ghost" size="icon-sm" onClick={() => {
                        const opt = JSON.parse(prodForm.options);
                        opt.toppings.push({ name: '', price: 10000 });
                        setProdForm({...prodForm, options: JSON.stringify(opt)});
                      }}><Plus size={12} /></Button>
                    </div>
                    <div className="space-y-2">
                      {(JSON.parse(prodForm.options).toppings || []).map((t: any, idx: number) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input className="h-8 text-xs" placeholder="Tên topping" value={t.name} onChange={e => {
                             const opt = JSON.parse(prodForm.options);
                             opt.toppings[idx].name = e.target.value;
                             setProdForm({...prodForm, options: JSON.stringify(opt)});
                          }} />
                          <Input type="number" className="h-8 text-xs w-24" placeholder="Giá" value={t.price} onChange={e => {
                             const opt = JSON.parse(prodForm.options);
                             opt.toppings[idx].price = +e.target.value;
                             setProdForm({...prodForm, options: JSON.stringify(opt)});
                          }} />
                          <Button variant="ghost" size="icon-sm" onClick={() => {
                            const opt = JSON.parse(prodForm.options);
                            opt.toppings.splice(idx, 1);
                            setProdForm({...prodForm, options: JSON.stringify(opt)});
                          }}><Trash2 size={12} className="text-red-400" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Khuyến mãi */}
              <div className="col-span-2 pt-4 border-t space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-primary/70">
                  Khuyến mãi
                </Label>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Bật sale theo món</p>
                    <p className="text-xs text-slate-400 mt-0.5">Giảm % hoặc số tiền, có thể hẹn giờ bắt đầu / kết thúc</p>
                  </div>
                  <Switch
                    checked={prodForm.saleEnabled}
                    onCheckedChange={(v) => setProdForm((p) => ({ ...p, saleEnabled: v }))}
                  />
                </div>
                {prodForm.saleEnabled && (
                  <div className="space-y-3 pl-0.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Loại giảm</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={prodForm.saleDiscountType}
                          onChange={(e) =>
                            setProdForm((p) => ({
                              ...p,
                              saleDiscountType: e.target.value === 'amount' ? 'amount' : 'percent',
                            }))
                          }
                        >
                          <option value="percent">Giảm %</option>
                          <option value="amount">Giảm số tiền (đ)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {prodForm.saleDiscountType === 'percent' ? 'Phần trăm' : 'Số tiền (đ)'}
                        </Label>
                        <Input
                          type="number"
                          value={prodForm.saleDiscountValue}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, saleDiscountValue: e.target.value }))
                          }
                          placeholder={prodForm.saleDiscountType === 'percent' ? '15' : '5000'}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bắt đầu (tuỳ chọn)</Label>
                        <Input
                          type="datetime-local"
                          value={prodForm.saleStartsAtLocal}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, saleStartsAtLocal: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Kết thúc (tuỳ chọn)</Label>
                        <Input
                          type="datetime-local"
                          value={prodForm.saleEndsAtLocal}
                          onChange={(e) =>
                            setProdForm((p) => ({ ...p, saleEndsAtLocal: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-on-surface">Ghim món sale</p>
                        <p className="text-[11px] text-slate-500">Ưu tiên hiển thị trên menu khách</p>
                      </div>
                      <Switch
                        checked={prodForm.salePinned}
                        onCheckedChange={(v) => setProdForm((p) => ({ ...p, salePinned: v }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="col-span-2 flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Hiển thị trên menu</p>
                  <p className="text-xs text-slate-400 mt-0.5">Khách có thể thấy và đặt món này</p>
                </div>
                <Switch checked={prodForm.isAvailable} onCheckedChange={v => setProdForm(p => ({ ...p, isAvailable: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProdDialog(false)}>Huỷ</Button>
            <Button size="sm" onClick={saveProd} disabled={savingProd || !prodForm.name.trim() || !prodForm.price}>
              {savingProd ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {editProd ? 'Lưu thay đổi' : 'Thêm món'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Bulk sale ── */}
      <Dialog open={bulkSaleOpen} onOpenChange={setBulkSaleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bật sale hàng loạt</DialogTitle>
            <DialogDescription>
              Áp dụng cho {selectedProdIds.size} món đã chọn. Kiểm tra từng món có giá hợp lệ (giảm tiền không vượt quá giá).
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Loại giảm</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={bulkSaleForm.saleDiscountType}
                  onChange={(e) =>
                    setBulkSaleForm((s) => ({
                      ...s,
                      saleDiscountType: e.target.value === 'amount' ? 'amount' : 'percent',
                    }))
                  }
                >
                  <option value="percent">Giảm %</option>
                  <option value="amount">Giảm số tiền (đ)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Giá trị</Label>
                <Input
                  type="number"
                  value={bulkSaleForm.saleDiscountValue}
                  onChange={(e) =>
                    setBulkSaleForm((s) => ({ ...s, saleDiscountValue: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bắt đầu</Label>
                <Input
                  type="datetime-local"
                  value={bulkSaleForm.saleStartsAtLocal}
                  onChange={(e) =>
                    setBulkSaleForm((s) => ({ ...s, saleStartsAtLocal: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kết thúc</Label>
                <Input
                  type="datetime-local"
                  value={bulkSaleForm.saleEndsAtLocal}
                  onChange={(e) =>
                    setBulkSaleForm((s) => ({ ...s, saleEndsAtLocal: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm">Ghim sale</Label>
              <Switch
                checked={bulkSaleForm.salePinned}
                onCheckedChange={(v) => setBulkSaleForm((s) => ({ ...s, salePinned: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" type="button" onClick={() => setBulkSaleOpen(false)}>
              Huỷ
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={bulkSaleSaving || selectedProdIds.size === 0}
              onClick={() => void applyBulkSale()}
            >
              {bulkSaleSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Áp dụng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Delete Confirm ── */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <DialogTitle>Xác nhận xoá?</DialogTitle>
            </div>
            <DialogDescription>
              {deleteDialog?.type === 'cat'
                ? 'Xoá danh mục này sẽ xoá tất cả các món bên trong. Hành động không thể hoàn tác.'
                : 'Món này sẽ bị xoá vĩnh viễn khỏi thực đơn.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialog(null)}>Huỷ</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Xoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
