"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { createBrowserClient, createRecoveryBrowserClient } from "@/lib/supabase/client";
import {
  bootstrapSupabaseSessionFromAuthLink,
  readAuthLinkCredentialsFromUrl,
  safeInternalPath,
  stripAuthParamsFromUrlKeepSearch,
} from "@/src/lib/supabase/authLinkBootstrap";

const EXPIRED_MESSAGE =
  "This reset link is invalid or has expired. Request a new one from the forgot password page.";

export function FiOsUpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterPasswordPath = safeInternalPath(
    searchParams.get("next"),
    "/follicle-intelligence/login"
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const credentials = readAuthLinkCredentialsFromUrl();

    async function bootstrapRecoverySession() {
      try {
        if (credentials.kind !== "none") {
          const supabase = createRecoveryBrowserClient();
          const ok = await bootstrapSupabaseSessionFromAuthLink(supabase, credentials);
          if (cancelled) return;
          if (!ok) {
            setError(EXPIRED_MESSAGE);
            return;
          }
          stripAuthParamsFromUrlKeepSearch();
          setReady(true);
          return;
        }

        const supabase = createBrowserClient();
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (event === "PASSWORD_RECOVERY" && session) {
            setReady(true);
          }
        });

        const { data } = await supabase.auth.getSession();
        if (cancelled) {
          subscription.unsubscribe();
          return;
        }
        if (!data.session) {
          subscription.unsubscribe();
          setError(EXPIRED_MESSAGE);
          return;
        }
        subscription.unsubscribe();
        setReady(true);
      } catch {
        if (!cancelled) setError("Could not verify your session.");
      }
    }

    void bootstrapRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createBrowserClient();
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      setDone(true);
      router.replace(afterPasswordPath);
    } catch {
      setError("Could not update password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-emerald-200">Your password was updated.</p>
        <Link
          href={afterPasswordPath}
          className="inline-block rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white hover:from-cyan-500 hover:to-sky-500"
        >
          Continue
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!ready && !error ? (
        <p className="text-center text-sm text-slate-400">Verifying reset link…</p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {ready ? (
        <>
          <div>
            <label
              htmlFor="np1"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              New password
            </label>
            <input
              id="np1"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="w-full rounded-lg border border-slate-600/80 bg-slate-950/80 px-3 py-2.5 text-slate-100 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
          <div>
            <label
              htmlFor="np2"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              Confirm password
            </label>
            <input
              id="np2"
              type="password"
              autoComplete="new-password"
              required
              value={password2}
              onChange={(ev) => setPassword2(ev.target.value)}
              className="w-full rounded-lg border border-slate-600/80 bg-slate-950/80 px-3 py-2.5 text-slate-100 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save new password"}
          </button>
        </>
      ) : null}

      <p className="text-center text-sm text-slate-400">
        <Link
          href="/follicle-intelligence/forgot-password"
          className="text-cyan-400/90 hover:underline"
        >
          Request a new link
        </Link>
      </p>
    </form>
  );
}
