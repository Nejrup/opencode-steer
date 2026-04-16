# opencode-steer

Local nested plugin repo that adds `/steer 'message'` and immediately steers the active/main session using the same TUI-style prompt append + submit flow as the desktop app.

## What it does

- Registers the `/steer` slash command.
- Intercepts `/steer` through the plugin `command.execute.before` hook.
- Primary behavior: append the steer message to the active/main session prompt and submit it immediately through the TUI API.
- `/steer` does **not** auto-select descendant/subagent sessions; the normal path always targets the current/main session.

## Local verification

```bash
npm install
npm run typecheck
npm test
```

## Queue suppression semantics

- **Guaranteed by this plugin:** immediate TUI delivery for the active/main session and best-effort suppression of normal command expansion.
- **Best-effort only:** suppressing all normal host-side queued slash-command behavior. The plugin clears `output.parts` to reduce normal command expansion, but host runtime semantics remain authoritative.
- **Not supported here:** true mid-generation token injection into an already-running model turn.

## Entry point

- Source: [`src/index.ts`](src/index.ts)
