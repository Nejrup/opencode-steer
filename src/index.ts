import type { Hooks, Plugin } from "@opencode-ai/plugin"

const STEER_COMMAND_NAME = "steer"
const STEER_COMMAND_DESCRIPTION =
	"Immediately steer the active/main session via TUI append + submit"
const STEER_COMMAND_TEMPLATE =
	"This command is handled directly by the opencode-steer plugin and should not be expanded into a normal queued instruction."

type PluginConfig = Parameters<NonNullable<Hooks["config"]>>[0]
type CommandExecuteInput = Parameters<NonNullable<Hooks["command.execute.before"]>>[0]
type PluginClient = Parameters<Plugin>[0]["client"]

export type SteerExecutionResult =
	| { outcome: "ignored"; reason: "empty-message" }
	| {
		outcome: "steered"
		targetSessionID: string
		delivery: "tui"
	  }

function registerSteerCommand(input: PluginConfig): void {
	input.command ??= {}
	input.command[STEER_COMMAND_NAME] = {
		template: STEER_COMMAND_TEMPLATE,
		description: STEER_COMMAND_DESCRIPTION,
	}
}

export function normalizeSteerMessage(value: string): string | undefined {
	const trimmedValue = value.trim()
	if (!trimmedValue) return

	const quote = trimmedValue[0]
	if ((quote === '"' || quote === "'") && trimmedValue.endsWith(quote) && trimmedValue.length >= 2) {
		return trimmedValue.slice(1, -1).trim() || undefined
	}

	return trimmedValue
}

function formatError(error: unknown): string {
	if (error instanceof Error && error.message) return error.message
	if (!error || typeof error !== "object") return String(error)

	const record = error as {
		name?: string
		data?: { message?: string; statusCode?: number }
	}
	const pieces = [record.name, record.data?.message].filter(
		(value): value is string => typeof value === "string" && Boolean(value.trim()),
	)
	if (record.data?.statusCode) {
		pieces.push(`status ${record.data.statusCode}`)
	}
	return pieces.join(": ") || JSON.stringify(error)
}

async function requestOk(request: Promise<{ error: unknown }>): Promise<void> {
	const result = await request
	if (result.error) {
		throw new Error(formatError(result.error))
	}
}

export function selectTargetSessionID(options: { currentSessionID: string }): string {
	return options.currentSessionID
}

async function sendSteerPromptToCurrentSession(
	client: PluginClient,
	directory: string,
	message: string,
): Promise<void> {
	await requestOk(
		client.tui.appendPrompt({
			query: { directory },
			body: { text: message },
		}),
	)

	await requestOk(
		client.tui.submitPrompt({
			query: { directory },
		}),
	)
}

async function handleSteerCommand(
	client: PluginClient,
	directory: string,
	input: CommandExecuteInput,
	log: (level: "debug" | "info" | "warn" | "error", message: string) => Promise<void>,
): Promise<SteerExecutionResult> {
	const message = normalizeSteerMessage(input.arguments)
	if (!message) {
		await log("warn", `Ignored /${STEER_COMMAND_NAME} without a message for session ${input.sessionID}`)
		return { outcome: "ignored", reason: "empty-message" }
	}

	const targetSessionID = selectTargetSessionID({ currentSessionID: input.sessionID })
	await sendSteerPromptToCurrentSession(client, directory, message)

	await log("info", `Steered current session ${targetSessionID} via TUI prompt append + submit`)

	return {
		outcome: "steered",
		targetSessionID,
		delivery: "tui",
	}
}

export const steerTestExports = {
	normalizeSteerMessage,
	selectTargetSessionID,
	handleSteerCommand,
}

export const OpencodeSteerPlugin: Plugin = async ({ client, directory }) => {
	const log = async (level: "debug" | "info" | "warn" | "error", message: string): Promise<void> => {
		await client.app.log({ body: { service: "opencode-steer", level, message } }).catch(() => {})
	}

	return {
		config: async (input) => {
			registerSteerCommand(input)
		},
		"command.execute.before": async (input, output) => {
			if (input.command !== STEER_COMMAND_NAME) return
			// Best-effort only: clearing parts reduces normal slash-command expansion,
			// but host-side queue semantics are ultimately controlled by OpenCode.
			output.parts = []

			try {
				await handleSteerCommand(client, directory, input, log)
			} catch (error) {
				await log(
					"error",
					`Failed to handle /${STEER_COMMAND_NAME} for session ${input.sessionID}: ${formatError(error)}`,
				)
			}
		},
	} as Hooks
}

export default {
	id: "opencode-steer",
	server: OpencodeSteerPlugin,
}
