# sPARK — Meta Ray-Ban Display

**Production:** [s-park-xr.vercel.app](https://s-park-xr.vercel.app) (Vercel project **s-park-xr**, branch **master**).

Web app HUD for **Meta Ray-Ban Display** (additive waveguide, **600×600**).

- Pure **black** backgrounds render as **transparent** on-device (no light).
- No WebXR / Immersive AR path.
- No fake passthrough video — the glasses show the real world behind the UI.

Preview on desktop: set DevTools device size to **600×600**, or just open the page (HUD is centered). Navigate with **arrow keys + Enter** (same as Neural Band / captouch).

Stack: React + TypeScript + Vite.

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Docs

- [Build Web Apps (Meta Wearables)](https://wearables.developer.meta.com/docs/develop/webapps/build)
- [Test Web Apps](https://wearables.developer.meta.com/docs/develop/webapps/test/)
