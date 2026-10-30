import { combineRgb } from '@companion-module/base'
import { groupLabel } from './actions.js'

// Buttons store feedback ids and options: those of the feedbacks from version 1.0 must not change
const LEGACY_STYLE = { bgcolor: combineRgb(0, 0, 255), color: combineRgb(0, 0, 0) }
const WHITE = combineRgb(255, 255, 255)
const PREVIEW_STYLE = { bgcolor: combineRgb(19, 154, 69), color: WHITE }
const RECORDING_STYLE = { bgcolor: combineRgb(225, 0, 30), color: WHITE }

const nameOptions = [
	{ type: 'textinput', label: 'group name', id: 'groupName', default: '' },
	{ type: 'textinput', label: 'plan name', id: 'planName', default: '' },
]
// version 1.0 gave the feedbacks without options a static text
const staticText = (id, value) => [{ type: 'static-text', label: value, id, value }]

export function getFeedbackDefinitions(self) {
	const groupChoices = []
	const planChoices = []
	for (let i = 0; i < 32; i++) {
		groupChoices.push({ id: i, label: groupLabel(self.planGroups, i) })
		planChoices.push({ id: i, label: `Plan ${i + 1}` })
	}
	const planOption = { type: 'dropdown', label: 'select', id: 'plan', choices: planChoices, default: 0 }
	const inPreview = () => self.realMode === false

	return {
		plan: {
			type: 'boolean',
			name: 'CallPlan',
			description: 'The plan with this number (in its group) is on air',
			defaultStyle: LEGACY_STYLE,
			options: [planOption],
			callback: ({ options }) => self.planIndex === options.plan,
		},
		callByName: {
			type: 'boolean',
			name: 'CallByName',
			description: 'The plan with this group and name is on air',
			defaultStyle: LEGACY_STYLE,
			options: nameOptions,
			callback: ({ options }) => self.currentName === `${options.groupName}-${options.planName}`,
		},
		previewPlan: {
			type: 'boolean',
			name: 'Plan in preview',
			description: 'In preview mode, the plan with this number (in its group) is in the preview',
			defaultStyle: PREVIEW_STYLE,
			options: [planOption],
			callback: ({ options }) => inPreview() && self.previewIndex === options.plan,
		},
		previewByName: {
			type: 'boolean',
			name: 'Plan in preview (by name)',
			description: 'In preview mode, the plan with this group and name is in the preview',
			defaultStyle: PREVIEW_STYLE,
			options: nameOptions,
			callback: ({ options }) => inPreview() && self.previewName === `${options.groupName}-${options.planName}`,
		},
		previewMode: {
			type: 'boolean',
			name: 'Preview mode',
			description: 'Kommander is in preview (PVW) mode',
			defaultStyle: PREVIEW_STYLE,
			options: [],
			callback: inPreview,
		},
		preGroup: {
			type: 'boolean',
			name: 'PreGroup',
			description: 'The group with this number is the current group',
			defaultStyle: LEGACY_STYLE,
			options: [{ type: 'dropdown', label: 'select', id: 'preGroup', choices: groupChoices, default: 0 }],
			callback: ({ options }) => self.groupIndex === options.preGroup,
		},
		playStatus: {
			type: 'boolean',
			name: 'PlayStatus',
			description: 'Kommander is playing, paused or stopped (plan projects)',
			defaultStyle: LEGACY_STYLE,
			options: [
				{
					type: 'dropdown',
					label: 'select',
					id: 'playStatus',
					choices: [
						{ id: 0, label: 'play' },
						{ id: 1, label: 'pause' },
						{ id: 2, label: 'stop' },
					],
					default: 0,
				},
			],
			callback: ({ options }) => self.playStatus === options.playStatus && self.isNotTimeLine,
		},
		unmute: {
			type: 'boolean',
			name: 'Muted',
			description: 'The audio is muted',
			defaultStyle: LEGACY_STYLE,
			options: staticText('unmute', 'unmute'),
			callback: () => Boolean(self.isMute),
		},
		blackscreen: {
			type: 'boolean',
			name: 'BlackScreen',
			description: 'The black screen is on',
			defaultStyle: LEGACY_STYLE,
			options: staticText('blackscreen', 'blackscreen'),
			callback: () => Boolean(self.isBlackScreen),
		},
		monitorStatus: {
			type: 'boolean',
			name: 'MonitorStatus',
			description: 'The outputs are on',
			defaultStyle: LEGACY_STYLE,
			options: staticText('monitorStatus', 'output On'),
			callback: () => self.monitorStatus === 1,
		},
		lock: {
			type: 'boolean',
			name: 'Lock',
			description: 'Kommander is locked',
			defaultStyle: LEGACY_STYLE,
			options: staticText('lock', 'lock'),
			callback: () => Boolean(self.isLock),
		},
		recording: {
			type: 'boolean',
			name: 'Recording',
			description: 'The output is being recorded (started from Companion)',
			defaultStyle: RECORDING_STYLE,
			options: [],
			callback: () => self.recording,
		},
	}
}
