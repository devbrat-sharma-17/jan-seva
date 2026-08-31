<div align="center">

# 🏛️ JAN-SEVA (जन-सेवा)
### *Aapki Samasya, Hamari Jimmedari (आपकी समस्या, हमारी ज़िम्मेदारी)*

[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Design System](https://img.shields.io/badge/CSS3-Vanilla%20Tokens-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**An enterprise-grade, transparent, and AI-assisted Civic Grievance Redressal & Operations Management Ecosystem.**  
*Currently powering municipal services in **Gwalior, Madhya Pradesh**, with upcoming expansions to **Indore** and **Bhopal**.*

---

[Explore Features](#-key-capabilities) • [Architecture](#-three-tier-architecture) • [Getting Started](#-getting-started) • [Demo Personas](#-demo-personas--quick-access) • [Privacy & Security](#-privacy--statutory-compliance)

</div>

---

## 🌟 Executive Overview

**JAN-SEVA** is a modern civic governance platform that bridges the gap between citizens, municipal field departments, and city administrators. By replacing bureaucratic silos with real-time tracking, dual-location GPS intelligence, automated SLA escalations, and cross-department oversight, JAN-SEVA delivers guaranteed accountability in municipal service delivery.

---

## 🏗️ Three-Tier Architecture

```mermaid
graph TD
    A[Citizen Portal\n/] -->|Submit & Track| B[(Shared Complaint Store\njan_seva_complaints_v3)]
    B -->|Filtered Department Context| C[Department Portal\n/department/*]
    B -->|Cross-City Oversight & Audit| D[Admin Command Center\n/admin/*]
    C -->|Update Status & Upload Evidence| B
    D -->|Reassign / Escalate / Audit| B
```

---

## 🚀 Key Capabilities

### 1. 👥 Citizen Experience (`/`, `/report`, `/track`)
* **60-Second Report Wizard**: 4-step streamlined grievance submission with photo evidence capture, real-time file validation, and description suggestions.
* **Dual Location Intelligence**: Captures both *Device GPS coordinates* and *Citizen-Confirmed Issue Location* on an interactive map.
* **AI-Assisted Classification**: Automatic priority scoring (0–100) and department routing (PWD, Sanitation, Water, Electrical, Infra).
* **Live Complaint Tracker (`/track`)**:
  * Real-time timeline nodes showing verified field updates.
  * Before & after photographic resolution evidence gallery.
  * **Citizen Resolution Verification**: Citizens confirm whether the issue was fixed or request a reinspection.
  * Printable official complaint receipt.
* **Cinematic Scroll Impact Statistics**: Non-linear quartic ease-out counters triggered on viewport entry (`12,480+` Issues Reported, `94%` Resolution Rate, `42` Active Initiatives).
* **City Expansion Ready**: City selector dropdown supporting **Gwalior** (Active • Default), **Indore** (Coming Soon), and **Bhopal** (Coming Soon).

---

### 2. 🏢 Department Operations Ecosystem (`/department/*`)
* **5 Dedicated Municipal Configurations**:
  * 🛣️ **Public Works Department (PWD)** — Potholes & road surface repairs
  * 🧹 **Municipal Sanitation** — Waste collection, open dumping, and compactor dispatch
  * 🚰 **Public Health & Water Works (PHE)** — Pipeline leaks, contamination, and water supply outages
  * 💡 **Municipal Electrical Division** — Streetlights, dark spots, and exposed utility wiring
  * 🏗️ **Public Infrastructure** — Damaged railings, parks, pavements, and public property
* **Locked Department Context**: Secure session locking preventing unauthorized cross-department data tampering.
* **Operational Dashboard**: Backlog management, unassigned grievance triage, and SLA countdown trackers.
* **Field Task Assignment**: Assign field engineers and operational maintenance teams with single-click workflow.
* **Performance Scoring**: Multi-metric performance rating engine (Resolution Rate 25%, SLA Compliance 25%, Speed 20%, Satisfaction 20%, Backlog Control 10%).

---

### 3. 🏛️ Admin Command Center (`/admin/*`)
* **Weighted Civic Health Score (0–100)**: City-wide composite metric derived from department performance, SLA compliance, resolution rate, citizen satisfaction, backlog ratio, and escalations.
* **8 Executive City KPIs**:
  * Total Influx, Active, Resolved, Escalated
  * SLA Compliance % (vs. 90% benchmark)
  * Average Citizen Satisfaction (Stars)
  * Average Resolution Time (Hours)
  * **Resolution Verification Rate & Resolutions Pending Citizen Confirmation**
* **Explicit "Needs Attention" Radar**: Severity-tagged items sorted by urgency (Critical, High, Medium, Low).
* **Cross-Department Grievance Monitor (`/admin/complaints`)**:
  * Multi-dimensional filtering by department, priority, status, locality, and SLA state.
  * **Cross-Department Reassignment**: Transfer misrouted complaints with audit reasoning.
  * **Manual Administrative Escalation**: Escalate critical bottlenecks directly to the Municipal Commissioner.
* **Separate Admin Audit Log**: Immutable record of all administrative decisions, isolated from citizen-facing public timelines.
* **City-Wide Civic Map & Hotspots Radar (`/admin/map`)**: Real-time geographic pins with locality clustering (City Centre, Thatipur, Lashkar, Morar, Phool Bagh).
* **SLA & Escalation Center (`/admin/escalations`)**: Tabbed monitoring for Breached, At-Risk (<8h), Escalated, and Citizen Reinspection Requests.
* **Performance Trends & Analytics (`/admin/performance`)**: 7d, 30d, 90d longitudinal SVG bar charts comparing complaint influx vs resolution velocity.
* **Civic Initiatives & Print Reports (`/admin/initiatives` & `/admin/reports`)**: Manage ward modernization missions and export printable municipal digests.

---

## 🔒 Privacy & Statutory Compliance

JAN-SEVA adheres to statutory standards (Digital Personal Data Protection Act):
* **Zero Raw Aadhaar Exposure**: Aadhaar numbers and mobile numbers are cryptographically derived and masked (`+91 XXXXX 43210`).
* **Minimum Necessary Principle**: Administrative access to citizen contact details is restricted and masked across all portals.
* **Dual Timeline Isolation**: Public grievance updates and internal administrative audit logs remain completely separated.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Core Framework** | React 19, TypeScript 5.7 |
| **Build & Dev Tool** | Vite 6 |
| **Routing** | React Router v7 |
| **Styling** | Vanilla CSS3 Design System with CSS Tokens, Glassmorphism, and HSL palettes |
| **Animations** | `requestAnimationFrame` + `IntersectionObserver` with Quartic Ease-Out |
| **Data Layer** | Reactive LocalStorage Repository with Cross-Tab Storage Event Sync |
| **Quality & Linting** | Strict TypeScript, Zero Compilation Errors |

---

## 📂 Codebase Structure

```
jan-seva/
├── public/                     # Static assets, branding marks, and city imagery
├── src/
│   ├── components/
│   │   ├── Admin/              # Phase 5: Admin Command Center
│   │   │   ├── Dashboard/      # Civic Health Score, KPIs, Needs Attention
│   │   │   ├── Complaints/     # Grievance Monitor & Inspector with Audit Log
│   │   │   ├── Departments/    # Department Ranking Scorecards & Drill-downs
│   │   │   ├── Map/            # City-Wide GIS Map & Hotspot Radar
│   │   │   ├── Escalations/    # SLA Breaches & Reinspection Oversight
│   │   │   ├── Feedback/       # Citizen Sentiment & Verification Analytics
│   │   │   ├── Performance/    # Longitudinal SVG Trend Charts
│   │   │   ├── Initiatives/    # Civic Campaign Manager
│   │   │   └── Reports/        # Print-ready Municipal Digests
│   │   ├── Department/         # Phase 4: Department Operations Ecosystem
│   │   │   ├── Dashboard/      # Department KPI Cards & SLA Health
│   │   │   ├── Complaints/     # Complaint Queue & Action Modal
│   │   │   ├── MyWork/         # Officer Assigned Work Inspector
│   │   │   ├── Map/            # Department Ward Radar
│   │   │   └── Performance/    # Department Tier & Scorecard
│   │   ├── Header/             # Brand Lockup, City Selector (Gwalior, Indore, Bhopal)
│   │   ├── Hero/               # Hero Headline & Cinematic Count-Up Trust Bar
│   │   ├── ReportWizard/       # 4-Step Citizen Grievance Reporting Wizard
│   │   ├── TrackComplaint/     # Real-Time Tracking & Verification
│   │   └── ui/                 # Reusable Design System Buttons, Icons & Badges
│   ├── data/                   # Department configurations, navigation, seed data
│   ├── hooks/                  # Custom hooks (useCountUp, useCityConfig, useGeolocation)
│   ├── services/               # AdminService, ComplaintService, PerformanceService, AuthService
│   ├── styles/                 # Global tokens, typography, animations, icons
│   ├── types/                  # Strict TypeScript interfaces (Complaint, Admin, Department)
│   ├── App.tsx                 # Master Routing Setup
│   └── main.tsx                # Application Entry Point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 💻 Getting Started

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/devbrat-sharma-17/jan-seva.git
   cd jan-seva
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🔑 Demo Personas & Quick Access

You can explore all three portals immediately using the built-in **Quick Demo** selectors:

| Role | Portal URL | Demo Persona | Credentials / Quick Access |
|---|---|---|---|
| **Citizen** | `/` or `/report` | Raj Sharma / Anjali Gupta | OTP Simulation (e.g. `9876543210`) |
| **Department Officer** | `/department/login` | Er. Ramesh Verma (PWD) / Anita Sharma (Sanitation) | Select department & click **Quick Demo Login** |
| **City Administrator** | `/admin/login` | Dr. Rakesh Agrawal (City Administrator) | Click **Enter as City Administrator** |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ for Citizen Empowerment and Transparent Civic Governance.</sub>
</div>
