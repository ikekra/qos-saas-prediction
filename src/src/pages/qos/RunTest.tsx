import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { extractFunctionErrorMessage, invokeWithLiveToken } from '@/lib/live-token';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { getOperationCost } from '@/lib/token-usage';
import { Loader2, Play, RefreshCw, Rocket, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TokenWidget } from '@/components/TokenWidget';

type TestType = 'latency' | 'load' | 'uptime' | 'throughput';

type QuotaState = {
  plan: 'standard' | 'pro' | 'enterprise';
  runLimit: number;
  runsUsed: number;
  runsRemaining: number;
  resetDate: string;
  warning?: string | null;
  exhaustedMessage?: string | null;
  ctaLabel?: string | null;
  orgId?: string | null;
  summary?: string | null;
};

type RunResult = {
  data?: {
    id: string;
    service_url: string;
    service_id?: string | null;
    test_type: TestType;
    created_at: string;
    latency: number | null;
    uptime: number | null;
    throughput: number | null;
    success_rate: number | null;
    status: string | null;
    error_message: string | null;
  };
  results?: {
    latency: number | null;
    uptime: number | null;
    throughput: number | null;
    success_rate: number | null;
  };
  predicted_efficiency?: number;
  token?: {
    mode: 'cached' | 'live';
    reserved: number;
    deducted: number;
    refunded: number;
    balance: number;
  };
  cache?: {
    hit: boolean;
    ttlSeconds: number;
    cachedAt?: string;
  };
  quota?: QuotaState;
};

const TEST_TYPES: Array<{ value: TestType; label: string; cost: number }> = [
  { value: 'uptime', label: 'Health Check', cost: getOperationCost('uptime') },
  { value: 'latency', label: 'Latency Test', cost: getOperationCost('latency') },
  { value: 'load', label: 'Load Test', cost: getOperationCost('load') },
  { value: 'throughput', label: 'Throughput Test', cost: getOperationCost('throughput') },
];

const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(Math.round(value));

const deriveEfficiencyScore = (results?: RunResult['results']) => {
  if (!results) return 0;

  const latency = Number(results.latency ?? 0);
  const hasThroughput = typeof results.throughput === 'number' && Number.isFinite(results.throughput);
  const throughput = Number(results.throughput ?? 0);
  const availability = Number(results.uptime ?? 0);
  const reliability = Number(results.success_rate ?? 0);
  const latencyScore = Math.max(0, Math.min(100, 100 - latency / 10));
  const throughputScore = Math.max(0, Math.min(100, throughput));
  const score = hasThroughput
    ? availability * 0.35 + reliability * 0.35 + latencyScore * 0.2 + throughputScore * 0.1
    : availability * 0.4 + reliability * 0.35 + latencyScore * 0.25;

  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
};

const qosBand = (score: number) => {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600' };
  if (score >= 65) return { label: 'Good', color: 'text-lime-600' };
  if (score >= 45) return { label: 'Fair', color: 'text-amber-600' };
  return { label: 'Needs Attention', color: 'text-rose-600' };
};

const formatMetric = (value: number | null | undefined, suffix = '') =>
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : 'N/A';

export default function RunTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tokenUsage, refreshTokenUsage, deductTokens, refundTokens, applyOptimisticBalance } = useTokenUsage();
  const [loading, setLoading] = useState(false);
  const [serviceUrl, setServiceUrl] = useState('');
  const [testType, setTestType] = useState<TestType>('latency');
  const [forceFresh, setForceFresh] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [baselineResult, setBaselineResult] = useState<RunResult | null>(null);
  const [recentTests, setRecentTests] = useState<Array<{ id: string; service_url: string; test_type: string; created_at: string; status: string | null }>>([]);
  const [serviceOptions, setServiceOptions] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [selectedService, setSelectedService] = useState<string>('manual');
  const [runAllLoading, setRunAllLoading] = useState(false);
  const [quota, setQuota] = useState<QuotaState | null>(null);

  const isValidHttpUrl = (value: string) => {
    if (!value || value === '#') return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const selectedCost = useMemo(() => getOperationCost(testType), [testType]);
  const estimatedAfter = useMemo(() => Math.max(0, tokenUsage.balance - selectedCost), [selectedCost, tokenUsage.balance]);

  const loadQuota = async () => {
    const { data, error } = await invokeWithLiveToken<{ quota?: QuotaState; error?: string }>('get-performance-quota');
    if (error) return;
    if (data?.quota) setQuota(data.quota);
  };

  const applyQuotaState = (nextQuota?: QuotaState | null) => {
    if (!nextQuota) return;
    setQuota(nextQuota);
  };

  const parseQuotaError = async (error: unknown) => {
    const maybeError = error as { context?: { json?: () => Promise<unknown> } };
    if (!maybeError?.context || typeof maybeError.context.json !== 'function') return null;

    try {
      const payload = (await maybeError.context.json()) as { error?: string; quota?: QuotaState };
      return payload;
    } catch {
      return null;
    }
  };

  const loadRecent = async () => {
    try {
      const { data } = await supabase
        .from('tests')
        .select('id, service_url, test_type, created_at, status')
        .order('created_at', { ascending: false })
        .limit(6);
      setRecentTests((data as any) || []);
    } catch {
      setRecentTests([]);
    }
  };

  useEffect(() => {
    void loadRecent();
    void loadQuota();
  }, []);

  useEffect(() => {
    const initServices = async () => {
      try {
        const { data, error } = await supabase
          .from('web_services')
          .select('id, name, base_url, docs_url, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (error) throw error;
        const options =
          (data || [])
            .map((s: any) => ({ id: s.id as string, name: s.name as string, url: (s.base_url || s.docs_url || '') as string }))
            .filter((s) => isValidHttpUrl(s.url));
        setServiceOptions(options);
      } catch {
        try {
          const { data } = await supabase
            .from('web_services')
            .select('id, name, base_url, is_active')
            .eq('is_active', true)
            .order('name', { ascending: true });
          const options =
            (data || [])
              .map((s: any) => ({ id: s.id as string, name: s.name as string, url: (s.base_url || '') as string }))
              .filter((s) => isValidHttpUrl(s.url));
          setServiceOptions(options);
        } catch {
          setServiceOptions([]);
        }
      }
    };
    void initServices();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const url = params.get('serviceUrl');
    if (url) {
      setServiceUrl(url);
      const match = serviceOptions.find((s) => s.url === url);
      if (match) setSelectedService(match.id);
    }
  }, [location.search, serviceOptions]);

  const runTest = async (override?: { serviceUrl?: string; forceFresh?: boolean }) => {
    const activeUrl = (override?.serviceUrl ?? serviceUrl).trim();
    const activeForceFresh = override?.forceFresh ?? forceFresh;
    if (!activeUrl) {
      toast({ title: 'URL Required', description: 'Please enter service URL', variant: 'destructive' });
      return;
    }

    if (!isValidHttpUrl(activeUrl)) {
      toast({
        title: 'Invalid URL',
        description: 'Please use a valid http(s) service URL. Placeholder values like # cannot be tested.',
        variant: 'destructive',
      });
      return;
    }

    if (quota?.runsRemaining === 0 && quota.exhaustedMessage) {
      toast({ title: 'Run limit reached', description: quota.exhaustedMessage, variant: 'destructive' });
      return;
    }

    if (tokenUsage.balance < selectedCost && !activeForceFresh) {
      toast({
        title: 'Insufficient tokens',
        description: `Need ${selectedCost} tokens. Please top up.`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setStatusText(`Reserving ${selectedCost} tokens...`);
    const shouldOptimisticDeduct = !activeForceFresh;
    if (shouldOptimisticDeduct) deductTokens(selectedCost);

    try {
      const { data, error } = await invokeWithLiveToken<RunResult>('run-qos-test', {
        body: {
          serviceUrl: activeUrl,
          serviceId: selectedService !== 'manual' ? selectedService : null,
          testType,
          forceFresh: activeForceFresh,
          isScheduled: false,
          batchSize: 1,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setStatusText('Completed');
      setLastResult(data ?? null);
      applyQuotaState(data?.quota);
      if (compareEnabled && !baselineResult && data) setBaselineResult(data);

      if (typeof data?.token?.balance === 'number') {
        applyOptimisticBalance(data.token.balance);
      }

      if (shouldOptimisticDeduct && data?.token?.mode === 'cached') {
        refundTokens(selectedCost);
      }
      if (shouldOptimisticDeduct && (data?.token?.refunded ?? 0) > 0) {
        refundTokens(data?.token?.refunded ?? 0);
      }

      if (data?.token?.mode === 'cached') {
        toast({
          title: 'Cached result',
          description: `0 tokens used (cached within ${data.cache?.ttlSeconds ?? 60}s).`,
        });
      } else {
        const refunded = data?.token?.refunded ?? 0;
        const deducted = data?.token?.deducted ?? selectedCost;
        toast({
          title: 'Test completed',
          description:
            data?.quota?.summary ??
            (refunded > 0
              ? `${deducted} tokens deducted, ${refunded} refunded.`
              : `${deducted} tokens deducted.`),
        });
      }

      if (data?.quota?.warning) {
        toast({
          title: 'Quota update',
          description: data.quota.warning,
        });
      }

      await refreshTokenUsage();
      await loadRecent();
      await loadQuota();
      navigate('/qos/reports');
    } catch (error) {
      setStatusText('Failed');
      if (shouldOptimisticDeduct) refundTokens(selectedCost);
      const quotaError = await parseQuotaError(error);
      if (quotaError?.quota) applyQuotaState(quotaError.quota);
      const message = quotaError?.error || await extractFunctionErrorMessage(error, 'Failed to run test');
      toast({ title: 'Run failed', description: message, variant: 'destructive' });
      await refreshTokenUsage();
      await loadQuota();
    } finally {
      setLoading(false);
    }
  };

  const score = Number(lastResult?.predicted_efficiency ?? deriveEfficiencyScore(lastResult?.results));
  const band = qosBand(score);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Run QoS Test</h1>
            <p className="text-sm text-muted-foreground">Live testing with reservation-based token accounting</p>
          </div>
          <TokenWidget />
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Test Config</CardTitle>
              <CardDescription>Choose endpoint, type, and cost mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {quota && (
                <div className={`rounded-lg border p-3 text-sm ${quota.runsRemaining === 0 ? 'border-rose-300 bg-rose-50' : 'border-border'}`}>
                  <p className="font-medium capitalize">{quota.plan} plan run quota</p>
                  <p>{quota.runsUsed} / {quota.runLimit} runs used</p>
                  <p>{quota.runsRemaining} runs remaining until {new Date(quota.resetDate).toLocaleDateString()}</p>
                  {quota.orgId && <p className="text-xs text-muted-foreground mt-1">Org scope: {quota.orgId}</p>}
                  {quota.warning && <p className="mt-2 text-amber-700">{quota.warning}</p>}
                  {quota.exhaustedMessage && <p className="mt-2 text-rose-700">{quota.exhaustedMessage}</p>}
                  {quota.ctaLabel && (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      variant={quota.plan === 'standard' ? 'default' : 'outline'}
                      onClick={() => {
                        if (quota.plan === 'standard') {
                          window.location.href = '/settings/billing';
                          return;
                        }
                        window.location.href = 'mailto:sales@qoscollab.com?subject=Enterprise%20Run%20Quota';
                      }}
                    >
                      {quota.ctaLabel}
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="serviceUrl">Endpoint URL</Label>
                <Select
                  value={selectedService}
                  onValueChange={(value) => {
                    setSelectedService(value);
                    if (value === 'manual') return;
                    const option = serviceOptions.find((s) => s.id === value);
                    if (option) setServiceUrl(option.url);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from registered services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual URL</SelectItem>
                    {serviceOptions.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="serviceUrl"
                  placeholder="https://api.example.com/health"
                  value={serviceUrl}
                  onChange={(e) => setServiceUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Test Type</Label>
                <div className="space-y-2">
                  {TEST_TYPES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTestType(option.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        testType === option.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{option.cost} tokens</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <p>This test: <span className="font-semibold">{selectedCost} tokens</span></p>
                <p>After run: <span className="font-semibold">{formatNumber(estimatedAfter)} tokens</span></p>
                <p className="text-xs text-muted-foreground mt-1">Duplicate runs within 60s may return cached result at 0 token cost.</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Force Fresh Run</p>
                  <p className="text-xs text-muted-foreground">Bypass cache and charge full tokens</p>
                </div>
                <Switch checked={forceFresh} onCheckedChange={setForceFresh} />
              </div>

              <Button className="w-full" disabled={loading || quota?.runsRemaining === 0} onClick={() => void runTest()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {statusText}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Test
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                variant="secondary"
                disabled={runAllLoading || serviceOptions.length === 0 || quota?.runsRemaining === 0}
                onClick={async () => {
                  setRunAllLoading(true);
                  try {
                    let success = 0;
                    let failed = 0;
                    for (const service of serviceOptions) {
                      const { data, error } = await invokeWithLiveToken<RunResult>('run-qos-test', {
                        body: {
                          serviceUrl: service.url,
                          serviceId: service.id,
                          testType,
                          forceFresh: false,
                          isScheduled: false,
                          batchSize: serviceOptions.length,
                        },
                      });
                      if (error) {
                        failed += 1;
                        const quotaError = await parseQuotaError(error);
                        if (quotaError?.quota) {
                          applyQuotaState(quotaError.quota);
                          if (quotaError.quota.runsRemaining === 0) break;
                        }
                      } else {
                        success += 1;
                        applyQuotaState(data?.quota);
                        if (typeof data?.token?.balance === 'number') {
                          applyOptimisticBalance(data.token.balance);
                        }
                      }
                    }
                    await refreshTokenUsage();
                    await loadRecent();
                    await loadQuota();
                    toast({
                      title: 'Run-all finished',
                      description: `Success: ${success}, Failed: ${failed}`,
                    });
                    if (success > 0) {
                      navigate('/qos/reports');
                    }
                  } catch (error) {
                    const message = await extractFunctionErrorMessage(error, 'Run-all failed');
                    toast({ title: 'Run-all failed', description: message, variant: 'destructive' });
                  } finally {
                    setRunAllLoading(false);
                  }
                }}
              >
                {runAllLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running all services...
                  </>
                ) : (
                  'Run Test For All Services'
                )}
              </Button>

              <Button variant="outline" className="w-full" onClick={() => toast({ title: 'Coming next', description: 'Scheduled runs with 20% discount will be wired next.' })}>
                <Timer className="mr-2 h-4 w-4" />
                Save as Scheduled
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Live Results</CardTitle>
              <CardDescription>{lastResult?.data?.service_url ?? 'Run a test to see metrics'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!lastResult ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Results will appear here after test execution.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Realtime QoS Score</p>
                      <p className={`text-3xl font-bold ${band.color}`}>{Math.round(score)}/100</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lastResult.cache?.hit ? 'outline' : 'secondary'}>
                        {lastResult.cache?.hit ? 'Cached' : 'Realtime'}
                      </Badge>
                      <Badge variant={lastResult.data?.status === 'completed' ? 'secondary' : 'destructive'}>
                        {lastResult.data?.status?.toUpperCase() ?? 'UNKNOWN'}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={Math.max(0, Math.min(100, score))} />
                  <p className={`text-sm font-medium ${band.color}`}>{band.label}</p>

                  {lastResult.cache?.hit && <Badge variant="outline">Cached result - 0 tokens used</Badge>}
                  {!lastResult.cache?.hit && <p className="text-xs text-muted-foreground">Live run completed at {new Date().toLocaleTimeString()}</p>}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Latency</p>
                      <p className="text-lg font-semibold">{formatMetric(lastResult.results?.latency, ' ms')}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Uptime</p>
                      <p className="text-lg font-semibold">{formatMetric(lastResult.results?.uptime, '%')}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Error Rate</p>
                      <p className="text-lg font-semibold">{Math.max(0, 100 - Math.round(lastResult.results?.success_rate ?? 0))}%</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Throughput (req/s)</p>
                      <p className="text-lg font-semibold">{formatMetric(lastResult.results?.throughput)}</p>
                    </div>
                  </div>

                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Tokens: reserved {lastResult.token?.reserved ?? 0}, deducted {lastResult.token?.deducted ?? 0}, refunded {lastResult.token?.refunded ?? 0}
                  </p>
                  {lastResult.quota?.summary && <p className="text-xs text-muted-foreground">{lastResult.quota.summary}</p>}
                  {lastResult.quota?.warning && <p className="text-xs text-amber-700">{lastResult.quota.warning}</p>}
                  <p className="text-xs text-muted-foreground">Run status: {statusText}</p>
                  {lastResult.data?.error_message && <p className="text-xs text-amber-600">Error note: {lastResult.data.error_message}</p>}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void runTest()}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Re-run
                    </Button>
                    <Button variant="outline" onClick={() => setCompareEnabled((v) => !v)}>
                      {compareEnabled ? 'Disable Compare' : 'Enable Compare'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Recent Tests</CardTitle>
              <CardDescription>Quick rerun and force-refresh</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTests.length === 0 && <p className="text-sm text-muted-foreground">No recent tests yet.</p>}
              {recentTests.map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-sm">
                  <p className="line-clamp-1 font-medium">{item.service_url}</p>
                  <p className="text-xs text-muted-foreground">{item.test_type} | {new Date(item.created_at).toLocaleTimeString()}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setServiceUrl(item.service_url);
                        setTestType((item.test_type as TestType) || 'latency');
                        void runTest({ serviceUrl: item.service_url });
                      }}
                    >
                      Re-run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setServiceUrl(item.service_url);
                        setTestType((item.test_type as TestType) || 'latency');
                        void runTest({ serviceUrl: item.service_url, forceFresh: true });
                      }}
                    >
                      <Rocket className="mr-1 h-3.5 w-3.5" />
                      Force
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {compareEnabled && baselineResult && lastResult && baselineResult.data?.id !== lastResult.data?.id && (
          <Card>
            <CardHeader>
              <CardTitle>Compare Mode</CardTitle>
              <CardDescription>Latest run vs baseline run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-4 rounded-lg border p-3 font-medium">
                <span>Metric</span>
                <span>Baseline</span>
                <span>Latest</span>
                <span>Change</span>
              </div>
              {(['latency', 'uptime', 'throughput'] as const).map((metric) => {
                const oldValue = Number((baselineResult.results as any)?.[metric] ?? 0);
                const newValue = Number((lastResult.results as any)?.[metric] ?? 0);
                const delta = oldValue === 0 ? 0 : ((newValue - oldValue) / oldValue) * 100;
                return (
                  <div key={metric} className="grid grid-cols-4 rounded-lg border p-3">
                    <span className="capitalize">{metric}</span>
                    <span>{Math.round(oldValue)}</span>
                    <span>{Math.round(newValue)}</span>
                    <span className={delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : ''}>
                      {delta >= 0 ? '+' : ''}
                      {Math.round(delta)}%
                    </span>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={() => setBaselineResult(lastResult)}>Set Latest as Baseline</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
