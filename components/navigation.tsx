"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, BookOpen, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";

export function Navigation() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Hide navigation on auth pages
  if (pathname?.startsWith("/auth")) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-cream-50/80 backdrop-blur-sm border-b border-sand-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-heading text-xl text-charcoal-900">
            Digital Sanctuary
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/content"
                  className="flex items-center gap-2 text-charcoal-700 hover:text-charcoal-900 transition-colors"
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="hidden sm:inline">Content</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-charcoal-700 hover:text-charcoal-900 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="px-4 py-2 bg-bronze-500 hover:bg-bronze-600 text-white rounded-lg transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

