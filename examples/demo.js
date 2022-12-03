const qmp = require('@jakogut/node-qmp');

const client = new qmp.Client();

// Run qemu like so:
// qemu-system-x86_64 [...] -qmp unix:/tmp/qmp.sock,server,wait=off
client.connect('/tmp/qmp.sock');

client.on('ready', () => {
	client.execute('query-status').then((status) => {
		console.log('Machine status:');
		console.log(status);
	}).then(() => {
		client.on('SHUTDOWN', () => {
			console.log('Virtual machine powered off');
		});

		console.log('Powering off');
		client.execute('system_powerdown');
	});
});
