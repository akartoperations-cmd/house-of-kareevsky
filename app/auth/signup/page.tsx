"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    
    // Sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Create user profile
      const { error: profileError } = await supabase.from("users").insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        is_premium: false,
      });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        setError("Account created but profile setup failed. Please contact support.");
        setLoading(false);
        return;
      }

      router.push("/content");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-cream-50 to-sand-100 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-sand-200"
      >
        <h1 className="font-heading text-3xl text-charcoal-900 mb-2">Join the Sanctuary</h1>
        <p className="text-charcoal-600 mb-8">Create your account to begin</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-charcoal-700 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-charcoal-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-charcoal-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-sand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-bronze-400 bg-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-bronze-500 hover:bg-bronze-600 disabled:bg-sand-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? "Creating account..." : "Sign Up"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-charcoal-600">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-bronze-600 hover:text-bronze-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

