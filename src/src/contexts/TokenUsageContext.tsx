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
  syncingTokenUsage: boolean;
  tokenUsageError: string | null;
  refreshTokenUsage: () => Promise<void>;
  applyOptimisticBalance: (nextBalance: number) => void;
  rollbackBalance: (previousBalance: number) => void;
  deductTokens: (amount: number) => void;
  refundTokens: (amount: number) => void;
  balanceUpdatedAt: string | null;
  balanceRecentlyUpdated: boolean;
  liveStatus: "live" | "reconnecting" | "paused";
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
const roundToTwo = (value: number) => Number(value.toFixed(2));

export function TokenUsageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TokenUsageState>(initialState);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceUpdatedAt, setBalanceUpdatedAt] = useState<string | null>(null);
  const [balanceRecentlyUpdated, setBalanceRecentlyUpdated] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"live" | "reconnecting" | "paused">("reconnecting");
  const prevBalanceRef = useRef<number>(0);
  const recentTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const pausedReconnectRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const markBalanceUpdated = useCallback((balance: number) => {
    const nowIso = new Date().toISOString();
    prevBalanceRef.current = balance;
    setBalanceUpdatedAt(nowIso);
    setBalanceRecentlyUpdated(true);
    if (recentTimerRef.current) window.clearTimeout(recentTimerRef.current);
    recentTimerRef.current = window.setTimeout(() => setBalanceRecentlyUpdated(false), 2500);
  }, []);

  const refresh = useCallback(async () => {
    setSyncing(true);
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

      const profileRes = await db
        .from("user_profiles")
        .select("token_balance, lifetime_tokens_used")
        .eq("id", user.id)
        .limit(1);
      if (profileRes.error) throw profileRes.error;

      const txRes = await db
        .from("token_transactions")
        .select("amount, description, endpoint, created_at, type")
        .eq("user_id", user.id)
        .gte("created_at", cycleStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(600);

      const txError = txRes.error ?? null;
      const txRows = txError
        ? []
        : ((txRes.data || []) as Array<{
            amount: number;
            description: string | null;
            endpoint: string | null;
            created_at: string;
            type: "credit" | "debit";
          }>);
      const profile = (profileRes.data?.[0] as { token_balance?: number; lifetime_tokens_used?: number } | undefined) || {
        token_balance: 0,
        lifetime_tokens_used: 0,
      };

      const perService = new Map<string, { tokens: number; tests: number }>();
      const perOperation = new Map<string, { tokens: number; count: number }>();

      let cycleUsed = 0;
      let weeklyLatencyTests = 0;

      for (const tx of txRows) {
        if (tx.type !== "debit") continue;
        const tokens = Number(tx.amount ?? 0);
        if (!Number.isFinite(tokens) || tokens <= 0) continue;
        cycleUsed += tokens;

        const desc = String(tx.description || "").toLowerCase();
        const operationFromDesc =
          desc.includes("latency")
            ? "latency"
            : desc.includes("load")
              ? "load"
              : desc.includes("uptime")
                ? "uptime"
                : desc.includes("throughput")
                  ? "throughput"
                  : "other";
        const operation = operationFromDesc.toLowerCase();

        const existingOp = perOperation.get(operation) || { tokens: 0, count: 0 };
        existingOp.tokens += tokens;
        existingOp.count += 1;
        perOperation.set(operation, existingOp);

        const serviceName = tx.endpoint || "Unknown Service";
        const existingService = perService.get(serviceName) || { tokens: 0, tests: 0 };
        existingService.tokens += tokens;
        existingService.tests += 1;
        perService.set(serviceName, existingService);

        if (operation === "latency" && new Date(tx.created_at) >= weekStart) {
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
      if (nextBalance !== prevBalanceRef.current) markBalanceUpdated(nextBalance);

      setState({
        balance: nextBalance,
        lifetimeUsed: Number(profile.lifetime_tokens_used ?? 0),
        cycleUsed: roundToTwo(cycleUsed),
        cycleLimit: BILLING_CYCLE_TOKEN_LIMIT,
        weeklyLatencyTests,
        weeklyLatencyTokens,
        perServiceSpend,
        perOperationSpend,
        stale: Boolean(txError),
        lastUpdated: nowIso,
      });
      setError(txError?.message ?? null);
    } catch (err: any) {
      setState((prev) => ({ ...prev, stale: true }));
      setError(err?.message || "Failed to refresh token usage");
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [markBalanceUpdated]);

  const applyOptimisticBalance = useCallback((nextBalance: number) => {
    markBalanceUpdated(nextBalance);
    setState((prev) => ({
      ...prev,
      balance: nextBalance,
      stale: false,
      lastUpdated: new Date().toISOString(),
    }));
    if (!channelRef.current) return;
    channelRef.current.postMessage({ type: "TOKEN_UPDATED", newBalance: nextBalance });
  }, [markBalanceUpdated]);

  const rollbackBalance = useCallback((previousBalance: number) => {
    markBalanceUpdated(previousBalance);
    setState((prev) => ({
      ...prev,
      balance: previousBalance,
      lastUpdated: new Date().toISOString(),
    }));
  }, [markBalanceUpdated]);

  const deductTokens = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setState((prev) => {
      const nextBalance = Math.max(0, prev.balance - amount);
      markBalanceUpdated(nextBalance);
      return {
        ...prev,
        balance: nextBalance,
        cycleUsed: prev.cycleUsed + amount,
        lifetimeUsed: prev.lifetimeUsed + amount,
        stale: false,
        lastUpdated: new Date().toISOString(),
      };
    });
  }, [markBalanceUpdated]);

  const refundTokens = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setState((prev) => {
      const nextBalance = prev.balance + amount;
      markBalanceUpdated(nextBalance);
      return {
        ...prev,
        balance: nextBalance,
        cycleUsed: Math.max(0, prev.cycleUsed - amount),
        lifetimeUsed: Math.max(0, prev.lifetimeUsed - amount),
        stale: false,
        lastUpdated: new Date().toISOString(),
      };
    });
  }, [markBalanceUpdated]);

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
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (pausedReconnectRef.current) window.clearTimeout(pausedReconnectRef.current);
      eventSourceRef.current?.close();
      channelRef.current?.close();
    };
  }, [refresh]);

  useEffect(() => {
    channelRef.current = new BroadcastChannel("token_updates");
    channelRef.current.onmessage = (event) => {
      const payload = event.data as { type?: string; newBalance?: number };
      if (payload?.type === "TOKEN_UPDATED" && typeof payload.newBalance === "number") {
        markBalanceUpdated(payload.newBalance);
        setState((prev) => ({ ...prev, balance: payload.newBalance, stale: false, lastUpdated: new Date().toISOString() }));
      }
    };

    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setLiveStatus("paused");
        pausedReconnectRef.current = window.setTimeout(() => void connect(), 10000);
        return;
      }

      const sseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/token-stream?access_token=${encodeURIComponent(token)}`;
      setLiveStatus("reconnecting");

      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        retryCountRef.current = 0;
        setLiveStatus("live");
      };

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data) as {
            type?: string;
            newBalance?: number;
            balance?: number;
            lifetimeUsed?: number;
          };
          const nextBalance =
            typeof payload.newBalance === "number"
              ? payload.newBalance
              : typeof payload.balance === "number"
                ? payload.balance
                : null;

          if (
            (payload.type === "TOKEN_UPDATED" ||
              payload.type === "TOKEN_DEDUCTED" ||
              payload.type === "TOKEN_REFUNDED" ||
              payload.type === "TOKEN_TOPUP" ||
              payload.type === "TOKEN_SYNC") &&
            typeof nextBalance === "number"
          ) {
            applyOptimisticBalance(nextBalance);
            if (typeof payload.lifetimeUsed === "number") {
              setState((prev) => ({
                ...prev,
                lifetimeUsed: payload.lifetimeUsed as number,
                lastUpdated: new Date().toISOString(),
              }));
            }
            void refresh();
          }
          if (payload.type === "BILLING_UPDATED") {
            void refresh();
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        const nextRetry = retryCountRef.current + 1;
        retryCountRef.current = nextRetry;
        const retryDelay = Math.min(30000, 5000 * nextRetry);
        setLiveStatus(nextRetry >= 3 ? "paused" : "reconnecting");
        retryTimerRef.current = window.setTimeout(() => void connect(), retryDelay);
      };
    };

    void connect();

    return () => {
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (pausedReconnectRef.current) window.clearTimeout(pausedReconnectRef.current);
      eventSourceRef.current?.close();
      channelRef.current?.close();
    };
  }, [applyOptimisticBalance, markBalanceUpdated, refresh]);

  const usagePercent = useMemo(() => {
    if (!state.cycleLimit) return 0;
    return Math.min(100, Math.round((state.cycleUsed / state.cycleLimit) * 100));
  }, [state.cycleLimit, state.cycleUsed]);

  const value = useMemo<TokenUsageContextValue>(
    () => ({
      tokenUsage: state,
      usagePercent,
      loadingTokenUsage: loading,
      syncingTokenUsage: syncing,
      tokenUsageError: error,
      refreshTokenUsage: refresh,
      applyOptimisticBalance,
      rollbackBalance,
      deductTokens,
      refundTokens,
      balanceUpdatedAt,
      balanceRecentlyUpdated,
      liveStatus,
    }),
    [state, usagePercent, loading, syncing, error, refresh, applyOptimisticBalance, rollbackBalance, deductTokens, refundTokens, balanceUpdatedAt, balanceRecentlyUpdated, liveStatus],
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
