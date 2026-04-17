import test from "node:test"
import assert from "node:assert/strict"

import { OpencodeSteerPlugin, steerTestExports } from "../src/index.js"
import { OpencodeSteerTuiPlugin } from "../src/tui.js"

function createClientFixture() {
	const logs: Array<{ level: string; message: string }> = []

	const client = {
		app: {
			log: async ({ body }: { body: { level: string; message: string } }) => {
				logs.push(body)
				return {
					data: undefined,
					error: undefined,
					request: {} as Request,
					response: {} as Response,
				}
			},
		},
	}

	return { client, logs }
}

function createTuiFixture() {
	const triggers: string[] = []
	let registeredCommands: Array<{
		title: string
		value: string
		description?: string
		category?: string
		slash?: { name: string }
		onSelect?: () => void
	}> = []

	const api = {
		command: {
			register: (cb: () => typeof registeredCommands) => {
				registeredCommands = cb()
				return () => {}
			},
			trigger: (value: string) => {
				triggers.push(value)
			},
			show: () => {},
		},
	}

	return { api, triggers, getRegisteredCommands: () => registeredCommands }
}

test("normalizeSteerMessage trims matching outer quotes", () => {
	assert.equal(steerTestExports.normalizeSteerMessage("  'hello'  "), "hello")
	assert.equal(steerTestExports.normalizeSteerMessage('  "hello"  '), "hello")
	assert.equal(steerTestExports.normalizeSteerMessage(" keep me "), "keep me")
})

test("selectTargetSessionID always returns the current session", () => {
	assert.equal(steerTestExports.selectTargetSessionID({ currentSessionID: "root" }), "root")
})

test("server plugin does not register a command template", async () => {
	const fixture = createClientFixture()
	const hooks = await OpencodeSteerPlugin({
		client: fixture.client as never,
		directory: "/tmp/project",
	} as never)

	assert.equal(hooks.config, undefined)
	assert.equal(typeof hooks["command.execute.before"], "function")
})

test("suppressQueuedSteerCommand rewrites the queued command into the steer message", () => {
	const input = { command: "steer", sessionID: "root", arguments: "'refocus here'" }
	const output = { parts: [{ type: "text", text: "placeholder" }] }

	assert.equal(steerTestExports.suppressQueuedSteerCommand(input as never, output as never), true)
	assert.deepEqual(output.parts, [{ type: "text", text: "refocus here" }])
})

test("suppressQueuedSteerCommand ignores an empty steer message", () => {
	const input = { command: "steer", sessionID: "root", arguments: "   " }
	const output = { parts: [{ type: "text", text: "placeholder" }] }

	assert.equal(steerTestExports.suppressQueuedSteerCommand(input as never, output as never), false)
	assert.deepEqual(output.parts, [{ type: "text", text: "placeholder" }])
})

test("plugin hook rewrites the queued steer payload through the host path", async () => {
	const fixture = createClientFixture()
	const hooks = await OpencodeSteerPlugin({
		client: fixture.client as never,
		directory: "/tmp/project",
	} as never)

	const input = { command: "steer", sessionID: "root", arguments: "'refocus here'" }
	const output = { parts: [{ type: "text", text: "placeholder" }] }

	await hooks["command.execute.before"]?.(input, output as never)

	assert.deepEqual(output.parts, [{ type: "text", text: "refocus here" }])
	assert.ok(fixture.logs.some((entry) => entry.message.includes("Queued /steer for session root")))
})

test("TUI plugin registers /steer without a server template", async () => {
	const fixture = createTuiFixture()

	await OpencodeSteerTuiPlugin(fixture.api as never, undefined, { id: "opencode-steer" } as never)

	const [command] = fixture.getRegisteredCommands()
	assert.equal(command.title, "/steer")
	assert.equal(command.value, "/steer ")
	assert.equal(command.slash?.name, "steer")

	command.onSelect?.()
	assert.deepEqual(fixture.triggers, ["/steer "])
})
