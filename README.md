# Pixel Pet Arena

Pixel Pet Arena is a dot-style Tamagotchi battle prototype.

This project includes:

- a mobile app built with Expo and React Native
- a server built with NestJS
- shared game data and battle rules in a common package

## Project Goal

The app is a Tamagotchi-style game where players raise a pet and battle other players.

Current design goals:

- 5 elements: fire, water, grass, electric, digital
- 60 total pet templates
- 12 pets per element
- first pet is assigned randomly
- turn-based PvP battle
- premium features are convenience and cosmetics only
- premium must not increase battle win rate

## Current Status

Working prototype includes:

- first app screen
- login demo flow
- random first pet generation
- pet care actions
- battle queue request
- shared element balance table
- shared pet template data
- server API for auth, pet, care, battle, premium, replay, and content

Current mobile flow:

1. Open app
2. Tap `Login + Get First Pet`
3. Receive 1 random pet
4. Use `Feed`, `Clean`, `Play`, `Rest`
5. Enter battle queue

## Folder Structure

- `apps/mobile`
  - Expo mobile app
- `apps/server`
  - NestJS API and WebSocket server
- `packages/shared`
  - shared types, element rules, pet templates, battle logic, care logic

## Requirements

Before running the project, install:

- Node.js
- npm
- Android Studio and Android Emulator if you want to test on Android emulator

Recommended:

- Git
- GitHub Desktop

## Install

Clone the repository:

```bash
git clone https://github.com/sjs701701/PixelPet.git
cd PixelPet
```

Install packages:

```bash
npm install
```

## Run The Server

From the project root:

```bash
npm run dev:server
```

The server runs on:

```text
http://localhost:3001
```

## Run The Mobile App

Open a new terminal and move to the mobile app folder:

```bash
cd apps/mobile
npx expo start
```

If you are using Android Emulator:

1. Start the emulator first
2. In the Expo terminal, press `a`

Note:

- the mobile app is already configured to call the local server from Android Emulator using `10.0.2.2`

## Useful Commands

From the project root:

```bash
npm run dev:server
npm run build
npm test
```

## Tech Stack

- React Native
- Expo
- NestJS
- TypeScript
- Socket.IO
- Zustand
- React Query

## Gameplay Rules

### Elements

- Fire
- Water
- Grass
- Electric
- Digital

Each element has:

- 1 strong advantage target
- 1 weak-edge advantage target

Battle impact:

- strong advantage: +20%
- weak-edge advantage: +10%

Element advantage alone should not guarantee victory.
Level, items, and random battle variance also affect the result.

### Pets

- first pet is random
- pet element is fixed when created
- pet cannot change element later
- multiple users can receive the same pet template

### Premium Rules

Premium can include:

- dot skins
- battle backgrounds
- profile frames
- replay archive
- auto care assist

Premium must not affect:

- attack power
- defense power
- growth speed advantage in battle
- item power advantage
- win-rate advantage

## Notes For Next Work Session

Good next steps:

- improve battle UI
- connect real-time battle screen to WebSocket events
- add better loading and error states
- improve README screenshots and feature explanation
- replace demo login with real Google / Apple login
- persist data in a real database instead of in-memory storage

## Company PC Setup

If continuing work on another computer:

1. Clone this repository
2. Run `npm install`
3. Start the server with `npm run dev:server`
4. Start the mobile app with:

```bash
cd apps/mobile
npx expo start
```

5. Open Android Emulator
6. Press `a` in the Expo terminal

## License

This project is currently for prototype and internal development use.
