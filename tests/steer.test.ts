import test from "node:test"
import assert from "node:assert/strict"

import { steerTestExports } from "../src/index.js"

function createClientFixture() {
	const appendedPrompts: string[] = []
	let submitPromptCalls = 0
	const logs: Array<{ level: string; message: string }> = []

	const client = {
		tui: {
			appendPrompt: async ({ body }: { body?: { text: string } }) => {
				appendedPrompts.push(body?.text ?? "")
				return {
					data: true,
					error: undefined,
					request: {} as Request,
					response: {} as Response,
				}
			},
			submitPrompt: async () => {
				submitPromptCalls += 1
				return {
					data: true,
					error: undefined,
					request: {} as Request,
					response: {} as Response,
				}
			},
		},
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

	return { client, appendedPrompts, submitPromptCalls: () => submitPromptCalls, logs }
}

test("normalizeSteerMessage trims matching outer quotes", () => {
	assert.equal(steerTestExports.normalizeSteerMessage("  'hello'  "), "hello")
	assert.equal(steerTestExports.normalizeSteerMessage('  "hello"  '), "hello")
	assert.equal(steerTestExports.normalizeSteerMessage(" keep me "), "keep me")
})

test("selectTargetSessionID always returns the current session", () => {
	assert.equal(steerTestExports.selectTargetSessionID({ currentSessionID: "root" }), "root")
})

test("handleSteerCommand uses TUI append + submit for the current session", async () => {
	const fixture = createClientFixture()

	const result = await steerTestExports.handleSteerCommand(
		fixture.client as never,
		"/tmp/project",
		{ command: "steer", sessionID: "root", arguments: "'refocus here'" },
		async (level: "debug" | "info" | "warn" | "error", message: string) => {
			fixture.logs.push({ level, message })
		},
	)

	assert.deepEqual(fixture.appendedPrompts, ["refocus here"])
	assert.equal(fixture.submitPromptCalls(), 1)
	assert.equal(result.outcome, "steered")
	if (result.outcome === "steered") {
		assert.equal(result.targetSessionID, "root")
		assert.equal(result.delivery, "tui")
	}
	assert.ok(fixture.logs.some((entry) => entry.message.includes("Steered current session root")))
})

test("handleSteerCommand ignores an empty steer message", async () => {
	const fixture = createClientFixture()

	const result = await steerTestExports.handleSteerCommand(
		fixture.client as never,
		"/tmp/project",
		{ command: "steer", sessionID: "root", arguments: "   " },
		async (level: "debug" | "info" | "warn" | "error", message: string) => {
			fixture.logs.push({ level, message })
		},
	)

	assert.deepEqual(fixture.appendedPrompts, [])
	assert.equal(fixture.submitPromptCalls(), 0)
	assert.deepEqual(result, { outcome: "ignored", reason: "empty-message" })
})
