#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path


def simulate(recipe: dict[str, float | int | str]) -> dict[str, float | int | str]:
    mask_bias = float(recipe["maskBiasNm"])
    fragment_limit = int(recipe["fragmentLimit"])
    smoothing = float(recipe.get("smoothing", 0.55))
    serif_strength = float(recipe.get("serifStrength", 0.6))

    if not -5 <= mask_bias <= 5:
        raise ValueError("maskBiasNm must be between -5 and 5")
    if not 50 <= fragment_limit <= 1000:
        raise ValueError("fragmentLimit must be between 50 and 1000")
    if not 0 <= smoothing <= 1 or not 0 <= serif_strength <= 1:
        raise ValueError("smoothing and serifStrength must be between 0 and 1")

    epe = 2.0 + abs(mask_bias - 1.4) * 0.48 + abs(smoothing - 0.62) * 1.8
    epe += max(0, 190 - fragment_limit) * 0.005
    pv_band = 7.4 + abs(mask_bias - 1.1) * 0.72 + abs(serif_strength - 0.72) * 2.2
    defect_risk = 170 + epe * 31 + pv_band * 4.2
    process_window = 100 - epe * 2.5 - pv_band * 0.8
    runtime = 24 + fragment_limit * 0.16 + smoothing * 12 + serif_strength * 8
    compute_cost = runtime / 60 * 0.12

    return {
        "epeP95Nm": round(epe, 2),
        "pvBandNm": round(pv_band, 2),
        "defectRiskPpm": round(defect_risk),
        "processWindowScore": round(process_window, 1),
        "runtimeMinutes": round(runtime),
        "computeCostUsd": round(compute_cost, 3),
        "simulator": "synthetic-proteus-compatible-contract-v1",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the synthetic OPC simulator")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    recipe = json.loads(args.input.read_text(encoding="utf-8"))
    result = {"runId": recipe["runId"], "recipe": recipe, "metrics": simulate(recipe)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=True, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()