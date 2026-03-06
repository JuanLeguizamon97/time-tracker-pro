import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { lazy, Suspense, ReactNode } from "react";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Timesheet = lazy(() => import("./pages/Timesheet"));
const History = lazy(() => import("./pages/History"));
const Projects = lazy(() => import("./pages/Projects"));
const Clients = lazy(() => import("./pages/Clients"));
const Employees = lazy(() => import("./pages/Employees"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceEdit = lazy(() => import("./pages/InvoiceEdit"));
const Reports = lazy(() => import("./pages/Reports"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const Register = lazy(() => import("./pages/Register"));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,      // 2 min — no refetch si los datos son recientes
      gcTime: 1000 * 60 * 10,        // 10 min en cache
      retry: 1,
      refetchOnWindowFocus: false,   // no refetch al volver al tab
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/timesheet" element={<ProtectedRoute><MainLayout><Timesheet /></MainLayout></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><MainLayout><History /></MainLayout></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><MainLayout><Projects /></MainLayout></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><MainLayout><Clients /></MainLayout></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><MainLayout><Employees /></MainLayout></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute><MainLayout><Invoices /></MainLayout></ProtectedRoute>} />
              <Route path="/invoices/:invoiceId/edit" element={<ProtectedRoute><MainLayout><InvoiceEdit /></MainLayout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><MainLayout><Reports /></MainLayout></ProtectedRoute>} />
              {/* Legacy routes */}
              <Route path="/historial" element={<Navigate to="/history" replace />} />
              <Route path="/proyectos" element={<Navigate to="/projects" replace />} />
              <Route path="/clientes" element={<Navigate to="/clients" replace />} />
              <Route path="/empleados" element={<Navigate to="/employees" replace />} />
              <Route path="/facturacion" element={<Navigate to="/invoices" replace />} />
              <Route path="/billing" element={<Navigate to="/invoices" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
