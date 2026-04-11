# predict-qos Edge Function

This function:
- Receives QoS input from frontend
- Atomically deducts tokens for a full performance report
- Calls external FastAPI ML API (`/predict`)
- Stores result in `public.qos_predictions`
- Returns a structured performance report JSON plus plain-language summary

## Required environment variables

Set secrets in Supabase:

```bash
supabase secrets set ML_API_URL="https://your-ml-api.onrender.com/predict"
supabase secrets set ML_API_KEY="optional_api_key_if_used"
supabase secrets set ML_API_TIMEOUT_MS="12000"
supabase secrets set TOKEN_COST_FULL_REPORT="120"
supabase secrets set TOKEN_COST_LATENCY="50"
supabase secrets set TOKEN_COST_THROUGHPUT="70"
supabase secrets set TOKEN_COST_UPTIME="60"
supabase secrets set TOKEN_COST_HISTORICAL_ANALYSIS="150"
supabase secrets set TOKEN_COST_ANOMALY_SCAN="100"
supabase secrets set LATENCY_ALERT_MS="2000"
supabase secrets set UPTIME_ALERT_PERCENT="99.5"
supabase secrets set THROUGHPUT_DROP_ALERT="0.30"
supabase secrets set PAYMENT_MODE="sandbox"
supabase secrets set PREDICTION_CACHE_TTL_SECONDS="90"
```

`ML_API_KEY` is optional. If your FastAPI service doesn't use API-key auth, you can skip it.
`ML_API_TIMEOUT_MS` is optional. Default is `12000`.
Token and threshold values have safe defaults, but should be explicit in production.

## Local development

Create `supabase/functions/.env.local`:

```env
ML_API_URL=https://your-ml-api.onrender.com/predict
ML_API_KEY=optional_api_key_if_used
ML_API_TIMEOUT_MS=12000
TOKEN_COST_FULL_REPORT=120
TOKEN_COST_LATENCY=50
TOKEN_COST_THROUGHPUT=70
TOKEN_COST_UPTIME=60
TOKEN_COST_HISTORICAL_ANALYSIS=150
TOKEN_COST_ANOMALY_SCAN=100
LATENCY_ALERT_MS=2000
UPTIME_ALERT_PERCENT=99.5
THROUGHPUT_DROP_ALERT=0.30
PAYMENT_MODE=sandbox
PREDICTION_CACHE_TTL_SECONDS=90
```

Then serve function locally:

```bash
supabase functions serve predict-qos --env-file supabase/functions/.env.local
```

## Deploy

```bash
supabase functions deploy predict-qos
```

## Frontend invoke example

```ts
const { data, error } = await supabase.functions.invoke('predict-qos', {
  body: {
    service_url: "https://api.example.com",
    latency: 120,
    throughput: 180,
    availability: 99.4,
    reliability: 98.9,
    response_time: 135,
  },
});
```

Successful response shape:

```json
{
  "success": true,
  "summary": "Prediction complete. No anomalies detected against configured thresholds.",
  "report": {
    "service_url": "https://api.example.com",
    "predicted_latency_ms": 135,
    "predicted_latency_percentiles_ms": { "p50_ms": 135, "p95_ms": 168.75, "p99_ms": 202.5 },
    "predicted_throughput_rps": 180,
    "predicted_uptime_percent": 99.4,
    "confidence_score": "medium",
    "tokens_used": 20,
    "tokens_remaining": 480,
    "alerts": []
  },
  "prediction": {
    "id": "...",
    "service_id": null,
    "latency": 120,
    "throughput": 180,
    "availability": 99.4,
    "reliability": 98.9,
    "response_time": 135,
    "predicted_efficiency": 92.15,
    "created_at": "2026-04-06T10:00:00.000Z"
  }
}
```
