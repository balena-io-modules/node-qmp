const { Client } = require('./client');

describe('Client', () => {
	it('should throw when unable to connect', () => {
		const client = new Client();
		return expect(
			client.connect('does-not-exist')
		).rejects.toThrow('connect ENOENT does-not-exist');
	})
});
