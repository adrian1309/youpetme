import { Route, Routes } from 'react-router';

import { PlaceholderPage } from '../components/PlaceholderPage';
import { HomePage } from '../features/iam/home/HomePage';
import { LoginPage } from '../features/iam/login/LoginPage';
import { PrivacyPage } from '../features/iam/legal/PrivacyPage';
import { TermsPage } from '../features/iam/legal/TermsPage';
import { ForgotPasswordPage } from '../features/iam/password-reset/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/iam/password-reset/ResetPasswordPage';
import { RegisterPage } from '../features/iam/register/RegisterPage';
import { AppLayout } from './AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route
          path="*"
          element={<PlaceholderPage titleKey="notFound.title" bodyKey="notFound.body" />}
        />
      </Route>
    </Routes>
  );
}
