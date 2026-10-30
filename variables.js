export const PLAY_STATUS_NAMES = ['Play', 'Pause', 'Stop']

export function getVariableDefinitions() {
	return [
		{ variableId: 'plan_number', name: 'Number of the plan on air' },
		{ variableId: 'plan_name', name: 'Name of the plan on air' },
		{ variableId: 'group_number', name: 'Number of the current plan group' },
		{ variableId: 'group_name', name: 'Name of the current plan group' },
		{ variableId: 'preview_mode', name: 'Preview (PVW) mode on (true/false)' },
		{ variableId: 'preview_plan_number', name: 'Number of the plan in preview' },
		{ variableId: 'preview_plan_name', name: 'Name of the plan in preview' },
		{ variableId: 'preview_group_number', name: 'Number of the group of the plan in preview' },
		{ variableId: 'preview_group_name', name: 'Name of the group of the plan in preview' },
		{ variableId: 'play_status', name: 'Play status (Play, Pause or Stop)' },
		{ variableId: 'video_name', name: 'Video playing (the one with the most time left, if several)' },
		{ variableId: 'video_elapsed', name: 'Elapsed time of the video (mm:ss)' },
		{ variableId: 'video_remaining', name: 'Time left of the video (mm:ss)' },
		{ variableId: 'video_remaining_seconds', name: 'Time left of the video, in seconds' },
		{ variableId: 'video_duration', name: 'Duration of the video (mm:ss)' },
		{ variableId: 'volume', name: 'Volume (0-100), from its first change' },
		{ variableId: 'mute', name: 'Audio muted (true/false)' },
		{ variableId: 'brightness', name: 'Output brightness (-100 to 100)' },
		{ variableId: 'contrast', name: 'Output contrast (-100 to 100)' },
		{ variableId: 'blackscreen', name: 'Black screen on (true/false)' },
		{ variableId: 'output', name: 'Outputs on (true/false)' },
		{ variableId: 'lock', name: 'Kommander locked (true/false)' },
		{ variableId: 'recording', name: 'Recording the output (true/false)' },
		{ variableId: 'record_time', name: 'Recording time (mm:ss)' },
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

// Milliseconds as mm:ss (h:mm:ss from an hour). Time left rounds up, so it only shows 00:00 at the very end
export function formatTime(ms, roundUp = false) {
	const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
	const hours = Math.floor(total / 3600)
	const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
	const seconds = String(total % 60).padStart(2, '0')
	return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}
