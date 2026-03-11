import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ActivitySquare,
  BarChart3,
  Cpu,
  FileText,
  GitCompare,
  Globe,
  LayoutGrid,
  LineChart,
  LogOut,
  MessageSquare,
  MoreHorizontal,
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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
