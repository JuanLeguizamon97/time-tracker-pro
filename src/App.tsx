import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Auth from "./pages/Auth";
import Timesheet from "./pages/Timesheet";
import History from "./pages/History";
import Projects from "./pages/Projects";
import Clients from "./pages/Clients";
import Employees from "./pages/Employees";
import Billing from "./pages/Billing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout>
                  <Timesheet />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/historial" element={
              <ProtectedRoute>
                <MainLayout>
                  <History />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/proyectos" element={
              <ProtectedRoute requireAdmin>
                <MainLayout>
                  <Projects />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/clientes" element={
              <ProtectedRoute requireAdmin>
                <MainLayout>
                  <Clients />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/empleados" element={
              <ProtectedRoute requireAdmin>
                <MainLayout>
                  <Employees />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/facturacion" element={
              <ProtectedRoute requireAdmin>
                <MainLayout>
                  <Billing />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
