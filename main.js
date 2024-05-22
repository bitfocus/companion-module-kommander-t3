import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import WebSocket from 'ws'
import objectPath from 'object-path'
import { upgradeScripts } from './upgrade.js'


class KommanderInstance extends InstanceBase {
	isInitialized = false

	subscriptions = new Map()
	wsRegex = '^wss?:\\/\\/([\\da-z\\.-]+)(:\\d{1,5})?(?:\\/(.*))?$'

	async init(config) {
		this.config = config

		this.initWebSocket()
		this.isInitialized = true
		// login 
		
		//this.updateVariables()
		this.initActions()
		//this.initFeedbacks()
		//this.subscribeFeedbacks()
	}

	async destroy() {
		this.isInitialized = false
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}
		if (this.ws) {
			this.ws.close(1000)
			delete this.ws
		}
	}

	async configUpdated(config) {
		this.config = config
		this.initWebSocket()
	}

	updateVariables(callerId = null) {
		let variables = new Set()
		let defaultValues = {}
		this.subscriptions.forEach((subscription, subscriptionId) => {
			if (!subscription.variableName.match(/^[-a-zA-Z0-9_]+$/)) {
				return
			}
			variables.add(subscription.variableName)
			if (callerId === null || callerId === subscriptionId) {
				defaultValues[subscription.variableName] = ''
			}
		})
		let variableDefinitions = []
		variables.forEach((variable) => {
			variableDefinitions.push({
				name: variable,
				variableId: variable,
			})
		})
		this.setVariableDefinitions(variableDefinitions)
		if (this.config.reset_variables) {
			this.setVariableValues(defaultValues)
		}
	}

	maybeReconnect() {
		if (this.isInitialized && this.config.reconnect) {
			if (this.reconnect_timer) {
				clearTimeout(this.reconnect_timer)
			}
			this.reconnect_timer = setTimeout(() => {
				this.initWebSocket()
			}, 5000)
		}
	}

	initWebSocket() {
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}

		const url = this.config.url
		if (!url || url.match(new RegExp(this.wsRegex)) === null) {
			this.updateStatus(InstanceStatus.BadConfig, `Invalid URL provided. Please make sure the URL is valid and matches the required format`)
			return
		}

		this.updateStatus(InstanceStatus.Connecting)

		if (this.ws) {
			this.ws.close(1000)
			delete this.ws
		}
		this.ws = new WebSocket(url, {
      origin: "streamDeck"
    })

		this.ws.on('open', () => {
			this.updateStatus(InstanceStatus.Ok)
			this.log('debug', `Connection opened`)
			if (this.config.reset_variables) {
				this.updateVariables()
			}
			this.ws.send(JSON.stringify({
				KommanderMsg: "KommanderMsg_Authentication",
				identificationID: "10",
				params: {
					username: "streamDeck",
					password: "streamDeck",
					ip: "192.168.0.129",
					deviceId: "103291",
          connetType: 5
				}
			}))
		})
		this.ws.on('close', (code) => {
			this.log('debug', `Connection closed with code ${code}`)
			this.updateStatus(InstanceStatus.Disconnected, `Connection closed with code ${code}`)
			this.maybeReconnect()
		})

		this.ws.on('message', this.messageReceivedFromWebSocket.bind(this))

		this.ws.on('error', (data) => {
			this.log('error', `WebSocket error: ${data}`)
		})
		
	}

	messageReceivedFromWebSocket(data) {
		if (this.config.debug_messages) {
			this.log('debug', `Message received: ${data}`)
		}

		let msgValue = null
		try {
			msgValue = JSON.parse(data)
		} catch (e) {
			msgValue = data
		}

		this.subscriptions.forEach((subscription) => {
			if (subscription.variableName === '') {
				return
			}
			if (subscription.subpath === '') {
				this.setVariableValues({
					[subscription.variableName]: typeof msgValue === 'object' ? JSON.stringify(msgValue) : msgValue,
				})
			} else if (typeof msgValue === 'object' && objectPath.has(msgValue, subscription.subpath)) {
				let value = objectPath.get(msgValue, subscription.subpath)
				this.setVariableValues({
					[subscription.variableName]: typeof value === 'object' ? JSON.stringify(value) : value,
				})
			}
		})
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'url',
				label: 'Target URL',
				tooltip: 'ws://ip:1702',
				width: 12,
				regex: '/' + this.wsRegex + '/',
			},
			{
				type: 'checkbox',
				id: 'reconnect',
				label: 'Reconnect',
				tooltip: 'Reconnect on WebSocket error (after 5 secs)',
				width: 6,
				default: true,
			},
			{
				type: 'checkbox',
				id: 'append_new_line',
				label: 'Append new line',
				tooltip: 'Append new line (\\r\\n) to commands',
				width: 6,
				default: true,
			},
			{
				type: 'checkbox',
				id: 'debug_messages',
				label: 'Debug messages',
				tooltip: 'Log incomming and outcomming messages',
				width: 6,
			},
			{
				type: 'checkbox',
				id: 'reset_variables',
				label: 'Reset variables',
				tooltip: 'Reset variables on init and on connect',
				width: 6,
				default: true,
			},
		]
	}

	initFeedbacks() {
		this.setFeedbackDefinitions({
			websocket_variable: {
				type: 'advanced',
				name: 'Update variable with value from WebSocket message',
				description:
					'Receive messages from the WebSocket and set the value to a variable. Variables can be used on any button.',
				options: [
					{
						type: 'textinput',
						label: 'JSON Path (blank if not json)',
						id: 'subpath',
						default: '',
					},
					{
						type: 'textinput',
						label: 'Variable',
						id: 'variable',
						regex: '/^[-a-zA-Z0-9_]+$/',
						default: '',
					},
				],
				callback: () => {
					// Nothing to do, as this feeds a variable
					return {}
				},
				subscribe: (feedback) => {
					this.subscriptions.set(feedback.id, {
						variableName: feedback.options.variable,
						subpath: feedback.options.subpath,
					})
					if (this.isInitialized) {
						this.updateVariables(feedback.id)
					}
				},
				unsubscribe: (feedback) => {
					this.subscriptions.delete(feedback.id)
				},
			},
		})
	}

	initActions() {
		const callPlanDropDownValue = [
			{ id: 'PreviousPlan', label: 'Previous Plan' },
			{ id: 'NextPlan', label: 'Next Plan' },
		];

    const changePlanGroupDropDownValue = [
			{ id: 'pre', label: 'Previous Group' },
			{ id: 'next', label: 'Next Group' },
		];

		for( let i = 1; i<=32; i++){
			callPlanDropDownValue.push({
				id: i,
				label: `Plan_${i}`,
			})
      changePlanGroupDropDownValue.push({
        id: i,
        label: `Group_${i}`,
      })
		}
		
		this.setActionDefinitions({
			callPlan: {
				name: 'CallPlan',
				options: [
					{
						id: 'callPlan',
						type: 'dropdown',
						label: 'Previous Plan',
						choices: callPlanDropDownValue,
						default: 'PreviousPlan',
					},
				],
				callback: async (action) => {
					if (this.config.debug_messages) {
						this.log('debug', `Message sent: ${action.options.callPlan}`)
					}
          if (typeof(action.options.callPlan) === 'number') {
            this.ws.send(JSON.stringify({
              KommanderMsg: "KommanderMsg_IndexInvokePrePlan",
              params: {
                index: action.options.callPlan - 1,
                onlySetReal: true
              }
            }))
          }else{
            this.ws.send(JSON.stringify({
              KommanderMsg: "KommanderMsg_PrePlanNextOrPre",
              params: {
                next: action.options.callPlan === 'NextPlan', // true下一条
              }
            }))
          }
				},
			},
      ChangePlanGroup: {
				name: 'ChangePlanGroup',
				options: [
					{
						id: 'changePlanGroup',
						type: 'dropdown',
						label: 'next',
						choices: changePlanGroupDropDownValue,
						default: 'next',
					},
				],
				callback: async (action) => {
					if (this.config.debug_messages) {
						this.log('debug', `Message sent: ${action.options.changePlanGroup}`)
					}
          if (typeof(action.options.changePlanGroup) === 'number') {
            this.ws.send(JSON.stringify({
              KommanderMsg: "KommanderMsg_SwitchPlanPreGroup",
              params: {
                index: action.options.changePlanGroup - 1,
              }
            }))
          }else{
            this.ws.send(JSON.stringify({
              KommanderMsg: "KommanderMsg_SwitchPlanPreGroup",
              params: {
                type: action.options.changePlanGroup,
              }
            }))
          }
				},
			},
			ChangePlayStatus: {
				name: 'ChangePlayStatus',
				options: [
					{
						id: 'changePlayStatus',
						type: 'dropdown',
						label: 'ChangePlayStatus',
						choices: [
							{ id: 'Play', label: 'Play' },
							{ id: 'Pause', label: 'Pause' },
							{ id: 'Stop', label: "Stop"}
						],
						default: 'Play',
					},
				],
				callback: async (action) => {
					if (this.config.debug_messages) {
						this.log('debug', `Message sent: ${action.options.changePlayStatus}`)
					}
					this.ws.send(JSON.stringify({
            KommanderMsg: `KommanderMsg_${action.options.changePlayStatus}`,
            params: {
              onlySetReal: true
            }
          }))
				},
			},
      SoundControl: {
				name: 'SoundControl',
				options: [
					{
						id: 'soundControl',
						type: 'dropdown',
						label: 'SoundControl',
						choices: [
              { id: 0, label: "Mute/Unmute"},
							{ id: -1, label: 'Volume+' },
							{ id: -2, label: 'Volume-' }
						],
						default: -1,
					},
				],
				callback: async (action) => {
          if (this.config.debug_messages) {
						this.log('debug', `Message sent: ${action.options.soundControl}`)
					}
          if(action.options.soundControl === 0) {
            this.ws.send(JSON.stringify({
              KommanderMsg: 'KommanderMsg_Mute',
            }))
          }else{
            this.ws.send(JSON.stringify({
              KommanderMsg: `KommanderMsg_Volume`,
              params: {
                volume: action.options.soundControl
              }
            }))
          }
				},
			},
      PageTurn: {
				name: 'PageTurn',
				options: [
					{
						id: 'pageTurn',
						type: 'dropdown',
						label: 'PageTurn',
						choices: [
							{ id: 'PrevPage', label: 'PageUP' },
							{ id: 'NextPage', label: 'PageDown' }
						],
						default: 'NextPage',
					},
				],
				callback: async (action) => {
					if (this.config.debug_messages) {
						this.log('debug', `Message sent: ${action.options.pageTurn}`)
					}
					this.ws.send(JSON.stringify({
            KommanderMsg: `KommanderMsg_${action.options.pageTurn}`,
            params: {
              isGlobalTurnPage: true,
              onlySetReal: true
            }
          }))
				},
			},
      ScreenOnOff: {
				name: 'Screen On/Off',
				options: [],
				callback: async () => {
          if (this.config.debug_messages) {
						this.log('debug', 'Message sent: UpdateBlackScreen')
					}
					this.ws.send(JSON.stringify({
            KommanderMsg: 'KommanderMsg_UpdateBlackScreen',
          }))
				},
			},
      BrightContrast: {
				name: 'Bright&Contrast',
				options: [
					{
						id: 'brightContrast',
						type: 'dropdown',
						label: 'Bright&Contrast',
						choices: [
							{ id: 'Brightness+', label: 'Brightness+' },
							{ id: 'Brightness-', label: 'Brightness-' },
              { id: 'Contrast+', label: 'Contrast+' },
							{ id: 'Contrast-', label: 'Contrast-' }
						],
						default: 'Brightness+',
					},
				],
				callback: async (action) => {
          if (this.config.debug_messages) {
						this.log('debug', `Message sent: ${action.options.brightContrast}`)
					}
          const komMsg = {
            KommanderMsg: '',
            params: {
            }
          };
          switch (action.options.brightContrast) {
            case 'Brightness+':
              komMsg.KommanderMsg = 'KommanderMsg_SetScreenLight';
              komMsg.params = {
                light: -1
              };
              break;
            case 'Brightness-':
              komMsg.KommanderMsg = 'KommanderMsg_SetScreenLight';
              komMsg.params = {
                light: -2
              };
              break;
            case 'Contrast+':
              komMsg.KommanderMsg = 'KommanderMsg_SetScreenContrast';
              komMsg.params = {
                contrast: -1
              };
              break;
            case 'Contrast-':
              komMsg.KommanderMsg = 'KommanderMsg_SetScreenContrast';
              komMsg.params = {
                contrast: -2
              };
              break;
            default:
              break;
          }
					this.ws.send(JSON.stringify(komMsg))
				},
			},
      OutputOnOff: {
				name: 'Output On/Off',
				options: [
					{
						id: 'outputOnOff',
						type: 'dropdown',
						label: 'Output On/Off',
						choices: [
							{ id: 0, label: 'Off' },
							{ id: 1, label: 'On' }
						],
						default: '1',
					},
				],
				callback: async (action) => {
					if (this.config.debug_messages) {
						this.log('debug', `Message sent: ${action.options.outputOnOff}`)
					}
					this.ws.send(JSON.stringify({
            KommanderMsg: "KommanderMsg_EnableAllMonitor",
            params: {
              bOpen: Boolean(action.options.outputOnOff)
            }
          }))
				},
			},
      MasterSwitch: {
				name: 'Master Switch',
				options: [],
				callback: async () => {
          if(this.config.debug_messages){
            this.log('debug', 'Message sent: RoleChange')
          }
					this.ws.send(JSON.stringify({
            KommanderMsg: "KommanderMsg_RoleChange",
            params: {
              bSwitch: true
            }
          }))
				},
			},
      Lock: {
				name: 'Lock',
        options: [],
				callback: async () => {
          if(this.config.debug_messages){
            this.log('debug', 'Message sent: SetKommanderLock')
          }
					this.ws.send(JSON.stringify({
            KommanderMsg: "KommanderMsg_SetKommanderLock",
          }))
				},
			},
		})
	}
}

runEntrypoint(KommanderInstance, upgradeScripts)
