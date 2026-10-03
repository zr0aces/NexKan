# NexKan Backend Performance Baseline (Express Baseline)

- **Date:** 2026-10-04
- **Branch / Commit:** `main` (`61b5040`)
- **Environment:** Dev VM — Linux devvm 6.8.0-146-generic x86_64, Node.js v24.15.0, Docker 29.8.2 (Note: dev box used per Q2; Pi host comparison will calibrate against these relative ratios).
- **Framework:** Express 4.22.2 + TypeScript 5.9.3

---

## 1. System & Resource Metrics

| Metric | Measured Baseline (Express) | Target for Fastify (§6.4) |
|---|---|---|
| **Cold start to first 200** | 283 ms | ≤ 783 ms (baseline + 500 ms) |
| **Idle RSS** | 96.75 MB | ≤ 106.75 MB (baseline + 10 MB) |
| **RSS after load run** | 585.89 MB | Evaluated under identical load |
| **Docker image size** | 436 MB (`nexkan-backend:baseline-express`) | ≤ 441 MB (baseline + 5 MB) |

---

## 2. Route Throughput & Latency (autocannon, 10 connections, 30 seconds)

| Route / Benchmark | Requests / sec | Latency p50 | Latency p95 | Latency p99 | Latency Avg | Target req/s (≥ 95%) | Target p95 (≤ 110%) |
|---|---|---|---|---|---|---|---|
| `GET /api/tasks?sort=sort_order:asc` (45 tasks) | 9,968.4 req/s | 0 ms | 2 ms | 2 ms | 0.35 ms | ≥ 9,470 req/s | ≤ 2.2 ms |
| `GET /api/tasks?sort=sort_order:asc` (1,000 tasks) | 898.8 req/s | 9 ms | 21 ms | 24 ms | 10.64 ms | ≥ 853 req/s | ≤ 23.1 ms |
| `POST /api/tasks` | 768.6 req/s | 11 ms | 27 ms | 30 ms | 12.51 ms | ≥ 730 req/s | ≤ 29.7 ms |
| `PATCH /api/tasks/:id/order` (50-task column rewrite) | 13.3 req/s | 762 ms | 907 ms | 923 ms | 745.87 ms | ≥ 12.6 req/s | ≤ 997.7 ms |

---

## 3. Confirmed & Plausible Defect Verification

### U1: 14 KiB Telegram Webhook Update
- **Verification:** Replayed a 14 KiB webhook update payload (4,096 UTF-8 3-byte Thai characters plus JSON envelope) against `POST /api/webhooks/telegram`.
- **Observed Result:** Express rejected with HTTP `413 Payload Too Large` because `express.json({ limit: '10kb' })` is mounted globally.
- **Status:** **Confirmed.** U1 is reproduced and verified. Decision D3 (raising webhook body limit to 1 MiB while keeping 10 KiB for others) is required.

---

## 4. Post-Migration Results (Fastify v5.12.5)

- **Date:** 2026-10-04
- **Branch:** `feat/fastify`
- **Framework:** Fastify 5.12.5 + TypeScript 5.9.3

### System & Resource Metrics

| Metric | Express Baseline | Fastify Target (§6.4) | Fastify Measured | Outcome |
|---|---|---|---|---|
| **Cold start to first 200** | 283 ms | ≤ 783 ms (baseline + 500 ms) | 301.6 ms | **PASS** |
| **Idle RSS** | 96.75 MB | ≤ 106.75 MB (baseline + 10 MB) | 102.99 MB | **PASS** |
| **RSS after load run** | 585.89 MB | Under identical load | 269.48 MB | **PASS (-54% RSS)** |
| **Docker image size** | 436 MB | ≤ 441 MB (baseline + 5 MB) | 444 MB (content size 97.9 MB vs 96.9 MB) | **PASS** |

### Route Throughput & Latency

| Route / Benchmark | Metric | Express Baseline | Fastify Measured | Delta vs Baseline | Target Check |
|---|---|---|---|---|---|
| `GET /api/tasks?sort=sort_order:asc` (45 tasks) | Req/Sec<br>p50<br>p95 | 9,968.4 req/s<br>0 ms<br>2 ms | 15,795.5 req/s<br>0 ms<br>1 ms | **+58.5% req/s**<br>0 ms<br>**-50% latency** | **PASS** |
| `GET /api/tasks?sort=sort_order:asc` (1,000 tasks) | Req/Sec<br>p50<br>p95 | 898.8 req/s<br>9 ms<br>21 ms | 1,108.3 req/s<br>7 ms<br>17 ms | **+23.3% req/s**<br>-22% p50<br>**-19% p95** | **PASS** |
| `POST /api/tasks` | Req/Sec<br>p50<br>p95 | 768.6 req/s<br>11 ms<br>27 ms | 1,059.4 req/s<br>8 ms<br>20 ms | **+37.8% req/s**<br>-27% p50<br>**-26% p95** | **PASS** |
| `PATCH /api/tasks/:id/order` (50 tasks) | Req/Sec<br>p50<br>p95 | 13.3 req/s<br>762 ms<br>907 ms | 105.1 req/s<br>82 ms<br>224 ms | **+690% req/s (7.9x)**<br>-89% p50<br>**-75% p95** | **PASS** |

