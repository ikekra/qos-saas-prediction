import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GitCompare, Zap, RefreshCw, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type WebService = {
  id: string;
  name: string;
  category: string | null;
  provider: string | null;
  description: string | null;
  logo_url: string | null;
  availability_score: number | null;
  base_latency_estimate: number | null;
  base_url: string | null;
  docs_url: string | null;
  is_active: boolean;
};

type LiveMetric = {
  latency: number;
  throughput: number;
  uptime: number;
  successRate: number;
  testedAt: string;
};

export default function CompareServices() {
  const { toast } = useToast();
  const [services, setServices] = useState<WebService[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, LiveMetric>>({});
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const retryRef = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifiedRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    const resolveUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };
    resolveUser();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('web_services')
        .select('id, name, category, provider, description, logo_url, availability_score, base_latency_estimate, base_url, docs_url, is_active')
        .eq('is_active', true)
        .order('availability_score', { ascending: false });

      if (error) throw error;
      setServices((data || []) as WebService[]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch services',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(
    () =>
      Array.from(new Set(services.map((service) => service.category).filter(Boolean))).sort() as string[],
    [services],
  );

  const filteredServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return services.filter((service) => {
      const name = (service.name || '').toLowerCase();
      const provider = (service.provider || '').toLowerCase();
      const matchesTerm = !term || name.includes(term) || provider.includes(term);
      const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [services, searchTerm, categoryFilter]);

  const toggleSelect = (serviceId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      }
      if (prev.length >= 4) {
        toast({
          title: 'Selection limit',
          description: 'Select up to 4 services for comparison.',
          variant: 'destructive',
        });
        return prev;
      }
      return [...prev, serviceId];
    });
  };

  const handleClear = () => {
    setSelectedIds([]);
    setLiveMetrics({});
    setAutoRefresh(false);
    setLastUpdatedAt(null);
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      toast({
        title: 'Select more services',
        description: 'Please choose at least 2 services to compare.',
        variant: 'destructive',
      });
      return;
    }

    setComparing(true);
    try {
      const selectedServices = services.filter((service) => selectedIds.includes(service.id));

      const results = await Promise.all(
        selectedServices.map(async (service) => {
          const testUrl = service.base_url || service.docs_url;
          if (!testUrl) {
            return {
              id: service.id,
              metrics: null,
              error: 'No test URL',
            };
          }

          const runTest = async (testType: 'latency' | 'throughput' | 'uptime') => {
            const { data, error } = await supabase.functions.invoke('run-qos-test', {
              body: { serviceUrl: testUrl, testType },
            });
            if (error) throw error;
            return data?.results || {};
          };

          const [latencyRes, throughputRes, uptimeRes] = await Promise.all([
            runTest('latency'),
            runTest('throughput'),
            runTest('uptime'),
          ]);

          const merged = {
            latency: Number(latencyRes.latency || throughputRes.latency || uptimeRes.latency || 0),
            throughput: Number(throughputRes.throughput || 0),
            uptime: Number(uptimeRes.uptime || latencyRes.uptime || 0),
            successRate: Number(uptimeRes.success_rate || latencyRes.success_rate || 0),
          };

          return {
            id: service.id,
            metrics: {
              ...merged,
              testedAt: new Date().toLocaleTimeString(),
            },
            error: null,
          };
        }),
      );

      const nextMetrics: Record<string, LiveMetric> = {};
      const failures = results.filter((result) => result.error);
      results.forEach((result) => {
        if (result.metrics) {
          nextMetrics[result.id] = result.metrics;
        }
      });

      setLiveMetrics(nextMetrics);
      setLastUpdatedAt(new Date().toLocaleTimeString());
      setAutoRefresh(true);

      if (failures.length > 0) {
        toast({
          title: 'Some services skipped',
          description: 'One or more services do not have a testable URL.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Comparison ready',
          description: 'Live metrics updated for selected services.',
        });
      }

      // Scroll results into view after compare
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to compare services',
        variant: 'destructive',
      });
    } finally {
      setComparing(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh || selectedIds.length < 2) return;
    const interval = setInterval(() => {
      handleCompare();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedIds]);

  const selectedServices = useMemo(
    () => services.filter((service) => selectedIds.includes(service.id)),
    [services, selectedIds],
  );

  const comparisonRows = useMemo(() => {
    return selectedServices.map((service) => {
      const live = liveMetrics[service.id];
      const latency = live?.latency ?? service.base_latency_estimate ?? 0;
      const uptime = live?.uptime ?? service.availability_score ?? 0;
      const throughput = live?.throughput ?? 0;
      const successRate = live?.successRate ?? 0;
      return {
        id: service.id,
        name: service.name,
        category: service.category || 'Other',
        provider: service.provider || 'Unknown',
        latency,
        uptime,
        throughput,
        successRate,
        testedAt: live?.testedAt || 'Estimated',
      };
    });
  }, [selectedServices, liveMetrics]);

  const serviceUrlToId = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((service) => {
      if (service.base_url) map.set(service.base_url, service.id);
      if (service.docs_url) map.set(service.docs_url, service.id);
    });
    return map;
  }, [services]);

  useEffect(() => {
    if (!userId) return;

    const scheduleRetry = () => {
      const attempt = Math.min(retryRef.current + 1, 5);
      retryRef.current = attempt;
      const delay = Math.min(30000, 1000 * 2 ** attempt);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(() => startSubscription(), delay);
    };

    const startSubscription = () => {
      if (!userId) return;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`compare-tests-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tests',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as {
              service_url: string;
              latency: number | null;
              throughput: number | null;
              uptime: number | null;
              success_rate: number | null;
            };
            const serviceId = serviceUrlToId.get(row.service_url);
            if (!serviceId || !selectedIds.includes(serviceId)) return;

            setLiveMetrics((prev) => ({
              ...prev,
              [serviceId]: {
                latency: Number(row.latency ?? 0),
                throughput: Number(row.throughput ?? 0),
                uptime: Number(row.uptime ?? 0),
                successRate: Number(row.success_rate ?? 0),
                testedAt: new Date().toLocaleTimeString(),
              },
            }));
            setLastUpdatedAt(new Date().toLocaleTimeString());
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
            retryRef.current = 0;
            notifiedRef.current = false;
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeStatus('reconnecting');
            if (!notifiedRef.current) {
              notifiedRef.current = true;
              toast({
                title: 'Realtime disconnected',
                description: 'Trying to reconnect to live updates.',
                variant: 'destructive',
              });
            }
            scheduleRetry();
          }
          if (status === 'CLOSED') {
            setRealtimeStatus('disconnected');
            scheduleRetry();
          }
        });

      channelRef.current = channel;
    };

    startSubscription();

    return () => {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [userId, selectedIds, serviceUrlToId, toast]);

  const chartData = comparisonRows.map((service) => ({
    name: service.name,
    Latency: Math.round(service.latency),
    Uptime: Math.round(service.uptime),
    Throughput: Math.round(service.throughput),
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
              Pick services from the full catalog and run live QoS comparisons.
            </p>
          </div>

          <Card className="metric-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Live Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                Select 2-4 services, then run live tests to compare real-time metrics.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleCompare}
                  disabled={comparing || selectedIds.length < 2}
                  className="gap-2"
                >
                  {comparing ? 'Comparing...' : 'Compare Selected Services'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCompare}
                  disabled={comparing || selectedIds.length < 2}
                  className="gap-2"
                >
                  <RefreshCw className={comparing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                  Refresh Live
                </Button>
                <Button
                  variant={autoRefresh ? 'secondary' : 'outline'}
                  onClick={() => setAutoRefresh((prev) => !prev)}
                  disabled={selectedIds.length < 2}
                >
                  {autoRefresh ? 'Auto Refresh: On' : 'Auto Refresh: Off'}
                </Button>
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="uppercase tracking-[0.18em] text-[0.65rem]">Realtime</span>
                <Badge variant={realtimeStatus === 'connected' ? 'secondary' : 'outline'}>
                  {realtimeStatus === 'connected'
                    ? 'Connected'
                    : realtimeStatus === 'reconnecting'
                      ? 'Reconnecting'
                      : 'Disconnected'}
                </Badge>
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="uppercase tracking-[0.18em] text-[0.65rem] text-muted-foreground">
                  Selected
                </span>
                {selectedServices.length === 0 ? (
                  <Badge variant="outline">No services selected</Badge>
                ) : (
                  selectedServices.map((service) => (
                    <Badge key={service.id} variant="secondary">
                      {service.name}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
            {lastUpdatedAt && (
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Last updated at {lastUpdatedAt}
              </CardContent>
            )}
          </Card>

          <Card className="metric-card mb-6">
            <CardHeader>
              <CardTitle>Service Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[220px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleClear}>
                  Clear
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">Total: {filteredServices.length}</Badge>
                <Badge variant="secondary">Selected: {selectedIds.length}</Badge>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={`skeleton-${index}`} className="border">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-muted shimmer" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-2/3 bg-muted rounded shimmer" />
                      <div className="h-3 w-1/3 bg-muted rounded shimmer" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <div className="h-5 w-16 bg-muted rounded-full shimmer" />
                      <div className="h-5 w-20 bg-muted rounded-full shimmer" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-muted rounded shimmer" />
                      <div className="h-3 w-5/6 bg-muted rounded shimmer" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-10 bg-muted rounded shimmer" />
                      <div className="h-10 bg-muted rounded shimmer" />
                      <div className="h-10 bg-muted rounded shimmer" />
                    </div>
                    <div className="h-9 w-full bg-muted rounded shimmer" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No services found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {filteredServices.map((service) => {
                const selected = selectedIds.includes(service.id);
                const live = liveMetrics[service.id];
                return (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Card
                    key={service.id}
                    className={`border transition-all ${selected ? 'ring-2 ring-primary/70' : 'hover:shadow-lg'}`}
                  >
                    <CardHeader className="flex flex-row items-center gap-3">
                      <div className="h-12 w-12 rounded-xl border bg-white p-2 shadow-sm">
                        {service.logo_url ? (
                          <img
                            src={service.logo_url}
                            alt={service.name}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            N/A
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                          {service.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{service.provider || 'Unknown'}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {service.category && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {service.category}
                          </Badge>
                        )}
                        {live && (
                          <Badge variant="secondary" className="text-xs">
                            Live @ {live.testedAt}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {service.description || 'No description available.'}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <p className="uppercase">Latency</p>
                          <p className="font-semibold text-foreground">
                            {live?.latency !== undefined && live?.latency !== null
                              ? `${Math.round(live.latency)} ms`
                              : service.base_latency_estimate !== null && service.base_latency_estimate !== undefined
                                ? `${Math.round(service.base_latency_estimate)} ms`
                                : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase">Uptime</p>
                          <p className="font-semibold text-foreground">
                            {live?.uptime !== undefined && live?.uptime !== null
                              ? `${live.uptime.toFixed(1)}%`
                              : service.availability_score !== null && service.availability_score !== undefined
                                ? `${service.availability_score.toFixed(1)}%`
                                : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase">Throughput</p>
                          <p className="font-semibold text-foreground">
                            {live?.throughput !== undefined && live?.throughput !== null
                              ? `${Math.round(live.throughput)}`
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                      <Button className="w-full" onClick={() => toggleSelect(service.id)} variant={selected ? 'secondary' : 'default'}>
                        {selected ? 'Selected' : 'Select for Compare'}
                      </Button>
                    </CardContent>
                  </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {comparisonRows.length > 0 && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-6 lg:sticky lg:top-24 lg:z-10 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2"
            >
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle>Comparison Results</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{comparisonRows.length} services compared</span>
                  {lastUpdatedAt && <span>Last updated at {lastUpdatedAt}</span>}
                </CardContent>
              </Card>
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Latency" fill="hsl(var(--primary))" />
                      <Bar dataKey="Uptime" fill="hsl(var(--accent))" />
                      <Bar dataKey="Throughput" fill="hsl(var(--secondary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

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
                          {comparisonRows.map((service) => (
                            <th key={service.id} className="text-left p-3">
                              {service.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Category</td>
                          {comparisonRows.map((service) => (
                            <td key={service.id} className="p-3">
                              <Badge variant="outline">{service.category}</Badge>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Provider</td>
                          {comparisonRows.map((service) => (
                            <td key={service.id} className="p-3">
                              {service.provider}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Latency (ms)</td>
                          {comparisonRows.map((service) => (
                            <td key={service.id} className="p-3">
                              {Math.round(service.latency)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Throughput</td>
                          {comparisonRows.map((service) => (
                            <td key={service.id} className="p-3">
                              {Math.round(service.throughput)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Uptime (%)</td>
                          {comparisonRows.map((service) => (
                            <td key={service.id} className="p-3">
                              {service.uptime.toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Success Rate (%)</td>
                          {comparisonRows.map((service) => (
                            <td key={service.id} className="p-3">
                              {service.successRate.toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Last Tested</td>
                          {comparisonRows.map((service) => (
                            <td key={service.id} className="p-3">
                              {service.testedAt}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
