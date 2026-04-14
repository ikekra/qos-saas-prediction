import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { TokenUsageProvider } from "@/contexts/TokenUsageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
const Landing = lazy(() => import("./pages/Landing"));
const DashboardEntry = lazy(() => import("./pages/DashboardEntry"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Forgot = lazy(() => import("./pages/auth/Forgot"));
const Reset = lazy(() => import("./pages/auth/Reset"));
const QosDashboard = lazy(() => import("./pages/qos/Dashboard"));
const RunTest = lazy(() => import("./pages/qos/RunTest"));
const Reports = lazy(() => import("./pages/qos/Reports"));
const Predict = lazy(() => import("./pages/qos/Predict"));
const Analytics = lazy(() => import("./pages/qos/Analytics"));
const AdvancedAnalytics = lazy(() => import("./pages/qos/AdvancedAnalytics"));
const Feedback = lazy(() => import("./pages/qos/Feedback"));
const RecommendationsUI = lazy(() => import("./pages/qos/RecommendationsUI"));
const QosAlerts = lazy(() => import("./pages/qos/Alerts"));
const QosSettings = lazy(() => import("./pages/qos/Settings"));
const WebServicesAdmin = lazy(() => import("./pages/admin/WebServicesAdmin"));
const TokenAdmin = lazy(() => import("./pages/admin/TokenAdmin"));
const AdminHub = lazy(() => import("./pages/admin/AdminHub"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const TeamDashboard = lazy(() => import("./pages/team/TeamDashboard"));
const TeamInvitationPage = lazy(() => import("./pages/team/TeamInvitation"));
const Profile = lazy(() => import("./pages/Profile"));
const ServicesList = lazy(() => import("./pages/services/ServicesList"));
const NewService = lazy(() => import("./pages/services/NewService"));
const ServiceDetail = lazy(() => import("./pages/services/ServiceDetail"));
const WebServicesDirectory = lazy(() => import("./pages/web-services/Directory"));
const WebServiceDetail = lazy(() => import("./pages/web-services/ServiceDetail"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const CompareServices = lazy(() => import("./pages/CompareServices"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <TokenUsageProvider>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/register" element={<Register />} />
                  <Route path="/auth/forgot" element={<Forgot />} />
                  <Route path="/auth/reset" element={<Reset />} />
                  <Route path="/dashboard" element={<ProtectedRoute><DashboardEntry /></ProtectedRoute>} />
                  <Route path="/qos/run-test" element={<ProtectedRoute><RunTest /></ProtectedRoute>} />
                  <Route path="/qos/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                  <Route path="/qos/predict" element={<ProtectedRoute><Predict /></ProtectedRoute>} />
                  <Route path="/qos/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/qos/advanced-analytics" element={<ProtectedRoute><AdvancedAnalytics /></ProtectedRoute>} />
                  <Route path="/qos/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
                  <Route path="/qos/recommendations" element={<ProtectedRoute><RecommendationsUI /></ProtectedRoute>} />
                  <Route path="/qos/alerts" element={<ProtectedRoute><QosAlerts /></ProtectedRoute>} />
                  <Route path="/qos/settings" element={<ProtectedRoute><QosSettings /></ProtectedRoute>} />
                  <Route path="/settings/billing" element={<ProtectedRoute><QosSettings /></ProtectedRoute>} />
                  <Route path="/profile/payments" element={<ProtectedRoute><QosSettings /></ProtectedRoute>} />
                  <Route path="/admin/web-services" element={<ProtectedRoute requireAdmin><WebServicesAdmin /></ProtectedRoute>} />
                  <Route path="/admin/tokens" element={<ProtectedRoute requireAdmin><TokenAdmin /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminHub /></ProtectedRoute>} />
                  <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><AdminHub /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/payments" element={<ProtectedRoute requireAdmin><AdminPayments /></ProtectedRoute>} />
                  <Route path="/admin/audit" element={<ProtectedRoute requireAdmin><AdminAuditLogs /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/team" element={<ProtectedRoute><TeamDashboard /></ProtectedRoute>} />
                  <Route path="/team/invitations/:token" element={<TeamInvitationPage />} />
                  <Route path="/services" element={<ProtectedRoute><ServicesList /></ProtectedRoute>} />
                  <Route path="/services/new" element={<ProtectedRoute><NewService /></ProtectedRoute>} />
                  <Route path="/services/:id" element={<ProtectedRoute><ServiceDetail /></ProtectedRoute>} />
                  <Route path="/directory" element={<ProtectedRoute><WebServicesDirectory /></ProtectedRoute>} />
                  <Route path="/directory/:id" element={<ProtectedRoute><WebServiceDetail /></ProtectedRoute>} />
                  <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
                  <Route path="/compare" element={<ProtectedRoute><CompareServices /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </TokenUsageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
