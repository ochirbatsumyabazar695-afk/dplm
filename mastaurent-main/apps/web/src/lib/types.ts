export type Role = 'DIRECTOR' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'DRIVER' | 'USER';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isPlatformAdmin?: boolean;
  isActive?: boolean;
  avatarUrl: string | null;
  tenantId: string;
};


export type TenantCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  accentColor: string;
  deliveryFee: number;
  minOrder: number;
  etaMinutes: number;
  rating: number;
  category: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  isTemporarilyClosed?: boolean;
  _count: { menuItems: number };
};

export type Tenant = Omit<TenantCard, '_count'> & {
  description: string | null;
  phone: string | null;
  address: string | null;
  openTime: string;
  closeTime: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryRadiusKm?: number;
  openHours?: Record<string, { open: string; close: string; closed?: boolean }> | null;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  isAvailable: boolean;
  isPopular: boolean;
  prepMinutes: number;
  calories: number | null;
  tags: string;
  categoryId: string;
};

export type ModifierOption = { id: string; name: string; priceDelta: number };

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: number;
  options: ModifierOption[];
};

export type MenuItemDetail = MenuItem & {
  category: { id: string; name: string };
  modifierGroups: ModifierGroup[];
};

export type Category = {
  id: string;
  name: string;
  sortOrder?: number;
  menuItems: MenuItem[];
};

export type OrderItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  options: string;
  lineTotal: number;
};

export type OrderType = 'DELIVERY' | 'PICKUP' | 'DINE_IN';

export type Order = {
  id: string;
  orderNo: number;
  type: OrderType;
  /** Хянах холбоосын нууц түлхүүр — URL-д энэ орно, orderNo биш. */
  trackToken: string;
  customerName: string;
  customerPhone: string;
  district: string | null;
  addressLine: string | null;
  note: string | null;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  isPaid: boolean;
  deliveryCode?: string | null;
  createdAt: string;
  table?: { id: string; number: string } | null;
  items: OrderItem[];
};

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';

export type RestaurantTable = {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  note?: string | null;
  qrToken?: string | null;
};

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type Reservation = {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedAt: string;
  reservedTime: string;
  note: string | null;
  status: ReservationStatus;
  reviewNote: string | null;
  createdAt: string;
  table: { id: string; number: string; capacity: number } | null;
};

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type RestaurantRequest = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  accentColor: string;
  note: string | null;
  status: RequestStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  tenantId: string | null;
  createdAt: string;
  /** Зөвхөн админы жагсаалтад ирнэ. */
  account?: { id: string; name: string; email: string; phone: string | null };
};

export type PaymentProvider = 'QPAY' | 'STRIPE' | 'WIRE';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export type Payment = {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  invoiceId: string | null;
  /** Stripe эсвэл Wire төлбөрийн хуудас. */
  checkoutUrl: string | null;
  /** QPay QR — банкны апп руу шилжих түүхий текст. */
  qrText: string | null;
  /** QPay QR зураг, base64. */
  qrImage: string | null;
  paidAt: string | null;
  orderNo: number | null;
  /** Төлсний дараа энэ холбоосоор захиалгаа хянана — нэвтрэх шаардлагагүй. */
  trackToken: string | null;
};

export type PaymentProviders = { qpay: boolean; stripe: boolean; wire?: boolean };


export type Stats = {
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  totalRevenue: number;
  completedOrders: number;
  avgOrder: number;
  topItems: { name: string; quantity: number }[];
};
