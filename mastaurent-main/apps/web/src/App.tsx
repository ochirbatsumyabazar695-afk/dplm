import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { restoreLocalSession } from './store/auth';

import { Landing } from './pages/Landing';
import { ForgotPassword, PlatformLogin, PlatformRegister } from './pages/Auth';
import { RestaurantRequestPage } from './pages/RestaurantRequest';
import { AdminRequests } from './pages/AdminRequests';
import { AdminAccounts, AdminTenants } from './pages/AdminPanel';
import { StorefrontLayout } from './layouts/StorefrontLayout';
import { StorefrontHome } from './pages/storefront/Home';
import { StorefrontMenu } from './pages/storefront/Menu';
import { ItemDetail } from './pages/storefront/ItemDetail';
import { Checkout } from './pages/storefront/Checkout';
import { StorefrontOrders } from './pages/storefront/Orders';
import { OrderTrack } from './pages/storefront/OrderTrack';
import { Pay } from './pages/storefront/Pay';
import { Profile } from './pages/storefront/Profile';
import { Reserve } from './pages/storefront/Reserve';

import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardLogin } from './pages/dashboard/Login';
import { DashboardOrders } from './pages/dashboard/Orders';
import { DashboardMenu } from './pages/dashboard/Menu';
import { DashboardSettings } from './pages/dashboard/Settings';
import { DashboardTables } from './pages/dashboard/Tables';
import { DashboardReservations } from './pages/dashboard/Reservations';
import { KitchenDashboard } from './pages/dashboard/Kitchen';
import { DriverDashboard } from './pages/dashboard/Driver';
import { StaffManagement } from './pages/dashboard/Staff';
import { DispatchDashboard } from './pages/dashboard/Dispatch';
import { useStaffMember } from './store/auth';

export default function App() {
  const location = useLocation();

  // Хуудас сэргээхэд өөрийн сессийг httpOnly cookie-гоор сэргээнэ.
  useEffect(() => {
    void restoreLocalSession();
  }, []);

  // Хуудас солигдоход дээшээ.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<RoleAwareHome />} />

          {/* Платформын нэвтрэлт — ресторанаас хамааралгүй */}
          <Route path="/login/*" element={<PlatformLogin />} />
          <Route path="/register/*" element={<PlatformRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Ресторан нээх хүсэлт + платформын админ */}
          <Route path="/restaurant-request" element={<RestaurantRequestPage />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
          <Route path="/admin/tenants" element={<AdminTenants />} />
          <Route path="/admin/accounts" element={<AdminAccounts />} />

          {/* Ресторан бүрийн дэлгүүр */}
          <Route path="/t/:slug" element={<StorefrontLayout />}>
            <Route index element={<StorefrontHome />} />
            <Route path="menu" element={<StorefrontMenu />} />
            <Route path="item/:id" element={<ItemDetail />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="orders" element={<StorefrontOrders />} />
            <Route path="order/:token" element={<OrderTrack />} />
            <Route path="pay/:paymentId" element={<Pay />} />
            <Route path="reserve" element={<Reserve />} />
            <Route path="profile" element={<Profile />} />
            {/* Нэвтрэлт платформын хэмжээнд болсон тул эдгээр нь чиглүүлэгч. */}
            <Route path="login" element={<Navigate to="/login" replace />} />
            <Route path="register" element={<Navigate to="/register" replace />} />
          </Route>

          {/* Рестораны удирдлага */}
          <Route path="/dashboard/login/*" element={<DashboardLogin />} />
          <Route path="/dashboard/*" element={<DashboardHome />} />

          <Route path="/manager" element={<DashboardLayout roles={['MANAGER']} base="/manager" />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<DashboardOrders />} />
            <Route path="menu" element={<DashboardMenu />} />
            <Route path="tables" element={<DashboardTables />} />
            <Route path="reservations" element={<DashboardReservations />} />
            <Route path="dispatch" element={<DispatchDashboard />} />
          </Route>
          <Route path="/director" element={<DashboardLayout roles={['DIRECTOR']} base="/director" />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<DashboardOrders />} />
            <Route path="menu" element={<DashboardMenu />} />
            <Route path="tables" element={<DashboardTables />} />
            <Route path="reservations" element={<DashboardReservations />} />
            <Route path="dispatch" element={<DispatchDashboard />} />
            <Route path="staff" element={<StaffManagement />} />
            <Route path="settings" element={<DashboardSettings />} />
          </Route>
          <Route path="/kitchen" element={<DashboardLayout roles={['KITCHEN']} base="/kitchen" />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<KitchenDashboard />} />
          </Route>
          <Route path="/cashier" element={<DashboardLayout roles={['CASHIER']} base="/cashier" />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<DashboardOrders />} />
          </Route>
          <Route path="/driver" element={<DashboardLayout roles={['DRIVER']} base="/driver" />}>
            <Route index element={<Navigate to="deliveries" replace />} />
            <Route path="deliveries" element={<DriverDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

function DashboardHome() {
  const { user, isSignedIn, ready } = useStaffMember();
  if (!ready) return null;
  // Нэвтрээгүй бол л нэвтрэлт рүү. Нэвтэрсэн ч ажилтны эрхгүй хүнийг
  // нэвтрэлт рүү шидвэл давталт үүснэ — тэр хүн ресторан нээх ёстой.
  if (!isSignedIn) return <Navigate to="/login" replace />;
  // Нэвтэрсэн энгийн USER dashboard руу орвол ресторан нээх form руу
  // албадан чиглүүлэхгүй, storefront-ийн нүүр рүү буцаана.
  if (!user) return <Navigate to="/" replace />;
  if (user.isPlatformAdmin) return <Navigate to="/admin/requests" replace />;
  const path =
    user.role === 'DIRECTOR'
      ? '/director/orders'
      : user.role === 'MANAGER'
      ? '/manager/orders'
      : user.role === 'KITCHEN'
      ? '/kitchen/orders'
      : user.role === 'CASHIER'
      ? '/cashier/orders'
      : user.role === 'DRIVER'
      ? '/driver/deliveries'
      : '/';
  return <Navigate to={path} replace />;
}

/** Ажилтныг landing дээр саатуулахгүй, өөрийн role-ийн page руу шууд оруулна. */
function RoleAwareHome() {
  const { user, isSignedIn, ready } = useStaffMember();
  if (!ready) return null;
  if (isSignedIn && user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}
