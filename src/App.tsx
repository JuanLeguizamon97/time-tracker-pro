import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/contexts/DataContext";
import { MainLayout } from "@/components/layout/MainLayout";
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
      <DataProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Timesheet />} />
              <Route path="/historial" element={<History />} />
              <Route path="/proyectos" element={<Projects />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/empleados" element={<Employees />} />
              <Route path="/facturacion" element={<Billing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
