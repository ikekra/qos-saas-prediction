import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { UNREAD_ALERT_COUNT_KEY } from '@/hooks/useQosAlerts';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import {
  ActivitySquare,
  Bell,
  BarChart3,
  Coins,
  Cpu,
  FileText,
  GitCompare,
  Globe,
  Home,
  LayoutGrid,
  LineChart,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Settings,
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
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const dashboardPath = isAdmin ? '/admin/dashboard' : '/dashboard';
  const [unreadCount, setUnreadCount] = useState(0);
  const { tokenUsage, liveStatus } = useTokenUsage();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const refreshUnread = () => {
      const raw = localStorage.getItem(UNREAD_ALERT_COUNT_KEY);
      const value = Number(raw ?? 0);
      const next = Number.isFinite(value) ? value : 0;
      setUnreadCount((prev) => (prev === next ? prev : next));
    };

    refreshUnread();
    const timer = window.setInterval(refreshUnread, 60000);
    window.addEventListener('focus', refreshUnread);
    window.addEventListener('storage', refreshUnread);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshUnread);
      window.removeEventListener('storage', refreshUnread);
    };
  }, []);

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
              <Link to="/">
                <Button variant="ghost" size="sm">
                  Home
                </Button>
              </Link>
              <Link to={dashboardPath}>
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
              <Link to="/team">
                <Button variant="ghost" size="sm">
                  Team
                </Button>
              </Link>
              {isAdmin && (
                <>
                  <Link to="/admin/dashboard">
                    <Button variant="ghost" size="sm">
                      Admin Dashboard
                    </Button>
                  </Link>
                  <Link to="/admin">
                    <Button variant="ghost" size="sm">
                      Admin Hub
                    </Button>
                  </Link>
                  <Link to="/admin/web-services">
                    <Button variant="ghost" size="sm">
                      Admin Services
                    </Button>
                  </Link>
                </>
              )}
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
                    {new Intl.NumberFormat('en-IN').format(tokenUsage.balance)} tokens
                  </Badge>
                </Link>
                <Badge
                  variant={liveStatus === 'live' ? 'secondary' : 'outline'}
                  className="hidden md:inline-flex"
                >
                  Live: {liveStatus}
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
                      <Link to="/" className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Home
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
                      <Link to="/team" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Team Workspace
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
                          <Link to="/admin/tokens" className="flex items-center gap-2">
                            <Coins className="h-4 w-4" />
                            Admin Tokens
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
