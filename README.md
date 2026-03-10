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

- `Press Start 2P` typography
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

For Android emulator testing:

1. Start the Android emulator first
2. Run the Expo dev server
3. Press `a` in the Expo terminal

The mobile app is configured to reach the local server through the Android emulator host alias `10.0.2.2`.

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

- visual identity
- app shell and tab structure
- local development workflow
- shared gameplay rule setup

Areas still suited for future iteration:

- richer battle presentation
- real auth provider integration
- persistent database storage
- expanded pet content and progression
- production-ready error handling and polish

## License

This project is currently intended for prototype and internal development use.
