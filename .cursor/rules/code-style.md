---
description: PWA and web development code style and best practices for Shangdaren
globs: **/*
alwaysApply: true
---

# PWA & Web Development Code Style Guidelines

These guidelines define the coding standards, performance patterns, and PWA practices for this codebase.

---

## 1. Core Engineering Tenets

- **Zero Build, Zero Runtime Dependencies**: Keep code runnable directly by any static HTTP file server. Never introduce bundlers (Webpack, Vite, Rollup), transpilers (Babel), or npm runtime packages.
- **Native Web Standards**: Use native ES Modules (`type="module"`), CSS Custom Properties, native Service Workers, and CSS Scroll Snap.
- **Strict Separation of Concerns**:
  - `src/js/rules.js`: Pure functional algorithms (scoring, partition search). No side effects, no state, no DOM.
  - `src/js/game.js`: Turn lifecycle orchestrator and event emitter. No DOM.
  - `src/js/main.js`: Presentation layer, reactive rendering, and DOM bindings.
  - `src/js/player.js`, `card.js`, `deck.js`: Entity data models.

---

## 2. Progressive Web App (PWA) Best Practices

### 2.1 Service Worker Lifecycle & Caching (`sw.js`)
- **Cache-First with Network Fallback**: Static assets are served from cache first for instant load and offline resilience.
- **Cache Invalidation Discipline**: Whenever assets are added, renamed, or modified:
  1. Increment `CACHE_NAME` (e.g., `'shangdaren-v1'` $\to$ `'shangdaren-v2'`).
  2. Update `ASSETS_TO_CACHE` array with the exact relative paths.
- **Activation Cleanup**: Purge old cache versions inside the `activate` event (`caches.keys()` filter and `caches.delete()`), followed by `self.clients.claim()`.
- **Immediate Takeover**: Call `self.skipWaiting()` in the `install` handler.

### 2.2 Manifest & Mobile Shell Metadata
- **Manifest Standards (`manifest.json`)**: Ensure `start_url` points to `./index.html`, `display` is `standalone`, and both 192px and 512px icons are configured with matching `theme-color` and `background_color`.
- **HTML Shell Integration**: Every HTML page must include:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#1a1a1a">
  <link rel="apple-touch-icon" href="icon-192.png">
  ```
- **Registration**: Defer registration to the `load` event with feature detection (`'serviceWorker' in navigator`) to avoid contending with initial page rendering.

---

## 3. JavaScript Standards & Conventions

### 3.1 Module Imports & Exports
- Use native ESM syntax. Always include the explicit `.js` file extension in import specifiers:
  ```js
  import { Rules } from './rules.js'; // Correct
  import { Rules } from './rules';   // Wrong - fails in native browser ESM
  ```

### 3.2 Headless Compatibility
- Domain models and rules must remain executable in headless Node.js (for CLI checks and unit testing).
- Always guard browser-only globals:
  ```js
  if (typeof document === 'undefined') return null;
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) { ... }
  ```

### 3.3 Timing & Animation Centralization
- **No Magic Timeout Numbers**: Never write `setTimeout(..., 1000)` literals in application logic.
- Import all durations from `src/js/constants.js` (`GAME_SPEEDS` for turns/melds/bots, `UI_DELAYS` for carousel/bubbles).

### 3.4 Defensive Storage Operations
- Always wrap `localStorage` access in `try / catch` to handle privacy mode and quota exceptions:
  ```js
  try {
      localStorage.setItem('key', JSON.stringify(data));
  } catch (e) {
      console.error('Storage failed:', e);
  }
  ```

---

## 4. UI & Performance Best Practices

### 4.1 Selective Rendering (DOM Fingerprinting)
- Prevent DOM thrashing during rapid state emissions by computing a lightweight fingerprint (`playerFingerprint()`):
  ```js
  const fp = playerFingerprint();
  if (fp !== lastPlayerFingerprint) {
      lastPlayerFingerprint = fp;
      renderPlayers();
  }
  ```
- Any new player-visible state must be added to `playerFingerprint()`.

### 4.2 Smooth Mobile Interactions & Scroll Snap
- Use native CSS Scroll Snap (`scroll-snap-type: x mandatory` and `scroll-snap-align: center`) for carousel components.
- Lock auto-scroll transitions with state flags (`isCarouselScrolling = true`) and debounce user swipe listeners (`UI_DELAYS.CAROUSEL_DEBOUNCE`).
- Use the modern `scrollend` event with a fallback `setTimeout` for carousel wrap-around snaps.

### 4.3 Safe DOM Construction
- Prefer `textContent` over `innerHTML` when rendering dynamic text or player names.
- When building composite nodes, use `document.createElement()` and `classList.add()`.

---

## 5. CSS & Design System Patterns

- **CSS Variables**: Manage design tokens in `:root` (colors, card dimensions, shadows, glassmorphism backgrounds).
- **Graceful Glassmorphism**: Pair `backdrop-filter: blur(...)` with a fallback semi-transparent `background`.
- **Responsive Card Layouts**:
  - Desktop (>800px): `.card-desktop-layout` (vertical top/bottom character stamps).
  - Mobile ($\le$ 800px): `.center-char` (square aspect ratio, centralized character).
  - Maintain both layout implementations when editing `.card` styles.

---

## 6. Bilingual Localization (i18n)

- **Dynamic JavaScript UI**: Every user-facing string must use `t('Key')` with corresponding entries in both `zh` and `en` in `src/js/translations.js`.
- **Static Pages (`about.html`, `how-to.html`, `versions.html`)**: Toggle visibility via `body.lang-zh` / `body.lang-en` selectors with `[lang="zh"]` and `[lang="en"]` markup.
- Persist the selected language in `localStorage.getItem('language')` and keep it synchronized across all pages.
