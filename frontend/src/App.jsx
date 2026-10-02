import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyAccess from './pages/VerifyAccess';
import { ForgotPassword, ResetPassword } from './pages/PasswordPages';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import ModuleRoute from './components/ModuleRoute';
import RegistrationRoute from './components/RegistrationRoute';
import Profile from './pages/Profile';
import Editor from './pages/Editor';
import Overlay from './pages/Overlay';
import AcceptInvite from './pages/AcceptInvite';
import EditorHub from './pages/EditorHub';
import Settings from './pages/Settings';
import Store from './pages/Store';
import Cart from './pages/Cart';
import Inventory from './pages/Inventory';
import Inicio from './pages/Inicio';
import SystemAdmin from './pages/SystemAdmin';
import { CookiesPage, FaqPage, PrivacyPage, SecurityPage, TermsPage } from './pages/PublicPages';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<ModuleRoute moduleKey="login"><PublicOnlyRoute><Login /></PublicOnlyRoute></ModuleRoute>} />
      <Route path="/register" element={<RegistrationRoute><PublicOnlyRoute><Register /></PublicOnlyRoute></RegistrationRoute>} />
      <Route path="/verify-access" element={<ModuleRoute moduleKey="login"><VerifyAccess /></ModuleRoute>} />
      <Route path="/forgot-password" element={<ModuleRoute moduleKey="login"><ForgotPassword /></ModuleRoute>} />
      <Route path="/reset-password" element={<ModuleRoute moduleKey="login"><ResetPassword /></ModuleRoute>} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route path="/terminos" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/seguridad" element={<SecurityPage />} />
      <Route path="/overlay/:publicKey" element={<Overlay />} />
      <Route path="/invite/:token" element={<ProtectedRoute><AcceptInvite /></ProtectedRoute>} />

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/app" element={<Inicio />} />
        <Route path="/app/inicio" element={<Inicio />} />
        <Route path="/app/editor" element={<ModuleRoute moduleKey="editor" fallback="/app"><EditorHub /></ModuleRoute>} />
        <Route path="/app/editor/:publicKey" element={<ModuleRoute moduleKey="editor" fallback="/app"><Editor /></ModuleRoute>} />
        <Route path="/app/profile" element={<Profile />} />
        <Route path="/app/settings" element={<Settings />} />
        <Route path="/app/cart" element={<ModuleRoute moduleKey="store" fallback="/app"><Cart /></ModuleRoute>} />
        <Route path="/app/store" element={<ModuleRoute moduleKey="store" fallback="/app"><Store /></ModuleRoute>} />
        <Route path="/app/inventory" element={<Inventory />} />
        <Route path="/app/admin" element={<ProtectedRoute role="SUPER_ADMIN" permission="admin.system.access" explicitPermission><SystemAdmin /></ProtectedRoute>} />
        <Route path="/app/diagnostico" element={<Navigate to="/app/settings?section=diagnostics" replace />} />
      </Route>

      <Route path="*" element={<div className="p-10 text-[var(--dc-accent-four)]">404</div>} />
    </Routes>
  );
}
