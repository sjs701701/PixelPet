# Pixel Pet Arena

도트 스타일 다마고치 PvP 모바일 앱의 모노레포입니다.

## Workspace

- `apps/mobile`: Expo 기반 모바일 앱
- `apps/server`: NestJS 기반 API/WebSocket 서버
- `packages/shared`: 공용 도메인 타입, 5속성 밸런스, 60종 캐릭터 데이터

## Run

```bash
npm install
npm run dev:server
npm run dev:mobile
```

## Highlights

- 5속성 상성: 불, 물, 풀, 전기, 디지털
- 속성별 12종, 총 60종의 오리지널 캐릭터 템플릿
- 최초 캐릭터 서버 무작위 지급
- 실시간 1:1 턴제 배틀과 서버 권위 판정
- 무료/유료 기능 분리: 꾸미기와 편의성만 유료
