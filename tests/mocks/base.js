// Stand-in for @companion-module/base: records what the module defines and sets
export const InstanceStatus = {
	Ok: 'ok',
	Connecting: 'connecting',
	Disconnected: 'disconnected',
	ConnectionFailure: 'connection_failure',
	BadConfig: 'bad_config',
}

export function combineRgb(r, g, b) {
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

export function runEntrypoint(instanceClass, upgradeScripts) {
	globalThis.kommander = { instanceClass, upgradeScripts }
}

export class InstanceBase {
	id = 'b5Ykz9nVH0801dn976FMY'
	labelValue = 'kommander'
	actions = {}
	feedbacks = {}
	presets = {}
	variableDefinitions = []
	variables = {}
	statuses = []
	logs = []

	get label() {
		return this.labelValue
	}
	log(level, message) {
		this.logs.push([level, message])
	}
	updateStatus(status, message = null) {
		this.statuses.push([status, message])
	}
	setActionDefinitions(definitions) {
		this.actions = definitions
	}
	setFeedbackDefinitions(definitions) {
		this.feedbacks = definitions
	}
	setPresetDefinitions(definitions) {
		this.presets = definitions
	}
	setVariableDefinitions(definitions) {
		this.variableDefinitions = definitions
	}
	setVariableValues(values) {
		Object.assign(this.variables, values)
	}
	checkFeedbacks() {}
}
