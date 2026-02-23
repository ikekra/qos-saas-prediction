import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Sparkles, TrendingUp, Star } from 'lucide-react';
import { ScrollableRow } from '@/components/ScrollableRow';
import { ServiceCard } from '@/components/ServiceCard';
import { useNavigate } from 'react-router-dom';

export default function Recommendations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [keywordRecs, setKeywordRecs] = useState<any[]>([]);
  const [userRecs, setUserRecs] = useState<any[]>([]);

  useEffect(() => {
    fetchUserRecommendations();
  }, []);

  const fetchUserRecommendations = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-recommendations', {
        body: { type: 'user' },
      });

      if (error) throw error;

      if (data?.recommendations) {
        setUserRecs(data.recommendations);
      }
    } catch (error: any) {
      console.error('Error fetching user recommendations:', error);
    }
  };

  const handleKeywordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim()) return;

    setLoading(true);
    try {
      const keywordArray = keywords.split(',').map((k) => k.trim()).filter(Boolean);

      const { data, error } = await supabase.functions.invoke('get-recommendations', {
        body: {
          type: 'keywords',
          keywords: keywordArray,
        },
      });

      if (error) throw error;

      if (data?.recommendations) {
        setKeywordRecs(data.recommendations);
        toast({
          title: 'Recommendations found',
          description: `Found ${data.recommendations.length} matching services`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch recommendations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceClick = (serviceId: string) => {
    navigate(`/services/${serviceId}`);
  };

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
              <Sparkles className="h-10 w-10 text-primary" />
              AI Recommendations
            </h1>
            <p className="text-muted-foreground text-lg">
              Discover services tailored to your needs with intelligent recommendations
            </p>
          </div>

          {/* Keyword Search */}
          <Card className="metric-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search by Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleKeywordSearch} className="flex gap-3">
                <Input
                  placeholder="e.g., api, storage, auth (comma-separated)"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </form>
              {keywordRecs.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Keyword Matches</h3>
                  <ScrollableRow title="">
                    {keywordRecs.map((service) => (
                      <motion.div
                        key={service.id}
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card
                          className="metric-card cursor-pointer w-[300px]"
                          onClick={() => handleServiceClick(service.id)}
                        >
                          <CardHeader>
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{service.category}</Badge>
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-primary text-primary" />
                                <span>{service.avg_rating?.toFixed(1) || '0.0'}</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {service.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs bg-primary/10 rounded-md px-3 py-2">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              <span className="text-primary font-medium">{service.reason}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </ScrollableRow>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User-based Recommendations */}
          {userRecs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Recommended For You
              </h2>
              <ScrollableRow title="">
                {userRecs.map((service) => (
                  <motion.div
                    key={service.id}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="metric-card cursor-pointer w-[300px]"
                      onClick={() => handleServiceClick(service.id)}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{service.category}</Badge>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span>{service.avg_rating?.toFixed(1) || '0.0'}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {service.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {service.tags?.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs bg-accent/10 rounded-md px-3 py-2">
                          <Sparkles className="h-4 w-4 text-accent" />
                          <span className="text-accent font-medium">{service.reason}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </ScrollableRow>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
