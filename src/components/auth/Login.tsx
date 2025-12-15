import { useState } from "react";
import { supabase, SUPABASE_CONFIG_OK } from "../../lib/supabase"; // Adjust path if needed
import { Mail, ArrowRight, CheckCircle } from "lucide-react"; // Assuming lucide-react is installed

export function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // 1. Google Handler
  const handleGoogleLogin = async () => {
    if (!supabase || !SUPABASE_CONFIG_OK) {
      alert("Supabase is not configured. Please set environment variables.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Redirect back to your local app after Google approves
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      alert(error.message);
      setLoading(false);
    }
  };

  // 2. Magic Link Handler
  const handleEmailLogin = async (e: React.FormEvent) => {
    if (!supabase || !SUPABASE_CONFIG_OK) {
      alert("Supabase is not configured. Please set environment variables.");
      return;
    }
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Redirect back to your local app when they click the email link
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      setEmailSent(true);
      setLoading(false);
    }
  };

  // State: Magic Link Sent Success Screen
  if (emailSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center max-w-sm mx-auto">
        <div className="bg-green-100 p-3 rounded-full mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-stone-800">Check your inbox</h2>
        <p className="text-stone-600 mt-2">
          We sent a magic link to <strong>{email}</strong>. <br />
          Click it to log in.
        </p>
        <button
          onClick={() => setEmailSent(false)}
          className="mt-6 text-sm text-stone-500 hover:text-stone-800 underline"
        >
          Try a different email
        </button>
      </div>
    );
  }

  // Default State: Login Form
  if (!supabase || !SUPABASE_CONFIG_OK) {
    return (
      <div className="p-4 rounded-lg bg-white border border-sand-100 text-sm text-red-700">
        Supabase is not configured. Please set VITE_SUPABASE_URL and
        VITE_SUPABASE_ANON_KEY and restart the dev server.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-stone-800 text-center mb-2">
          Welcome Back
        </h1>
        <p className="text-stone-500 text-center mb-8">Weekly Companion</p>

        {/* Option A: Google (Primary) */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          {/* Simple Google G Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-stone-400">Or continue with email</span>
          </div>
        </div>

        {/* Option B: Magic Link (Secondary) */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-stone-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-900 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Magic Link"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
