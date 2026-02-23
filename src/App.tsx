import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Timesheet from "./pages/Timesheet";
import History from "./pages/History";
import Projects from "./pages/Projects";
import Clients from "./pages/Clients";
import Employees from "./pages/Employees";
import Invoices from "./pages/Invoices";
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
            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route path="/" element={<MainLayout><Timesheet /></MainLayout>} />
            <Route path="/history" element={<MainLayout><History /></MainLayout>} />
            <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
            <Route path="/clients" element={<MainLayout><Clients /></MainLayout>} />
            <Route path="/employees" element={<MainLayout><Employees /></MainLayout>} />
            <Route path="/invoices" element={<MainLayout><Invoices /></MainLayout>} />
            {/* Legacy Spanish routes */}
            <Route path="/historial" element={<Navigate to="/history" replace />} />
            <Route path="/proyectos" element={<Navigate to="/projects" replace />} />
            <Route path="/clientes" element={<Navigate to="/clients" replace />} />
            <Route path="/empleados" element={<Navigate to="/employees" replace />} />
            <Route path="/facturacion" element={<Navigate to="/invoices" replace />} />
            <Route path="/billing" element={<Navigate to="/invoices" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
