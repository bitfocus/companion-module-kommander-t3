import { combineRgb } from '@companion-module/base'

const WHITE = combineRgb(255, 255, 255)
const CARD = combineRgb(35, 38, 45)
const RED = combineRgb(225, 0, 30)
const BLUE = combineRgb(47, 140, 255)
const GREEN = combineRgb(19, 154, 69)
const AMBER = combineRgb(240, 160, 0)

// Biggest size that keeps every word on one line: 'auto' splits words ("GRO/UP") to fit a bigger font
function textSize(text) {
	if (text.includes('$(')) return '14'
	const longestWord = Math.max(...text.split(/\s+/).map((word) => word.length))
	return longestWord <= 5 ? '18' : longestWord <= 7 ? '14' : 'auto'
}

function button(category, name, text, actions, feedbacks = [], bgcolor = CARD) {
	return {
		type: 'button',
		category,
		name,
		style: { text, size: textSize(text), color: WHITE, bgcolor },
		steps: [{ down: actions, up: [] }],
		feedbacks,
	}
}

function action(actionId, options = {}) {
	return { actionId, options }
}

function feedback(feedbackId, options, bgcolor) {
	return { feedbackId, options, style: { bgcolor, color: WHITE } }
}

export function getPresetDefinitions(label, planGroups) {
	const presets = {}

	// Plan buttons are green while in preview and red while on air, like a switcher's tally
	for (let n = 1; n <= 32; n++) {
		presets[`plan_${n}`] = button(
			'Plans',
			`Plan ${n}`,
			`PLAN ${n}`,
			[action('callPlan', { callPlan: n })],
			[feedback('previewPlan', { plan: n - 1 }, GREEN), feedback('plan', { plan: n - 1 }, RED)],
		)
		presets[`group_${n}`] = button(
			'Groups',
			`Group ${n}`,
			`GROUP ${n}`,
			[action('ChangePlanGroup', { changePlanGroup: n })],
			[feedback('preGroup', { preGroup: n - 1 }, BLUE)],
		)
	}

	presets.plan_previous = button('Navigation', 'Previous plan', '< PLAN', [
		action('callPlan', { callPlan: 'PreviousPlan' }),
	])
	presets.plan_next = button('Navigation', 'Next plan', 'PLAN >', [action('callPlan', { callPlan: 'NextPlan' })])
	presets.group_previous = button('Navigation', 'Previous group', '< GROUP', [
		action('ChangePlanGroup', { changePlanGroup: 'pre' }),
	])
	presets.group_next = button('Navigation', 'Next group', 'GROUP >', [
		action('ChangePlanGroup', { changePlanGroup: 'next' }),
	])

	presets.play = button(
		'Playback',
		'Play',
		'PLAY',
		[action('ChangePlayStatus', { changePlayStatus: 'Play' })],
		[feedback('playStatus', { playStatus: 0 }, GREEN)],
	)
	presets.pause = button(
		'Playback',
		'Pause',
		'PAUSE',
		[action('ChangePlayStatus', { changePlayStatus: 'Pause' })],
		[feedback('playStatus', { playStatus: 1 }, AMBER)],
	)
	presets.stop = button(
		'Playback',
		'Stop',
		'STOP',
		[action('ChangePlayStatus', { changePlayStatus: 'Stop' })],
		[feedback('playStatus', { playStatus: 2 }, RED)],
	)

	presets.blackscreen = button(
		'Screen',
		'Black screen on/off',
		'BLACK',
		[action('ScreenOnOff')],
		[feedback('blackscreen', {}, RED)],
	)
	presets.output_on = button(
		'Screen',
		'Outputs on',
		'OUTPUT\nON',
		[action('OutputOnOff', { outputOnOff: 1 })],
		[feedback('monitorStatus', {}, GREEN)],
	)
	// Red while the outputs are off: the "outputs on" feedback turns it back to the normal colour
	presets.output_off = button(
		'Screen',
		'Outputs off',
		'OUTPUT\nOFF',
		[action('OutputOnOff', { outputOnOff: 0 })],
		[feedback('monitorStatus', {}, CARD)],
		RED,
	)
	presets.brightness_up = button('Screen', 'Brightness +', 'BRIGHT\n+', [
		action('BrightContrast', { brightContrast: 'Brightness+' }),
	])
	presets.brightness_down = button('Screen', 'Brightness -', 'BRIGHT\n-', [
		action('BrightContrast', { brightContrast: 'Brightness-' }),
	])
	presets.brightness_reset = button('Screen', 'Brightness 0', 'BRIGHT\n0', [
		action('SetBrightValue', { SetBrightValue: 0 }),
	])
	presets.contrast_up = button('Screen', 'Contrast +', 'CONTR\n+', [
		action('BrightContrast', { brightContrast: 'Contrast+' }),
	])
	presets.contrast_down = button('Screen', 'Contrast -', 'CONTR\n-', [
		action('BrightContrast', { brightContrast: 'Contrast-' }),
	])
	presets.contrast_reset = button('Screen', 'Contrast 0', 'CONTR\n0', [
		action('SetContrastValue', { SetContrastValue: 0 }),
	])

	presets.mute = button(
		'Audio',
		'Mute/unmute',
		'MUTE',
		[action('SoundControl', { soundControl: 0 })],
		[feedback('unmute', {}, RED)],
	)
	presets.volume_up = button('Audio', 'Volume +', 'VOL +', [action('SoundControl', { soundControl: -1 })])
	presets.volume_down = button('Audio', 'Volume -', 'VOL -', [action('SoundControl', { soundControl: -2 })])

	presets.lock = button('System', 'Lock/unlock', 'LOCK', [action('Lock')], [feedback('lock', {}, AMBER)])
	presets.master_switch = button('System', 'Master switch', 'MASTER\nSWITCH', [action('MasterSwitch')])

	presets.page_up = button('Presentation', 'Page up', 'PAGE\nUP', [action('PageTurn', { pageTurn: 'PrevPage' })])
	presets.page_down = button('Presentation', 'Page down', 'PAGE\nDOWN', [action('PageTurn', { pageTurn: 'NextPage' })])

	presets.preview_mode = button(
		'Preview (PVW)',
		'Preview mode on/off',
		'PVW\nMODE',
		[action('previewMode', { mode: 'toggle' })],
		[feedback('previewMode', {}, GREEN)],
	)
	presets.take = button('Preview (PVW)', 'Take: preview to air', 'TAKE', [action('take')], [], RED)
	presets.copy_to_preview = button('Preview (PVW)', 'Copy air to preview', 'PGM\n> PVW', [action('copyToPreview')])
	presets.status_preview = button('Preview (PVW)', 'Plan in preview', `PVW\n$(${label}:preview_plan_name)`, [])

	presets.record = button(
		'Recording',
		'Record on/off',
		`REC\n$(${label}:record_time)`,
		[action('record', { mode: 'toggle' })],
		[feedback('recording', {}, RED)],
	)

	presets.status_plan = button('Status', 'Plan on air', `ON AIR\n$(${label}:plan_name)`, [])
	presets.status_group = button('Status', 'Current group', `GROUP\n$(${label}:group_name)`, [])
	presets.status_play = button('Status', 'Play status', `$(${label}:play_status)`, [])
	presets.status_video = button('Status', 'Video time left', `VIDEO\n$(${label}:video_remaining)`, [])
	presets.status_volume = button('Status', 'Volume', `VOL\n$(${label}:volume)`, [])

	for (let n = 1; n <= 32; n++) {
		presets[`timeline_${n}`] = button('Timeline', `Timeline ${n} play/pause`, `TL ${n}`, [
			action('CallTimeline', { CallTimeline: n, CallTimelineStatus: 1 }),
		])
	}

	// One button per group and plan of the open project, once the media library has been loaded
	planGroups.forEach((group, g) => {
		presets[`group_named_${g}`] = button(
			'Groups by name',
			group.name,
			group.name,
			[action('ChangePlanGroup', { changePlanGroup: g + 1 })],
			[feedback('preGroup', { preGroup: g }, BLUE)],
		)
		;(group.data ?? []).forEach((plan, p) => {
			presets[`plan_named_${g}_${p}`] = button(
				`Plans: ${group.name}`,
				plan.name,
				plan.name,
				[action('CallByName', { CallByName: `${group.name}@@${plan.name}` })],
				[
					feedback('previewByName', { groupName: group.name, planName: plan.name }, GREEN),
					feedback('callByName', { groupName: group.name, planName: plan.name }, RED),
				],
			)
		})
	})

	return presets
}
