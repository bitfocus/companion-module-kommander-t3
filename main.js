import { InstanceBase, InstanceStatus, runEntrypoint } from '@companion-module/base'
import { networkInterfaces } from 'node:os'
import WebSocket from 'ws'
import { getActionDefinitions } from './actions.js'
import { getFeedbackDefinitions } from './feedbacks.js'
import { getPresetDefinitions } from './presets.js'
import { upgradeScripts } from './upgrade.js'
import {
	formatTime,
	getEmptyVariableValues,
	getVariableDefinitions,
	indexToNumber,
	PLAY_STATUS_NAMES,
} from './variables.js'

const URL_REGEX = '^wss?:\\/\\/([\\da-z\\.-]+)(:\\d{1,5})?(?:\\/(.*))?$'
// Login of Kommander's Stream Deck access, which works without any setup in Kommander
export const DEFAULT_LOGIN = 'streamDeck'
// Kommander only reports changes: this is asked for once the plans are known
const STATE_REQUESTS = [
	'GetGlobalState',
	'GetAllMonitor',
	'GetBlackScreen',
	'GetKommanderLock',
	'GetPretidingMode',
	'GetScreenContrastLight',
	'GetPrePlanUsingMark',
]
// Media type of videos, in the media library and on the canvas
const VIDEO = 1

// Kommander tells clients apart by device id: one per Companion connection, so two of them don't clash
function deviceIdFor(connectionId) {
	let hash = 0
	for (const char of connectionId) hash = (hash * 31 + char.charCodeAt(0)) % 900000
	return String(100000 + hash)
}

function localAddress() {
	const addresses = Object.values(networkInterfaces()).flat()
	return addresses.find((address) => address.family === 'IPv4' && !address.internal)?.address ?? '127.0.0.1'
}

class KommanderInstance extends InstanceBase {
	// plan groups of the open project, from the media library
	planGroups = []
	planSignature = ''
	// why Kommander refused the last login, shown as the connection status
	loginError = null

	async init(config) {
		this.config = config
		this.resetState()
		this.setVariableDefinitions(getVariableDefinitions())
		this.setVariableValues(getEmptyVariableValues())
		this.initDefinitions()
		this.initWebSocket()
	}

	async destroy() {
		this.isDestroyed = true
		clearTimeout(this.reconnectTimer)
		this.stopTimers()
		this.closeWebSocket()
	}

	async configUpdated(config) {
		this.config = config
		// the presets show this connection's variables, which go by its label
		this.initPresets()
		this.initWebSocket()
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'url',
				label: 'Kommander URL',
				tooltip: 'ws://<ip>:1702',
				width: 12,
				regex: `/${URL_REGEX}/`,
				default: 'ws://127.0.0.1:1702',
			},
			{
				type: 'textinput',
				id: 'username',
				label: 'Username',
				tooltip: 'A user of Kommander (System Settings > Users). The default works without any setup',
				width: 6,
				default: DEFAULT_LOGIN,
			},
			{ type: 'textinput', id: 'password', label: 'Password', width: 6, default: DEFAULT_LOGIN },
			{
				type: 'checkbox',
				id: 'reconnect',
				label: 'Reconnect',
				tooltip: 'Reconnect 5 seconds after the connection drops',
				width: 6,
				default: true,
			},
			{
				type: 'checkbox',
				id: 'debug_messages',
				label: 'Log messages',
				tooltip: 'Log every message to and from Kommander (debug level)',
				width: 6,
				default: false,
			},
		]
	}

	// Kommander's state as last reported, null while unknown
	resetState() {
		this.stopTimers()
		this.isNotTimeLine = true
		this.playStatus = null
		this.isMute = false
		this.isBlackScreen = false
		this.monitorStatus = null
		this.isLock = false
		this.realMode = null
		this.groupIndex = null
		this.planIndex = null
		this.currentName = ''
		this.previewIndex = null
		this.previewName = ''
		this.recording = false
		// files on the canvases (on air and preview) by id: name, type, mute, volume, state, position, duration
		this.files = new Map()
	}

	stopTimers() {
		clearTimeout(this.libraryTimer)
		clearInterval(this.videoTimer)
		clearInterval(this.recordTimer)
		this.videoTimer = null
		this.recordTimer = null
	}

	initDefinitions() {
		this.setActionDefinitions(getActionDefinitions(this))
		this.setFeedbackDefinitions(getFeedbackDefinitions(this))
		this.initPresets()
	}

	initPresets() {
		this.setPresetDefinitions(getPresetDefinitions(this.label, this.planGroups))
	}

	initWebSocket() {
		clearTimeout(this.reconnectTimer)
		this.closeWebSocket()
		this.resetState()
		this.setVariableValues(getEmptyVariableValues())
		this.checkFeedbacks()

		const url = this.config.url
		if (!url || !new RegExp(URL_REGEX).test(url)) {
			this.updateStatus(InstanceStatus.BadConfig, 'The Kommander URL must look like ws://<ip>:1702')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.loginError = null
		this.stateRequested = false

		const ws = new WebSocket(url, { origin: 'streamDeck' })
		this.ws = ws
		ws.on('open', () => this.login())
		ws.on('message', (data) => this.messageReceived(data))
		ws.on('error', (error) => {
			// while Kommander is off this repeats every 5 seconds: log it once
			if (error.message !== this.lastError) this.log('error', `WebSocket error: ${error.message}`)
			this.lastError = error.message
		})
		ws.on('close', (code) => {
			this.log('debug', `Connection closed with code ${code}`)
			this.stopTimers()
			if (this.loginError) {
				this.updateStatus(InstanceStatus.ConnectionFailure, `Kommander refused the login: ${this.loginError}`)
			} else {
				this.updateStatus(InstanceStatus.Disconnected, `Connection closed with code ${code}`)
			}
			this.maybeReconnect()
		})
	}

	// Closes the connection without the reconnect its close event would start
	closeWebSocket() {
		if (!this.ws) return
		this.ws.removeAllListeners()
		// closing before the connection is up emits an error: nothing to report
		this.ws.on('error', () => {})
		this.ws.close(1000)
		delete this.ws
	}

	maybeReconnect() {
		if (this.isDestroyed || !this.config.reconnect) return
		clearTimeout(this.reconnectTimer)
		this.reconnectTimer = setTimeout(() => this.initWebSocket(), 5000)
	}

	login() {
		this.send(
			'Authentication',
			{
				username: this.config.username || DEFAULT_LOGIN,
				password: this.config.password || DEFAULT_LOGIN,
				ip: localAddress(),
				deviceId: deviceIdFor(this.id),
				connetType: 5,
			},
			{ identificationID: '10' },
		)
	}

	// Sends KommanderMsg_<name>; false when there is no connection
	send(name, params, extra = {}) {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			this.log('warn', `Not connected to Kommander: ${name} not sent`)
			return false
		}
		const message = { KommanderMsg: `KommanderMsg_${name}`, ...extra }
		if (params !== undefined) message.params = params
		if (this.config.debug_messages) this.log('debug', `Sent: ${JSON.stringify(message)}`)
		this.ws.send(JSON.stringify(message))
		return true
	}

	messageReceived(data) {
		if (this.config.debug_messages) this.log('debug', `Received: ${data}`)
		let message
		try {
			message = JSON.parse(data)
		} catch {
			this.log('warn', `Not a Kommander message: ${data}`)
			return
		}
		this.handleMessage(String(message.KommanderMsg).replace('KommanderMsg_', ''), message)
	}

	handleMessage(name, message) {
		const data = message.data ?? {}
		switch (name) {
			case 'Authentication':
				if (message.code !== 1) {
					// e.g. "Maximum connection number": Kommander closes the connection right after this
					this.loginError = data.msg ?? `error ${data.error}`
					this.log('error', `Kommander refused the login: ${this.loginError}`)
					break
				}
				this.lastError = null
				this.isNotTimeLine = data.isNotTimeLine
				this.updateStatus(InstanceStatus.Ok)
				this.setVariableValues({ project_type: this.isNotTimeLine ? 'Plan' : 'Timeline' })
				this.send('GetMediaLibs')
				break
			case 'GetMediaLibs': {
				const plans =
					message.code === 1
						? message.MediaLibs?.find((library) => library.MediaGroup === '播放预案' || library.MediaGrouptype === 8)
						: undefined
				this.updatePlanGroups(plans?.data ?? [])
				if (!this.stateRequested) {
					this.stateRequested = true
					STATE_REQUESTS.forEach((request) => this.send(request))
				}
				break
			}
			case 'MediaLibsChanged':
				// Sent when plans are edited and when a plan goes on air (also after a Take, which has no notice of
				// its own): refresh both once things settle
				clearTimeout(this.libraryTimer)
				this.libraryTimer = setTimeout(() => {
					this.send('GetMediaLibs')
					this.send('GetPrePlanUsingMark')
				}, 300)
				break
			case 'GetGlobalState':
				this.playStatus = data.state
				this.checkFeedbacks('playStatus')
				this.setVariableValues({ play_status: PLAY_STATUS_NAMES[data.state] ?? '' })
				break
			case 'Mute':
				this.isMute = data.mute
				this.checkFeedbacks('unmute')
				this.setVariableValues({ mute: Boolean(data.mute) })
				break
			case 'Volume':
				if (typeof data.volume === 'number') this.setVariableValues({ volume: data.volume })
				break
			case 'GetScreenContrastLight':
				this.setVariableValues({ brightness: data.light, contrast: data.contrast })
				break
			case 'GetBlackScreen':
			case 'UpdateBlackScreen':
				this.isBlackScreen = data.blackscreen
				this.checkFeedbacks('blackscreen')
				this.setVariableValues({ blackscreen: Boolean(data.blackscreen) })
				break
			case 'GetAllMonitor':
				this.monitorStatus = data.state
				this.checkFeedbacks('monitorStatus')
				this.setVariableValues({ output: data.state === 1 })
				break
			case 'GetKommanderLock':
			case 'UpdateLockKommander':
				this.isLock = data.lock
				this.checkFeedbacks('lock')
				this.setVariableValues({ lock: Boolean(data.lock) })
				break
			case 'GetPretidingMode':
			case 'SetPretidingMode':
				// the reply to SetPretidingMode has no data, the notice that follows has the mode
				if (typeof data.realMode !== 'boolean') break
				this.realMode = data.realMode
				this.checkFeedbacks('previewMode', 'previewPlan', 'previewByName')
				this.setVariableValues({ preview_mode: !data.realMode })
				break
			case 'SwitchPlanPreGroup':
				this.groupIndex = data.index
				this.checkFeedbacks('preGroup')
				this.setVariableValues({
					group_number: indexToNumber(data.index),
					group_name: this.planGroups[data.index]?.name ?? '',
				})
				break
			case 'UpdatePrePlanUsingMark':
				this.updatePlans(data)
				break
			case 'UpdateProgFileList':
				for (const file of Array.isArray(message.data) ? message.data : []) {
					this.updateFile(file.id, { name: file.name, type: file.media?.type, mute: file.bMute })
				}
				this.updateVideo()
				break
			case 'DeleteProgFile':
				this.files.delete(data.id)
				this.updateVideo()
				break
			case 'SetProgFileMute':
				// also the reply to our own SetProgFileMute, which has no data
				if (data.id) this.updateFile(data.id, { mute: data.bMute })
				break
			case 'UpdateProgFileVolume':
				this.updateFile(data.id, { volume: data.volume })
				break
			case 'UpdateProgFilePlayState':
				this.updateFile(data.id, { state: data.state, position: Number(data.curPos), duration: Number(data.duration) })
				this.updateVideo()
				break
			case 'GetProgFilePlayState':
				// the reply has no file id: it is about the video asked for last
				if (!this.videoAsked) break
				this.updateFile(this.videoAsked, {
					state: data.state,
					position: Number(data.curPos),
					duration: Number(data.duration),
				})
				this.updateVideo()
				break
			case 'StartVideoRecord':
			case 'StopVideoRecord':
				if (message.code === 1) this.setRecording(name === 'StartVideoRecord')
				break
		}
	}

	// The plan lists (actions, feedbacks, presets) are rebuilt only when the plans changed
	updatePlanGroups(groups) {
		this.planGroups = groups
		const signature = JSON.stringify(groups.map((group) => [group.name, (group.data ?? []).map((plan) => plan.name)]))
		if (signature === this.planSignature) return
		this.planSignature = signature
		this.initDefinitions()
	}

	// Plans on air and in preview. Kommander's notice has their positions and names, but the reply to
	// GetPrePlanUsingMark only has their ids, so those come from the media library
	updatePlans(data) {
		const onAir =
			data.outPutingId === undefined
				? this.findPlan(data.outPutingPrePlanId, this.groupIndex)
				: {
						index: data.outPutingId,
						groupIndex: data.nOutGroupId,
						group: data.outGroupName,
						name: data.outPutingPrePlanName,
					}
		const preview =
			data.editingId === undefined
				? this.findPlan(data.editingPrePlanId)
				: {
						index: data.editingId,
						groupIndex: data.nEditGroupId,
						group: data.EditGroupName,
						name: data.editingPrePlanName,
					}
		this.planIndex = onAir.index
		this.groupIndex = onAir.groupIndex
		this.currentName = `${onAir.group}-${onAir.name}`
		this.previewIndex = preview.index
		this.previewName = `${preview.group}-${preview.name}`
		this.checkFeedbacks('plan', 'callByName', 'preGroup', 'previewPlan', 'previewByName')
		this.setVariableValues({
			plan_number: indexToNumber(onAir.index),
			plan_name: onAir.name ?? '',
			group_number: indexToNumber(onAir.groupIndex),
			group_name: onAir.group ?? '',
			preview_plan_number: indexToNumber(preview.index),
			preview_plan_name: preview.name ?? '',
			preview_group_number: indexToNumber(preview.groupIndex),
			preview_group_name: preview.group ?? '',
		})
	}

	// Position and names of a plan of the media library (index -1 when it isn't there)
	findPlan(planId, groupIndex = -1) {
		for (const [g, group] of this.planGroups.entries()) {
			const p = (group.data ?? []).findIndex((plan) => plan.id === planId)
			if (p !== -1) return { index: p, groupIndex: g, group: group.name, name: group.data[p].name }
		}
		return { index: -1, groupIndex, group: this.planGroups[groupIndex]?.name ?? '', name: '' }
	}

	updateFile(id, changes) {
		if (id) this.files.set(id, { ...this.files.get(id), ...changes })
	}

	// Files on the canvases with this name (case and spaces around it don't matter)
	findFiles(name) {
		const wanted = String(name).trim().toLowerCase()
		const found = [...this.files.entries()].filter(([, file]) => file.name?.toLowerCase() === wanted)
		if (!found.length) this.log('warn', `No file named "${name}" in the plans on air or in preview`)
		return found
	}

	// The video that plays (the longest one left, if several) and its times. Kommander sends no progress while it
	// plays, so its position is asked for every second
	updateVideo() {
		const left = ([, file]) => file.duration - (file.position || 0)
		const videos = [...this.files.entries()].filter(([, file]) => file.type === VIDEO && file.duration > 0)
		const playing = videos.filter(([, file]) => file.state === 1)
		const [id, video] = (playing.length ? playing : videos).sort((a, b) => left(b) - left(a))[0] ?? []
		this.setVariableValues({
			video_name: video?.name ?? '',
			video_elapsed: video ? formatTime(video.position || 0) : '',
			video_remaining: video ? formatTime(left([id, video]), true) : '',
			video_remaining_seconds: video ? Math.ceil(left([id, video]) / 1000) : '',
			video_duration: video ? formatTime(video.duration, true) : '',
		})
		this.playingVideo = playing.length ? id : null
		if (this.playingVideo && !this.videoTimer) {
			this.videoTimer = setInterval(() => {
				if (this.send('GetProgFilePlayState', { id: this.playingVideo })) this.videoAsked = this.playingVideo
			}, 1000)
		} else if (!this.playingVideo) {
			clearInterval(this.videoTimer)
			this.videoTimer = null
		}
	}

	// Kommander has no notice for recording, so this follows the replies to our own commands
	setRecording(recording) {
		this.recording = recording
		clearInterval(this.recordTimer)
		this.recordTimer = null
		if (recording) {
			const start = Date.now()
			this.recordTimer = setInterval(
				() => this.setVariableValues({ record_time: formatTime(Date.now() - start) }),
				1000,
			)
		}
		this.checkFeedbacks('recording')
		this.setVariableValues({ recording, record_time: recording ? formatTime(0) : '' })
	}
}

runEntrypoint(KommanderInstance, upgradeScripts)
