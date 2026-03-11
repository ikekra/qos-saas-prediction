from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate realistic QoS dataset with noise")
    parser.add_argument("--rows", type=int, default=5000)
    parser.add_argument("--output", type=Path, default=Path("qos_dataset.csv"))
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def generate_dataset(rows: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    latency = rng.normal(loc=160, scale=45, size=rows).clip(40, 500)
    throughput = rng.normal(loc=220, scale=70, size=rows).clip(20, 800)
    availability = rng.normal(loc=99.2, scale=0.5, size=rows).clip(95, 99.99)
    reliability = rng.normal(loc=98.6, scale=0.8, size=rows).clip(90, 99.99)
    response_time = (latency * rng.normal(1.05, 0.12, size=rows)).clip(50, 700)
    packet_loss = rng.gamma(shape=1.5, scale=0.6, size=rows).clip(0, 5)
    service_load = rng.normal(loc=55, scale=18, size=rows).clip(5, 100)

    # Efficiency score: high availability/reliability/throughput, low latency/response/packet_loss/load
    availability_factor = (availability / 100) ** 2
    reliability_factor = (reliability / 100) ** 1.8
    throughput_factor = np.sqrt(throughput / 300)
    latency_penalty = (latency / 200) ** 1.2
    response_penalty = (response_time / 220) ** 1.1
    loss_penalty = 1 + (packet_loss / 5) ** 1.4
    load_penalty = 1 + (service_load / 100) ** 1.2

    base_score = (
        100
        * availability_factor
        * reliability_factor
        * throughput_factor
        / (latency_penalty * response_penalty * loss_penalty * load_penalty)
    )

    noise = rng.normal(loc=0, scale=2.0, size=rows)
    efficiency_score = (base_score + noise).clip(0, 100)

    return pd.DataFrame(
        {
            "latency": latency,
            "throughput": throughput,
            "availability": availability,
            "reliability": reliability,
            "response_time": response_time,
            "packet_loss": packet_loss,
            "service_load": service_load,
            "efficiency_score": efficiency_score,
        }
    )


def main() -> None:
    args = parse_args()
    df = generate_dataset(args.rows, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output, index=False)
    print(f"Saved dataset to {args.output} with {len(df)} rows")


if __name__ == "__main__":
    main()
