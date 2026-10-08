import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './api';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import ConversationsPage from './pages/ConversationsPage';
import SyncPage from './pages/SyncPage';
import ChannelsPage from './pages/ChannelsPage';
import OutboxPage from './pages/OutboxPage';
import WorkitemsPage from './pages/WorkitemsPage';
import FriendRequestsPage from './pages/FriendRequestsPage';
import ContactsPage from './pages/ContactsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerPage from './pages/CustomerPage';
import ErpMatchingPage from './pages/ErpMatchingPage';
import ErpTasksPage from './pages/ErpTasksPage';
import ErpCatalogPage from './pages/ErpCatalogPage';
import ActivityPage from './pages/ActivityPage';
import AdminPage from './pages/admin/AdminPage';
import OffboardPage from './pages/admin/OffboardPage';
import OwnTokensPage from './pages/OwnTokensPage';
import MePage from './pages/MePage';
import NotificationsPage from './pages/NotificationsPage';
import SearchPage from './pages/SearchPage';
import ReportsPage from './pages/reports/ReportsPage';
import { NotFoundView } from './components/layout/ErrorViews';

function RequireAuth({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/conversations/:id" element={<ConversationsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/channels/map" element={<ChannelsPage view="map" />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/contacts/requests" element={<FriendRequestsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/erp-matching" element={<ErpMatchingPage />} />
        <Route path="/customers/erp-tasks" element={<ErpTasksPage />} />
        <Route path="/customers/erp-catalog" element={<ErpCatalogPage />} />
        <Route path="/customers/:id" element={<CustomerPage />} />
        <Route path="/outbox" element={<OutboxPage />} />
        <Route path="/approvals" element={<WorkitemsPage />} />
        <Route path="/workitems" element={<WorkitemsPage />} />
        <Route path="/admin/users/:id/offboard" element={<OffboardPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/settings/activity" element={<ActivityPage />} />
        <Route path="/settings/tokens" element={<OwnTokensPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:tab" element={<ReportsPage />} />
        {/* R5 (00 §2.3): unknown route shows MH-UI-06 in place, URL unchanged, menu and header stay. */}
        <Route path="*" element={<NotFoundView />} />
      </Route>
      <Route path="/" element={<Navigate to="/conversations" replace />} />
    </Routes>
  );
}
