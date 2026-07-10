"""Build the ignored AI v1 runtime artifact without rewriting tracked reports."""

from pathlib import Path
import subprocess
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import (  # noqa: E402
    AI_V1_ARTIFACT_PATH,
    AI_V1_DATASET_PATH,
    AI_V1_METADATA_PATH,
)
from app.ml.shadow import ShadowWaitModel  # noqa: E402


def main() -> None:
    current = ShadowWaitModel.load_optional()
    if current.status.available:
        print(f"AI v1 ready: {current.status.model_version}")
        return

    runtime_dir = AI_V1_ARTIFACT_PATH.parent
    runtime_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            sys.executable,
            str(BACKEND_DIR / "scripts" / "train_wait_model.py"),
            "--data",
            str(AI_V1_DATASET_PATH),
            "--artifact",
            str(AI_V1_ARTIFACT_PATH),
            "--metadata",
            str(runtime_dir / "wait_model_v1.generated.metadata.json"),
            "--report",
            str(runtime_dir / "wait_model_v1.generated.report.md"),
        ],
        check=True,
    )
    rebuilt = ShadowWaitModel.load_optional(metadata_path=AI_V1_METADATA_PATH)
    if not rebuilt.status.available:
        raise SystemExit(f"AI v1 artifact validation failed: {rebuilt.status.reason}")
    print(f"AI v1 rebuilt: {rebuilt.status.model_version}")


if __name__ == "__main__":
    main()
