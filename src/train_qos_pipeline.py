from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_COLUMNS = [
    "latency",
    "throughput",
    "availability",
    "reliability",
    "response_time",
]
TARGET_COLUMN = "efficiency_score"


class OutlierClipper(BaseEstimator, TransformerMixin):
    """Clip numeric features to IQR bounds learned from training data."""

    def __init__(self, factor: float = 1.5) -> None:
        self.factor = factor
        self.lower_bounds_: pd.Series | None = None
        self.upper_bounds_: pd.Series | None = None

    def fit(self, X: pd.DataFrame | np.ndarray, y: Any = None) -> "OutlierClipper":
        X_df = pd.DataFrame(X)
        q1 = X_df.quantile(0.25)
        q3 = X_df.quantile(0.75)
        iqr = q3 - q1
        self.lower_bounds_ = q1 - self.factor * iqr
        self.upper_bounds_ = q3 + self.factor * iqr
        return self

    def transform(self, X: pd.DataFrame | np.ndarray) -> np.ndarray:
        if self.lower_bounds_ is None or self.upper_bounds_ is None:
            raise RuntimeError("OutlierClipper must be fitted before transform.")
        X_df = pd.DataFrame(X)
        clipped = X_df.clip(self.lower_bounds_, self.upper_bounds_, axis=1)
        return clipped.to_numpy(dtype=float)


@dataclass
class ModelResult:
    model_name: str
    holdout_r2: float
    holdout_mae: float
    holdout_rmse: float
    cv_r2_mean: float
    cv_r2_std: float
    cv_mae_mean: float
    cv_mae_std: float
    cv_rmse_mean: float
    cv_rmse_std: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QOSCollab complete ML training pipeline")
    parser.add_argument("--data", type=Path, default=Path("qos_dataset.csv"), help="Path to QoS dataset CSV")
    parser.add_argument("--best-model-out", type=Path, default=Path("best_model.pkl"), help="Output path for best model artifact")
    parser.add_argument("--scaler-out", type=Path, default=Path("scaler.pkl"), help="Output path for scaler artifact")
    parser.add_argument("--report-out", type=Path, default=Path("evaluation_report.json"), help="Output path for evaluation report (JSON)")
    parser.add_argument("--report-text-out", type=Path, default=Path("evaluation_report.txt"), help="Output path for evaluation report (text)")
    parser.add_argument("--test-size", type=float, default=0.2, help="Test split ratio")
    parser.add_argument("--cv-folds", type=int, default=5, help="Cross-validation folds")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed")
    return parser.parse_args()


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    df = pd.read_csv(path)
    missing_cols = [c for c in FEATURE_COLUMNS + [TARGET_COLUMN] if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing required columns: {missing_cols}")

    df = df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()
    for col in FEATURE_COLUMNS + [TARGET_COLUMN]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    dropped = before - len(df)

    if len(df) < 200:
        raise ValueError(f"Insufficient valid rows after cleaning: {len(df)}")

    if dropped > 0:
        print(f"Dropped {dropped} invalid rows during cleaning.")

    return df


def get_model_pipelines(random_state: int) -> Dict[str, Pipeline]:
    return {
        "LinearRegression": Pipeline(
            steps=[
                ("outlier", OutlierClipper(factor=1.5)),
                ("scaler", StandardScaler()),
                ("model", LinearRegression()),
            ]
        ),
        "RandomForest": Pipeline(
            steps=[
                ("outlier", OutlierClipper(factor=1.5)),
                ("scaler", StandardScaler()),
                (
                    "model",
                    RandomForestRegressor(
                        n_estimators=500,
                        max_depth=18,
                        min_samples_leaf=2,
                        random_state=random_state,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
        "GradientBoosting": Pipeline(
            steps=[
                ("outlier", OutlierClipper(factor=1.5)),
                ("scaler", StandardScaler()),
                (
                    "model",
                    GradientBoostingRegressor(
                        n_estimators=400,
                        learning_rate=0.05,
                        max_depth=3,
                        random_state=random_state,
                    ),
                ),
            ]
        ),
    }


def evaluate_models(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    X_full: pd.DataFrame,
    y_full: pd.Series,
    pipelines: Dict[str, Pipeline],
    cv_folds: int,
) -> List[ModelResult]:
    results: List[ModelResult] = []

    scoring = {
        "r2": "r2",
        "mae": "neg_mean_absolute_error",
        "rmse": "neg_root_mean_squared_error",
    }

    for name, pipeline in pipelines.items():
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)

        holdout_r2 = r2_score(y_test, predictions)
        holdout_mae = mean_absolute_error(y_test, predictions)
        holdout_rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))

        cv_scores = cross_validate(
            pipeline,
            X_full,
            y_full,
            cv=cv_folds,
            scoring=scoring,
            n_jobs=-1,
            return_train_score=False,
        )

        result = ModelResult(
            model_name=name,
            holdout_r2=float(holdout_r2),
            holdout_mae=float(holdout_mae),
            holdout_rmse=float(holdout_rmse),
            cv_r2_mean=float(np.mean(cv_scores["test_r2"])),
            cv_r2_std=float(np.std(cv_scores["test_r2"])),
            cv_mae_mean=float(-np.mean(cv_scores["test_mae"])),
            cv_mae_std=float(np.std(-cv_scores["test_mae"])),
            cv_rmse_mean=float(-np.mean(cv_scores["test_rmse"])),
            cv_rmse_std=float(np.std(-cv_scores["test_rmse"])),
        )
        results.append(result)

    return results


def pick_best_model(results: List[ModelResult]) -> ModelResult:
    return sorted(
        results,
        key=lambda r: (-r.cv_r2_mean, -r.holdout_r2, r.cv_rmse_mean, r.holdout_rmse),
    )[0]


def write_reports(
    report_json_path: Path,
    report_text_path: Path,
    dataset_path: Path,
    row_count: int,
    cv_folds: int,
    results: List[ModelResult],
    best: ModelResult,
) -> None:
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": str(dataset_path.resolve()),
        "rows_used": row_count,
        "features": FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "cross_validation_folds": cv_folds,
        "models": [asdict(r) for r in results],
        "best_model": asdict(best),
        "selection_rule": "Highest cv_r2_mean, then highest holdout_r2, then lowest cv_rmse_mean, then lowest holdout_rmse",
    }

    report_json_path.parent.mkdir(parents=True, exist_ok=True)
    report_json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "QOSCollab ML Training Evaluation Report",
        "=" * 40,
        f"Generated (UTC): {payload['generated_at_utc']}",
        f"Dataset: {payload['dataset']}",
        f"Rows Used: {row_count}",
        f"Features: {', '.join(FEATURE_COLUMNS)}",
        f"Target: {TARGET_COLUMN}",
        f"CV Folds: {cv_folds}",
        "",
        "Model Comparison",
        "-" * 40,
    ]

    for r in results:
        lines.extend(
            [
                f"{r.model_name}",
                f"  Holdout -> R2: {r.holdout_r2:.4f}, MAE: {r.holdout_mae:.4f}, RMSE: {r.holdout_rmse:.4f}",
                f"  CV Mean -> R2: {r.cv_r2_mean:.4f}, MAE: {r.cv_mae_mean:.4f}, RMSE: {r.cv_rmse_mean:.4f}",
                f"  CV Std  -> R2: {r.cv_r2_std:.4f}, MAE: {r.cv_mae_std:.4f}, RMSE: {r.cv_rmse_std:.4f}",
                "",
            ]
        )

    lines.extend(
        [
            "Best Model",
            "-" * 40,
            f"Selected: {best.model_name}",
            f"Holdout R2: {best.holdout_r2:.4f}",
            f"Holdout MAE: {best.holdout_mae:.4f}",
            f"Holdout RMSE: {best.holdout_rmse:.4f}",
            f"CV R2 Mean: {best.cv_r2_mean:.4f}",
            f"CV MAE Mean: {best.cv_mae_mean:.4f}",
            f"CV RMSE Mean: {best.cv_rmse_mean:.4f}",
        ]
    )

    report_text_path.parent.mkdir(parents=True, exist_ok=True)
    report_text_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()

    df = load_dataset(args.data)
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        shuffle=True,
    )

    pipelines = get_model_pipelines(args.random_state)
    results = evaluate_models(
        X_train=X_train,
        X_test=X_test,
        y_train=y_train,
        y_test=y_test,
        X_full=X,
        y_full=y,
        pipelines=pipelines,
        cv_folds=args.cv_folds,
    )

    best = pick_best_model(results)
    best_pipeline = pipelines[best.model_name]
    best_pipeline.fit(X, y)

    args.best_model_out.parent.mkdir(parents=True, exist_ok=True)
    args.scaler_out.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(best_pipeline, args.best_model_out)
    best_scaler = best_pipeline.named_steps["scaler"]
    joblib.dump(best_scaler, args.scaler_out)

    write_reports(
        report_json_path=args.report_out,
        report_text_path=args.report_text_out,
        dataset_path=args.data,
        row_count=len(df),
        cv_folds=args.cv_folds,
        results=results,
        best=best,
    )

    print("\nModel Comparison Summary")
    for r in results:
        print(
            f"- {r.model_name}: Holdout R2={r.holdout_r2:.4f}, MAE={r.holdout_mae:.4f}, RMSE={r.holdout_rmse:.4f}; "
            f"CV R2={r.cv_r2_mean:.4f}"
        )

    print(f"\nBest model selected: {best.model_name}")
    print(f"Saved best model to: {args.best_model_out.resolve()}")
    print(f"Saved scaler to: {args.scaler_out.resolve()}")
    print(f"Saved evaluation report (JSON): {args.report_out.resolve()}")
    print(f"Saved evaluation report (text): {args.report_text_out.resolve()}")


if __name__ == "__main__":
    main()
