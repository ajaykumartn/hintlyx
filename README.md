# Hintlyx

A fast AI copilot for meetings, lectures and interview practice. Hintlyx sits on top of your screen as a small command bar and gives you answers about your screen and conversation.

Hintlyx is a visible assistant: it appears in the taskbar and in screen shares. Use it only where AI help is allowed.

## Status

Phase 1 (app shell) is done:

- Command bar: drag handle, settings, listening switch, session timer, hide button
- Ask card: mode menu, transcript toggle, quick actions, ask bar, answer-from-screen button
- Settings: Groq and Gemini API keys, encrypted with Windows data protection
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
```

## License

MIT. See [LICENSE](LICENSE).
