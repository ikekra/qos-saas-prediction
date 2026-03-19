import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Star, TestTube, TrendingUp, Globe, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { StatusBadge } from '@/components/StatusBadge';
import { MetricCard } from '@/components/MetricCard';
import { requireUser } from '@/lib/auth';

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratings, setRatings] = useState<any[]>([]);
  const [testHistory, setTestHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchServiceDetails();
  }, [id]);

  const fetchServiceDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch service
      const { data: serviceData, error: serviceError } = await supabase
        .from('web_services')
        .select('*')
        .eq('id', id)
        .single();

      if (serviceError) throw serviceError;
      setService(serviceData);

      if (user) {
        // Check if favorited
        const { data: favData } = await supabase
          .from('web_service_favorites')
          .select('*')
          .eq('user_id', user.id)
          .eq('service_id', id)
          .single();

        setIsFavorite(!!favData);

        // Fetch user's rating
        const { data: ratingData } = await supabase
          .from('web_service_ratings')
          .select('*')
          .eq('user_id', user.id)
          .eq('service_id', id)
          .single();

        if (ratingData) {
          setUserRating(ratingData.rating);
          setComment(ratingData.comment || '');
        }
      }

      // Fetch all ratings
      const { data: ratingsData } = await supabase
        .from('web_service_ratings')
        .select('*, profiles(name)')
        .eq('service_id', id)
        .order('created_at', { ascending: false });

      setRatings(ratingsData || []);

      // Fetch test history (match by service URL)
      if (serviceData?.base_url || serviceData?.docs_url) {
        const { data: testsData } = await supabase
          .from('tests')
          .select('*')
          .eq('service_url', serviceData.base_url || serviceData.docs_url)
          .order('created_at', { ascending: false })
          .limit(20);

        setTestHistory(testsData || []);
      } else {
        setTestHistory([]);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading service',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      const user = await requireUser();

      if (isFavorite) {
        await supabase
          .from('web_service_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('service_id', id);
      } else {
        await supabase
          .from('web_service_favorites')
          .insert({ user_id: user.id, service_id: id });
      }

      setIsFavorite(!isFavorite);
      toast({
        title: isFavorite ? 'Removed from favorites' : 'Added to favorites',
      });
    } catch (error: any) {
      if (error?.message?.includes('Authentication')) {
        navigate('/auth/login');
      }
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const submitRating = async () => {
    try {
      const user = await requireUser();

      if (userRating === 0) {
        toast({
          title: 'Please select a rating',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.from('web_service_ratings').upsert({
        user_id: user.id,
        service_id: id,
        rating: userRating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      toast({
        title: 'Rating submitted',
        description: 'Thank you for your feedback!',
      });

      fetchServiceDetails();
    } catch (error: any) {
      if (error?.message?.includes('Authentication')) {
        navigate('/auth/login');
      }
      toast({
        title: 'Error submitting rating',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8 relative">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8 relative">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <div className="text-center">Service not found</div>
        </div>
      </div>
    );
  }

  const chartData = testHistory.map((test) => ({
    time: new Date(test.created_at).toLocaleTimeString(),
    latency: test.latency ?? 0,
    throughput: test.throughput ?? 0,
  }));

  const displayName = service.service_name || service.name || 'Service';
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + Number(r.rating || 0), 0) / ratings.length
    : Number(service.avg_rating || 0);
  const totalRatings = service.total_ratings ?? ratings.length;
  const status = service.availability_score >= 99
    ? 'stable'
    : service.availability_score >= 97
      ? 'degrading'
      : 'critical';

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
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => navigate('/services')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Services
          </Button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">{displayName}</h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  {service.base_url || service.docs_url}
                </span>
                {service.category && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    {service.category}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isFavorite ? 'default' : 'outline'}
                onClick={toggleFavorite}
                className="gap-2"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                {isFavorite ? 'Favorited' : 'Add to Favorites'}
              </Button>
              <Link to="/qos/run-test">
                <Button className="gap-2">
                  <TestTube className="h-4 w-4" />
                  Run Test
                </Button>
              </Link>
            </div>
          </div>

          {service.description && (
            <p className="text-lg text-muted-foreground mb-8">{service.description}</p>
          )}

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <MetricCard
              title="Average Latency"
              value={`${(service.avg_latency ?? service.base_latency_estimate ?? 0).toFixed(0)}ms`}
              icon={TrendingUp}
              status={status}
            />
            <MetricCard
              title="Average Rating"
              value={avgRating.toFixed(1)}
              subtitle={`${totalRatings || 0} ratings`}
              icon={Star}
            />
            <Card className="metric-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <div className="mt-2">
                      <StatusBadge status={status} showIcon />
                    </div>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle>Latency Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="time" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="metric-card">
                <CardHeader>
                  <CardTitle>Throughput</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="time" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="throughput"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="metric-card mb-8">
            <CardHeader>
              <CardTitle>Rate This Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setUserRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= userRating
                          ? 'fill-primary text-primary'
                          : 'text-muted'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="Add a comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <Button onClick={submitRating}>Submit Rating</Button>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardHeader>
              <CardTitle>User Reviews ({ratings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {ratings.length > 0 ? (
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div key={rating.id} className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {rating.profiles?.name || 'Anonymous'}
                        </span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < rating.rating
                                  ? 'fill-primary text-primary'
                                  : 'text-muted'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rating.comment && (
                        <p className="text-muted-foreground">{rating.comment}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(rating.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No reviews yet. Be the first to rate this service!
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

