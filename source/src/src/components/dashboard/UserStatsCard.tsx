import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { User, Activity, Zap } from 'lucide-react';

interface UserStats {
  totalTests: number;
  avgLatency: number;
  totalRatings: number;
}

export function UserStatsCard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalTests: 0,
    avgLatency: 0,
    totalRatings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserStats();
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      // Fetch test results
      const { data: tests } = await supabase
        .from('test_results')
        .select('latency')
        .eq('user_id', user.id);

      // Fetch ratings
      const { data: ratings } = await supabase
        .from('ratings')
        .select('id')
        .eq('user_id', user.id);

      const totalTests = tests?.length || 0;
      const avgLatency = tests?.length
        ? tests.reduce((acc, t) => acc + Number(t.latency || 0), 0) / tests.length
        : 0;

      setStats({
        totalTests,
        avgLatency: Math.round(avgLatency),
        totalRatings: ratings?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const activityPercentage = Math.min((stats.totalTests / 50) * 100, 100);

  return (
    <Card className="gradient-card shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Your Activity Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded shimmer" />
            <div className="h-4 bg-muted rounded shimmer w-3/4" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Circular progress */}
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                    fill="none"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: 352 }}
                    animate={{
                      strokeDashoffset: 352 - (352 * activityPercentage) / 100,
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    strokeDasharray="352"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-2xl font-bold text-primary">{stats.totalTests}</span>
                  <span className="text-xs text-muted-foreground">Tests</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
              >
                <Zap className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-xs text-muted-foreground">Avg Latency</p>
                  <p className="text-lg font-semibold">{stats.avgLatency}ms</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
              >
                <Activity className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Ratings</p>
                  <p className="text-lg font-semibold">{stats.totalRatings}</p>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
