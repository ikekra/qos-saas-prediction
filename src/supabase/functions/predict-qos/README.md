# predict-qos Edge Function

This function:
- Receives QoS input from frontend
- Calls external FastAPI ML API (`/predict`)
- Stores result in `public.qos_predictions`
- Associates prediction with authenticated user (`auth.uid()`)
- Returns saved prediction row

## Required environment variables

Set secrets in Supabase:

```bash
supabase secrets set ML_API_URL="https://your-ml-api.onrender.com/predict"
supabase secrets set ML_API_KEY="optional_api_key_if_used"
supabase secrets set ML_API_TIMEOUT_MS="12000"
```

`ML_API_KEY` is optional. If your FastAPI service doesn't use API-key auth, you can skip it.
`ML_API_TIMEOUT_MS` is optional. Default is `12000`.

## Local development

Create `supabase/functions/.env.local`:

```env
ML_API_URL=https://your-ml-api.onrender.com/predict
ML_API_KEY=optional_api_key_if_used
ML_API_TIMEOUT_MS=12000
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
    latency: 120,
    throughput: 180,
    availability: 99.4,
    reliability: 98.9,
    response_time: 135,
  },
});
```
