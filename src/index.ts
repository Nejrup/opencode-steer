import type { Hooks, Plugin } from "@opencode-ai/plugin"

const STEER_COMMAND_NAME = "steer"
type CommandExecuteInput = Parameters<NonNullable<Hooks["command.execute.before"]>>[0]
type CommandExecuteOutput = Parameters<NonNullable<Hooks["command.execute.before"]>>[1]

export function normalizeSteerMessage(value: string): string | undefined {
	const trimmedValue = value.trim()
	if (!trimmedValue) return

	const quote = trimmedValue[0]
	if ((quote === '"' || quote === "'") && trimmedValue.endsWith(quote) && trimmedValue.length >= 2) {
		return trimmedValue.slice(1, -1).trim() || undefined
	}

	return trimmedValue
}

export function selectTargetSessionID(options: { currentSessionID: string }): string {
	return options.currentSessionID
}

export function suppressQueuedSteerCommand(input: CommandExecuteInput, output: CommandExecuteOutput): boolean {
	const message = normalizeSteerMessage(input.arguments)
	if (!message) {
		return false
	}

	output.parts = [{ type: "text", text: message } as CommandExecuteOutput["parts"][number]]
	return true
}

export const steerTestExports = {
	normalizeSteerMessage,
	selectTargetSessionID,
	suppressQueuedSteerCommand,
}

export const OpencodeSteerPlugin: Plugin = async ({ client }) => {
	const log = async (level: "debug" | "info" | "warn" | "error", message: string): Promise<void> => {
		await client.app.log({ body: { service: "opencode-steer", level, message } }).catch(() => {})
	}

	return {
		"command.execute.before": async (input, output) => {
			if (input.command !== STEER_COMMAND_NAME) return

			const targetSessionID = selectTargetSessionID({ currentSessionID: input.sessionID })
			if (!suppressQueuedSteerCommand(input, output)) {
				await log("warn", `Ignored /${STEER_COMMAND_NAME} without a message for session ${targetSessionID}`)
				return
			}

			await log(
				"info",
				`Queued /${STEER_COMMAND_NAME} for session ${targetSessionID} via host command rewrite`,
			)
		},
	} as Hooks
}

export default {
	id: "opencode-steer",
	server: OpencodeSteerPlugin,
}
