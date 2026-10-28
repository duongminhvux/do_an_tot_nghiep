"""Install the requested Torch wheels once; verify without needing a build-time GPU."""
from __future__ import annotations

import argparse
import importlib
import importlib.metadata
from pathlib import Path
import re
import subprocess
import sys


def expected_cuda(variant: str) -> str | None:
    if variant == "cpu":
        return None
    if not re.fullmatch(r"cu\d{3}", variant):
        raise ValueError("Torch variant must be cpu or cuNNN, for example cu126")
    return f"{int(variant[2:-1])}.{variant[-1]}"


def matches(version: str, variant: str) -> bool:
    expected = f"{version}+{variant}"
    try:
        return all(importlib.metadata.version(name) == expected for name in ("torch", "torchaudio"))
    except importlib.metadata.PackageNotFoundError:
        return False


def verify(version: str, variant: str) -> None:
    if not matches(version, variant):
        raise RuntimeError(f"Expected torch and torchaudio {version}+{variant}")
    torch = importlib.import_module("torch")
    # Import also checks the matching TorchAudio shared libraries.
    importlib.import_module("torchaudio")
    if torch.version.cuda != expected_cuda(variant):
        raise RuntimeError(f"Torch CUDA runtime mismatch: {torch.version.cuda!r} for {variant}")
    # torch.cuda.is_available() is checked at service startup, when Docker exposes the GPU.
    print(f"Verified torch={torch.__version__}, CUDA runtime={torch.version.cuda or 'cpu'}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--variant", required=True)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    expected_cuda(args.variant)
    if not re.fullmatch(r"\d+\.\d+\.\d+", args.version):
        parser.error("Torch version must be an exact release, for example 2.7.1")

    if not args.verify:
        constraints = "".join(f"{name}=={args.version}+{args.variant}\n" for name in ("torch", "torchaudio"))
        Path("/opt/torch-constraints.txt").write_text(constraints, encoding="utf-8")
        if matches(args.version, args.variant):
            print("Matching Torch environment already installed; skipping download", flush=True)
        else:
            subprocess.run([
                sys.executable, "-m", "pip", "install",
                f"torch=={args.version}+{args.variant}",
                f"torchaudio=={args.version}+{args.variant}",
                "--index-url", f"https://download.pytorch.org/whl/{args.variant}",
            ], check=True)
    verify(args.version, args.variant)


if __name__ == "__main__":
    main()
