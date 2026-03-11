import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface PerformanceMetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  change?: number;
  index: number;
}

export function PerformanceMetricCard({
  title,
  value,
  unit,
  icon: Icon,
  change,
  index,
}: PerformanceMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="metric-card min-w-[280px] flex-shrink-0"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        {change !== undefined && (
          <span
            className={`text-sm font-medium ${
              change >= 0 ? 'text-accent' : 'text-destructive'
            }`}
          >
            {change > 0 ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </motion.div>
  );
}
