import * as net from 'net';
import { EventEmitter } from 'events';

const QMP_NEGOTIATION_KEY = 'QMP'
const QMP_EVENT_KEY = 'event';
const QMP_ID_KEY = 'id';

interface QMPMessage {
	id: number;
}

interface QMPResponse extends QMPMessage {
	return: object;
}

export class Client extends EventEmitter {
	private sock: net.Socket | null = null;
	private negotiated: boolean = false;
	private messageId: number = 0;
	private deferredCallbacks: {[index: number]:any} = {};

	constructor() {
		super();
		this.on('message', this.onMessage);
	}

	connect(addr: string | number): void {
		this.sock = net.createConnection(addr as any);
		this.sock.setEncoding('utf8');
		this.sock.on('data', this.onData.bind(this));
		this.sock.on('end', this.onClose.bind(this));
		this.sock.on('error', (err) => { this.emit('error', err); })
	}

	onData(data: string): void {
		const messages = data.split('\n');
		for (const msg of messages) {
			if (msg)
				this.emit('message', this.decodeMessage(msg));
		}
	}

	onClose(): void {
		this.sock = null;
		this.negotiated = false;
		this.emit('disconnect');
	}

	decodeMessage(msg: string): QMPMessage {
		return JSON.parse(msg)
	}

	encodeMessage(msg: QMPMessage): string {
		return JSON.stringify(msg);
	}

	onMessage(msg: object): void {
		if (!this.negotiated) {
			for (const [key, value] of Object.entries(msg)) {
				if (key === QMP_NEGOTIATION_KEY) {
					this.negotiate().then(() => {
						this.negotiated = true
						this.emit('ready');
					});

					return;
				}
			}
		}

		if (QMP_EVENT_KEY in msg) {
			Object.entries(msg).map( ([k, v]) => {
				if ( k === 'event') {
					this.emit((v as string).toLowerCase(), JSON.stringify(msg))
				}
			})
		}

		if (QMP_ID_KEY in msg) {
			const response: QMPResponse = msg as QMPResponse;
			const messageId: number = response.id;
			const callbacks = this.deferredCallbacks[messageId];
			delete this.deferredCallbacks[messageId];
			callbacks.resolve(response.return);
		}
	}

	sendMessage(msg: QMPMessage | string): Promise<object> {
		msg = (typeof msg === 'string') 
			? this.decodeMessage(msg)
			: msg;

		const messageId = this.messageId++;
		msg.id = messageId;
		msg = this.encodeMessage(msg);

		if (!this.sock) {
			throw new Error("Not connected");
		}

		this.sock.write(msg);

		let dResolve, dReject;
		const deferred = new Promise<object>((resolve, reject) => {
			dResolve = resolve;
			dReject = reject;
		});

		this.deferredCallbacks[messageId] = {resolve: dResolve, reject: dReject};
		return deferred;
	}

	execute(cmd: string, args?: object): Promise<object> {
		let msg: any = {execute: cmd, arguments: args}
		return this.sendMessage(msg);
	}

	negotiate(): Promise<object> {
		return this.execute('qmp_capabilities');
	}
}
