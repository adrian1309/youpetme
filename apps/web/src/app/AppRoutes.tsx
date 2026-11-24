import { Route, Routes } from 'react-router';

import { PlaceholderPage } from '../components/PlaceholderPage';
import { CataloguePage } from '../features/animals/catalogue/CataloguePage';
import { AnimalDetailPage } from '../features/animals/detail/AnimalDetailPage';
import { RegisterAnimalPage } from '../features/animals/register/RegisterAnimalPage';
import { RequireAdmin } from '../features/animals/register/RequireAdmin';
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
        <Route path="animals" element={<CataloguePage />} />
        <Route path="animals/:id" element={<AnimalDetailPage />} />
        <Route
          path="admin/animals/new"
          element={
            <RequireAdmin>
              <RegisterAnimalPage />
            </RequireAdmin>
          }
        />
        <Route
          path="*"
          element={<PlaceholderPage titleKey="notFound.title" bodyKey="notFound.body" />}
        />
      </Route>
    </Routes>
  );
}
