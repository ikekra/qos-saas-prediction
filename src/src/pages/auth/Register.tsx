import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FolderKanban, User, Mail, Lock } from 'lucide-react';
import authBg from '@/assets/auth-qos-background.jpg';
import heroImg from '@/assets/hero-qos-monitoring.jpg';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Passwords do not match',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 6 characters',
      });
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, name);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } else {
      toast({
        title: 'Success',
        description: 'Account created successfully!',
      });
      navigate('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Background Image */}
      <div 
        className="hidden lg:block relative bg-cover bg-center"
        style={{ backgroundImage: `url(${authBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/40"></div>
        <div className="absolute inset-0 opacity-40 pattern-dots"></div>
        <div className="relative h-full flex flex-col justify-center items-center text-white p-12">
          <FolderKanban className="h-16 w-16 mb-6" />
          <h2 className="text-4xl font-bold mb-4">Join QoS Collab</h2>
          <p className="text-xl text-center text-white/90 max-w-md">
            Start managing your projects efficiently and collaborate with your team seamlessly
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/80">
            <span className="rounded-full bg-white/15 px-3 py-1">Team workspaces</span>
            <span className="rounded-full bg-white/15 px-3 py-1">Realtime insights</span>
            <span className="rounded-full bg-white/15 px-3 py-1">Secure access</span>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-none lg:shadow-large gradient-card animate-fade-in">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto mb-2 lg:hidden inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Create Account</CardTitle>
            <CardDescription className="text-base">
              Enter your details to get started
            </CardDescription>
            <div className="pt-2">
              <img
                src={heroImg}
                alt="QoS monitoring preview"
                className="mx-auto h-28 w-full max-w-sm rounded-xl object-cover shadow-soft"
                loading="lazy"
              />
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter Your Full Name"
                    className="pl-10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter Your Valid Email id"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By creating an account you agree to the Terms and Privacy Policy.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
