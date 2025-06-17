"use client"

import Link from "next/link"
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function MainNav() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      <Link
        href="/"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Home
      </Link>
      <Link
        href="/cases"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Cases
      </Link>
      <Link
        href="/forensics/evidence"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Evidence
      </Link>
      <Link
        href="/case-analysis"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Analysis
      </Link>
      <div className="ml-auto flex items-center space-x-4">
        {user ? (
          <>
            <span className="text-xs text-muted-foreground">{user.email}</span>
            <button
              className="text-sm font-medium transition-colors hover:text-primary border rounded px-2 py-1"
              onClick={async () => { await supabase.auth.signOut(); }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium transition-colors hover:text-primary border rounded px-2 py-1"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  )
} 