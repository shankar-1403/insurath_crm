import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import HomeRedirect from './pages/HomeRedirect'
import ManagementBoard from './pages/ManagementBoard'
import SalesBoard from './pages/SalesBoard'
import ProcessBoard from './pages/ProcessBoard'
import AdminUsers from './pages/AdminUsers'
import AdminProducts from './pages/AdminProducts'
import AdminStatuses from './pages/AdminStatuses'
import PartnerBoard from './pages/PartnerBoard'
import { ROLES } from './constants'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomeRedirect />} />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/products"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <AdminProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/statuses"
              element={
                <ProtectedRoute roles={[ROLES.ADMIN]}>
                  <AdminStatuses />
                </ProtectedRoute>
              }
            />
            <Route
              path="management"
              element={
                <ProtectedRoute roles={[ROLES.MANAGEMENT]}>
                  <ManagementBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="sales"
              element={
                <ProtectedRoute roles={[ROLES.SALES]}>
                  <SalesBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="process"
              element={
                <ProtectedRoute roles={[ROLES.PROCESS]}>
                  <ProcessBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="partner"
              element={
                <ProtectedRoute roles={[ROLES.PARTNER]}>
                  <PartnerBoard />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
