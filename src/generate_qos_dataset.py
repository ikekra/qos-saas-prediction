import csv
import random
from pathlib import Path


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def generate_qos_row() -> dict[str, float]:
    # Latency (ms): right-skewed, realistic for web services
    latency = clamp(random.lognormvariate(4.25, 0.42), 20.0, 900.0)

    # Throughput (Mbps): inversely related to latency, plus noise
    throughput = clamp(210.0 - 0.18 * latency + random.gauss(0, 18), 8.0, 260.0)

    # Availability (%): mostly high values, small spread
    availability = clamp(random.gauss(99.25, 0.45), 95.0, 99.999)

    # Reliability (%): correlated with availability + slight noise
    reliability = clamp(availability - random.uniform(0.0, 2.0) + random.gauss(0, 0.2), 92.0, 99.99)

    # Response time (ms): latency plus processing jitter
    response_time = clamp(latency + random.gauss(18, 10), 15.0, 1000.0)

    # Normalized component scores (0-100)
    latency_score = clamp(100.0 - (latency / 9.0), 0.0, 100.0)
    throughput_score = clamp((throughput - 8.0) / (260.0 - 8.0) * 100.0, 0.0, 100.0)

    # Efficiency strongly favors low latency + high availability
    efficiency_score = (
        0.45 * latency_score
        + 0.35 * availability
        + 0.12 * reliability
        + 0.08 * throughput_score
        + random.gauss(0, 1.8)
    )
    efficiency_score = clamp(efficiency_score, 0.0, 100.0)

    return {
        "latency": round(latency, 3),
        "throughput": round(throughput, 3),
        "availability": round(availability, 4),
        "reliability": round(reliability, 4),
        "response_time": round(response_time, 3),
        "efficiency_score": round(efficiency_score, 4),
    }


def main(rows: int = 3000, seed: int = 42) -> None:
    random.seed(seed)
    output_path = Path("qos_dataset.csv")
    fieldnames = [
        "latency",
        "throughput",
        "availability",
        "reliability",
        "response_time",
        "efficiency_score",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for _ in range(rows):
            writer.writerow(generate_qos_row())

    print(f"Generated {rows} rows at {output_path.resolve()}")


if __name__ == "__main__":
    main()
