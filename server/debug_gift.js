const { WebcastPushConnection } = require('tiktok-live-connector');

// Default to a popular user to increase chance of seeing gifts
const tiktokUsername = process.argv[2] || "nctg0076zzp"; 

console.log(`Connecting to ${tiktokUsername} to listen for gifts...`);

const tiktokConnection = new WebcastPushConnection(tiktokUsername, {
    enableExtendedGiftInfo: true
});

tiktokConnection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect:', err.message);
    process.exit(1);
});

tiktokConnection.on('gift', data => {
    console.log("Gift Event Received:");
    console.log(JSON.stringify(data, null, 2));
    
    // Exit after receiving a few gifts to avoid spam
    // process.exit(0); 
});

tiktokConnection.on('streamEnd', () => {
    console.log('Stream ended');
    process.exit(0);
});

// Timeout after 60 seconds if no gifts
setTimeout(() => {
    console.log("Timeout: No gifts received in 60s");
    process.exit(0);
}, 60000);
