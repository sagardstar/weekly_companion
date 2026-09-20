import { createClient } from "@supabase/supabase-js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const MAX_ATTEMPTS = 2;
const QUERY_TIMEOUT_MS = 5_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A cached success must never stand in for a real database request.
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("keepalive.config_error", { missing: ["CRON_SECRET"] });
    return res.status(500).json({ ok: false, error: "Cron secret not configured." });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    console.warn("keepalive.unauthorized");
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !supabaseUrl && "SUPABASE_URL (or VITE_SUPABASE_URL)",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    console.error("keepalive.config_error", { missing });
    return res.status(500).json({
      ok: false,
      error: "Supabase keepalive is not configured.",
      missing,
    });
  }

  let supabase: ReturnType<typeof createClient>;
  let projectHost: string;
  try {
    projectHost = new URL(supabaseUrl!).hostname;
    supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch {
    console.error("keepalive.config_error", { reason: "Invalid Supabase configuration" });
    return res.status(500).json({ ok: false, error: "Invalid Supabase configuration." });
  }

  const startedAt = Date.now();
  console.info("keepalive.started", { projectHost });
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    let retryable = true;
    try {
      const { error, status } = await supabase
        .from("habits")
        .select("id")
        .limit(1)
        .abortSignal(controller.signal);
      if (!error) {
        const checkedAt = new Date().toISOString();
        console.info("keepalive.succeeded", {
          projectHost,
          checkedAt,
          attempt,
          durationMs: Date.now() - startedAt,
        });
        return res.status(200).json({ ok: true, checkedAt, attempts: attempt });
      }
      // Retry transport failures/rate limits/server errors, not invalid keys or schema.
      retryable = status === 0 || status === 408 || status === 429 || status >= 500;
      console.warn("keepalive.query_failed", {
        projectHost,
        attempt,
        status,
        code: error.code,
      });
    } catch {
      // Do not log raw exceptions: SDK/network errors may contain request credentials.
      console.warn("keepalive.request_failed", { projectHost, attempt });
    } finally {
      clearTimeout(timeout);
    }
    if (!retryable || attempt === MAX_ATTEMPTS) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.error("keepalive.failed", { projectHost, durationMs: Date.now() - startedAt });
  return res.status(502).json({
    ok: false,
    error: "Supabase database check failed. See the keepalive function logs for details.",
  });
}
