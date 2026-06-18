import React from 'react';

interface InvoiceTemplateProps {
  merchantName: string;
  tableNumber: string;
  orderId: number | string;
  items: Array<{
    product: { name: string; price: string | number };
    quantity: number;
    note?: string;
    notes?: string;
  }>;
  totalPrice: string | number;
  createdAt: string;
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>((props, ref) => {
  const { merchantName, tableNumber, orderId, items, totalPrice, createdAt } = props;
  const getNote = (item: { note?: string; notes?: string }) => item.note ?? item.notes ?? '';

  return (
    <div ref={ref} className="p-4 bg-surface text-black font-mono text-[12px] w-[80mm] mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold uppercase">{merchantName}</h1>
        <p className="text-[10px]">Hóa Đơn Bán Hàng</p>
        <div className="border-b border-dashed border-black my-2" />
      </div>

      <div className="space-y-1 mb-4">
        <div className="flex justify-between">
          <span>Bàn:</span>
          <span className="font-bold">{tableNumber || 'Tại quầy'}</span>
        </div>
        <div className="flex justify-between">
          <span>HĐ:</span>
          <span>#{orderId}</span>
        </div>
        <div className="flex justify-between">
          <span>Ngày:</span>
          <span>{new Date(createdAt).toLocaleString('vi-VN')}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-2" />

      <table className="w-full text-left mb-4">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1">Món</th>
            <th className="py-1 text-right">SL</th>
            <th className="py-1 text-right">Giá</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <tr>
                <td className="py-1 uppercase font-bold">{item.product.name}</td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">
                  {Intl.NumberFormat('vi-VN').format(+item.product.price)}
                </td>
              </tr>
              {getNote(item) && (
                <tr>
                  <td colSpan={3} className="text-[10px] italic pb-1">
                     ghi chú: {getNote(item)}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="border-b border-dashed border-black my-2" />

      <div className="space-y-1">
        <div className="flex justify-between text-base font-bold">
          <span>TỔNG TIỀN:</span>
          <span>{Intl.NumberFormat('vi-VN').format(+totalPrice)}đ</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-4" />

      <div className="text-center space-y-1">
        <p className="font-bold">CẢM ƠN QUÝ KHÁCH!</p>
        <p className="text-[10px]">Hẹn gặp lại quý khách lần sau</p>
        <p className="text-[8px] opacity-50">Powered by KivoMenu.vn</p>
      </div>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';
