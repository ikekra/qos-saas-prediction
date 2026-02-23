import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Forgot from "./pages/auth/Forgot";
import Reset from "./pages/auth/Reset";
import QosDashboard from "./pages/qos/Dashboard";
import RunTest from "./pages/qos/RunTest";
import Reports from "./pages/qos/Reports";
import Profile from "./pages/Profile";
import ServicesList from "./pages/services/ServicesList";
import NewService from "./pages/services/NewService";
import ServiceDetail from "./pages/services/ServiceDetail";
import Recommendations from "./pages/Recommendations";
import CompareServices from "./pages/CompareServices";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/register" element={<Register />} />
              <Route path="/auth/forgot" element={<Forgot />} />
              <Route path="/auth/reset" element={<Reset />} />
              <Route path="/dashboard" element={<ProtectedRoute><QosDashboard /></ProtectedRoute>} />
              <Route path="/qos/run-test" element={<ProtectedRoute><RunTest /></ProtectedRoute>} />
              <Route path="/qos/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><ServicesList /></ProtectedRoute>} />
              <Route path="/services/new" element={<ProtectedRoute><NewService /></ProtectedRoute>} />
              <Route path="/services/:id" element={<ProtectedRoute><ServiceDetail /></ProtectedRoute>} />
              <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
              <Route path="/compare" element={<ProtectedRoute><CompareServices /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
