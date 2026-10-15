"""Compatibility entry point for the current evidence-bound parity report."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name('customer-ui-final-report.py')), run_name='__main__')
