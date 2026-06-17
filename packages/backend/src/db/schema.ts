import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  timestamp,
  index,
  serial,
  doublePrecision,
  uuid,
  numeric,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'paid',
]);

// ──────────────────────────────────────────────────────────────────────────────
// 1. merchants — Cửa hàng / tenant
// ──────────────────────────────────────────────────────────────────────────────

export const merchants = pgTable(
  'merchants',
  {
    id: text('id').primaryKey().notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    name: text('name').notNull(),
    slug: text('slug').unique(),
    slogan: text('slogan'),
    address: text('address'),
    phone: text('phone'),
    logoUrl: text('logo_url'),
    openTime: text('open_time'),
    closeTime: text('close_time'),
    tableCount: integer('table_count').default(10).notNull(),
    bankName: text('bank_name'),
    bankAccount: text('bank_account'),
    bankOwner: text('bank_owner'),
    autoAccept: boolean('auto_accept').default(true).notNull(),
    notifySound: boolean('notify_sound').default(true).notNull(),
    isOpen: boolean('is_open').default(true).notNull(),
    bannerUrl: text('banner_url'),
    qrSecret: text('qr_secret').default('comviet_secret').notNull(),
    googleId: text('google_id').unique(),
    appleId: text('apple_id').unique(),
    role: text('role').default('merchant').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    fcmToken: text('fcm_token'),
    timezone: text('timezone').default('Asia/Ho_Chi_Minh'),
    wifiSsid: text('wifi_ssid'),
    wifiPassword: text('wifi_password'),
    accountStatus: text('account_status').default('approved'),
    openingHoursJson: text('opening_hours_json'),
    featureFlagsJson: text('feature_flags_json'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    geoFenceRadiusM: integer('geo_fence_radius_m'),
    requireCustomerLocation: boolean('require_customer_location')
      .default(false)
      .notNull(),
    /** Cứ N đồng giá trị đơn (sau thanh toán) được 1 điểm; mặc định 1000 */
    loyaltyVndPerPoint: integer('loyalty_vnd_per_point').default(1000).notNull(),
  },
  (table) => [
    index('idx_merchants_email').on(table.email),
    index('idx_merchants_google_id').on(table.googleId),
    index('idx_merchants_apple_id').on(table.appleId),
  ],
);

export const merchantBlockedIps = pgTable(
  'merchant_blocked_ips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    ip: text('ip').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_merchant_blocked_ips_merchant').on(table.merchantId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 2. categories — Danh mục món ăn
// ──────────────────────────────────────────────────────────────────────────────

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_categories_merchant_id').on(table.merchantId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 3. products — Món ăn
// ──────────────────────────────────────────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    price: text('price').notNull(),
    imageUrl: text('image_url'),
    isAvailable: boolean('is_available').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    isNew: boolean('is_new').default(false).notNull(),
    options: text('options'),
    saleEnabled: boolean('sale_enabled').default(false).notNull(),
    saleDiscountType: text('sale_discount_type'),
    saleDiscountValue: numeric('sale_discount_value', {
      precision: 14,
      scale: 2,
    }),
    saleStartsAt: timestamp('sale_starts_at', { withTimezone: true }),
    saleEndsAt: timestamp('sale_ends_at', { withTimezone: true }),
    salePinned: boolean('sale_pinned').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_products_merchant_id').on(table.merchantId),
    index('idx_products_category_id').on(table.categoryId),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// 4. table_sessions — Phiên đặt món theo bàn
// ──────────────────────────────────────────────────────────────────────────────

export const tableSessions = pgTable(
  'table_sessions',
  {
    id: text('id')
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    tableNumber: text('table_number').notNull(),
    status: text('status').default('active').notNull(), // active | completed | paid
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    parentTableNumber: text('parent_table_number'),
  },
  (table) => [
    index('idx_table_sessions_merchant_table').on(
      table.merchantId,
      table.tableNumber,
    ),
    index('idx_table_sessions_active').on(
      table.merchantId,
      table.tableNumber,
      table.status,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// 5. orders — Đơn hàng
// ──────────────────────────────────────────────────────────────────────────────

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    tableNumber: text('table_number').notNull(),
    sessionId: text('session_id'),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    status: text('status').default('pending').notNull(),
    type: text('type').default('order').notNull(),
    totalPrice: text('total_price').notNull(),
    paymentMethod: text('payment_method'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    clientIp: text('client_ip'),
    clientLat: doublePrecision('client_lat'),
    clientLng: doublePrecision('client_lng'),
    clientLocationAccuracyM: doublePrecision('client_location_accuracy_m'),
    billGroupId: text('bill_group_id'),
    mergedIntoOrderId: integer('merged_into_order_id'),
    mergedFromTableNumber: text('merged_from_table_number'),
  },
  (table) => [
    index('idx_orders_merchant_id').on(table.merchantId),
    index('idx_orders_table_number').on(table.merchantId, table.tableNumber),
    index('idx_orders_status').on(table.status),
    index('idx_orders_created_at').on(table.createdAt),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// 6. order_items — Chi tiết món trong đơn
// ──────────────────────────────────────────────────────────────────────────────

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey().notNull(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').default(1).notNull(),
    price: text('price').notNull(),
    note: text('note'),
    notes: text('notes'),
    splitFromItemId: integer('split_from_item_id'),
  },
  (table) => [index('idx_order_items_order_id').on(table.orderId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 7. reviews — Đánh giá
// ──────────────────────────────────────────────────────────────────────────────

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    tableNumber: text('table_number'),
    customerName: text('customer_name'),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_reviews_merchant_id').on(table.merchantId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 8. Employee
// ──────────────────────────────────────────────────────────────────────────────

export const employees = pgTable(
  'Employee',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('userId'),
    merchantId: text('shopId')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    name: text('name'), // Note: name might be missing in Employee table if it's in User
    pin: text('pin').notNull(),
    /** Staff socket notification audience: all | waiter | cashier | kitchen */
    notifyRole: text('notifyRole').notNull().default('all'),
    isActive: boolean('isActive').default(true).notNull(),
    fcmToken: text('fcm_token'),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_employee_merchant_id').on(table.merchantId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 9. ChatMessage
// ──────────────────────────────────────────────────────────────────────────────

export const chatMessages = pgTable(
  'ChatMessage',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    senderType: text('sender_type').notNull(), // 'customer' | 'staff'
    senderName: text('sender_name').notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_chatmessage_merchant_id').on(table.merchantId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 10. Notification
// ──────────────────────────────────────────────────────────────────────────────

export const notifications = pgTable(
  'Notification',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_notification_merchant_id').on(table.merchantId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 11. Shift
// ──────────────────────────────────────────────────────────────────────────────

export const shifts = pgTable(
  'Shift',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: text('status').default('scheduled').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_shift_merchant_id').on(table.merchantId)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 12. SupportRequest
// ──────────────────────────────────────────────────────────────────────────────

export const supportRequests = pgTable(
  'SupportRequest',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    status: text('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_supportrequest_merchant_id').on(table.merchantId)],
);

export const loyaltyAccounts = pgTable(
  'loyalty_accounts',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerPhone: text('customer_phone').notNull(),
    customerName: text('customer_name'),
    points: integer('points').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_loyalty_accounts_merchant_phone').on(table.merchantId, table.customerPhone),
  ],
);

export const loyaltyRewards = pgTable(
  'loyalty_rewards',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    /** Món trong menu (nước / topping…) mà quà đổi tham chiếu — tuỳ chọn */
    productId: integer('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    highlightLabel: text('highlight_label'),
    pointsCost: integer('points_cost').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_loyalty_rewards_merchant_active').on(
      table.merchantId,
      table.active,
      table.sortOrder,
    ),
  ],
);

export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    customerPhone: text('customer_phone').notNull(),
    deltaPoints: integer('delta_points').notNull(),
    reason: text('reason').notNull().default('order_paid'),
    rewardId: integer('reward_id').references(() => loyaltyRewards.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_loyalty_transactions_merchant_phone').on(table.merchantId, table.customerPhone),
    index('idx_loyalty_transactions_order_id').on(table.orderId),
  ],
);

// ──────────────────────────────────────────────────────────────────────────────
// 12b. Customer — tài khoản khách (đặt món / lưu thông tin)
// ──────────────────────────────────────────────────────────────────────────────

export const customers = pgTable(
  'Customer',
  {
    id: text('id').primaryKey().notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_customer_email').on(table.email)],
);

// ──────────────────────────────────────────────────────────────────────────────
// 13. User
// ──────────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'User',
  {
    id: text('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: text('role').default('EMPLOYEE').notNull(),
    fcmToken: text('fcm_token'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_user_email').on(table.email)],
);

// ──────────────────────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// push_subscriptions — Web Push (VAPID) per merchant browser
// ──────────────────────────────────────────────────────────────────────────────

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_push_subscriptions_merchant_id').on(table.merchantId)],
);

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey().notNull(),
  key: text('key').notNull().unique(),
  value: text('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const staffInvites = pgTable(
  'staff_invites',
  {
    id: serial('id').primaryKey().notNull(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    role: text('role').notNull().default('waiter'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_staff_invites_merchant_id').on(table.merchantId)],
);

export const merchantsRelations = relations(merchants, ({ many }) => ({
  categories: many(categories),
  products: many(products),
  orders: many(orders),
  reviews: many(reviews),
  employees: many(employees),
  chatMessages: many(chatMessages),
  notifications: many(notifications),
  shifts: many(shifts),
  supportRequests: many(supportRequests),
  users: many(users),
  tableSessions: many(tableSessions),
  pushSubscriptions: many(pushSubscriptions),
  loyaltyAccounts: many(loyaltyAccounts),
  loyaltyTransactions: many(loyaltyTransactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [categories.merchantId],
    references: [merchants.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [products.merchantId],
    references: [merchants.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}));

export const tableSessionsRelations = relations(tableSessions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [tableSessions.merchantId],
    references: [merchants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [orders.merchantId],
    references: [merchants.id],
  }),
  items: many(orderItems),
  loyaltyTransactions: many(loyaltyTransactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  merchant: one(merchants, {
    fields: [reviews.merchantId],
    references: [merchants.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [employees.merchantId],
    references: [merchants.id],
  }),
  shifts: many(shifts),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  merchant: one(merchants, {
    fields: [chatMessages.merchantId],
    references: [merchants.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  merchant: one(merchants, {
    fields: [notifications.merchantId],
    references: [merchants.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  merchant: one(merchants, {
    fields: [shifts.merchantId],
    references: [merchants.id],
  }),
  employee: one(employees, {
    fields: [shifts.employeeId],
    references: [employees.id],
  }),
}));

export const supportRequestsRelations = relations(
  supportRequests,
  ({ one }) => ({
    merchant: one(merchants, {
      fields: [supportRequests.merchantId],
      references: [merchants.id],
    }),
  }),
);

export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ one }) => ({
  merchant: one(merchants, {
    fields: [loyaltyAccounts.merchantId],
    references: [merchants.id],
  }),
}));

export const loyaltyTransactionsRelations = relations(
  loyaltyTransactions,
  ({ one }) => ({
    merchant: one(merchants, {
      fields: [loyaltyTransactions.merchantId],
      references: [merchants.id],
    }),
    order: one(orders, {
      fields: [loyaltyTransactions.orderId],
      references: [orders.id],
    }),
  }),
);

export const usersRelations = relations(users, ({ one }) => ({
  merchant: one(merchants, {
    fields: [users.merchantId],
    references: [merchants.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    merchant: one(merchants, {
      fields: [pushSubscriptions.merchantId],
      references: [merchants.id],
    }),
  }),
);
