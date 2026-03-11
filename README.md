# Pixel Pet Arena

Pixel Pet Arena is a retro-styled mobile tamagotchi prototype built with Expo, React Native, and NestJS.

The current build focuses on a strong pixel-art presentation: a dark arcade UI, animated pet sprite, care actions, collection preview, and a basic battle queue flow backed by a local API server.

![Pixel Pet Arena screenshot](./screenshots/1.jpg)

## Overview

- Raise a pixel pet with a simple care loop
- Start with 1 random pet template
- Manage `Feed`, `Clean`, `Play`, and `Rest` actions
- Browse a small collection preview of available templates
- Queue for battle from the mobile app
- Switch language and theme inside the app
- Share battle and content rules between client and server through a shared package

## Current App Flow

The current mobile prototype includes these screens and flows:

1. Splash screen with retro boot-style presentation
2. Demo login flow
3. Home tab with featured pet, level/EXP, and care actions
4. Battle tab with queue request
5. Collection tab with template preview
6. Profile tab with trainer info and settings

## Visual Direction

This version of the app is intentionally styled like an indie pixel game:

- `Mona12` / `Mona12-Bold` pixel typography (Regular + Bold weights)
- high-contrast dark theme with a light theme option
- pixel icon set for care actions
- minimalist dividers and UI framing
- animated sprite support for registered pets

## Project Structure

- `apps/mobile`: Expo + React Native app
- `apps/server`: NestJS API server
- `packages/shared`: shared game logic, pet templates, types, care rules, and battle rules

## Tech Stack

- React Native 0.79
- Expo 53
- TypeScript
- NestJS 11
- React Query
- Zustand
- AsyncStorage
- Socket.IO / Socket.IO Client

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/sjs701701/PixelPet.git
cd PixelPet
npm install
```

## Run The Server

From the project root:

```bash
npm run dev:server
```

The API server runs on `http://localhost:3001`.

### Premium Prototype Mode

Real store billing and receipt verification are not connected in this prototype.

- `POST /premium/verify-purchase` is intentionally not implemented for production use yet.
- Internal testing can use `POST /premium/dev/toggle` only when the server starts with `PIXELPET_PREMIUM_DEV=true`.
- If the flag is not set, premium stays in normal free mode.

Example:

```bash
$env:PIXELPET_PREMIUM_DEV="true"
npm run dev:server
```

## Run The Mobile App

From the project root:

```bash
npm run dev:mobile
```

Or directly from the mobile workspace:

```bash
cd apps/mobile
npx expo start
```

### API Address Resolution

The mobile app now resolves the API target in this order:

1. `EXPO_PUBLIC_API_URL` from `apps/mobile/.env.local`
2. Android emulator default: `http://10.0.2.2:3001`
3. iOS simulator / web default: `http://localhost:3001`

Copy the example file if you need a custom host:

```bash
cd apps/mobile
copy .env.example .env.local
```

Then update:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_IP:3001
```

### Android Emulator Testing

Android emulator uses `http://10.0.2.2:3001` by default, so no extra setup is needed if the server is running on the same PC.

1. Start the Android emulator first
2. Run the API server from the project root
3. Run the Expo dev server
4. Press `a` in the Expo terminal

### iOS Simulator / Web Testing

iOS simulator and web fall back to `http://localhost:3001`.

### Real Device Testing

For a physical device, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to your PC's LAN IP.

For example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:3001
```

Make sure the phone and the server PC are on the same network.

### Previous Android-only Flow

The old hardcoded Android emulator alias has been removed. The app no longer assumes `10.0.2.2` in every environment.

### Quick Android Flow

If you only need the default Android emulator path:

1. Start the server with `npm run dev:server`
2. Start the mobile app with `npm run dev:mobile`
3. Press `a`

## Useful Commands

From the repository root:

```bash
npm run dev:mobile
npm run dev:server
npm run build
npm test
```

## Gameplay Notes

- Elements currently used: `fire`, `water`, `grass`, `electric`, `digital`
- First pet acquisition is random
- Care actions affect the pet state
- Battle queue flow is connected to the local server
- Shared rules live in `packages/shared` so client and server stay aligned

## Current Scope

This repository is still a prototype. The current version is strongest in:

- demo login flow tied to a local install id
- local persistence for user, session, and pet state
- pet creation, nickname save, and care loop prototype
- internal-only premium dev toggle
- shared gameplay rule setup and mobile app shell

Areas still suited for future iteration:

- final battle policy and battle server rules
- real auth provider integration
- production database and deployment setup
- expanded pet content and progression
- store billing and real receipt verification

---

## Changelog

### v0.3.0 — 2026-03-11

**Font System Overhaul**
- Replaced `Press Start 2P` (single weight) with `Mona12` pixel font (Regular + Bold)
- Bold weight applied to titles, headlines, species names, level display
- Regular weight for body text, labels, stat values

**UI Polish**
- Splash / login screen text sizes increased globally
- Nickname creation changed from inline block to popup modal with bordered buttons
- Dark mode `gray` updated to `#BEBEBE`, light mode to `#555555` for better readability
- Status bar graph height doubled (4px → 8px)
- Care action button label font increased (9px → 12px)
- Tab bar font increased (13px → 14px)
- Profile tab fonts increased by +2px across the board
- Stat number font increased (11px → 13px)
- Cooldown timer text made larger and bold (12px → 16px Bold)
- Level display styled with bold weight

**Battle System**
- Implemented full battle screen (Pokemon-style layout)
  - Opponent info top / player info bottom with HP bars and stat chips
  - Three action buttons: attack / skill / guard
  - HP bar color changes by threshold (green → orange → red)
  - Battle log showing per-turn damage / guard results
  - Victory / defeat result screen with lobby return
- Added dev bot matchmaking (`POST /battle/queue-dev`) for solo testing
- Added battle detail endpoint (`GET /battle/:id`) and action endpoint (`POST /battle/:id/action`)
- Bot auto-responds with weighted random actions (60% attack, 25% skill, 15% guard)

## License

This project is currently intended for prototype and internal development use.
