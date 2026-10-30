// Fake WebSocket: keeps what the module sends, and the tests play Kommander's side
import { EventEmitter } from 'node:events'

export default class FakeWebSocket extends EventEmitter {
	static OPEN = 1
	static latest = null

	constructor(url, options) {
		super()
		this.url = url
		this.options = options
		this.readyState = 0
		this.sent = []
		FakeWebSocket.latest = this
	}

	send(data) {
		this.sent.push(JSON.parse(data))
	}

	close(code) {
		this.readyState = 3
		this.closeCode = code
	}

	open() {
		this.readyState = FakeWebSocket.OPEN
		this.emit('open')
	}

	receive(name, data, extra = {}) {
		this.emit('message', Buffer.from(JSON.stringify({ KommanderMsg: `KommanderMsg_${name}`, code: 1, data, ...extra })))
	}

	sentNames() {
		return this.sent.map((message) => message.KommanderMsg.replace('KommanderMsg_', ''))
	}

	last(name) {
		return this.sent.findLast((message) => message.KommanderMsg === `KommanderMsg_${name}`)
	}
}
