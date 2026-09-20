import { useState } from "react";
import { supabase, SUPABASE_CONFIG_OK } from "../../lib/supabase";
import { ArrowRight, CheckCircle, Sprout } from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = async (method: "email" | "google") => {
    if (!supabase || !SUPABASE_CONFIG_OK || loading) return;
    setLoading(method);
    setError(null);
    try {
      const result =
        method === "google"
          ? await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.origin },
            })
          : await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: window.location.origin },
            });
      if (result.error) throw result.error;
      if (method === "email") setEmailSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t connect just now. Please try again.",
      );
    } finally {
      setLoading(null);
    }
  };
  if (!supabase || !SUPABASE_CONFIG_OK)
    return (
      <section className="account-panel">
        <Sprout size={36} />
        <h1>Your own little corner.</h1>
        <p className="text-center text-stone-600">
          You can keep tracking on this device. Account sync isn’t available right now.
        </p>
      </section>
    );
  if (emailSent)
    return (
      <section className="account-panel">
        <CheckCircle size={36} className="text-sage-500" />
        <h1>Check your inbox.</h1>
        <p className="text-center text-stone-600">
          We sent a sign-in link to <strong>{email.trim()}</strong>.<br />
          Open it to come back to your companion.
        </p>
        <p className="text-sm text-stone-500">
          Not seeing it? Take a look in your spam folder.
        </p>
        <button className="text-link" onClick={() => setEmailSent(false)}>
          Try again or use a different email
        </button>
      </section>
    );
  return (
    <section className="account-panel">
      <Sprout size={34} className="text-sage-500" />
      <div className="text-center">
        <h1>A space that goes with you.</h1>
        <p className="text-sm text-stone-500">
          Sign in to bring your habits across devices.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-sand-100 bg-white p-6">
        <button
          disabled={Boolean(loading)}
          onClick={() => void signIn("google")}
          className="button-secondary w-full"
        >
          {loading === "google" ? "Connecting…" : "Continue with Google"}
        </button>
        <p className="text-center text-xs text-stone-500">
          or use an email link — no password needed
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void signIn("email");
          }}
        >
          <label className="flex flex-col gap-2 text-sm text-stone-700">
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-stone-200 px-3 py-3"
            />
          </label>
          <button
            type="submit"
            disabled={Boolean(loading)}
            className="button-primary w-full"
          >
            {loading === "email" ? "Sending your link…" : "Send sign-in link"}
            <ArrowRight size={16} />
          </button>
        </form>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      <p className="text-xs text-stone-500">
        Happy here? You can keep using the app without signing in.
      </p>
    </section>
  );
}
