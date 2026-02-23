import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GitCompare, TrendingUp, Award, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CompareServices() {
  const { toast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch services',
        variant: 'destructive',
      });
    }
  };

  const handleCompare = async () => {
    if (selectedServices.length < 2 || selectedServices.length > 3) {
      toast({
        title: 'Invalid selection',
        description: 'Please select 2-3 services to compare',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('compare-services', {
        body: { serviceIds: selectedServices },
      });

      if (error) throw error;

      if (data?.comparison) {
        setComparison(data);
        toast({
          title: 'Comparison ready',
          description: 'Services compared successfully',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to compare services',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (value: string, index: number) => {
    const newSelected = [...selectedServices];
    newSelected[index] = value;
    setSelectedServices(newSelected);
  };

  const chartData = comparison?.comparison.map((service: any) => ({
    name: service.name,
    Latency: service.metrics.latency,
    'Success Rate': service.metrics.successRate,
    Rating: service.avg_rating * 20, // Scale to 0-100
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <GitCompare className="h-10 w-10 text-primary" />
              Compare Services
            </h1>
            <p className="text-muted-foreground text-lg">
              Side-by-side comparison of service performance and ratings
            </p>
          </div>

          {/* Service Selection */}
          <Card className="metric-card mb-8">
            <CardHeader>
              <CardTitle>Select Services to Compare</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                {[0, 1, 2].map((index) => (
                  <Select
                    key={index}
                    value={selectedServices[index] || ''}
                    onValueChange={(value) => handleServiceSelect(value, index)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Service ${index + 1}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {services
                        .filter((s) => !selectedServices.includes(s.id) || selectedServices[index] === s.id)
                        .map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
              <Button
                onClick={handleCompare}
                disabled={loading || selectedServices.length < 2}
                className="w-full"
              >
                {loading ? 'Comparing...' : 'Compare Selected Services'}
              </Button>
            </CardContent>
          </Card>

          {/* Comparison Results */}
          {comparison && (
            <div className="space-y-6">
              {/* Insights */}
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Performance Winners
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10">
                      <Zap className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Fastest</p>
                        <p className="font-semibold">{comparison.insights.bestLatency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-accent/10">
                      <Award className="h-8 w-8 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Highest Rated</p>
                        <p className="font-semibold">{comparison.insights.bestRating}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/10">
                      <TrendingUp className="h-8 w-8 text-secondary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Best Throughput</p>
                        <p className="font-semibold">{comparison.insights.bestThroughput}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Latency" fill="hsl(var(--primary))" />
                      <Bar dataKey="Success Rate" fill="hsl(var(--accent))" />
                      <Bar dataKey="Rating" fill="hsl(var(--secondary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detailed Comparison Table */}
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle>Detailed Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3">Metric</th>
                          {comparison.comparison.map((service: any) => (
                            <th key={service.id} className="text-left p-3">
                              {service.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Category</td>
                          {comparison.comparison.map((service: any) => (
                            <td key={service.id} className="p-3">
                              <Badge variant="outline">{service.category}</Badge>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Avg Latency (ms)</td>
                          {comparison.comparison.map((service: any) => (
                            <td key={service.id} className="p-3">
                              {service.metrics.latency}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Success Rate (%)</td>
                          {comparison.comparison.map((service: any) => (
                            <td key={service.id} className="p-3">
                              {service.metrics.successRate}%
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">User Rating</td>
                          {comparison.comparison.map((service: any) => (
                            <td key={service.id} className="p-3">
                              {service.avg_rating.toFixed(1)} / 5.0
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Total Tests</td>
                          {comparison.comparison.map((service: any) => (
                            <td key={service.id} className="p-3">
                              {service.recentTests}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
