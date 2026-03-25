import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { UNREAD_ALERT_COUNT_KEY } from '@/hooks/useQosAlerts';
import {
  ActivitySquare,
  Bell,
  BarChart3,
  Coins,
  Cpu,
  FileText,
  GitCompare,
  Globe,
  LayoutGrid,
  LineChart,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Shield,
  Sparkles,
  Stars,
  TestTube,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.app_metadata?.role === 'admin';
  const [unreadCount, setUnreadCount] = useState(0);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [tokenSyncStatus, setTokenSyncStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const tokenChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const tokenRefreshTimerRef = useRef<number | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const refreshUnread = () => {
      const raw = localStorage.getItem(UNREAD_ALERT_COUNT_KEY);
      const value = Number(raw ?? 0);
      setUnreadCount(Number.isFinite(value) ? value : 0);
    };

    refreshUnread();
    const timer = window.setInterval(refreshUnread, 15000);
    window.addEventListener('focus', refreshUnread);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshUnread);
    };
  }, []);

  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!user) {
        setTokenBalance(null);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('token_balance')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        setTokenBalance(data.token_balance ?? 0);
      }
    };

    void fetchTokenBalance();
  }, [user]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (tokenRefreshTimerRef.current) window.clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = window.setTimeout(() => {
        if (!user) return;
        void supabase
          .from('user_profiles')
          .select('token_balance')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data) setTokenBalance(data.token_balance ?? 0);
          });
      }, 200);
    };

    if (!user) {
      if (tokenChannelRef.current) supabase.removeChannel(tokenChannelRef.current);
      setTokenSyncStatus('disconnected');
      return;
    }

    if (tokenChannelRef.current) {
      supabase.removeChannel(tokenChannelRef.current);
    }

    const channel = supabase
      .channel(`header-token-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'token_transactions', filter: `user_id=eq.${user.id}` },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` },
        scheduleRefresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setTokenSyncStatus('connected');
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTokenSyncStatus('reconnecting');
          return;
        }
        if (status === 'CLOSED') {
          setTokenSyncStatus('disconnected');
        }
      });

    tokenChannelRef.current = channel;

    return () => {
      if (tokenRefreshTimerRef.current) window.clearTimeout(tokenRefreshTimerRef.current);
      if (tokenChannelRef.current) supabase.removeChannel(tokenChannelRef.current);
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span>QoSCollab</span>
        </Link>
        
        <nav className="flex items-center gap-3">
          {user ? (
            <div className="hidden items-center gap-1 md:flex">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link to="/services">
                <Button variant="ghost" size="sm">
                  Services
                </Button>
              </Link>
              <Link to="/directory">
                <Button variant="ghost" size="sm">
                  Directory
                </Button>
              </Link>
              <Link to="/compare">
                <Button variant="ghost" size="sm">
                  Compare
                </Button>
              </Link>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {user ? (
              <>
                <Link to="/qos/alerts">
                  <Button variant="ghost" size="icon" className="relative" aria-label="Alerts">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link to="/profile">
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex cursor-pointer border-primary/30 bg-primary/10 text-primary"
                  >
                    <Coins className="mr-1 h-3.5 w-3.5" />
                    {new Intl.NumberFormat('en-IN').format(tokenBalance ?? 0)} tokens
                  </Badge>
                </Link>
                <Badge
                  variant={tokenSyncStatus === 'connected' ? 'secondary' : 'outline'}
                  className="hidden md:inline-flex"
                >
                  Live: {tokenSyncStatus}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MoreHorizontal className="h-4 w-4" />
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>QoS Tools</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/run-test" className="flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Run Test
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/reports" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Reports
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/analytics" className="flex items-center gap-2">
                        <LineChart className="h-4 w-4" />
                        Analytics
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/advanced-analytics" className="flex items-center gap-2">
                        <ActivitySquare className="h-4 w-4" />
                        Advanced Analytics
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/feedback" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Feedback
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/recommendations" className="flex items-center gap-2">
                        <Stars className="h-4 w-4" />
                        QoS Recommendations
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/predict" className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        Predict
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/alerts" className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Alerts
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/qos/settings" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Insights</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link to="/recommendations" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Service Recommendations
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/directory" className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Service Directory
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/admin/web-services" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      Account
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="gap-2">
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/auth/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link to="/auth/register">
                  <Button variant="hero" size="lg">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
