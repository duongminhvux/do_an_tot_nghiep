#!/usr/bin/env python3
"""Backward-compatible alias to the fresh-stack architecture validator."""
from runpy import run_path
from pathlib import Path
run_path(str(Path(__file__).with_name('check-fresh-stack.py')),run_name='__main__')
