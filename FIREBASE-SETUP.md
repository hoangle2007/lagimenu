# 🔔 Firebase Setup — Push Notification cho Merchant

Hướng dẫn cài đặt Firebase Cloud Messaging (FCM) để merchant nhận notification kể cả khi tắt màn hình điện thoại.

---

## Bước 1: Tạo Firebase Project

1. Vào [Firebase Console](https://console.firebase.google.com) → **Create project**
2. Đặt tên project (VD: `lagi-menu`)
3. Tắt Google Analytics (không cần) → **Create project**

---

## Bước 2: Thêm Web App

1. Trong Firebase Console → **Project Settings** → **Add app** → chọn **Web** (`</>`)
2. Đặt tên app (VD: `LagiMenu Web`)
3. Copy đoạn config:

```json
{
  "apiKey": "AIzaSy...",
  "authDomain": "lagi-menu.firebaseapp.com",
  "projectId": "lagi-menu",
  "storageBucket": "lagi-menu.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abc..."
}
```

---

## Bước 3: Lấy VAPID Key (Web Push)

1. **Project Settings** → tab **Cloud Messaging**
2. Cuộn xuống **Web Push certificates**
3. Nếu chưa có → bấm **Generate key pair**
4. Copy **VAPID public key**

---

## Bước 4: Lấy Service Account (Backend)

1. **Project Settings** → **Service Accounts**
2. Bấm **Generate new private key**
3. File JSON được tải về — mở file, lấy 3 giá trị:
   - `project_id`
   - `client_email`
   - `private_key` (giữ nguyên `\n`, bao gồm header/footer `-----BEGIN PRIVATE KEY-----` ... `-----END PRIVATE KEY-----`)

---

## Bước 5: Điền .env Backend

File: `packages/backend/.env`

```env
DATABASE_URL=postgresql://tsh_db:Tsh123qwe@14.225.254.130:5434/lagimenu
PORT=3001
NODE_ENV=development
JWT_SECRET=super-secret-key-123
FRONTEND_URL=http://localhost:3000

# Firebase Cloud Messaging (Push Notifications)
FIREBASE_PROJECT_ID=lagi-menu
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@lagi-menu.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Bước 6: Điền .env Frontend

File: `packages/frontend/.env`

```env
# Dev: bỏ dòng này hoặc comment để dùng proxy Vite (/api → backend). Nếu cần URL tuyệt đối: http://localhost:3001
# VITE_API_URL=http://localhost:3001

# Firebase Cloud Messaging
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=lagi-menu.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lagi-menu
VITE_FIREBASE_STORAGE_BUCKET=lagi-menu.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
VITE_FIREBASE_VAPID_KEY=BDExxx...   # ← VAPID public key từ bước 3
```

---

## Bước 7: Restart Backend

```bash
# Kill server cũ
lsof -ti :3001 | xargs kill -9

# Restart
cd packages/backend
npm run dev
```

Kiểm tra log — thấy dòng này là Firebase init thành công:
```
[PushNotification] Firebase Admin SDK initialized.
```

---

## Bước 8: Test Thực Tế

### Test 1: Đăng ký FCM token
1. Mở dashboard merchant trên Chrome
2. Mở DevTools → Console
3. Đăng nhập → kiểm tra console:
   ```
   [Push] FCM token registered: eyJBM...
   ```
   (hoặc `[Firebase] VITE_FIREBASE_VAPID_KEY not set` nếu chưa config)

### Test 2: Đặt món → nhận notification
1. Mở trình duyệt khác (hoặc tab ẩn) → đặt món
2. Tab dashboard ban đầu phải nhận notification

### Test 3: Tắt màn hình
1. Đóng/c khóa điện thoại
2. Đặt món từ customer menu
3. Kiểm tra notification trên lock screen

---

## Troubleshooting

### Lỗi `[Firebase] VITE_FIREBASE_VAPID_KEY not set`
→ Thêm `VITE_FIREBASE_VAPID_KEY` vào `.env` frontend (bước 6)

### Lỗi `[PushNotification] Firebase credentials not found`
→ Kiểm tra 3 biến trong `.env` backend:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

### Lỗi `[Firebase] Notification permission denied`
→ Browser chặn notification. Vào Settings → Permissions → Allow notification cho site

### Notification không hiện trên iOS
→ Cần thêm app iOS vào Firebase Console + config `GoogleService-Info.plist`
  (App Flutter đã tích hợp FCM sẵn qua `firebase_messaging` plugin)

---

## Kiến trúc Hoàn Chỉnh

```
Khách đặt món
    ↓
POST /api/orders
    ↓
OrdersService.createOrder()
  ├─ Lưu orders + order_items vào DB
  ├─ [MỚI] PushNotificationService.notifyShop()
  │     ├─ Lấy tất cả FCM tokens của shop từ DB
  │     └─ Gửi push qua FCM Server
  │           ↓
  └─ Trả về order cho khách

FCM Server → Push đến Android/iOS/Web
    ↓
Merchant nhận notification
├─ Điện thoại Android → Hiện notification system
├─ iPhone → Hiện notification system (qua APNs)
└─ Desktop Chrome → Hiện notification qua Service Worker
```
