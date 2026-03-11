import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Loader2, TrendingUp, Clock, Activity, Download, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, isAfter, isBefore } from 'date-fns';
import { motion } from 'framer-motion';

interface Test {
  id: string;
  service_url: string;
  test_type: string;
  latency: number;
  uptime: number;
  throughput: number;
  success_rate: number;
  created_at: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))'];

export default function Reports() {
  const { toast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [filteredTests, setFilteredTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterService, setFilterService] = useState<string>('all');
  const [filterTestType, setFilterTestType] = useState<string>('all');

  useEffect(() => {
    fetchTests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tests, dateFrom, dateTo, filterService, filterTestType]);

  const applyFilters = () => {
    let filtered = [...tests];

    // Date filter
    filtered = filtered.filter(test => {
      const testDate = new Date(test.created_at);
      return isAfter(testDate, new Date(dateFrom)) && isBefore(testDate, new Date(dateTo + 'T23:59:59'));
    });

    // Service filter
    if (filterService !== 'all') {
      filtered = filtered.filter(test => test.service_url === filterService);
    }

    // Test type filter
    if (filterTestType !== 'all') {
      filtered = filtered.filter(test => test.test_type === filterTestType);
    }

    setFilteredTests(filtered);
  };

  const fetchTests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view reports",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTests(data || []);
      setFilteredTests(data || []);
    } catch (error: any) {
      toast({
        title: "Error Loading Reports",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (filteredTests.length === 0) {
      toast({
        title: "No Data",
        description: "No test results to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Date', 'Service URL', 'Test Type', 'Latency (ms)', 'Uptime (%)', 'Throughput', 'Success Rate (%)'];
    const csvData = filteredTests.map(test => [
      format(new Date(test.created_at), 'yyyy-MM-dd HH:mm:ss'),
      test.service_url,
      test.test_type,
      test.latency?.toFixed(2) || 'N/A',
      test.uptime?.toFixed(2) || 'N/A',
      test.throughput?.toFixed(2) || 'N/A',
      test.success_rate?.toFixed(2) || 'N/A',
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qos-reports-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Reports exported to CSV",
    });
  };

  const uniqueServices = Array.from(new Set(tests.map(t => t.service_url)));
  const uniqueTestTypes = Array.from(new Set(tests.map(t => t.test_type)));

  const chartData = filteredTests.slice(0, 10).reverse().map(test => ({
    name: format(new Date(test.created_at), 'MMM dd HH:mm'),
    latency: test.latency || 0,
    uptime: test.uptime || 0,
    throughput: test.throughput || 0,
  }));

  const avgLatency = filteredTests.length > 0 
    ? (filteredTests.reduce((sum, t) => sum + (t.latency || 0), 0) / filteredTests.length).toFixed(2)
    : '0';

  const avgUptime = filteredTests.length > 0
    ? (filteredTests.reduce((sum, t) => sum + (t.uptime || 0), 0) / filteredTests.length).toFixed(2)
    : '0';

  const avgSuccessRate = filteredTests.length > 0
    ? (filteredTests.reduce((sum, t) => sum + (t.success_rate || 0), 0) / filteredTests.length).toFixed(2)
    : '0';

  // Test type distribution
  const testTypeData = uniqueTestTypes.map(type => ({
    name: type,
    value: filteredTests.filter(t => t.test_type === type).length,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container py-12 relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <motion.div 
          className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h1 className="text-4xl font-bold mb-2">Performance Reports</h1>
            <p className="text-muted-foreground">
              Advanced analytics and historical performance trends
            </p>
          </div>
          <Button onClick={exportToCSV} size="lg" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </motion.div>

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="mb-8 shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <CardDescription>Filter reports by date, service, and test type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">From Date</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">To Date</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceFilter">Service</Label>
                  <Select value={filterService} onValueChange={setFilterService}>
                    <SelectTrigger id="serviceFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {uniqueServices.map(service => (
                        <SelectItem key={service} value={service}>{service}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="testTypeFilter">Test Type</Label>
                  <Select value={filterTestType} onValueChange={setFilterTestType}>
                    <SelectTrigger id="testTypeFilter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueTestTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          className="grid gap-6 md:grid-cols-3 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="gradient-card shadow-soft hover-scale">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgLatency}ms</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {filteredTests.length} tests
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-soft hover-scale">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Uptime</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgUptime}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Service availability
              </p>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-soft hover-scale">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgSuccessRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Test completion rate
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts */}
        {filteredTests.length > 0 ? (
          <motion.div 
            className="grid gap-6 lg:grid-cols-2 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Latency Trend</CardTitle>
                <CardDescription>Response time over filtered results</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    latency: {
                      label: "Latency (ms)",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="Latency (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Comparison across test types</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    uptime: {
                      label: "Uptime (%)",
                      color: "hsl(var(--accent))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="uptime" 
                        fill="hsl(var(--accent))"
                        name="Uptime (%)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="shadow-medium lg:col-span-2">
              <CardHeader>
                <CardTitle>Test Type Distribution</CardTitle>
                <CardDescription>Breakdown of tests by type</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    distribution: {
                      label: "Test Distribution",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={testTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => `${entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {testTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Card className="shadow-medium">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground mb-4">No test results yet</p>
              <p className="text-sm text-muted-foreground">
                Run your first test to see performance reports and analytics
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recent Tests Table */}
        {filteredTests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Filtered Test Results</CardTitle>
                <CardDescription>Showing {filteredTests.length} results based on filters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Date</th>
                        <th className="text-left p-4">URL</th>
                        <th className="text-left p-4">Type</th>
                        <th className="text-right p-4">Latency</th>
                        <th className="text-right p-4">Uptime</th>
                        <th className="text-right p-4">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTests.slice(0, 20).map((test) => (
                        <tr key={test.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-4 text-sm">
                            {format(new Date(test.created_at), 'MMM dd, yyyy HH:mm')}
                          </td>
                          <td className="p-4 text-sm truncate max-w-xs">
                            {test.service_url}
                          </td>
                          <td className="p-4 text-sm capitalize">{test.test_type}</td>
                          <td className="p-4 text-sm text-right">{test.latency?.toFixed(2) || 'N/A'}ms</td>
                          <td className="p-4 text-sm text-right">{test.uptime?.toFixed(2) || 'N/A'}%</td>
                          <td className="p-4 text-sm text-right">{test.success_rate?.toFixed(2) || 'N/A'}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
