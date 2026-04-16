import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

const STEER_COMMAND_NAME = "steer"
const STEER_COMMAND_DESCRIPTION =
	"Immediately steer the active/main session via TUI append + submit"
const STEER_COMMAND_VALUE = `/${STEER_COMMAND_NAME} `

export const OpencodeSteerTuiPlugin: TuiPlugin = async (api) => {
	api.command.register(() => [
		{
			title: "/steer",
			value: STEER_COMMAND_VALUE,
			description: STEER_COMMAND_DESCRIPTION,
			category: "Session",
			slash: {
				name: STEER_COMMAND_NAME,
			},
			onSelect: () => {
				api.command.trigger(STEER_COMMAND_VALUE)
			},
		},
	])
}

const opencodeSteerTuiPluginModule: TuiPluginModule = {
	tui: OpencodeSteerTuiPlugin,
}

export default opencodeSteerTuiPluginModule
