# QoSCollab - QoS Monitoring, Testing, and Token-Based Usage Platform

QoSCollab is a SaaS-style Quality of Service platform for monitoring and testing web/API services with a token-based billing model.

It includes:
- Real-time QoS testing (latency, load, uptime, throughput)
- Token usage accounting with top-up flow
- Profile + billing history + subscription insights
- Realtime token sync pipeline (SSE + polling fallback)
- ML-based QoS prediction workflow

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn/ui
- Auth/DB/Realtime/Functions: Supabase
- Edge Runtime: Supabase Edge Functions (Deno)
- ML Service: FastAPI (Python)
- Model tooling: scikit-learn

## Key Product Modules

- `Landing` marketing page with sponsorship and conversion flow
- `QoS Dashboard` live insights and status monitoring
- `Run Test` page for direct service testing and token deduction
- `Reports` and analytics views
- `Profile` with token balance, usage, and payment status
- `Billing & Payments` settings page with top-up records and CSV export

## Token System (Current Behavior)

- Tests consume tokens according to test type
- Cache-aware responses can avoid extra token spend
- Top-up flow supports mock/test-mode payment progression
- Realtime updates are delivered through token stream events
- Polling fallback keeps UI fresh if realtime drops

## Repository Structure

```text
src/
  src/                        # React app source
    pages/                    # App pages (dashboard, profile, qos, auth)
    components/               # Reusable UI/components
    contexts/                 # Auth + token usage contexts
    integrations/supabase/    # Supabase client/types
  supabase/
    functions/                # Edge functions (run-qos-test, token-stream, payments, etc.)
    migrations/               # SQL migrations
  ml_service.py               # FastAPI prediction service
  train_*.py                  # Model training scripts
```

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+
- Supabase project (URL + anon key + service role key)

## Local Setup

### 1) Install dependencies

```powershell
cd "c:\Users\Asus\Desktop\saas-qos\New folder\source\src"
npm install
python -m pip install -r requirements.txt
```

### 2) Configure frontend env

Create `.env` in project root (`source/src`) using:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
VITE_ML_API_URL=http://localhost:8000/predict
VITE_PAYMENT_ENABLED=false
VITE_TOKEN_POLL_INTERVAL_MS=60000
VITE_TOKEN_COST_LATENCY=50
VITE_TOKEN_COST_THROUGHPUT=70
VITE_TOKEN_COST_UPTIME=60
VITE_TOKEN_COST_FULL_REPORT=120
VITE_TOKEN_COST_HISTORICAL_ANALYSIS=150
VITE_TOKEN_COST_ANOMALY_SCAN=100
```

### 3) Run ML API

```powershell
python ml_service.py
```

### 4) Run frontend

```powershell
npm run dev
```

### 5) Production build check

```powershell
npm.cmd run build
```

## Supabase Edge Functions Used

Main functions currently wired in project:

- `run-qos-test`
- `token-stream`
- `token-topup`
- `token-check-demo`
- `payments-create-order`
- `payments-verify`
- `payments-webhook`
- `predict-qos`
- `compare-services`
- `create-web-service`
- `test-service`
- `get-recommendations`

Deploy examples:

```powershell
npx supabase functions deploy run-qos-test
npx supabase functions deploy token-stream
npx supabase functions deploy token-topup
npx supabase functions deploy payments-create-order
npx supabase functions deploy payments-verify
npx supabase functions deploy payments-webhook
```

## Database Migrations

Push migrations:

```powershell
npx supabase db push
```

Notes:
- If you see conflicts like "relation already exists", your remote DB likely has older/manual schema changes.
- Resolve by syncing migration history and running only missing migrations.

## Training & Model Scripts

Generate/train/evaluate:

```powershell
python generate_qos_dataset.py
python train_qos_model.py --data qos_dataset.csv
python train_qos_pipeline.py --data qos_dataset.csv
```

Artifacts include:
- `qos_model.pkl`
- `scaler.pkl`
- `evaluation_report.json`
- `evaluation_report.txt`

## Sponsor

This project is supported by:

- **ASQUADRA LOOP** (Title Sponsor)
- Website: https://asquadraloop.in

## Security & Production Notes

Before production rollout, make sure to:

- Restrict CORS to trusted frontend origins
- Apply rate limiting on auth/payment/test endpoints
- Keep secrets only in env vars (never frontend)
- Validate all request inputs in edge functions
- Monitor token and billing events with logs/alerts

## Useful NPM Scripts

```powershell
npm run dev
npm run build
npm run preview
npm run lint
```

## License

Proprietary / Internal project unless explicitly re-licensed.

---

If you are using this as a final-year project submission, this README is structured to be presentation-ready and deployment-oriented.
