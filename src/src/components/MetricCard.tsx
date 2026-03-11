import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  status?: 'stable' | 'degrading' | 'critical';
  subtitle?: string;
  trend?: number[];
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  status,
  subtitle,
  className,
}: MetricCardProps) {
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-[hsl(var(--status-stable))]';
    if (change < 0) return 'text-[hsl(var(--status-critical))]';
    return 'text-muted-foreground';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className={className}
    >
      <Card className="metric-card border-border/50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                {change !== undefined && (
                  <span className={`text-sm font-medium ${getChangeColor(change)}`}>
                    {change > 0 ? '+' : ''}
                    {change.toFixed(1)}%
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              {status && <StatusBadge status={status} showIcon={false} />}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
