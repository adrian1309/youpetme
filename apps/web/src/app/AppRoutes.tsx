import { Route, Routes } from 'react-router';

import { PlaceholderPage } from '../components/PlaceholderPage';
import { HomePage } from '../features/iam/home/HomePage';
import { RegisterPage } from '../features/iam/register/RegisterPage';
import { AppLayout } from './AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="register" element={<RegisterPage />} />
        {/* Provisional: SCRUM-47 (terms, privacy) and SCRUM-6 (login) replace these. */}
        <Route path="terms" element={<PlaceholderPage titleKey="placeholder.terms.title" />} />
        <Route path="privacy" element={<PlaceholderPage titleKey="placeholder.privacy.title" />} />
        <Route path="login" element={<PlaceholderPage titleKey="placeholder.login.title" />} />
      </Route>
    </Routes>
  );
}
