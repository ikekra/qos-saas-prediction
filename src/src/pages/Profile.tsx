import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Building, Calendar, Heart, TestTube, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { ServiceCard } from '@/components/ServiceCard';
import { ScrollableRow } from '@/components/ScrollableRow';
import { requireUser } from '@/lib/auth';

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileExists, setProfileExists] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchUserActivity();
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setProfileExists(true);
        return;
      }

      const draftProfile = {
        id: user.id,
        email: user.email ?? '',
        name: 'User',
        username: null,
        bio: null,
        organization: null,
      };
      setProfileExists(false);
      setProfile(draftProfile);

      const { error: createError } = await supabase.from('profiles').upsert(draftProfile);
      if (createError) throw createError;

      setProfileExists(true);
      setBanner('Profile created successfully.');
    } catch (error: any) {
      toast({
        title: 'Error loading profile',
        description:
          error.message ||
          'Unable to load or create your profile. Make sure your Supabase policies allow inserting profiles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserActivity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch favorites with service details
      const { data: favData } = await supabase
        .from('user_favorites')
        .select('*, services(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent tests
      const { data: testsData } = await supabase
        .from('test_results')
        .select('*, services(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch user ratings
      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('*, services(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setFavorites(favData || []);
      setRecentTests(testsData || []);
      setRatings(ratingsData || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await requireUser();
      const name = (profile?.name || '').trim() || 'User';
      const username = (profile?.username || '').trim() || null;
      const bio = (profile?.bio || '').trim() || null;
      const organization = (profile?.organization || '').trim() || null;
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name,
          email: user.email ?? profile.email,
          username,
          bio,
          organization,
        });

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully.',
      });
      setProfileExists(true);
      setBanner('Profile saved successfully.');
    } catch (error: any) {
      if (error?.message?.includes('Authentication')) {
        navigate('/auth/login');
      }
      toast({
        title: 'Error saving profile',
        description:
          error.message ||
          'Save failed. This can happen if your profile policies don’t allow insert/update or required fields are missing.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-4xl font-bold mb-2">My Profile</h1>
          <p className="text-muted-foreground mb-8">Manage your account and view your activity</p>
          {banner && (
            <Card className="metric-card mb-6 border-emerald-500/50">
              <CardContent className="py-4 text-emerald-700">{banner}</CardContent>
            </Card>
          )}

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList>
              <TabsTrigger value="profile">Profile Info</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        <User className="inline h-4 w-4 mr-2" />
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        value={profile?.name || ''}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">
                        <User className="inline h-4 w-4 mr-2" />
                        Username
                      </Label>
                      <Input
                        id="username"
                        value={profile?.username || ''}
                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      <Mail className="inline h-4 w-4 mr-2" />
                      Email
                    </Label>
                    <Input id="email" value={profile?.email || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">
                      <Building className="inline h-4 w-4 mr-2" />
                      Organization
                    </Label>
                    <Input
                      id="organization"
                      value={profile?.organization || ''}
                      onChange={(e) => setProfile({ ...profile, organization: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profile?.bio || ''}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <div className="space-y-6">
                <Card className="metric-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TestTube className="h-5 w-5" />
                      Recent Tests ({recentTests.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentTests.length > 0 ? (
                      <div className="space-y-3">
                        {recentTests.map((test) => (
                          <div key={test.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium">{test.services?.name || 'Unknown Service'}</p>
                              <p className="text-sm text-muted-foreground">
                                {test.test_type} • {test.latency}ms
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(test.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No tests yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="metric-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      Your Ratings ({ratings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ratings.length > 0 ? (
                      <div className="space-y-3">
                        {ratings.map((rating) => (
                          <div key={rating.id} className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium">{rating.services?.name || 'Unknown Service'}</p>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${i < rating.rating ? 'fill-primary text-primary' : 'text-muted'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            {rating.comment && (
                              <p className="text-sm text-muted-foreground">{rating.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No ratings yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="favorites">
              <Card className="metric-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Favorite Services ({favorites.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {favorites.length > 0 ? (
                    <ScrollableRow title="">
                      {favorites.map((fav) => (
                        <ServiceCard
                          key={fav.id}
                          serviceName={fav.services?.name || 'Unknown'}
                          latency={fav.services?.avg_latency || 0}
                          uptime={99.5}
                          status={fav.services?.status || 'stable'}
                          lastTested="Recently"
                        />
                      ))}
                    </ScrollableRow>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No favorites yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
