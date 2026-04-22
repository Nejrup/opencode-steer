# Non working beta, do not use for other than dev 
# contributions are welcome!

---
# opencode-steer

Local nested plugin repo that adds `/steer 'message'` through the TUI and rewrites the submitted slash command into the steer message.

## What it does

- Registers the `/steer` slash command in the TUI.
- The TUI plugin registers `/steer` so it stays visible and selectable without a server-side command template.
- Intercepts `/steer` through the plugin `command.execute.before` hook.
- Primary behavior: replace the submitted slash-command payload with the steer message so OpenCode submits exactly one prompt.
- `/steer` does **not** auto-select descendant/subagent sessions; the normal path always targets the current/main session.

## Local verification

```bash
npm install
npm run typecheck
npm test
```

## Queue suppression semantics

- **Guaranteed by this plugin:** a single queued steer message for the active/main session.
- **How it works:** the TUI plugin exposes `/steer`, and the server hook rewrites `command.execute.before.output.parts` to the normalized steer text.
- **Best-effort only:** `command.execute.before` still cannot cancel the host command outright.
- **Not supported here:** true mid-generation token injection into an already-running model turn.

## Entry point

- Source: [`src/index.ts`](src/index.ts)
