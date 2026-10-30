export const PLAY_STATUS_NAMES = ['Play', 'Pause', 'Stop']

export function getVariableDefinitions() {
	return [
		{ variableId: 'plan_number', name: 'Number of the plan on air' },
		{ variableId: 'plan_name', name: 'Name of the plan on air' },
		{ variableId: 'group_number', name: 'Number of the current plan group' },
		{ variableId: 'group_name', name: 'Name of the current plan group' },
		{ variableId: 'play_status', name: 'Play status (Play, Pause or Stop)' },
		{ variableId: 'mute', name: 'Audio muted (true/false)' },
		{ variableId: 'blackscreen', name: 'Black screen on (true/false)' },
		{ variableId: 'output', name: 'Outputs on (true/false)' },
		{ variableId: 'lock', name: 'Kommander locked (true/false)' },
		{ variableId: 'project_type', name: 'Project type (Plan or Timeline)' },
	]
}

// Empty until Kommander reports its state, so buttons don't show $NA
export function getEmptyVariableValues() {
	return Object.fromEntries(getVariableDefinitions().map((variable) => [variable.variableId, '']))
}

// Kommander sends 0-based indexes; buttons show 1-based numbers
export function indexToNumber(index) {
	return typeof index === 'number' && index >= 0 ? index + 1 : ''
}
