<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=28&pause=1000&color=F5A623&center=true&vCenter=true&width=600&lines=⚡+VOLTCLOUD;Cloud+Energy+Monitoring+Platform;Real-time+%7C+Scalable+%7C+Firebase-powered" alt="VoltCloud" />

<br/>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)

<br/>

> **A cloud-native IoT energy monitoring platform** that ingests real-time readings from ESP-based smart meters, runs automated aggregation pipelines, and serves analytics through a live web dashboard — all backed by Firebase Firestore.

<br/>

[![Made with ❤️ by Illusive Coders](https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F%20by-Illusive%20Coders-ff69b4?style=flat-square)](https://github.com/)
![KTU Mini Project](https://img.shields.io/badge/KTU-Mini%20Project%202026-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Completed-brightgreen?style=flat-square)

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Data Pipeline](#-data-pipeline)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
- [Dashboard Preview](#-dashboard-preview)
- [Team](#-team)

---

## 🔍 Overview

VoltCloud solves a core challenge in modern energy management: **raw IoT sensor data is noisy, high-frequency, and hard to act on.** 

Smart meters generate readings every second — storing and querying raw data at that rate would be expensive and slow. VoltCloud solves this with a **tiered aggregation pipeline**: 1-second readings → 15-minute windows → daily summaries → monthly reports. Each tier reduces data volume while preserving analytical value.

The result is a system where:
- A home user can see their **live power usage** by appliance
- Historical data is **queryable in milliseconds** from Firestore
- Storage costs stay bounded even as usage data grows indefinitely

This was built as a KTU B.Tech Mini Project (S4 IT, GEC Palakkad, 2025–26).

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│              Web Dashboard (HTML + Chart.js + Firebase SDK)         │
│         Live View │ Daily Analytics │ Monthly Efficiency            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Firebase SDK (real-time queries)
┌───────────────────────────────▼─────────────────────────────────────┐
│                        CLOUD LAYER (Firebase)                       │
│                                                                     │
│  ┌──────────────────┐   ┌───────────────────┐  ┌────────────────┐  │
│  │  Cloud Firestore │   │  Firebase Auth    │  │  Firebase      │  │
│  │  (NoSQL DB)      │   │  (User Sessions)  │  │  Console       │  │
│  └──────────────────┘   └───────────────────┘  └────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Admin SDK
┌───────────────────────────────▼─────────────────────────────────────┐
│                      BACKEND LAYER (Node.js)                        │
│                                                                     │
│   Express.js Server          Cron Scheduler (node-cron)             │
│   ├── POST /send-data    ←   ├── Every 1 min   → 15_min.js          │
│   └── GET  /debug-memory     ├── 23:59 daily   → daily_auto.js      │
│                              └── 23:59 last    → monthly_auto.js    │
│                                  day of month                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP POST (1 req/sec)
┌───────────────────────────────▼─────────────────────────────────────┐
│                       EDGE LAYER (IoT / Simulator)                  │
│                                                                     │
│   ESP32 Smart Meter  OR  esp_stimulator.js (for dev/testing)        │
│   Sends: power, voltage, current, energy, frequency, power_factor   │
│   Rate: 1 reading/second per GPIO pin                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### ⚡ Core Functionality
- **Real-time ingestion** — accepts 1-second ESP readings via REST endpoint
- **15-minute aggregation** — in-memory accumulation with cron-triggered Firestore writes
- **Daily rollup with auto-deletion** — daily summaries generated nightly, raw 15-min data purged to save storage
- **Monthly summaries** — long-term trend data computed on month-end
- **Multi-device support** — each ESP device and GPIO pin tracked independently

### 🔐 Security & Access Control
- **Firebase Authentication** — each user tied to a specific `esp_id`
- **Per-user data isolation** — users can only query meters registered to their account
- **No raw key exposure** — `serviceAccountKey.json` excluded from version control

### 📊 Dashboard
- **Live Energy Analysis** — per-pin cards with current power, voltage, current
- **Daily Analytics** — bar chart of 24h consumption, KPIs (avg power, total kWh)
- **Monthly Efficiency** — doughnut chart of appliance share, monthly averages

### 🧪 Developer Experience
- **ESP Simulator** (`stimulator.js`) — generates realistic data with daily usage patterns (morning/evening peaks, night lows) without physical hardware
- **Debug endpoint** (`GET /debug-memory`) — inspect live in-memory aggregation state

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js | Backend server & cron jobs |
| Framework | Express.js | REST API routing |
| Database | Firebase Firestore | Cloud NoSQL storage |
| Auth | Firebase Authentication | User identity & access control |
| Scheduler | node-cron | Automated aggregation jobs |
| Visualization | Chart.js | Dashboard charts |
| Dev Tool | VS Code | IDE |
| Simulator | Custom JS | ESP device emulation |

---

## 🔄 Data Pipeline

This is the core engineering decision in VoltCloud — how raw 1-second readings become actionable monthly insights:

```
ESP Device
    │
    │  POST /send-data  (every 1 second)
    ▼
In-Memory Buffer (liveAggregation object)
    │  Groups readings by [esp_id][pin][15-min window]
    │  Accumulates: totalPower, totalVoltage, totalCurrent, totalEnergy, count
    │
    │  Cron: every 1 minute
    ▼
Firestore: aggregates_15min/{esp_id}/{pin}/data
    │  Stores: avg_power, avg_voltage, avg_current, total_energy, sample_count
    │  Retention: ~24 hours (deleted after daily rollup)
    │
    │  Cron: 23:59 daily
    ▼
Firestore: aggregates_daily/{esp_id}/{pin}/data  ──► DELETE 15min docs (batch)
    │  Stores: daily_avg_power, daily_total_energy, window_count
    │  Retention: ~31 days (deleted after monthly rollup)
    │
    │  Cron: 23:59 on last day of month
    ▼
Firestore: aggregates_monthly/{esp_id}/{pin}/data
    │  Stores: monthly_avg_power, monthly_total_energy, day_count
    │  Retention: permanent
    ▼
Dashboard (Web Client)
    Queries the right collection based on selected view
```

**Why this matters:** Without this pipeline, querying "last month's energy usage" would mean scanning thousands of raw documents. With it, it's a single Firestore document read.

---

## 📁 Project Structure

```
voltcloud/
│
├── backend/
│   ├── 15_min.js                  # Express server + real-time 15-min aggregation
│   ├── stimulator.js              # IoT device simulator (dev/testing)
│   ├── daily_auto.js              # Daily rollup — auto scheduled at 23:59
│   ├── daily_current.js           # Daily rollup — run manually for testing
│   ├── monthly_auto.js            # Monthly rollup — triggers on last day of month at 23:59
│   ├── monthly_current.js         # Monthly rollup — run manually for testing
│   ├── serviceAccountKey.json     # ← NOT in repo (excluded via .gitignore)
│   └── package.json
│
├── frontend/
│   ├── index.html                 # Landing page
│   ├── login.html                 # User login
│   ├── register.html              # User registration
│   ├── hub.html                   # Device hub / home after login
│   ├── analysis.html              # Live 15-min energy analysis
│   ├── daily.html                 # Daily analytics dashboard
│   ├── monthly.html               # Monthly efficiency dashboard
│   ├── profile.html               # User profile
│   └── settings.html              # App settings
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- A Firebase project with Firestore enabled
- Firebase service account key (`serviceAccountKey.json`)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/voltcloud.git
cd voltcloud/backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add Firebase credentials

Download your `serviceAccountKey.json` from Firebase Console → Project Settings → Service Accounts, and place it in the `/backend` folder.

> ⚠️ **Never commit this file.** It's already in `.gitignore`.

### 4. Start the backend server

```bash
node 15_min.js
```

The server starts on `http://localhost:5000`. Cron jobs activate automatically.

### 5. Run the ESP simulator (in a new terminal)

```bash
node stimulator.js
```

You should see live readings being sent every second:
```
[10:32:15] #0001 | P:142W | V:231.4V | I:0.614A | PF:0.881 | Avg:142W
[10:32:16] #0002 | P:145W | V:229.8V | I:0.631A | PF:0.873 | Avg:143W
```

### 6. Test aggregation manually (optional)

The `_auto` scripts run on a real-time cron schedule (daily at 23:59, monthly on the last day). For immediate testing without waiting, use the `_current` variants:

```bash
node daily_current.js      # runs daily aggregation right now
node monthly_current.js    # runs monthly aggregation right now
```

### 6. Open the dashboard

Open `frontend/index.html` in your browser. Log in with a Firebase-registered user to view your device's energy analytics.

---

## 📡 API Reference

### `POST /send-data`
Receives a single energy reading from an ESP device.

**Request body:**
```json
{
  "esp_id": "esp_001",
  "pin_number": "GPIO_18",
  "power": 142,
  "voltage": 231.4,
  "current": 0.614,
  "energy": 0.0394,
  "frequency": 50.1,
  "power_factor": 0.881,
  "apparent_power": 142.1,
  "reactive_power": 18.3
}
```

**Response:**
```json
{ "message": "Data accumulated", "samples": 47 }
```

---

### `GET /debug-memory`
Returns the current in-memory aggregation buffer. Useful for verifying data is being collected before the next cron flush.

**Response:**
```json
{
  "liveAggregation": {
    "esp_001": {
      "GPIO_18": {
        "2026-03-18T10:15:00.000Z": {
          "totalPower": 6534,
          "totalVoltage": 10642,
          "count": 46
        }
      }
    }
  },
  "currentWindow": "2026-03-18T10:15:00.000Z"
}
```

---

## 📸 Dashboard Preview

| View | Description |
|------|-------------|
| **Live (15-min)** | Per-appliance cards showing real-time power, voltage, current |
| **Daily Analytics** | Bar chart of hourly consumption + KPIs (avg power, total kWh) |
| **Monthly Efficiency** | Doughnut chart of appliance share + monthly averages |

---

## 👥 Team

**Group 13 — Department of Information Technology, GEC Palakkad**

| Name | Roll No. | Key Contributions |
|------|----------|-------------------|
| Anuja K | PKD23IT018 | Architecture design, 15-min & daily aggregation, PPT |
| Athulyakrishna K | PKD23IT024 | Firebase implementation, aggregation logic, project diary |
| Najiya K K | PKD23IT045 | Collection structure, ESP simulator testing, final review |
| Fathima Sherin | IDK23IT028 | Dataset summary, documentation, final report writing |

**Guide:** Dr. Rani M.R, Assistant Professor, Dept. of IT  
**Institution:** Government Engineering College Palakkad, APJ Abdul Kalam Technological University

---

## 📄 License

This project was developed for academic purposes under KTU B.Tech IT curriculum (2025–26).

---

<div align="center">

**⚡ VoltCloud — Turning raw watts into real insight**

</div>
