@AGENTS.md

This is **buffit-mobile** — the React Native (Expo) version of Buffit, sharing the same
Convex backend as the web app at [github.com/Bingza/buffit](https://github.com/Bingza/buffit).

## Stack
- Expo (managed workflow) + TypeScript
- Expo Router (file-based routing, like Next.js App Router)
- Convex (`convex/react`) — same deployment as the web app
- EAS Build/Submit for App Store packaging

## Convex setup
The `convex/` directory is a **copy** of the web app's `convex/` folder (schema + functions +
generated types). It is not independently deployed — both apps point at the same
`upbeat-grouse-644` (prod) / `strong-chameleon-407` (dev) Convex deployment.

When Convex backend functions change, sync the `convex/` folder from the web app and
re-run `npx convex codegen` to update `convex/_generated/`.

## Standing authorization (granted 2026-06-08 by repo owner)
Blanket authorization to `git commit`, `git push origin main`, and EAS deploys without
pausing to confirm. Does NOT extend to destructive git operations (force-push,
`reset --hard`, branch deletion, history rewrites).

## Migration plan
Full plan: `docs/convert-to-react-native-plan.en.md` (or the Thai version).
Current phase: **Phase 3 / Phase 4** (Phase 1 ✅ walking skeleton, Phase 2 ✅ auth, Phase 3 ✅ nav shell — now porting pages in Phase 4).
