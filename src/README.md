# QoS Efficiency Prediction Platform

End-to-end system that trains a QoS efficiency model, serves predictions via a FastAPI ML service, and stores prediction history in Supabase with a React dashboard.

**Tech Stack**
- Frontend: Vite + React + TypeScript + Tailwind + shadcn-ui
- Backend ML API: FastAPI
- Database: Supabase
- ML: scikit-learn

**Stable Demo Flow**
1. Start the ML API.
2. Start the frontend.
3. Open the Predict page and enter QoS metrics.
4. Get the predicted efficiency and see it stored in Supabase.
5. Export prediction history to CSV.

## Setup

**Prerequisites**
- Node.js 18+
- Python 3.10+ (3.12/3.13 supported)

**Install frontend dependencies**
```powershell
cd "c:\Users\Asus\Desktop\saas-qos\New folder\source\src"
npm install
```

**Environment variables**
Create or update `.env` in the same folder as `package.json`:
```
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"
VITE_ML_API_URL=http://localhost:8000/predict
```

## Run the ML API
```powershell
cd "c:\Users\Asus\Desktop\saas-qos\New folder\source\src"
python -m pip install -r requirements.txt
python ml_service.py
```

## Run the Frontend
```powershell
cd "c:\Users\Asus\Desktop\saas-qos\New folder\source\src"
npm run dev
```

## Sample Prediction Request
```powershell
Invoke-RestMethod `
  -Uri "http://localhost:8000/predict" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"latency":120,"throughput":80,"availability":99.2,"reliability":98.9,"response_time":140}'
```

## Model Training

**Generate dataset**
```powershell
python generate_qos_dataset.py
```

**Train a single model**
```powershell
python train_qos_model.py --data qos_dataset.csv
```
This produces:
- `qos_model.pkl`
- `scaler.pkl`

**Full evaluation pipeline with report**
```powershell
python train_qos_pipeline.py --data qos_dataset.csv
```
This produces:
- `evaluation_report.json`
- `evaluation_report.txt`
- `best_model.pkl`
- `scaler.pkl`

## Model Evaluation (R2, MAE, RMSE)
The latest metrics are saved to:
- `evaluation_report.txt`
- `evaluation_report.json`

You can include these metrics in your final report:
- R2
- MAE
- RMSE

## Export Predictions (CSV)
Open the Predict page and click **Export CSV** to download the latest prediction history. The file opens in Excel.

## Supabase Tables Used
- `qos_predictions` stores prediction history
- `efficiency_logs` stores API request logs (from the Supabase Edge function)

## Screenshots
Place your screenshots here and update this list:
- `docs/screenshots/predict-page.png`
- `docs/screenshots/history-table.png`
- `docs/screenshots/export-csv.png`
