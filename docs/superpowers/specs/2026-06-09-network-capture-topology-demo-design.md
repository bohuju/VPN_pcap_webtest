# Network Capture Topology Demo — Design Spec

**Date:** 2026-06-09
**Status:** Approved
**File:** `frontend/src/pages/NetworkTopologyPage.tsx`

## Overview

A single-page SVG-based network topology demo showing a data capture and LLM analysis pipeline. The page demonstrates how traffic flows from the Internet through a Gateway, gets captured and analyzed on a Server by an LLM Agent, and results are sent back to a client (STA).

## Topology Layout

SVG viewBox: 1000×680, dark background (#0f172a).

### Node Positions

| Node | Position (x, y) | Radius/Size | Color |
|------|-----------------|-------------|-------|
| Internet / External Network | (500, 40) | r=30 | Blue (#3b82f6) |
| Gateway / AP | (500, 150) | r=36 | Blue (#3b82f6) |
| SW1 | (230, 300) | 56×56 rect | Cyan (#22d3ee) |
| SW2 | (770, 300) | 56×56 rect | Cyan (#22d3ee) |
| STA / Client | (230, 440) | r=30 | Green (#4ade80) |
| Server | (770, 430) | r=34 | Purple (#c084fc) |
| Dataset (data 5.8GB) | (770, 550) | 124×64 rect | Neutral gray |

### Probe / LCM / Capture Module Placement

Three badge modules placed to the RIGHT of the Gateway→SW2 diagonal line, at the midpoint:
- Probe: (645, 212)
- LCM: (645, 252)
- Capture: (645, 292)

A short horizontal "tap" line connects from the Gateway→SW2 line to the module stack, visually representing signal tapping. A dashed amber box encloses the Gateway→Server path region when highlighted.

### Lines / Connections

| Path | Type | Style |
|------|------|-------|
| Internet → Gateway | Solid | Blue-gray, standard width |
| Gateway → SW1 | Solid | Standard, left branch |
| Gateway → SW2 | Dashed | **Thicker + amber**, capture path |
| SW1 → STA | Solid | Standard |
| SW2 → Server | Dashed | **Thicker + amber**, capture path |

No line connects to Dataset — it floats independently below Server.

## Animation Sequence (5 Phases)

Triggered by "Start Demo" button. Total duration ~4s.

### Phase 0: Ingress (0ms)
- Blue dot packets flow Internet → Gateway
- Step counter: "Step 1/5 — Traffic enters Gateway"

### Phase 1: Distribution (600ms)
- Cyan packets: Gateway → SW1 (left path)
- Orange packets: Gateway → SW2 (right path)  
- Step counter: "Step 2/5 — Gateway distributes to switches"

### Phase 2: Capture (1400ms)
- Purple packets: SW2 → Server (inbound capture)
- Probe lights up → 200ms delay → LCM lights up → 200ms delay → Capture lights up
- Amber glow filter + dashed box appears around capture path
- Step counter: "Step 3/5 — Probe → LCM → Capture observing traffic"

### Phase 3: LLM Analysis + Local Capture (2400ms)
- Server node pulses with purple glow
- "LLM Agent" badge appears near Server, lights up
- Server Local Capture panel status updates:
  - "Extra data captured" → green dot
  - "Capture status: active" → green text
- Step counter: "Step 4/5 — LLM Agent analyzing captured data"

### Phase 4: Result Return (3200ms)
- **Green square** packets flow in reverse: Server → SW2 → Gateway → SW1 → STA
- Completes the round-trip loop
- Step counter: "Step 5/5 — Results sent back to STA"

### Completion (4000ms)
- Status: "Demo complete"
- All visual states persist

## Key Visual Distinctions

- **Inbound capture packets**: Purple circles (Gateway→SW2→Server)
- **Outbound result packets**: Green squares (Server→SW2→Gateway→SW1→STA)
- **Dataset**: Always static, never animated, "not a network node" annotation
- **Capture path**: Thicker dashed lines, amber color throughout

## Server Local Capture Panel

Position: to the right of Server node (x≈818, y≈390)
Contents:
- Title: "Server Local Capture"
- Status items:
  - Extra data captured (green/red dot)
  - Capture status: active/idle
  - LLM Agent: analyzing (phase 3+)

## Dataset Card

Position: directly below Server (x=770, y=550)
- Stacked file/database icon
- Label: "Dataset" + "data 5.8GB"
- Sub-label: "Stored on Server"
- Annotation: "(not a network node)"
- **No connecting lines to any node**

## Interactive Features

- **Start Demo**: Triggers phased animation sequence
- **Reset**: Clears all animations, returns to idle state
- **Tooltips**: Hover on any node shows description (dark tooltip, 120% above node)
- **Status indicator**: Small colored dot showing idle/running/complete state

## Responsive Design

- Desktop (≥768px): Standard horizontal SVG topology
- Mobile (<768px): SVG scales to fit viewport width, controls stack vertically, font sizes reduced proportionally via SVG's `preserveAspectRatio`

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS 3.4 (for wrapper layout + buttons)
- lucide-react icons
- Pure SVG canvas (no external charting library for topology)
- CSS transitions + requestAnimationFrame for animation loop
