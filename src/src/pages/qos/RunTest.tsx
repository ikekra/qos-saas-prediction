import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play } from 'lucide-react';

export default function RunTest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [serviceUrl, setServiceUrl] = useState('');
  const [testType, setTestType] = useState<'latency' | 'load' | 'uptime' | 'throughput'>('latency');

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

      // Call edge function to run test
      const { data, error } = await supabase.functions.invoke('run-qos-test', {
        body: { serviceUrl, testType }
      });

      if (error) throw error;

      toast({
        title: "Test Completed",
        description: `${testType.charAt(0).toUpperCase() + testType.slice(1)} test completed successfully`,
      });

      // Navigate to reports page
      navigate('/qos/reports');
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to run test",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">Run Performance Test</h1>
            <p className="text-muted-foreground">
              Test your web service performance with automated QoS analysis
            </p>
          </div>

          <Card className="shadow-medium animate-slide-up">
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

                <Button type="submit" disabled={loading} className="w-full" size="lg">
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
              </form>
            </CardContent>
          </Card>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="gradient-card shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg">Test Accuracy</CardTitle>
                <CardDescription>
                  Our tests run from multiple global locations for accurate results
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="gradient-card shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg">Historical Data</CardTitle>
                <CardDescription>
                  All test results are saved for trend analysis and comparison
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
