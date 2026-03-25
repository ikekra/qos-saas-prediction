import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { extractFunctionErrorMessage, invokeWithLiveToken } from '@/lib/live-token';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { getOperationCost } from '@/lib/token-usage';

export default function RunTest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tokenCheckLoading, setTokenCheckLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [serviceUrl, setServiceUrl] = useState('');
  const [testType, setTestType] = useState<'latency' | 'load' | 'uptime' | 'throughput'>('latency');
  const { tokenUsage, refreshTokenUsage } = useTokenUsage();

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serviceUrl) {
      toast({
        title: "URL Required",
        description: "Please enter a service URL to test",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const requiredTokens = getOperationCost(testType);
      if (tokenUsage.balance < requiredTokens) {
        toast({
          title: "Insufficient tokens",
          description: `You need ${requiredTokens} tokens for this test. Please top up.`,
          variant: "destructive",
        });
        navigate('/profile');
        return;
      }

      // Call edge function to run test
      const { error } = await invokeWithLiveToken('run-qos-test', {
        body: { serviceUrl, testType }
      });

      if (error) throw error;

      toast({
        title: "Test Completed",
        description: `${testType.charAt(0).toUpperCase() + testType.slice(1)} test completed successfully`,
      });
      await refreshTokenUsage();

      // Navigate to reports page
      navigate('/qos/reports');
    } catch (error: any) {
      const message = await extractFunctionErrorMessage(error, "Failed to run test");
      toast({
        title: "Test Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTokenCheckTest = async () => {
    try {
      setTokenCheckLoading(true);
      const { data, error } = await invokeWithLiveToken("token-check-demo", {
        body: {},
      });

      if (error) {
        throw error;
      }
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error?: string }).error);
      }

      toast({
        title: "Token Deducted",
        description: `Deducted ${data?.deducted ?? 500} tokens. Balance: ${data?.balance ?? "-"}${data?.mode ? ` (${data.mode})` : ""}`,
      });
      await refreshTokenUsage();
    } catch (error: any) {
      const message = await extractFunctionErrorMessage(error, "Could not call token-check-demo");
      toast({
        title: "Token Check Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setTokenCheckLoading(false);
    }
  };

  const handleCreateOrderTest = async () => {
    try {
      setOrderLoading(true);
      const { data, error } = await invokeWithLiveToken("payments-create-order", {
        body: { pack: "starter" },
      });

      if (error) {
        throw error;
      }
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error?: string }).error);
      }

      if (data?.isMockAutoVerified) {
        toast({
          title: "Mock Payment Verified",
          description: `Tokens credited. New balance: ${data?.newBalance ?? "-"}`,
        });
        await refreshTokenUsage();
        return;
      }

      if (data?.isMock) {
        const { data: verifyData, error: verifyError } = await invokeWithLiveToken("payments-verify", {
          body: {
            razorpay_order_id: data.orderId,
            razorpay_payment_id: `mock_payment_${crypto.randomUUID()}`,
            razorpay_signature: "mock_signature",
          },
        });

        if (verifyError) {
          throw verifyError;
        }
        if ((verifyData as { error?: string } | null)?.error) {
          throw new Error((verifyData as { error?: string }).error);
        }

        toast({
          title: "Mock Payment Verified",
          description: `Tokens credited. New balance: ${verifyData?.newBalance ?? "-"}`,
        });
        await refreshTokenUsage();
        return;
      }

      toast({
        title: "Order Created",
        description: `Order: ${data?.orderId ?? "-"} | Amount: ${data?.amount ?? "-"} paise | Tokens: ${data?.tokensPurchased ?? "-"}`,
      });
    } catch (error: any) {
      const message = await extractFunctionErrorMessage(error, "Could not call payments-create-order");
      toast({
        title: "Create Order Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setOrderLoading(false);
    }
  };

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
          className="mx-auto max-w-2xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Run Performance Test</h1>
            <p className="text-muted-foreground">
              Test your web service performance with automated QoS analysis
            </p>
            <div className="mt-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Live test orchestration
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Current token balance: <span className="font-semibold text-foreground">{new Intl.NumberFormat('en-IN').format(tokenUsage.balance)}</span>
            </div>
          </div>

          <Card className="shadow-medium hover-scale">
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
              <CardDescription>
                Enter the service URL and select the type of test to perform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRunTest} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="serviceUrl">Service URL</Label>
                  <Input
                    id="serviceUrl"
                    type="url"
                    placeholder="https://api.example.com/endpoint"
                    value={serviceUrl}
                    onChange={(e) => setServiceUrl(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full URL of the API or web service you want to test
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testType">Test Type</Label>
                  <Select value={testType} onValueChange={(value: any) => setTestType(value)}>
                    <SelectTrigger id="testType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latency">Latency Test</SelectItem>
                      <SelectItem value="load">Load Test</SelectItem>
                      <SelectItem value="uptime">Uptime Check</SelectItem>
                      <SelectItem value="throughput">Throughput Test</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {testType === 'latency' && 'Measure response time and server latency'}
                    {testType === 'load' && 'Test performance under various load conditions'}
                    {testType === 'uptime' && 'Check availability and uptime status'}
                    {testType === 'throughput' && 'Measure data transfer rate and bandwidth'}
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Test...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Test
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  onClick={handleTokenCheckTest}
                  disabled={tokenCheckLoading}
                >
                  {tokenCheckLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Token Deduction...
                    </>
                  ) : (
                    "Test Token Deduction (500)"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  onClick={handleCreateOrderTest}
                  disabled={orderLoading}
                >
                  {orderLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    "Test Create Order (Starter)"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="gradient-card shadow-soft hover-scale">
              <CardHeader>
                <CardTitle className="text-lg">Test Accuracy</CardTitle>
                <CardDescription>
                  Our tests run from multiple global locations for accurate results
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="gradient-card shadow-soft hover-scale">
              <CardHeader>
                <CardTitle className="text-lg">Historical Data</CardTitle>
                <CardDescription>
                  All test results are saved for trend analysis and comparison
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

