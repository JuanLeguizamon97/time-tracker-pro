import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Timesheet = lazy(() => import("./pages/Timesheet"));
const History = lazy(() => import("./pages/History"));
const Projects = lazy(() => import("./pages/Projects"));
const Clients = lazy(() => import("./pages/Clients"));
const Employees = lazy(() => import("./pages/Employees"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceEditPage = lazy(() => import("./pages/invoices/InvoiceEditPage"));
const InvoiceNewPage = lazy(() => import("./pages/invoices/InvoiceNewPage"));
const ProjectNewPage = lazy(() => import("./pages/projects/ProjectNewPage"));
const ProjectDetailPage = lazy(() => import("./pages/projects/ProjectDetailPage"));
const ProjectEditPage = lazy(() => import("./pages/projects/ProjectEditPage"));
const Reports = lazy(() => import("./pages/Reports"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route path="/" element={<MainLayout><Dashboard /></MainLayout>} />
              <Route path="/timesheet" element={<MainLayout><Timesheet /></MainLayout>} />
              <Route path="/history" element={<MainLayout><History /></MainLayout>} />
              <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
              <Route path="/projects/new" element={<MainLayout><ProjectNewPage /></MainLayout>} />
              <Route path="/projects/:projectId/edit" element={<MainLayout><ProjectEditPage /></MainLayout>} />
              <Route path="/projects/:projectId" element={<MainLayout><ProjectDetailPage /></MainLayout>} />
              <Route path="/clients" element={<MainLayout><Clients /></MainLayout>} />
              <Route path="/employees" element={<MainLayout><Employees /></MainLayout>} />
              <Route path="/invoices" element={<MainLayout><Invoices /></MainLayout>} />
              <Route path="/invoices/new" element={<MainLayout><InvoiceNewPage /></MainLayout>} />
              <Route path="/invoices/:invoiceId/edit" element={<MainLayout><InvoiceEditPage /></MainLayout>} />
              <Route path="/reports" element={<MainLayout><Reports /></MainLayout>} />
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
