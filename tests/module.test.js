// Runs the module against a fake Kommander. The messages are the ones Kommander 360 8.2 sends and accepts
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { describe, it } from 'node:test'

register('./hooks.js', import.meta.url)
await import('../main.js')
const { default: FakeWebSocket } = await import('./mocks/ws.js')
const { instanceClass, upgradeScripts } = globalThis.kommander

const CONFIG = { url: 'ws://127.0.0.1:1702', reconnect: false }
const MEDIA_LIBS = [
	{ MediaGroup: 'Local', MediaGrouptype: 2048, data: [{ name: 'clip.mp4', type: 1 }] },
	{
		MediaGroup: 'Play plan',
		MediaGrouptype: 8,
		data: [
			{
				name: 'Abertura',
				isGroup: true,
				data: [
					{ id: '{vinheta}', name: 'Vinheta' },
					{ id: '{palco}', name: 'Palco' },
				],
			},
			{ name: 'Show', isGroup: true, data: [{ id: '{musica}', name: 'Música 1' }] },
		],
	},
]
const VERSION_1_ACTIONS = [
	'callPlan',
	'ChangePlanGroup',
	'ChangePlayStatus',
	'SoundControl',
	'PageTurn',
	'ScreenOnOff',
	'BrightContrast',
	'OutputOnOff',
	'MasterSwitch',
	'Lock',
	'SetVolumeValue',
	'CallByName',
	'SetBrightValue',
	'SetContrastValue',
	'CallTimeline',
]
const VERSION_1_FEEDBACKS = [
	'callByName',
	'plan',
	'playStatus',
	'unmute',
	'blackscreen',
	'monitorStatus',
	'lock',
	'preGroup',
]

async function start(config = CONFIG) {
	const instance = new instanceClass()
	await instance.init(config)
	return { instance, ws: FakeWebSocket.latest }
}

// An instance past the login and the media library
async function connect(config) {
	const { instance, ws } = await start(config)
	ws.open()
	ws.receive('Authentication', { isNotTimeLine: true })
	ws.receive('GetMediaLibs', undefined, { MediaLibs: MEDIA_LIBS })
	return { instance, ws }
}

const press = (instance, actionId, options = {}) =>
	instance.actions[actionId].callback({ options }, { parseVariablesInString: async (text) => text })
const isOn = (instance, feedbackId, options = {}) => instance.feedbacks[feedbackId].callback({ options })

// Every preset must use existing actions and feedbacks, with options and values they accept, and only
// variables of this connection
function presetProblems(instance) {
	const problems = []
	const variableIds = new Set(instance.variableDefinitions.map((variable) => variable.variableId))
	const checkOptions = (where, definition, options) => {
		for (const [key, value] of Object.entries(options)) {
			const option = definition.options.find((o) => o.id === key)
			if (!option) problems.push(`${where}: no option ${key}`)
			else if (option.type === 'dropdown' && !option.choices.some((c) => c.id === value))
				problems.push(`${where}: ${key}=${JSON.stringify(value)} is not a choice`)
		}
	}
	for (const [id, preset] of Object.entries(instance.presets)) {
		if (!['auto', '14', '18'].includes(preset.style.size)) problems.push(`${id}: size ${preset.style.size}`)
		for (const action of preset.steps.flatMap((step) => step.down)) {
			const definition = instance.actions[action.actionId]
			if (definition) checkOptions(`${id} ${action.actionId}`, definition, action.options)
			else problems.push(`${id}: no action ${action.actionId}`)
		}
		for (const feedback of preset.feedbacks) {
			const definition = instance.feedbacks[feedback.feedbackId]
			if (definition) checkOptions(`${id} ${feedback.feedbackId}`, definition, feedback.options)
			else problems.push(`${id}: no feedback ${feedback.feedbackId}`)
		}
		for (const [, label, variable] of preset.style.text.matchAll(/\$\(([^:)]+):([^)]+)\)/g)) {
			if (label !== instance.label) problems.push(`${id}: label ${label}`)
			if (!variableIds.has(variable)) problems.push(`${id}: no variable ${variable}`)
		}
	}
	return problems
}

describe('before Kommander answers', () => {
	it('defines the actions and feedbacks of version 1.0 and the new ones', async () => {
		const { instance } = await start()
		for (const id of VERSION_1_ACTIONS) assert.ok(instance.actions[id], id)
		for (const id of VERSION_1_FEEDBACKS) assert.ok(instance.feedbacks[id], id)
		for (const id of ['previewMode', 'take', 'copyToPreview', 'fileMute', 'fileVolume', 'record']) {
			assert.ok(instance.actions[id], id)
		}
		for (const id of ['previewMode', 'previewPlan', 'previewByName', 'recording']) assert.ok(instance.feedbacks[id], id)
	})

	it('starts with empty variables, not $NA', async () => {
		const { instance } = await start()
		assert.equal(instance.variableDefinitions.length, 25)
		for (const { variableId } of instance.variableDefinitions)
			assert.equal(instance.variables[variableId], '', variableId)
	})

	it('has valid presets whose words fit on the buttons', async () => {
		const { instance } = await start()
		assert.deepEqual(presetProblems(instance), [])
		const size = (id) => instance.presets[id].style.size
		assert.deepEqual(['group_1', 'pause', 'output_on', 'contrast_up', 'status_plan'].map(size), [
			'18',
			'18',
			'14',
			'18',
			'14',
		])
	})

	it('sends nothing without a connection', async () => {
		const { instance, ws } = await start()
		await press(instance, 'take')
		assert.deepEqual(ws.sent, [])
		assert.ok(instance.logs.some(([level, message]) => level === 'warn' && message.includes('OutPutToEchoWindow')))
	})

	it('reports a bad URL', async () => {
		const { instance } = await start({ url: 'http://kommander', reconnect: false })
		assert.equal(instance.statuses.at(-1)[0], 'bad_config')
	})
})

describe('login', () => {
	it("logs in like Kommander's Stream Deck access, with a device id of its own", async () => {
		const { instance, ws } = await start()
		assert.deepEqual(ws.options, { origin: 'streamDeck' })
		ws.open()
		const login = ws.sent[0]
		assert.equal(login.KommanderMsg, 'KommanderMsg_Authentication')
		assert.equal(login.identificationID, '10')
		assert.equal(login.params.username, 'streamDeck')
		assert.equal(login.params.password, 'streamDeck')
		assert.match(login.params.deviceId, /^\d{6}$/)
		assert.equal(login.params.connetType, 5)
		assert.equal(instance.statuses.at(-1)[0], 'connecting', 'connecting until Kommander accepts the login')
		ws.receive('Authentication', { isNotTimeLine: true })
		assert.equal(instance.statuses.at(-1)[0], 'ok')
		assert.equal(instance.variables.project_type, 'Plan')
		assert.equal(ws.sentNames().at(-1), 'GetMediaLibs')
	})

	it('uses the login of the settings', async () => {
		const { ws } = await start({ ...CONFIG, username: 'operador', password: 'segredo' })
		ws.open()
		assert.equal(ws.sent[0].params.username, 'operador')
		assert.equal(ws.sent[0].params.password, 'segredo')
	})

	it('shows why Kommander refused the login', async () => {
		const { instance, ws } = await start()
		ws.open()
		ws.receive('Authentication', { error: 4, msg: 'Maximum connection number' }, { code: 0 })
		ws.emit('close', 1000)
		assert.deepEqual(instance.statuses.at(-1), [
			'connection_failure',
			'Kommander refused the login: Maximum connection number',
		])
	})

	it('asks for the current state once, after the media library', async () => {
		const { ws } = await connect()
		assert.deepEqual(ws.sentNames().slice(2), [
			'GetGlobalState',
			'GetAllMonitor',
			'GetBlackScreen',
			'GetKommanderLock',
			'GetPretidingMode',
			'GetScreenContrastLight',
			'GetPrePlanUsingMark',
		])
		ws.receive('GetMediaLibs', undefined, { MediaLibs: MEDIA_LIBS })
		assert.equal(ws.sentNames().filter((name) => name === 'GetGlobalState').length, 1)
	})
})

describe('plans', () => {
	it('lists the plans of the open project in presets and menus', async () => {
		const { instance } = await connect()
		const named = instance.presets.plan_named_0_1
		assert.equal(named.category, 'Plans: Abertura')
		assert.equal(named.style.text, 'Palco')
		assert.deepEqual(named.steps[0].down, [{ actionId: 'CallByName', options: { CallByName: 'Abertura@@Palco' } }])
		assert.equal(instance.presets.group_named_1.style.text, 'Show')
		const planNames = instance.actions.CallByName.options[0].choices
		assert.ok(planNames.some((c) => c.id === 'Show@@Música 1' && c.label === 'Show / Música 1'))
		assert.equal(instance.actions.ChangePlanGroup.options[0].choices.find((c) => c.id === 1).label, 'Group 1: Abertura')
		assert.equal(instance.feedbacks.preGroup.options[0].choices[1].label, 'Group 2: Show')
		assert.deepEqual(presetProblems(instance), [])
	})

	it('finds the plans on air and in preview from the ids of the reply to GetPrePlanUsingMark', async () => {
		const { instance, ws } = await connect()
		ws.receive('GetPretidingMode', { realMode: false })
		ws.receive('UpdatePrePlanUsingMark', { editingPrePlanId: '{musica}', outPutingPrePlanId: '{palco}' })
		const v = instance.variables
		assert.deepEqual([v.plan_number, v.plan_name, v.group_number, v.group_name], [2, 'Palco', 1, 'Abertura'])
		assert.deepEqual(
			[v.preview_plan_number, v.preview_plan_name, v.preview_group_number, v.preview_group_name],
			[1, 'Música 1', 2, 'Show'],
		)
		assert.equal(isOn(instance, 'plan', { plan: 1 }), true)
		assert.equal(isOn(instance, 'callByName', { groupName: 'Abertura', planName: 'Palco' }), true)
		assert.equal(isOn(instance, 'previewPlan', { plan: 0 }), true)
		assert.equal(isOn(instance, 'previewByName', { groupName: 'Show', planName: 'Música 1' }), true)
	})

	it("takes positions and names from Kommander's notice", async () => {
		const { instance, ws } = await connect()
		ws.receive('UpdatePrePlanUsingMark', {
			EditGroupName: 'Show',
			editingId: 0,
			editingPrePlanName: 'Música 1',
			nEditGroupId: 1,
			nOutGroupId: 0,
			outGroupName: 'Abertura',
			outPutingId: 0,
			outPutingPrePlanName: 'Vinheta',
		})
		assert.equal(instance.variables.plan_name, 'Vinheta')
		assert.equal(instance.variables.preview_plan_name, 'Música 1')
	})

	it('shows the preview tally only in preview mode', async () => {
		const { instance, ws } = await connect()
		ws.receive('UpdatePrePlanUsingMark', { editingPrePlanId: '{musica}', outPutingPrePlanId: '{palco}' })
		ws.receive('GetPretidingMode', { realMode: true })
		assert.equal(isOn(instance, 'previewPlan', { plan: 0 }), false)
		assert.equal(isOn(instance, 'previewMode'), false)
		assert.equal(instance.variables.preview_mode, false)
		ws.receive('SetPretidingMode', { realMode: false })
		assert.equal(isOn(instance, 'previewPlan', { plan: 0 }), true)
		assert.equal(isOn(instance, 'previewMode'), true)
		assert.equal(instance.variables.preview_mode, true)
	})

	it('keeps the group when the plan on air is not in the media library', async () => {
		const { instance, ws } = await connect()
		ws.receive('UpdatePrePlanUsingMark', { editingPrePlanId: '{palco}', outPutingPrePlanId: '{palco}' })
		ws.receive('UpdatePrePlanUsingMark', { editingPrePlanId: '{other}', outPutingPrePlanId: '{other}' })
		assert.equal(instance.variables.plan_number, '')
		assert.equal(instance.variables.plan_name, '')
		assert.equal(instance.variables.group_name, 'Abertura')
	})

	it('reloads the plans when Kommander says they changed, rebuilding the lists only if they did', async (t) => {
		t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
		const { instance, ws } = await connect()
		const actions = instance.actions
		ws.receive('MediaLibsChanged')
		ws.receive('MediaLibsChanged')
		t.mock.timers.tick(300)
		assert.deepEqual(ws.sentNames().slice(-2), ['GetMediaLibs', 'GetPrePlanUsingMark'])
		assert.equal(ws.sentNames().filter((name) => name === 'GetMediaLibs').length, 2, 'one reload for both notices')
		ws.receive('GetMediaLibs', undefined, { MediaLibs: MEDIA_LIBS })
		assert.equal(instance.actions, actions, 'same plans: same lists')
		const edited = structuredClone(MEDIA_LIBS)
		edited[1].data[1].data.push({ id: '{bis}', name: 'Bis' })
		ws.receive('GetMediaLibs', undefined, { MediaLibs: edited })
		assert.notEqual(instance.actions, actions)
		assert.equal(instance.presets.plan_named_1_1.style.text, 'Bis')
		await instance.destroy()
	})

	it('copes with a media library without plans (timeline projects)', async () => {
		const { instance, ws } = await start()
		ws.open()
		ws.receive('Authentication', { isNotTimeLine: false })
		ws.receive('GetMediaLibs', undefined, { MediaLibs: [{ MediaGroup: 'Local', MediaGrouptype: 2048, data: [] }] })
		assert.equal(instance.variables.project_type, 'Timeline')
		assert.ok(!Object.keys(instance.presets).some((id) => id.startsWith('plan_named')))
		assert.deepEqual(presetProblems(instance), [])
	})
})

describe('state', () => {
	it('follows the play status, audio, black screen, outputs, lock and group', async () => {
		const { instance, ws } = await connect()
		const v = instance.variables
		ws.receive('GetGlobalState', { state: 1 }, { code: 0 })
		assert.equal(v.play_status, 'Pause')
		assert.equal(isOn(instance, 'playStatus', { playStatus: 1 }), true)
		ws.receive('Mute', { mute: true })
		assert.equal(v.mute, true)
		assert.equal(isOn(instance, 'unmute'), true)
		ws.receive('GetBlackScreen', { blackscreen: true, blackscreenSwitching: false })
		assert.equal(v.blackscreen, true)
		ws.receive('UpdateBlackScreen', { blackscreen: false })
		assert.equal(isOn(instance, 'blackscreen'), false)
		ws.receive('GetAllMonitor', { state: 3 }, { code: 0 })
		assert.equal(v.output, false)
		assert.equal(isOn(instance, 'monitorStatus'), false)
		ws.receive('GetAllMonitor', { state: 1 })
		assert.equal(v.output, true)
		ws.receive('GetKommanderLock', { lock: true })
		assert.equal(isOn(instance, 'lock'), true)
		ws.receive('UpdateLockKommander', { lock: false })
		assert.equal(v.lock, false)
		ws.receive('SwitchPlanPreGroup', { index: 1 })
		assert.deepEqual([v.group_number, v.group_name], [2, 'Show'])
		assert.equal(isOn(instance, 'preGroup', { preGroup: 1 }), true)
	})

	it('shows volume, brightness and contrast', async () => {
		const { instance, ws } = await connect()
		ws.receive('Volume', { volume: 20 })
		ws.receive('GetScreenContrastLight', { contrast: 10, light: -5 })
		const v = instance.variables
		assert.deepEqual([v.volume, v.brightness, v.contrast], [20, -5, 10])
	})

	it('counts down the video that plays, asking for its position every second', async (t) => {
		t.mock.timers.enable({ apis: ['setInterval'] })
		const { instance, ws } = await connect()
		const v = instance.variables
		ws.receive('UpdateProgFilePlayState', { id: '{v}', curPos: 0, duration: 69751, state: 1 })
		ws.receive('UpdateProgFileList', [
			{ id: '{v}', name: 'clip.mp4', bMute: false, media: { type: 1 } },
			{ id: '{p}', name: 'logo.png', bMute: false, media: { type: 4 } },
		])
		ws.receive('UpdateProgFilePlayState', { id: '{p}', curPos: 0, duration: 60000, state: 1 })
		assert.deepEqual(
			[v.video_name, v.video_elapsed, v.video_remaining, v.video_remaining_seconds, v.video_duration],
			['clip.mp4', '00:00', '01:10', 70, '01:10'],
		)
		t.mock.timers.tick(1000)
		assert.deepEqual(ws.last('GetProgFilePlayState').params, { id: '{v}' })
		ws.receive('GetProgFilePlayState', { curPos: '19366', duration: '69751', state: 1 })
		assert.deepEqual([v.video_elapsed, v.video_remaining], ['00:19', '00:51'])
		ws.receive('UpdateProgFilePlayState', { id: '{v}', curPos: 20000, duration: 69751, state: 0 })
		const sent = ws.sent.length
		t.mock.timers.tick(3000)
		assert.equal(ws.sent.length, sent, 'paused: no more questions')
		assert.equal(v.video_remaining, '00:50')
		ws.receive('DeleteProgFile', { id: '{v}' })
		assert.equal(v.video_name, '')
		await instance.destroy()
	})
})

describe('actions', () => {
	it('send what Kommander expects', async () => {
		const { instance, ws } = await connect()
		const sent = async (actionId, options) => {
			await press(instance, actionId, options)
			return ws.sent.at(-1)
		}
		const msg = (name, params) =>
			params === undefined ? { KommanderMsg: `KommanderMsg_${name}` } : { KommanderMsg: `KommanderMsg_${name}`, params }
		assert.deepEqual(
			await sent('callPlan', { callPlan: 3 }),
			msg('IndexInvokePrePlan', { index: 2, onlySetReal: true }),
		)
		assert.deepEqual(await sent('callPlan', { callPlan: 'PreviousPlan' }), msg('PrePlanNextOrPre', { next: false }))
		assert.deepEqual(await sent('ChangePlanGroup', { changePlanGroup: 4 }), msg('SwitchPlanPreGroup', { index: 3 }))
		assert.deepEqual(
			await sent('ChangePlanGroup', { changePlanGroup: 'next' }),
			msg('SwitchPlanPreGroup', { type: 'next' }),
		)
		assert.deepEqual(
			await sent('CallByName', { CallByName: 'Show@@Música 1' }),
			msg('ChangePlanGroupCallByName', { select: 'Show@@Música 1' }),
		)
		assert.deepEqual(await sent('ChangePlayStatus', { changePlayStatus: 'Pause' }), msg('Pause', { onlySetReal: true }))
		assert.deepEqual(await sent('SoundControl', { soundControl: 0 }), msg('Mute'))
		assert.deepEqual(await sent('SoundControl', { soundControl: -1 }), msg('Volume', { volume: -1 }))
		assert.deepEqual(await sent('SetVolumeValue', { SetVolumeValue: 40 }), msg('Volume', { volume: 40 }))
		assert.deepEqual(await sent('OutputOnOff', { outputOnOff: 0 }), msg('EnableAllMonitor', { bOpen: false }))
		assert.deepEqual(await sent('OutputOnOff', { outputOnOff: '1' }), msg('EnableAllMonitor', { bOpen: true }))
		assert.deepEqual(
			await sent('BrightContrast', { brightContrast: 'Contrast+' }),
			msg('SetScreenContrast', { contrast: -101 }),
		)
		assert.deepEqual(
			await sent('BrightContrast', { brightContrast: 'Brightness-' }),
			msg('SetScreenLight', { light: -102 }),
		)
		assert.deepEqual(await sent('SetBrightValue', { SetBrightValue: 0 }), msg('SetScreenLight', { light: 0 }))
		assert.deepEqual(await sent('SetContrastValue', { SetContrastValue: 5 }), msg('SetScreenContrast', { contrast: 5 }))
		assert.deepEqual(
			await sent('PageTurn', { pageTurn: 'NextPage' }),
			msg('NextPage', { isGlobalTurnPage: true, onlySetReal: true }),
		)
		assert.deepEqual(await sent('ScreenOnOff'), msg('UpdateBlackScreen'))
		assert.deepEqual(await sent('Lock'), msg('SetKommanderLock'))
		assert.deepEqual(await sent('MasterSwitch'), msg('RoleChange', { Switch: true }))
		assert.deepEqual(
			await sent('CallTimeline', { CallTimeline: 2, CallTimelineStatus: 1 }),
			msg('CallTimeline', { index: 2, status: 1 }),
		)
		assert.deepEqual(await sent('take'), msg('OutPutToEchoWindow'))
		assert.deepEqual(await sent('copyToPreview'), msg('CopyOutPutToEdit'))
	})

	it('does not send the empty choice of CallByName', async () => {
		const { instance, ws } = await connect()
		const count = ws.sent.length
		await press(instance, 'CallByName', { CallByName: 'PlanGroupList_PlanList' })
		assert.equal(ws.sent.length, count)
	})

	it('switches preview mode on, off and back', async () => {
		const { instance, ws } = await connect()
		await press(instance, 'previewMode', { mode: 'toggle' })
		assert.deepEqual(ws.last('SetPretidingMode').params, { realMode: false })
		ws.receive('SetPretidingMode', { realMode: false })
		await press(instance, 'previewMode', { mode: 'toggle' })
		assert.deepEqual(ws.last('SetPretidingMode').params, { realMode: true })
		await press(instance, 'previewMode', { mode: 'on' })
		assert.deepEqual(ws.last('SetPretidingMode').params, { realMode: false })
	})

	it('mutes a file and sets its volume by its name', async () => {
		const { instance, ws } = await connect()
		ws.receive('UpdateProgFileList', [
			{ id: '{a}', name: 'Clip.mp4', bMute: false, media: { type: 1 } },
			{ id: '{b}', name: 'logo.png', bMute: false, media: { type: 4 } },
		])
		await press(instance, 'fileMute', { file: ' clip.MP4 ', mode: 'toggle' })
		assert.deepEqual(ws.last('SetProgFileMute').params, { id: '{a}', bMute: true })
		ws.receive('SetProgFileMute', { id: '{a}', bMute: true })
		await press(instance, 'fileMute', { file: 'Clip.mp4', mode: 'toggle' })
		assert.deepEqual(ws.last('SetProgFileMute').params, { id: '{a}', bMute: false })
		await press(instance, 'fileVolume', { file: 'Clip.mp4', volume: 50 })
		assert.deepEqual(ws.last('SetProgFileVolume').params, { id: '{a}', volume: 50 })
		const count = ws.sent.length
		await press(instance, 'fileMute', { file: 'missing.mp4', mode: 'mute' })
		assert.equal(ws.sent.length, count)
		assert.ok(instance.logs.some(([level, message]) => level === 'warn' && message.includes('missing.mp4')))
	})

	it('records, with the time on the button', async (t) => {
		t.mock.timers.enable({ apis: ['setInterval', 'Date'] })
		const { instance, ws } = await connect()
		await press(instance, 'record', { mode: 'toggle' })
		assert.equal(ws.sentNames().at(-1), 'StartVideoRecord')
		ws.receive('StartVideoRecord', { res: 0 })
		assert.equal(isOn(instance, 'recording'), true)
		assert.equal(instance.variables.record_time, '00:00')
		t.mock.timers.tick(65000)
		assert.equal(instance.variables.record_time, '01:05')
		await press(instance, 'record', { mode: 'toggle' })
		assert.equal(ws.sentNames().at(-1), 'StopVideoRecord')
		ws.receive('StopVideoRecord', { res: 0 })
		assert.equal(instance.variables.recording, false)
		assert.equal(instance.variables.record_time, '')
		await instance.destroy()
	})

	it('runs every preset without errors', async () => {
		const { instance } = await connect()
		for (const [id, preset] of Object.entries(instance.presets)) {
			for (const action of preset.steps[0].down) {
				await assert.doesNotReject(async () => press(instance, action.actionId, action.options), id)
			}
		}
	})
})

describe('settings', () => {
	it('updates the variables in the presets when the connection is renamed', async () => {
		const { instance } = await connect()
		instance.labelValue = 'KMD'
		await instance.configUpdated(CONFIG)
		assert.match(instance.presets.status_plan.style.text, /\$\(KMD:plan_name\)/)
		assert.deepEqual(presetProblems(instance), [])
	})

	it('fills in the login of version 1.0 when an existing connection is upgraded', () => {
		const [upgrade] = upgradeScripts
		const result = upgrade({}, { config: { url: 'ws://10.0.0.2:1702', reconnect: true }, actions: [], feedbacks: [] })
		assert.deepEqual(result.updatedConfig, {
			url: 'ws://10.0.0.2:1702',
			reconnect: true,
			username: 'streamDeck',
			password: 'streamDeck',
			debug_messages: false,
		})
		assert.equal(upgrade({}, { config: { url: 'ws://10.0.0.2:1702', username: 'op' } }).updatedConfig, null)
		assert.equal(upgrade({}, { config: null }).updatedConfig, null)
	})
})
