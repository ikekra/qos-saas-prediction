import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Activity, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Recommendation {
  id: string;
  name: string;
  category: string;
  availability_score: number;
  avg_latency: number;
  reason: string;
}

export function RecommendationCarousel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = async () => {
    try {
      const { data: services } = await supabase
        .from('web_services')
        .select('id, service_name, name, category, availability_score, avg_latency')
        .eq('is_active', true)
        .order('availability_score', { ascending: false })
        .limit(5);

      if (services) {
        const recs = services.map((s) => ({
          id: s.id,
          name: s.service_name || s.name || 'Service',
          category: s.category || 'General',
          availability_score: Number(s.availability_score || 0),
          avg_latency: Number(s.avg_latency || 0),
          reason: Number(s.availability_score || 0) >= 99.5 ? 'Highly Available' : 'Popular Choice',
        }));
        setRecommendations(recs);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Recommended For You
        </h2>
        <div className="netflix-scroll">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[300px] h-48 bg-muted rounded-lg shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-2xl font-bold flex items-center gap-2"
      >
        <Sparkles className="h-6 w-6 text-primary" />
        Recommended For You
      </motion.h2>
      <div className="netflix-scroll">
        {recommendations.map((rec, index) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="min-w-[300px] flex-shrink-0"
          >
            <Card className="netflix-card h-full gradient-card border-primary/20">
              <CardContent className="p-6">
                <Badge className="mb-3 bg-primary/20 text-primary">
                  {rec.reason}
                </Badge>
                <h3 className="text-lg font-semibold mb-2">{rec.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{rec.category}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Availability</span>
                    <span className="font-medium">{rec.availability_score.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Latency</span>
                    <span className="font-medium">{Math.round(rec.avg_latency)}ms</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/services/${rec.id}`)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    onClick={() => navigate('/qos/run-test', { state: { serviceId: rec.id } })}
                    size="sm"
                    className="flex-1"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Test Now
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
