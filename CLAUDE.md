# PixelPet Arena

Tamagotchi-style pet battle game. Monorepo with npm workspaces.

## Structure

- `apps/mobile` — Expo + React Native mobile client
- `apps/server` — NestJS API + WebSocket server (port 3001)
- `packages/shared` — shared types, game logic, pet templates

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

## Key Files

### Mobile (`apps/mobile/`)
- `App.tsx` — main app with tab navigation and auth flow
- `lib/api.ts` — HTTP client (base URL: `10.0.2.2:3001` for emulator)
- `lib/store.ts` — Zustand session store (user, token, pet, language)
- `lib/i18n.ts` — i18n (ko/en)
- `components/PetSprite.tsx` — pixel art pet renderer with animation
- `components/PixelCard.tsx` — reusable retro card UI
- `theme/colors.ts` — color palette

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
