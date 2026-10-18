from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

FEATURE_COLUMNS = [
    "latency",
    "throughput",
    "availability",
    "reliability",
    "response_time",
]
TARGET_COLUMN = "efficiency_score"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train QoS efficiency prediction model")
    parser.add_argument("--data", type=Path, default=Path("qos_dataset.csv"), help="Path to dataset CSV")
    parser.add_argument("--model-out", type=Path, default=Path("qos_model.pkl"), help="Output path for trained model")
    parser.add_argument("--scaler-out", type=Path, default=Path("scaler.pkl"), help="Output path for fitted scaler")
    parser.add_argument("--test-size", type=float, default=0.2, help="Fraction of dataset for test split")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed")
    return parser.parse_args()


def load_and_validate_data(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {csv_path}")

    df = pd.read_csv(csv_path)

    required_columns = set(FEATURE_COLUMNS + [TARGET_COLUMN])
    missing = required_columns.difference(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")

    df = df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()

    for col in FEATURE_COLUMNS + [TARGET_COLUMN]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before_drop = len(df)
    df = df.replace([np.inf, -np.inf], np.nan).dropna()
    dropped = before_drop - len(df)

    if len(df) < 100:
        raise ValueError(
            f"Insufficient valid rows after preprocessing ({len(df)} rows). Need at least 100."
        )

    if dropped:
        print(f"Dropped {dropped} invalid rows during preprocessing.")

    return df


def train_model(df: pd.DataFrame, test_size: float, random_state: int) -> tuple[RandomForestRegressor, StandardScaler, pd.DataFrame]:
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        shuffle=True,
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = RandomForestRegressor(
        n_estimators=500,
        max_depth=16,
        min_samples_leaf=2,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    metrics = {
        "R2": r2_score(y_test, y_pred),
        "MAE": mean_absolute_error(y_test, y_pred),
        "RMSE": np.sqrt(mean_squared_error(y_test, y_pred)),
    }

    print("\nModel Evaluation")
    print(f"R2:   {metrics['R2']:.4f}")
    print(f"MAE:  {metrics['MAE']:.4f}")
    print(f"RMSE: {metrics['RMSE']:.4f}")

    importance_df = pd.DataFrame(
        {
            "feature": FEATURE_COLUMNS,
            "importance": model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)

    print("\nFeature Importance")
    for _, row in importance_df.iterrows():
        print(f"{row['feature']}: {row['importance']:.6f}")

    return model, scaler, importance_df


def save_artifacts(model: RandomForestRegressor, scaler: StandardScaler, model_path: Path, scaler_path: Path) -> None:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    scaler_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)

    print(f"\nSaved model to: {model_path.resolve()}")
    print(f"Saved scaler to: {scaler_path.resolve()}")


def main() -> None:
    args = parse_args()
    df = load_and_validate_data(args.data)
    print(f"Loaded {len(df)} clean rows from {args.data.resolve()}")

    model, scaler, _ = train_model(df, args.test_size, args.random_state)
    save_artifacts(model, scaler, args.model_out, args.scaler_out)


if __name__ == "__main__":
    main()
