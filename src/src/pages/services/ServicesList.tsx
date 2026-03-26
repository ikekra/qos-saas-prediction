import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { ServiceCard } from '@/components/ServiceCard';
import { Badge } from '@/components/ui/badge';
import { extractFunctionErrorMessage, invokeWithLiveToken } from '@/lib/live-token';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { getOperationCost } from '@/lib/token-usage';

export default function ServicesList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tokenUsage, refreshTokenUsage, applyOptimisticBalance } = useTokenUsage();
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, { latency: number; uptime: number; throughput: number; testedAt: string; recommendation?: string }>>({});
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

  useEffect(() => {
    filterServices();
  }, [searchTerm, categoryFilter, services]);

  const fetchServices = async () => {
    try {
      const activeQuery = await supabase
        .from('web_services')
        .select('id, name, category, provider, description, logo_url, availability_score, base_latency_estimate, base_url, docs_url, is_active')
        .eq('is_active', true)
        .order('availability_score', { ascending: false });

      if (activeQuery.error) throw activeQuery.error;

      if ((activeQuery.data || []).length > 0) {
        setServices(activeQuery.data || []);
        return;
      }

      // Fallback: show all services if is_active flag is missing/false in inserted rows.
      const allQuery = await supabase
        .from('web_services')
        .select('id, name, category, provider, description, logo_url, availability_score, base_latency_estimate, base_url, docs_url, is_active')
        .order('availability_score', { ascending: false });

      if (allQuery.error) throw allQuery.error;
      setServices(allQuery.data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading services',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = services;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter((s) => s.category === categoryFilter);
    }

    setFilteredServices(filtered);
  };

  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))];

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
        .channel(`services-list-tests-${userId}`)
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
            };
            const serviceId = serviceUrlToId.get(row.service_url);
            if (!serviceId) return;
            setLiveMetrics((prev) => ({
              ...prev,
              [serviceId]: {
                latency: Number(row.latency ?? 0),
                throughput: Number(row.throughput ?? 0),
                uptime: Number(row.uptime ?? 0),
                testedAt: new Date().toLocaleTimeString(),
                recommendation: getRecommendation({
                  latency: Number(row.latency ?? 0),
                  throughput: Number(row.throughput ?? 0),
                  uptime: Number(row.uptime ?? 0),
                }),
              },
            }));
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
  }, [userId, serviceUrlToId, toast]);

  const getStatus = (availability?: number | null) => {
    if (availability === null || availability === undefined) return 'stable';
    if (availability < 95) return 'critical';
    if (availability < 98) return 'degrading';
    return 'stable';
  };

  const getRecommendation = (metrics: { latency?: number; uptime?: number; throughput?: number }) => {
    const latency = metrics.latency ?? 0;
    const uptime = metrics.uptime ?? 0;
    const throughput = metrics.throughput ?? 0;

    const latencyScore = latency <= 200 ? 2 : latency <= 500 ? 1 : 0;
    const uptimeScore = uptime >= 99 ? 2 : uptime >= 97 ? 1 : 0;
    const throughputScore = throughput >= 200 ? 2 : throughput >= 80 ? 1 : 0;

    const total = latencyScore + uptimeScore + throughputScore;
    if (total >= 5) return 'Excellent for production workloads.';
    if (total >= 3) return 'Good performance. Monitor latency spikes.';
    if (total >= 2) return 'Fair. Consider alternatives for critical paths.';
    return 'Use cautiously. Performance is below recommended thresholds.';
  };

  const runLiveTest = async (service: any) => {
    const testUrl = service.base_url || service.docs_url;
    if (!testUrl) {
      toast({
        title: 'No test URL',
        description: 'This service does not have a testable URL yet.',
        variant: 'destructive',
      });
      return;
    }

    setRunningId(service.id);
    try {
      const requiredTokens =
        getOperationCost('latency') + getOperationCost('throughput') + getOperationCost('uptime');
      if (tokenUsage.balance < requiredTokens) {
        toast({
          title: 'Insufficient tokens',
          description: `Live test needs ${requiredTokens} tokens. Please top up first.`,
          variant: 'destructive',
        });
        navigate('/profile');
        return;
      }

      const runTest = async (testType: 'latency' | 'throughput' | 'uptime') => {
        const { data, error } = await invokeWithLiveToken('run-qos-test', {
          body: { serviceUrl: testUrl, testType },
        });
        if (error) throw error;
        if (typeof data?.token?.balance === 'number') {
          applyOptimisticBalance(data.token.balance);
        }
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
      };

      const recommendation = getRecommendation(merged);

      setLiveMetrics((prev) => ({
        ...prev,
        [service.id]: {
          ...merged,
          testedAt: new Date().toLocaleTimeString(),
          recommendation,
        },
      }));

      toast({
        title: 'Live tests completed',
        description: `Latency ${Math.round(merged.latency)}ms | Uptime ${merged.uptime.toFixed(1)}%`,
      });
      await refreshTokenUsage();
    } catch (error: any) {
      const message = await extractFunctionErrorMessage(error, 'Unable to run test.');
      toast({
        title: 'Live test failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Services</h1>
              <p className="text-muted-foreground">Browse and test web services</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="uppercase tracking-[0.18em] text-[0.65rem]">Realtime</span>
                <Badge variant={realtimeStatus === 'connected' ? 'secondary' : 'outline'}>
                  {realtimeStatus === 'connected'
                    ? 'Connected'
                    : realtimeStatus === 'reconnecting'
                      ? 'Reconnecting'
                      : 'Disconnected'}
                </Badge>
              </div>
            </div>
            <Link to="/services/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Service
              </Button>
            </Link>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12">Loading services...</div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredServices.map((service) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => navigate(`/directory/${service.id}`)}
                >
                  {(() => {
                    const live = liveMetrics[service.id];
                    const latency = live?.latency ?? service.base_latency_estimate ?? 0;
                    const uptime = live?.uptime ?? service.availability_score ?? 99.5;
                    const throughput = live?.throughput ?? null;
                    const lastTested = live ? `Live @ ${live.testedAt}` : 'Estimated';
                    const displayUrl = service.base_url || service.docs_url || null;
                    const recommendation = live?.recommendation || null;
                    return (
                      <>
                        <ServiceCard
                          serviceName={service.name}
                          serviceUrl={displayUrl}
                          latency={Math.round(latency)}
                          uptime={Number(uptime.toFixed ? uptime.toFixed(1) : uptime)}
                          throughput={throughput}
                          recommendation={recommendation}
                          status={getStatus(service.availability_score)}
                          lastTested={lastTested}
                          trend="stable"
                          onRunTest={() => runLiveTest(service)}
                          runningTest={runningId === service.id}
                          runTestDisabled={!displayUrl}
                        />
                        <div className="flex items-center justify-between mt-2 px-2 text-sm text-muted-foreground">
                          <span className="truncate">{service.provider}</span>
                          <span>
                            {service.availability_score ? `${service.availability_score.toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No services found</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

