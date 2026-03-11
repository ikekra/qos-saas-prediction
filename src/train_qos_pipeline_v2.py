from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, KFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBRegressor  # type: ignore

    HAS_XGBOOST = True
except Exception:
    XGBRegressor = None  # type: ignore
    HAS_XGBOOST = False

BASE_FEATURES = [
    "latency",
    "throughput",
    "availability",
    "reliability",
    "response_time",
    "packet_loss",
    "service_load",
]
TARGET_COLUMN = "efficiency_score"


@dataclass
class ModelResult:
    model_name: str
    best_params: Dict[str, Any]
    cv_r2_mean: float
    cv_r2_std: float
    cv_mae_mean: float
    cv_mae_std: float
    cv_rmse_mean: float
    cv_rmse_std: float


class EnsembleRegressor:
    def __init__(self, estimators: List[Tuple[str, Any]]) -> None:
        self.estimators = estimators

    def fit(self, X: np.ndarray, y: np.ndarray) -> "EnsembleRegressor":
        for _, est in self.estimators:
            est.fit(X, y)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        preds = [est.predict(X) for _, est in self.estimators]
        return np.mean(preds, axis=0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QoS ML pipeline v2")
    parser.add_argument("--data", type=Path, default=Path("qos_dataset.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path("."))
    parser.add_argument("--model-out", type=Path, default=None)
    parser.add_argument("--report-out", type=Path, default=None)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--cv-splits", type=int, default=5)
    parser.add_argument("--timestamped", action="store_true")
    return parser.parse_args()


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    df = pd.read_csv(path)
    missing = [c for c in BASE_FEATURES + [TARGET_COLUMN] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    df = df[BASE_FEATURES + [TARGET_COLUMN]].copy()
    for col in BASE_FEATURES + [TARGET_COLUMN]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    return df


def remove_outliers(df: pd.DataFrame) -> pd.DataFrame:
    filtered = df.copy()
    for col in BASE_FEATURES:
        q1 = filtered[col].quantile(0.25)
        q3 = filtered[col].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        filtered = filtered[(filtered[col] >= lower) & (filtered[col] <= upper)]
    return filtered


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["latency_ratio"] = df["response_time"] / df["latency"].replace(0, np.nan)
    df["load_factor"] = df["service_load"] / df["throughput"].replace(0, np.nan)
    df["availability_weight"] = (df["availability"] * df["reliability"]) / 100.0
    df["loss_impact"] = 1 - (df["packet_loss"] / 100)
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    return df


def get_feature_columns(df: pd.DataFrame) -> List[str]:
    return [c for c in df.columns if c != TARGET_COLUMN]


def build_pipelines(random_state: int) -> Dict[str, Tuple[Any, Dict[str, List[Any]]]]:
    pipelines: Dict[str, Tuple[Any, Dict[str, List[Any]]]] = {
        "RandomForest": (
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    ("model", RandomForestRegressor(random_state=random_state, n_jobs=-1)),
                ]
            ),
            {
                "model__n_estimators": [300, 500],
                "model__max_depth": [12, 18],
                "model__min_samples_leaf": [1, 2],
                "model__min_samples_split": [2, 4],
            },
        ),
        "GradientBoost": (
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    ("model", GradientBoostingRegressor(random_state=random_state)),
                ]
            ),
            {
                "model__n_estimators": [200, 350],
                "model__learning_rate": [0.05, 0.1],
                "model__max_depth": [3, 4],
            },
        ),
    }

    if HAS_XGBOOST:
        pipelines["XGBoost"] = (
            Pipeline(
                [
                    ("scaler", StandardScaler()),
                    (
                        "model",
                        XGBRegressor(
                            random_state=random_state,
                            objective="reg:squarederror",
                            n_estimators=400,
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
            {
                "model__max_depth": [4, 6],
                "model__learning_rate": [0.05, 0.1],
                "model__subsample": [0.8, 1.0],
                "model__colsample_bytree": [0.8, 1.0],
            },
        )

    return pipelines


def evaluate_models(
    X: np.ndarray,
    y: np.ndarray,
    pipelines: Dict[str, Tuple[Any, Dict[str, List[Any]]]],
    cv: KFold,
) -> Tuple[List[ModelResult], Dict[str, Any]]:
    results: List[ModelResult] = []
    best_estimators: Dict[str, Any] = {}

    scoring = {"r2": "r2", "mae": "neg_mean_absolute_error", "rmse": "neg_root_mean_squared_error"}

    for name, (pipeline, params) in pipelines.items():
        grid = GridSearchCV(pipeline, params, cv=cv, scoring=scoring, n_jobs=-1, refit="r2")
        grid.fit(X, y)

        cv_scores = grid.cv_results_
        best_idx = grid.best_index_

        def mean_std(metric: str) -> Tuple[float, float]:
            mean_val = float(cv_scores[f"mean_test_{metric}"][best_idx])
            std_val = float(cv_scores[f"std_test_{metric}"][best_idx])
            return mean_val, std_val

        r2_mean, r2_std = mean_std("r2")
        mae_mean, mae_std = mean_std("mae")
        rmse_mean, rmse_std = mean_std("rmse")

        results.append(
            ModelResult(
                model_name=name,
                best_params=grid.best_params_,
                cv_r2_mean=r2_mean,
                cv_r2_std=r2_std,
                cv_mae_mean=-mae_mean,
                cv_mae_std=mae_std,
                cv_rmse_mean=-rmse_mean,
                cv_rmse_std=rmse_std,
            )
        )
        best_estimators[name] = grid.best_estimator_

    return results, best_estimators


def compute_metrics(model: Any, X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
    preds = model.predict(X)
    return {
        "r2": float(r2_score(y, preds)),
        "mae": float(mean_absolute_error(y, preds)),
        "rmse": float(np.sqrt(mean_squared_error(y, preds))),
    }


def main() -> None:
    args = parse_args()
    np.random.seed(args.random_state)

    raw = load_dataset(args.data)
    filtered = remove_outliers(raw)
    engineered = add_features(filtered)

    feature_cols = get_feature_columns(engineered)
    X = engineered[feature_cols].to_numpy()
    y = engineered[TARGET_COLUMN].to_numpy()

    cv = KFold(n_splits=args.cv_splits, shuffle=True, random_state=args.random_state)
    pipelines = build_pipelines(args.random_state)

    results, best_estimators = evaluate_models(X, y, pipelines, cv)
    results_sorted = sorted(results, key=lambda r: r.cv_r2_mean, reverse=True)
    top_models = [best_estimators[result.model_name] for result in results_sorted[:2]]

    ensemble = EnsembleRegressor([(results_sorted[0].model_name, top_models[0])])
    if len(top_models) > 1:
        ensemble = EnsembleRegressor(
            [(results_sorted[0].model_name, top_models[0]), (results_sorted[1].model_name, top_models[1])]
        )

    ensemble.fit(X, y)
    holdout_metrics = compute_metrics(ensemble, X, y)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") if args.timestamped else ""
    suffix = f"_{timestamp}" if timestamp else ""

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    model_out = args.model_out or output_dir / f"optimized_model{suffix}.pkl"
    report_out = args.report_out or output_dir / f"training_report{suffix}.json"

    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "rows_used": len(engineered),
        "features": feature_cols,
        "models": [asdict(r) for r in results_sorted],
        "best_model": asdict(results_sorted[0]),
        "ensemble_models": [r.model_name for r in results_sorted[:2]],
        "ensemble_holdout": holdout_metrics,
        "xgboost_used": HAS_XGBOOST,
    }

    joblib.dump(ensemble, model_out)
    report_out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps({"status": "ok", "model": str(model_out), "report": str(report_out)}))


if __name__ == "__main__":
    main()
