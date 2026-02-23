import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'stable' | 'degrading' | 'critical';
  label?: string;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, label, showIcon = true, className }: StatusBadgeProps) {
  const icons = {
    stable: CheckCircle,
    degrading: AlertTriangle,
    critical: XCircle,
  };

  const labels = {
    stable: label || 'Stable',
    degrading: label || 'Degrading',
    critical: label || 'Critical',
  };

  const Icon = icons[status];

  return (
    <div className={cn('status-badge', `status-${status}`, className)}>
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      <span>{labels[status]}</span>
    </div>
  );
}
