"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import {
  LucideHome,
  LucideFileSearch,
  LucideUsers,
  LucideUpload,
  LucideDatabase,
  LucideSettings,
  LucideBrain,
  LucideFlag,
  LucideUser,
  LucideLogOut,
  LucideChevronDown,
  LucidePlus,
  LucideFileText,
  LucideAlertCircle,
  LucideActivity,
  LucideMenu
} from 'lucide-react';

interface Case {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status?: string;
}

interface QualityFlag {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'reviewed' | 'resolved' | 'dismissed';
}

export default function MainNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Your existing routes with some additions
  const routes = [
    {
      href: "/",
      label: "Dashboard",
      icon: LucideHome,
      active: pathname === "/"
    },
    {
      href: "/case-analysis",
      label: "Case Analysis", 
      icon: LucideFileSearch,
      active: pathname === "/case-analysis"
    },
    {
      href: "/cases",
      label: "Cases",
      icon: LucideUsers,
      active: pathname.startsWith("/cases"),
      hasDropdown: true
    },
    {
      href: "/analysis",
      label: "Quick Analysis",
      icon: LucideBrain,
      active: pathname === "/analysis"
    },
    {
      href: "/upload",
      label: "Upload",
      icon: LucideUpload,
      active: pathname === "/upload"
    },
    {
      href: "/forensics",
      label: "Forensics",
      icon: LucideDatabase,
      active: pathname.startsWith("/forensics")
    },
    {
      href: "/analysis/flags",
      label: "Quality Control",
      icon: LucideFlag,
      active: pathname === "/analysis/flags",
      badge: true
    }
  ];

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        await Promise.all([
          loadRecentCases(user.id),
          loadQualityFlags(user.id)
        ]);
      }
    } catch (error) {
      console.error('Error loading navigation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentCases = async (userId: string) => {
    const { data, error } = await supabase
      .from('cases')
      .select('id, name, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setRecentCases(data);
    }
  };

  const loadQualityFlags = async (userId: string) => {
    const { data: analyses, error } = await supabase
      .from('case_analysis')
      .select('id, analysis_data, confidence_score')
      .eq('user_id', userId);

    if (!error && analyses) {
      const flags: QualityFlag[] = [];
      analyses.forEach(analysis => {
        if (analysis.confidence_score && analysis.confidence_score < 60) {
          flags.push({
            id: `low-confidence-${analysis.id}`,
            severity: 'medium',
            status: 'active'
          });
        }
        if (!analysis.analysis_data?.suspects || analysis.analysis_data.suspects.length === 0) {
          flags.push({
            id: `no-suspects-${analysis.id}`,
            severity: 'high',
            status: 'active'
          });
        }
      });
      setQualityFlags(flags);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const createNewCase = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('cases')
      .insert([{
        name: `New Case ${new Date().toLocaleDateString()}`,
        description: 'Case description...',
        user_id: user.id
      }])
      .select()
      .single();

    if (!error && data) {
      router.push(`/cases/${data.id}`);
    }
  };

  const activeFlags = qualityFlags.filter(f => f.status === 'active');
  const criticalFlags = activeFlags.filter(f => f.severity === 'critical');

  if (!user) {
    return null; // Don't show navigation if not logged in
  }

  const getBadgeCount = (route: any) => {
    if (route.href === '/analysis/flags') {
      return criticalFlags.length > 0 ? criticalFlags.length : activeFlags.length;
    }
    if (route.href === '/cases') {
      return recentCases.length;
    }
    return 0;
  };

  const getBadgeVariant = (route: any) => {
    if (route.href === '/analysis/flags' && criticalFlags.length > 0) {
      return 'destructive';
    }
    return 'secondary';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo/Brand */}
        <Link href="/" className="flex items-center space-x-2">
          <LucideActivity className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">ColdCase AI</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
          {routes.map((route) => {
            if (route.hasDropdown && route.href === '/cases') {
              return (
                <NavigationMenu key={route.href}>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger 
                        className={cn(
                          "h-9 px-3",
                          route.active ? "bg-accent text-accent-foreground" : ""
                        )}
                      >
                        <route.icon className="mr-2 h-4 w-4" />
                        {route.label}
                        {recentCases.length > 0 && (
                          <Badge variant="outline" className="ml-2">
                            {recentCases.length}
                          </Badge>
                        )}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="w-80 p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold">Recent Cases</h4>
                            <Button onClick={createNewCase} size="sm" variant="outline">
                              <LucidePlus className="mr-1 h-3 w-3" />
                              New Case
                            </Button>
                          </div>
                          
                          {loading ? (
                            <div className="text-sm text-muted-foreground">Loading cases...</div>
                          ) : recentCases.length > 0 ? (
                            <div className="space-y-2">
                              {recentCases.map((case_) => (
                                <Link
                                  key={case_.id}
                                  href={`/cases/${case_.id}`}
                                  className="block p-3 rounded-md hover:bg-accent transition-colors"
                                >
                                  <div className="font-medium text-sm">{case_.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {new Date(case_.created_at).toLocaleDateString()}
                                  </div>
                                </Link>
                              ))}
                              <Link
                                href="/cases"
                                className="block p-2 text-center text-sm text-primary hover:underline"
                              >
                                View All Cases →
                              </Link>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <LucideFileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground mb-3">No cases yet</p>
                              <Button onClick={createNewCase} size="sm">
                                <LucidePlus className="mr-1 h-3 w-3" />
                                Create First Case
                              </Button>
                            </div>
                          )}
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              );
            }

            const badgeCount = getBadgeCount(route);
            
            return (
              <Button
                key={route.href}
                variant={route.active ? "default" : "ghost"}
                asChild
                className="h-9"
              >
                <Link href={route.href} className="flex items-center">
                  <route.icon className="h-4 w-4 mr-2" />
                  {route.label}
                  {route.badge && badgeCount > 0 && (
                    <Badge 
                      variant={getBadgeVariant(route)} 
                      className="ml-2"
                    >
                      {badgeCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* Right Side - Quality Alerts & User Menu */}
        <div className="flex items-center space-x-4">
          {/* Quality Alerts */}
          {criticalFlags.length > 0 && (
            <Link href="/analysis/flags">
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hidden md:flex">
                <LucideAlertCircle className="mr-2 h-4 w-4" />
                {criticalFlags.length} Critical Issue{criticalFlags.length !== 1 ? 's' : ''}
              </Button>
            </Link>
          )}

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <LucideUser className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.user_metadata?.full_name || user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <LucideUser className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <LucideSettings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LucideLogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <LucideMenu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                {routes.map((route) => (
                  <DropdownMenuItem key={route.href} asChild>
                    <Link 
                      href={route.href} 
                      className="cursor-pointer"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <route.icon className="mr-2 h-4 w-4" />
                      {route.label}
                      {route.badge && getBadgeCount(route) > 0 && (
                        <Badge 
                          variant={getBadgeVariant(route)} 
                          className="ml-auto"
                        >
                          {getBadgeCount(route)}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))}
                {criticalFlags.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link 
                        href="/analysis/flags" 
                        className="cursor-pointer text-red-600"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <LucideAlertCircle className="mr-2 h-4 w-4" />
                        {criticalFlags.length} Critical Issues
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}