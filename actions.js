// Buttons store action ids and options: those of the actions from version 1.0 must not change

const COUNT = 32

export function groupLabel(planGroups, index) {
	const name = planGroups[index]?.name
	return name ? `Group ${index + 1}: ${name}` : `Group ${index + 1}`
}

const choice = (id, label) => ({ id, label })
const TOGGLE_CHOICES = (on, off) => [
	choice(on.toLowerCase(), on),
	choice(off.toLowerCase(), off),
	choice('toggle', 'Toggle'),
]

export function getActionDefinitions(self) {
	const planChoices = [choice('PreviousPlan', 'Previous plan'), choice('NextPlan', 'Next plan')]
	const groupChoices = [choice('pre', 'Previous group'), choice('next', 'Next group')]
	const timelineChoices = []
	for (let i = 1; i <= COUNT; i++) {
		planChoices.push(choice(i, `Plan ${i}`))
		groupChoices.push(choice(i, groupLabel(self.planGroups, i - 1)))
		timelineChoices.push(choice(i, `Timeline ${i}`))
	}
	const planNameChoices = [choice('PlanGroupList_PlanList', '(choose a plan)')]
	for (const group of self.planGroups) {
		for (const plan of group.data ?? [])
			planNameChoices.push(choice(`${group.name}@@${plan.name}`, `${group.name} / ${plan.name}`))
	}

	return {
		callPlan: {
			name: 'CallPlan',
			description: 'A plan of the current group, or the previous/next plan. In preview mode it goes to the preview',
			options: [{ id: 'callPlan', type: 'dropdown', label: 'Plan', choices: planChoices, default: 'PreviousPlan' }],
			callback: ({ options }) => {
				if (typeof options.callPlan === 'number') {
					self.send('IndexInvokePrePlan', { index: options.callPlan - 1, onlySetReal: true })
				} else {
					self.send('PrePlanNextOrPre', { next: options.callPlan === 'NextPlan' })
				}
			},
		},
		CallByName: {
			name: 'CallByName',
			description: 'A plan by its group and name. In preview mode it goes to the preview',
			options: [
				{
					id: 'CallByName',
					type: 'dropdown',
					label: 'Plan',
					choices: planNameChoices,
					default: 'PlanGroupList_PlanList',
				},
			],
			callback: ({ options }) => {
				if (options.CallByName === 'PlanGroupList_PlanList') return
				self.send('ChangePlanGroupCallByName', { select: options.CallByName })
			},
		},
		ChangePlanGroup: {
			name: 'ChangePlanGroup',
			description: 'Select the group whose plans the plan numbers call',
			options: [{ id: 'changePlanGroup', type: 'dropdown', label: 'Group', choices: groupChoices, default: 'next' }],
			callback: ({ options }) => {
				if (typeof options.changePlanGroup === 'number') {
					self.send('SwitchPlanPreGroup', { index: options.changePlanGroup - 1 })
				} else {
					self.send('SwitchPlanPreGroup', { type: options.changePlanGroup })
				}
			},
		},
		previewMode: {
			name: 'Preview mode (PVW)',
			description: 'In preview mode, plans are called to the preview and go on air with Take',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Preview mode',
					choices: TOGGLE_CHOICES('On', 'Off'),
					default: 'toggle',
				},
			],
			callback: ({ options }) => {
				const on = options.mode === 'toggle' ? self.realMode !== false : options.mode === 'on'
				self.send('SetPretidingMode', { realMode: !on })
			},
		},
		take: {
			name: 'Take (preview to air)',
			description: 'Put the plan in preview on air',
			options: [],
			callback: () => self.send('OutPutToEchoWindow'),
		},
		copyToPreview: {
			name: 'Copy air to preview',
			description: 'Copy what is on air to the preview, to adjust it there',
			options: [],
			callback: () => self.send('CopyOutPutToEdit'),
		},
		ChangePlayStatus: {
			name: 'ChangePlayStatus',
			options: [
				{
					id: 'changePlayStatus',
					type: 'dropdown',
					label: 'Play status',
					choices: [choice('Play', 'Play'), choice('Pause', 'Pause'), choice('Stop', 'Stop')],
					default: 'Play',
				},
			],
			callback: ({ options }) => self.send(options.changePlayStatus, { onlySetReal: true }),
		},
		CallTimeline: {
			name: 'CallTimeline',
			description: 'For timeline projects',
			options: [
				{ id: 'CallTimeline', type: 'dropdown', label: 'Timeline', choices: timelineChoices, default: 1 },
				{
					id: 'CallTimelineStatus',
					type: 'dropdown',
					label: 'Status',
					choices: [choice(1, 'Toggle'), choice(2, 'Play'), choice(3, 'Pause'), choice(4, 'Stop')],
					default: 1,
				},
			],
			callback: ({ options }) =>
				self.send('CallTimeline', { index: options.CallTimeline, status: options.CallTimelineStatus }),
		},
		SoundControl: {
			name: 'SoundControl',
			options: [
				{
					id: 'soundControl',
					type: 'dropdown',
					label: 'Sound',
					choices: [choice(0, 'Mute/Unmute'), choice(-1, 'Volume+'), choice(-2, 'Volume-')],
					default: -1,
				},
			],
			callback: ({ options }) => {
				if (options.soundControl === 0) self.send('Mute')
				else self.send('Volume', { volume: options.soundControl })
			},
		},
		SetVolumeValue: {
			name: 'SetVolumeValue',
			options: [{ id: 'SetVolumeValue', type: 'number', label: 'Volume', default: 100, min: 0, max: 100 }],
			callback: ({ options }) => self.send('Volume', { volume: options.SetVolumeValue }),
		},
		fileMute: {
			name: 'File: mute',
			description: 'Mute or unmute one file of the plan on air (or in preview), by its name, e.g. video.mp4',
			options: [
				{ id: 'file', type: 'textinput', label: 'File name', default: '', useVariables: true },
				{ id: 'mode', type: 'dropdown', label: 'Audio', choices: TOGGLE_CHOICES('Mute', 'Unmute'), default: 'toggle' },
			],
			callback: async ({ options }, context) => {
				for (const [id, file] of self.findFiles(await context.parseVariablesInString(options.file))) {
					const mute = options.mode === 'toggle' ? !file.mute : options.mode === 'mute'
					self.send('SetProgFileMute', { id, bMute: mute })
				}
			},
		},
		fileVolume: {
			name: 'File: volume',
			description: 'Volume of one file of the plan on air (or in preview), by its name, e.g. video.mp4',
			options: [
				{ id: 'file', type: 'textinput', label: 'File name', default: '', useVariables: true },
				{ id: 'volume', type: 'number', label: 'Volume', default: 100, min: 0, max: 100 },
			],
			callback: async ({ options }, context) => {
				for (const [id] of self.findFiles(await context.parseVariablesInString(options.file))) {
					self.send('SetProgFileVolume', { id, volume: options.volume })
				}
			},
		},
		ScreenOnOff: {
			name: 'Screen On/Off',
			description: 'Black screen on/off',
			options: [],
			callback: () => self.send('UpdateBlackScreen'),
		},
		OutputOnOff: {
			name: 'Output On/Off',
			options: [
				{
					id: 'outputOnOff',
					type: 'dropdown',
					label: 'Outputs',
					choices: [choice(0, 'Off'), choice(1, 'On')],
					default: 1,
				},
			],
			// version 1.0 stored its default as '1'
			callback: ({ options }) => self.send('EnableAllMonitor', { bOpen: Number(options.outputOnOff) === 1 }),
		},
		BrightContrast: {
			name: 'Bright&Contrast',
			options: [
				{
					id: 'brightContrast',
					type: 'dropdown',
					label: 'Step',
					choices: [
						choice('Brightness+', 'Brightness+'),
						choice('Brightness-', 'Brightness-'),
						choice('Contrast+', 'Contrast+'),
						choice('Contrast-', 'Contrast-'),
					],
					default: 'Brightness+',
				},
			],
			callback: ({ options }) => {
				// -101 and -102 are Kommander's step up and step down
				const step = options.brightContrast.endsWith('+') ? -101 : -102
				if (options.brightContrast.startsWith('Brightness')) self.send('SetScreenLight', { light: step })
				else self.send('SetScreenContrast', { contrast: step })
			},
		},
		SetBrightValue: {
			name: 'SetBrightValue',
			options: [{ id: 'SetBrightValue', type: 'number', label: 'Brightness', default: 0, min: -100, max: 100 }],
			callback: ({ options }) => self.send('SetScreenLight', { light: options.SetBrightValue }),
		},
		SetContrastValue: {
			name: 'SetContrastValue',
			options: [{ id: 'SetContrastValue', type: 'number', label: 'Contrast', default: 0, min: -100, max: 100 }],
			callback: ({ options }) => self.send('SetScreenContrast', { contrast: options.SetContrastValue }),
		},
		PageTurn: {
			name: 'PageTurn',
			description: 'Previous/next page of the presentations on air',
			options: [
				{
					id: 'pageTurn',
					type: 'dropdown',
					label: 'Page',
					choices: [choice('PrevPage', 'PageUP'), choice('NextPage', 'PageDown')],
					default: 'NextPage',
				},
			],
			callback: ({ options }) => self.send(options.pageTurn, { isGlobalTurnPage: true, onlySetReal: true }),
		},
		record: {
			name: 'Record output',
			description: 'Record the output to an .mp4 file, which Kommander saves (by default on the Windows desktop)',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Recording',
					choices: TOGGLE_CHOICES('Start', 'Stop'),
					default: 'toggle',
				},
			],
			callback: ({ options }) => {
				const start = options.mode === 'toggle' ? !self.recording : options.mode === 'start'
				self.send(start ? 'StartVideoRecord' : 'StopVideoRecord')
			},
		},
		Lock: {
			name: 'Lock',
			description: 'Lock or unlock the Kommander window (the output keeps going)',
			options: [],
			callback: () => self.send('SetKommanderLock'),
		},
		MasterSwitch: {
			name: 'Master Switch',
			description: 'Switch between the main and the backup Kommander (only with a backup set up in Online)',
			options: [],
			callback: () => self.send('RoleChange', { Switch: true }),
		},
	}
}
