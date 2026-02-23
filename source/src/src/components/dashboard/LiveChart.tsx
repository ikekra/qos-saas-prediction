import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Activity } from 'lucide-react';

interface TestData {
  timestamp: string;
  latency: number;
  error_rate: number;
}

export function LiveChart() {
  const { user } = useAuth();
  const [data, setData] = useState<TestData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestData();
  }, [user]);

  const fetchTestData = async () => {
    if (!user) return;

    try {
      const { data: tests } = await supabase
        .from('test_results')
        .select('created_at, latency, error_rate')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tests) {
        const chartData = tests
          .reverse()
          .map((t) => ({
            timestamp: new Date(t.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            latency: Number(t.latency || 0),
            error_rate: Number(t.error_rate || 0),
          }));
        setData(chartData);
      }
    } catch (error) {
      console.error('Error fetching test data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="gradient-card shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Live Test Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 bg-muted rounded shimmer" />
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No test data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="timestamp"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
                name="Latency (ms)"
              />
              <Line
                type="monotone"
                dataKey="error_rate"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--destructive))' }}
                name="Error Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
