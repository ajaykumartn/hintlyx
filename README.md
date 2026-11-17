# Hintlyx

A fast AI copilot for meetings, lectures and interview practice. Hintlyx sits on top of your screen as a small command bar and gives you answers about your screen and conversation.

Hintlyx is visible by default. Click the eye button (or Settings, Invisibility) to hide it from screen sharing, recordings and screenshots, and optionally from the taskbar. Invisibility needs Windows 10 version 2004 or newer.

## Status

Phase 1 (app shell) is done:

- Command bar: drag handle, settings, listening switch, session timer, hide button
- Ask card: mode menu, transcript toggle, quick actions, ask bar, answer-from-screen button
- Settings: Groq and Gemini API keys, encrypted with Windows data protection
- Invisibility: hide from screen share and taskbar (off by default, remembered between runs). The mouse pointer is also hidden from the share while it is over Hintlyx; you still see a pointer drawn inside the overlay.
- Global hotkeys and a speed log

AI answers (phase 2) and live transcription (phase 3) are not connected yet.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + \` | Show or hide Hintlyx |
| `Ctrl + Enter` | Ask AI (opens the ask bar, or submits what you typed) |
| `Ctrl + Shift + Enter` | Answer from screen |
| `Ctrl + Alt + Arrow keys` | Move Hintlyx |

## Develop

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev        # run with hot reload
npm test           # unit tests
npm run typecheck
npm run build      # production build into out/
npm start          # run the production build
npm run test:invisibility   # checks screen-capture hiding on this PC (Windows)
```

`test:invisibility` starts Hintlyx, captures the screen with four methods (GDI, DXGI duplication, Windows Graphics Capture, and browser `getDisplayMedia` as used by Meet and Teams on the web) and checks that Hintlyx is captured when visible and missing when invisible, including after hide and show. It also checks that the Windows pointer is hidden while it sits over Hintlyx in invisible mode.

## License

MIT. See [LICENSE](LICENSE).
