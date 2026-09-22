import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyAccess from './pages/VerifyAccess';
import { ForgotPassword, ResetPassword } from './pages/PasswordPages';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ChannelDashboard from './pages/ChannelDashboard';
import Profile from './pages/Profile';
import Editor from './pages/Editor';
import Overlay from './pages/Overlay';
import AcceptInvite from './pages/AcceptInvite';
import EditorHub from './pages/EditorHub';
import Settings from './pages/Settings';
import { CookiesPage, FaqPage, PrivacyPage, SecurityPage, TermsPage } from './pages/PublicPages';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-access" element={<VerifyAccess />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route path="/terminos" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/seguridad" element={<SecurityPage />} />
      <Route path="/overlay/:publicKey" element={<Overlay />} />
      <Route path="/invite/:token" element={<ProtectedRoute><AcceptInvite /></ProtectedRoute>} />

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/app" element={<ChannelDashboard />} />
        <Route path="/app/editor" element={<EditorHub />} />
        <Route path="/app/editor/:publicKey" element={<Editor />} />
        <Route path="/app/profile" element={<Profile />} />
        <Route path="/app/settings" element={<Settings />} />
        <Route path="/app/diagnostico" element={<Navigate to="/app/settings?section=diagnostics" replace />} />
      </Route>

      <Route path="*" element={<div className="p-10">404</div>} />
    </Routes>
  );
}
