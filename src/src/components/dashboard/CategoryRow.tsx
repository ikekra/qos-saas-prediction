import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Service {
  id: string;
  name: string;
  category: string;
  avg_latency: number;
  avg_rating: number;
  status: string;
}

interface CategoryRowProps {
  category: string;
  services: Service[];
}

export function CategoryRow({ category, services }: CategoryRowProps) {
  const navigate = useNavigate();

  const getStatusColor = (latency: number) => {
    if (latency < 100) return 'status-stable';
    if (latency < 300) return 'status-degrading';
    return 'status-critical';
  };

  const getStatusLabel = (latency: number) => {
    if (latency < 100) return 'Fast';
    if (latency < 300) return 'Moderate';
    return 'Slow';
  };

  return (
    <div className="space-y-4">
      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-2xl font-bold"
      >
        {category}
      </motion.h2>
      <div className="netflix-scroll">
        {services.map((service, index) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="min-w-[320px] flex-shrink-0"
          >
            <Card className="netflix-card h-full bg-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{service.name}</h3>
                    <Badge className={`status-badge ${getStatusColor(service.avg_latency || 0)}`}>
                      {getStatusLabel(service.avg_latency || 0)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    <span className="font-medium">{Number(service.avg_rating || 0).toFixed(1)}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Latency</span>
                    <span className="font-medium">{Math.round(service.avg_latency || 0)}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{service.status}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/services/${service.id}`)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    View Details
                  </Button>
                  <Button
                    onClick={() => navigate('/qos/run-test', { state: { serviceId: service.id } })}
                    size="sm"
                    className="flex-1"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Run Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
