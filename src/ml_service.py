from __future__ import annotations

import os
from pathlib import Path
from typing import List

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

FEATURE_ORDER = [
    "latency",
    "throughput",
    "availability",
    "reliability",
    "response_time",
]


def parse_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "*")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["*"]


class PredictionRequest(BaseModel):
    latency: float = Field(..., ge=0, le=10000)
    throughput: float = Field(..., ge=0, le=100000)
    availability: float = Field(..., ge=0, le=100)
    reliability: float = Field(..., ge=0, le=100)
    response_time: float = Field(..., ge=0, le=10000)


class PredictionResponse(BaseModel):
    predicted_efficiency: float


app = FastAPI(
    title="QOSCollab ML Prediction API",
    version="1.0.0",
    description="Predict service efficiency score from QoS metrics",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MODEL = None
SCALER = None


@app.on_event("startup")
def load_artifacts() -> None:
    global MODEL, SCALER

    model_path = Path(os.getenv("MODEL_PATH", "qos_model.pkl"))
    scaler_path = Path(os.getenv("SCALER_PATH", "scaler.pkl"))

    if not model_path.exists() or not scaler_path.exists():
        missing = []
        if not model_path.exists():
            missing.append(str(model_path))
        if not scaler_path.exists():
            missing.append(str(scaler_path))
        raise RuntimeError(f"Missing required artifact(s): {', '.join(missing)}")

    MODEL = joblib.load(model_path)
    SCALER = joblib.load(scaler_path)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": f"Internal server error: {str(exc)}"})


@app.get("/health")
def health() -> dict:
    ready = MODEL is not None and SCALER is not None
    return {"status": "ok" if ready else "degraded", "artifacts_loaded": ready}


@app.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest) -> PredictionResponse:
    if MODEL is None or SCALER is None:
        raise HTTPException(status_code=503, detail="Model artifacts are not loaded")

    try:
        features = pd.DataFrame(
            [[getattr(payload, key) for key in FEATURE_ORDER]],
            columns=FEATURE_ORDER,
            dtype=float,
        )
        scaled_features = SCALER.transform(features)
        prediction = MODEL.predict(scaled_features)
        score = float(prediction[0])
        return PredictionResponse(predicted_efficiency=round(score, 4))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {str(exc)}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("ml_service:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
