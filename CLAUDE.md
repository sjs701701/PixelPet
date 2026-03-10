# PixelPet Arena

Tamagotchi-style pet battle game. Monorepo with npm workspaces.


## Structure

- `apps/mobile` — Expo + React Native mobile client
- `apps/server` — NestJS API + WebSocket server (port 3001)
- `packages/shared` — shared types, game logic, pet templates

## Design Guide

### Theme

Retro pixel/dot style. Dark mode (default) and light mode supported.

- Font: Press Start 2P (pixel font, via @expo-google-fonts/press-start-2p)
- Style: minimal pixel — text-label-driven, no decorative elements, no rounded corners (border-radius: 0)
- Accent color: #FF3C3C — used ONLY when a stat drops below 30%. Never used globally.
- Section dividers: 2px solid
- Icons: custom PNG icons (32x32, white on transparent, tintColor applied) in `assets/icons/`

### Dark Mode (default)

- Background: #0A0A0A
- Text: #FFFFFF
- Secondary text: #9A9A9A / #707070
- Divider: #2A2A2A
- Bar track: #222222, bar fill: #FFFFFF
- Accent: #FF3C3C (threshold only)

### Light Mode

- Background: #F5F5F0
- Text: #0A0A0A
- Secondary text: #777777 / #999999
- Divider: #E0E0DA
- Bar track: #E0E0DA, bar fill: #0A0A0A
- Accent: #FF3C3C (threshold only)

### Theme System

- `theme/colors.ts` — ThemeColors type, getTheme(mode) function, dark/light palettes
- `theme/ThemeContext.tsx` — React context providing { mode, c (colors), toggle() }
- Theme preference persisted in AsyncStorage ("pixelpet.theme")
- Toggle button in Profile tab

### Layout (Home tab, top to bottom)

Section 1 — Pet Info
- Horizontal split (flex-row)
- Left 70%: pixel art pet on pure background, no frame, no bottom border
- Right 30%: pet metadata stacked vertically (속성, 종족, 이름, Lv. + EXP dot bar)
  - 종족 = template name (e.g. Pyron), 이름 = user-given nickname
  - Font sizes: labels 11px, values 12px, species bold 13px
  - Generous spacing between groups (metaLabel marginTop: 10, Lv. marginTop: 14)

Section 2 — Status Bars
- Five stats vertically: 배고픔 / 기분 / 청결 / 에너지 / 유대감
- Each row: [label 11px] [bar] [value 11px], gap: 18
- Bar height: 4px, no border-radius, label width: 80
- If stat < 30%: accent color (#FF3C3C) on bar fill, label, and value

Section 3 — Action Buttons
- Four buttons in 2x2 grid: 먹이 / 씻기기 / 놀기 / 쉬기
- Custom PNG icon (32x32, tintColor) above label
- Border: 2px solid divider color
- On press: icon + label brighten to text color
- 10-second cooldown per action: all buttons disabled, clockwise quadrant sweep overlay with countdown timer on the pressed button
- Disabled: opacity 0.3

Section 4 — Tab Bar
- 4 tabs: 홈 / 배틀 / 도감 / 설정
- Font size: 13px, padding: 20px vertical
- Border top: 2px solid divider

### Rules

- No border-radius anywhere
- No gradients, no shadows, no decorative fills
- No color except bg, text, gray, and accent (#FF3C3C for threshold only)
- All typography: Press Start 2P pixel font
- Pixel art pet image sits naturally on background with no frame

## Commands

```bash
npm install                # install all workspaces
npm run dev:server         # start NestJS server on :3001
npm run build              # build shared + server
npm test                   # run shared package tests (vitest)
```

Mobile app:
```bash
cd apps/mobile
npx expo start             # then press 'a' for Android emulator
```

## Tech Stack

- TypeScript (ES2022, CommonJS)
- React Native + Expo (v53)
- NestJS (server)
- Socket.IO (real-time battles)
- Zustand (mobile state)
- React Query / TanStack Query (server state)
- Vitest (testing)
- Prisma (schema exists but not active — currently in-memory store)
- Press Start 2P (pixel font via @expo-google-fonts/press-start-2p)

## Key Files

### Mobile (`apps/mobile/`)
- `App.tsx` — main app with tab navigation, auth flow, theme provider
- `lib/api.ts` — HTTP client (base URL: `10.0.2.2:3001` for emulator)
- `lib/store.ts` — Zustand session store (user, token, pet, language)
- `lib/i18n.ts` — i18n (ko/en)
- `components/PetSprite.tsx` — pixel art pet renderer with animation
- `components/PixelCard.tsx` — minimal section divider card
- `components/PixelIcon.tsx` — PNG-based icon component (tintColor, 32x32)
- `assets/icons/` — care action icon PNGs (feed, clean, play, rest)
- `theme/colors.ts` — dark/light color palettes, ThemeColors type
- `theme/ThemeContext.tsx` — React context for theme (mode, colors, toggle)

### Server (`apps/server/src/`)
- `main.ts` — bootstrap, CORS, port 3001
- `common/store.service.ts` — in-memory data store (users, pets, battles)
- `common/session.service.ts` — token generation/verification
- `auth/` — social login (Google/Apple)
- `pet/` — pet rolling, ownership
- `care/` — pet care actions
- `battle/` — matchmaking queue, turn resolution, WebSocket gateway
- `premium/` — premium features (cosmetics only)
- `replay/` — battle replay storage

### Shared (`packages/shared/src/`)
- `types.ts` — all domain types
- `elements.ts` — 5 elements, advantage table, multipliers
- `battle.ts` — turn resolution, initiative, damage calc
- `care.ts` — care state transitions, neglect decay
- `content/templates.ts` — 60 pet templates (12 per element)

## Game Rules

- 5 elements: fire, water, grass, electric, digital
- Element advantages: strong (+20%), weak-edge (+10%)
- First pet is randomly assigned
- Turn-based PvP battles
- Care stats: hunger, mood, hygiene, energy, bond
- Premium = cosmetics/convenience only, never pay-to-win

## Auth

Simple token auth: base64-encoded userId + timestamp. Bearer token in Authorization header.

## Conventions

- Shared package must be built before server (`npm run build` handles order)
- Mobile uses `10.0.2.2` to reach localhost from Android emulator
- Server uses in-memory Maps — no DB persistence yet
- All UI components use ThemeContext for dark/light mode colors
- Font sizes are smaller than typical due to Press Start 2P pixel font (9-18px range)
- All borders/strokes are 2px throughout the app
- Battle tab uses element emojis (🔥💧🌿⚡💠) in the advantage grid

#To run Android emulator
-Run run-pixelpet.bat at C:\Users\consult_04\Documents\GitHub\PixelPet\run-pixelpet.bat
