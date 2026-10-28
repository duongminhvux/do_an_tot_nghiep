import importlib.metadata
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import install_torch


class TorchEnvironmentTests(unittest.TestCase):
    def run_install(self, variant, installed):
        with tempfile.TemporaryDirectory() as directory:
            constraints = Path(directory) / "constraints.txt"
            version = installed or "0.0.0"
            with patch("sys.argv", ["install_torch.py", "--version", "2.7.1", "--variant", variant]), \
                 patch.object(install_torch, "Path", return_value=constraints), \
                 patch.object(install_torch.importlib.metadata, "version", return_value=version), \
                 patch.object(install_torch.subprocess, "run") as run, \
                 patch.object(install_torch, "verify"):
                install_torch.main()
                return run.call_args_list, constraints.read_text()

    def test_matching_environment_skips_pip_downloads(self):
        calls, constraints = self.run_install("cu126", "2.7.1+cu126")
        self.assertEqual(calls, [])
        self.assertIn("torch==2.7.1+cu126", constraints)
        self.assertIn("torchaudio==2.7.1+cu126", constraints)

    def test_wrong_variant_installs_from_the_requested_index(self):
        calls, _ = self.run_install("cu126", "2.7.1+cpu")
        self.assertEqual(len(calls), 1)
        self.assertIn("https://download.pytorch.org/whl/cu126", calls[0].args[0])
        self.assertIn("torchaudio==2.7.1+cu126", calls[0].args[0])

    def test_missing_package_and_mismatched_audio_do_not_skip_installation(self):
        with patch.object(install_torch.importlib.metadata, "version", side_effect=importlib.metadata.PackageNotFoundError):
            self.assertFalse(install_torch.matches("2.7.1", "cpu"))
        with patch.object(install_torch.importlib.metadata, "version", side_effect=["2.7.1+cu126", "2.7.1+cpu"]):
            self.assertFalse(install_torch.matches("2.7.1", "cu126"))

    def test_verifies_cuda_build_without_requiring_a_gpu_during_build(self):
        torch = SimpleNamespace(__version__="2.7.1+cu126", version=SimpleNamespace(cuda="12.6"))
        with patch.object(install_torch, "matches", return_value=True), \
             patch.object(install_torch.importlib, "import_module", return_value=torch):
            install_torch.verify("2.7.1", "cu126")
            with self.assertRaisesRegex(RuntimeError, "runtime mismatch"):
                install_torch.verify("2.7.1", "cpu")

    def test_rejects_invalid_variant(self):
        with self.assertRaises(ValueError):
            install_torch.expected_cuda("init8")


if __name__ == "__main__":
    unittest.main()
