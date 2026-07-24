# Synthetic OPC Recipe Guide

This document contains demonstration-only rules and must not be interpreted as Synopsys guidance.

## Quality guardrails

- Accept a candidate when EPE p95 is at most 3.0 nm.
- Accept a candidate when PV Band is at most 10.0 nm.
- Prefer a process-window score of 85 or higher.
- Reject mask bias outside -5 nm to +5 nm.
- Reject fragment limits outside 50 to 1000.

## Exploration policy

Start with mask bias and smoothing. Increase fragmentation only when line-end EPE remains outside the guardrail. Rank feasible candidates by EPE, PV Band, process window, runtime, and compute cost. A human must approve every execution campaign and final checkpoint.