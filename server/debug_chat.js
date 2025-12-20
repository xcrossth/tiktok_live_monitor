const { WebcastPushConnection } = require('tiktok-live-connector');

// Default to a popular user to increase chance of seeing chats
const tiktokUsername = process.argv[2] || "nctg0076zzp";

console.log(`Connecting to ${tiktokUsername} to listen for chats...`);

const tiktokConnection = new WebcastPushConnection(tiktokUsername, {
    enableExtendedGiftInfo: true
});

tiktokConnection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect:', err.message);
    process.exit(1);
});

tiktokConnection.on('chat', data => {
    console.log("Chat Event Received:");
    console.log(JSON.stringify(data, null, 2));

    // Exit after receiving a few chats to avoid spam
    // process.exit(0); 
});

tiktokConnection.on('streamEnd', () => {
    console.log('Stream ended');
    process.exit(0);
});

// Timeout after 60 seconds
setTimeout(() => {
    console.log("Timeout: 60s reached");
    process.exit(0);
}, 60000);
