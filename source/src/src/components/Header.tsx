import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BarChart3, LogOut, User, Globe, TestTube, FileText, Sparkles, GitCompare } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
        
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/services">
                <Button variant="ghost" size="sm">
                  <Globe className="h-4 w-4 mr-2" />
                  Services
                </Button>
              </Link>
              <Link to="/qos/run-test">
                <Button variant="ghost" size="sm">
                  <TestTube className="h-4 w-4 mr-2" />
                  Run Test
                </Button>
              </Link>
              <Link to="/qos/reports">
                <Button variant="ghost" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Reports
                </Button>
              </Link>
              <Link to="/recommendations">
                <Button variant="ghost" size="sm">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Recommendations
                </Button>
              </Link>
              <Link to="/compare">
                <Button variant="ghost" size="sm">
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
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
        </nav>
      </div>
    </header>
  );
}