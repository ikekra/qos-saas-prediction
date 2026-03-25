import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BILLING_CYCLE_TOKEN_LIMIT, TOKEN_POLL_INTERVAL_MS, getOperationCost } from "@/lib/token-usage";

type ServiceSpend = {
  service: string;
  tokens: number;
  tests: number;
};

type OperationSpend = {
  operation: string;
  tokens: number;
  count: number;
};

type TokenUsageState = {
  balance: number;
  lifetimeUsed: number;
  cycleUsed: number;
  cycleLimit: number;
  weeklyLatencyTests: number;
  weeklyLatencyTokens: number;
  perServiceSpend: ServiceSpend[];
  perOperationSpend: OperationSpend[];
  stale: boolean;
  lastUpdated: string | null;
};

type TokenUsageContextValue = {
  tokenUsage: TokenUsageState;
  usagePercent: number;
  loadingTokenUsage: boolean;
  tokenUsageError: string | null;
  refreshTokenUsage: () => Promise<void>;
  balanceUpdatedAt: string | null;
  balanceRecentlyUpdated: boolean;
};

const initialState: TokenUsageState = {
  balance: 0,
  lifetimeUsed: 0,
  cycleUsed: 0,
  cycleLimit: BILLING_CYCLE_TOKEN_LIMIT,
  weeklyLatencyTests: 0,
  weeklyLatencyTokens: 0,
  perServiceSpend: [],
  perOperationSpend: [],
  stale: false,
  lastUpdated: null,
};

const TokenUsageContext = createContext<TokenUsageContextValue | null>(null);

export function TokenUsageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TokenUsageState>(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balanceUpdatedAt, setBalanceUpdatedAt] = useState<string | null>(null);
  const [balanceRecentlyUpdated, setBalanceRecentlyUpdated] = useState(false);
  const prevBalanceRef = useRef<number>(0);
  const recentTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState(initialState);
        setLoading(false);
        return;
      }

      const cycleStart = new Date();
      cycleStart.setDate(1);
      cycleStart.setHours(0, 0, 0, 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const db = supabase as any;

      const [profileRes, testsRes] = await Promise.all([
        db
          .from("user_profiles")
          .select("token_balance, lifetime_tokens_used")
          .eq("id", user.id)
          .maybeSingle(),
        db
          .from("tests")
          .select("service_url, test_type, created_at")
          .eq("user_id", user.id)
          .gte("created_at", cycleStart.toISOString())
          .order("created_at", { ascending: false })
          .limit(600),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (testsRes.error) throw testsRes.error;

      const tests = (testsRes.data || []) as Array<{ service_url: string | null; test_type: string; created_at: string }>;
      const profile = profileRes.data || { token_balance: 0, lifetime_tokens_used: 0 };

      const perService = new Map<string, { tokens: number; tests: number }>();
      const perOperation = new Map<string, { tokens: number; count: number }>();

      let cycleUsed = 0;
      let weeklyLatencyTests = 0;

      for (const test of tests) {
        const operation = (test.test_type || "latency").toLowerCase();
        const cost = getOperationCost(operation);
        cycleUsed += cost;

        const existingOp = perOperation.get(operation) || { tokens: 0, count: 0 };
        existingOp.tokens += cost;
        existingOp.count += 1;
        perOperation.set(operation, existingOp);

        const serviceName = test.service_url || "Unknown Service";
        const existingService = perService.get(serviceName) || { tokens: 0, tests: 0 };
        existingService.tokens += cost;
        existingService.tests += 1;
        perService.set(serviceName, existingService);

        if (operation === "latency" && new Date(test.created_at) >= weekStart) {
          weeklyLatencyTests += 1;
        }
      }

      const weeklyLatencyTokens = weeklyLatencyTests * getOperationCost("latency");

      const perServiceSpend = Array.from(perService.entries())
        .map(([service, value]) => ({ service, tokens: value.tokens, tests: value.tests }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 6);

      const perOperationSpend = Array.from(perOperation.entries())
        .map(([operation, value]) => ({ operation, tokens: value.tokens, count: value.count }))
        .sort((a, b) => b.tokens - a.tokens);

      const nextBalance = Number(profile.token_balance ?? 0);
      const nowIso = new Date().toISOString();
      if (nextBalance !== prevBalanceRef.current) {
        prevBalanceRef.current = nextBalance;
        setBalanceUpdatedAt(nowIso);
        setBalanceRecentlyUpdated(true);
        if (recentTimerRef.current) window.clearTimeout(recentTimerRef.current);
        recentTimerRef.current = window.setTimeout(() => setBalanceRecentlyUpdated(false), 2500);
      }

      setState({
        balance: nextBalance,
        lifetimeUsed: Number(profile.lifetime_tokens_used ?? 0),
        cycleUsed,
        cycleLimit: BILLING_CYCLE_TOKEN_LIMIT,
        weeklyLatencyTests,
        weeklyLatencyTokens,
        perServiceSpend,
        perOperationSpend,
        stale: false,
        lastUpdated: nowIso,
      });
      setError(null);
    } catch (err: any) {
      setState((prev) => ({ ...prev, stale: true }));
      setError(err?.message || "Failed to refresh token usage");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, TOKEN_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) void refresh();
    };
    const handleFocus = () => {
      void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      if (recentTimerRef.current) window.clearTimeout(recentTimerRef.current);
    };
  }, [refresh]);

  const usagePercent = useMemo(() => {
    if (!state.cycleLimit) return 0;
    return Math.min(100, Math.round((state.cycleUsed / state.cycleLimit) * 100));
  }, [state.cycleLimit, state.cycleUsed]);

  const value = useMemo<TokenUsageContextValue>(
    () => ({
      tokenUsage: state,
      usagePercent,
      loadingTokenUsage: loading,
      tokenUsageError: error,
      refreshTokenUsage: refresh,
      balanceUpdatedAt,
      balanceRecentlyUpdated,
    }),
    [state, usagePercent, loading, error, refresh, balanceUpdatedAt, balanceRecentlyUpdated],
  );

  return <TokenUsageContext.Provider value={value}>{children}</TokenUsageContext.Provider>;
}

export function useTokenUsageContext() {
  const ctx = useContext(TokenUsageContext);
  if (!ctx) {
    throw new Error("useTokenUsageContext must be used within TokenUsageProvider");
  }
  return ctx;
}
