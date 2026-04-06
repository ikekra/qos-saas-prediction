import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import QosDashboard from "@/pages/qos/Dashboard";

export default function DashboardEntry() {
  const { isAdmin, adminLoading } = useAuth();

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <QosDashboard />;
}
