import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

interface ServiceCardProps {
  serviceName: string;
  latency: number;
  uptime: number;
  status: 'stable' | 'degrading' | 'critical';
  lastTested: string;
  trend?: 'up' | 'down' | 'stable';
  onClick?: () => void;
}

export function ServiceCard({
  serviceName,
  latency,
  uptime,
  status,
  lastTested,
  trend = 'stable',
  onClick,
}: ServiceCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      whileTap={{ scale: 0.98 }}
      className="flex-shrink-0 w-[280px]"
    >
      <Card
        className="netflix-card cursor-pointer border-border/50 overflow-hidden h-full"
        onClick={onClick}
      >
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-accent/20">
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="h-16 w-16 text-primary/40" />
          </div>
          <div className="absolute top-3 right-3">
            <StatusBadge status={status} showIcon />
          </div>
        </div>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg truncate" title={serviceName}>
              {serviceName}
            </h3>
            <p className="text-xs text-muted-foreground">{lastTested}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Latency</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold">{latency}ms</p>
                {trend === 'down' && <TrendingDown className="h-3 w-3 text-[hsl(var(--status-stable))]" />}
                {trend === 'up' && <TrendingUp className="h-3 w-3 text-[hsl(var(--status-critical))]" />}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-sm font-semibold">{uptime}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
