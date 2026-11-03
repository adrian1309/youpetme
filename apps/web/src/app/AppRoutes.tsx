import { Route, Routes } from 'react-router';

import { PlaceholderPage } from '../components/PlaceholderPage';
import { HomePage } from '../features/iam/home/HomePage';
import { PrivacyPage } from '../features/iam/legal/PrivacyPage';
import { TermsPage } from '../features/iam/legal/TermsPage';
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
        {/* Provisional: SCRUM-6 (login) replaces this. */}
        <Route path="login" element={<PlaceholderPage titleKey="placeholder.login.title" />} />
        <Route
          path="*"
          element={<PlaceholderPage titleKey="notFound.title" bodyKey="notFound.body" />}
        />
      </Route>
    </Routes>
  );
}
