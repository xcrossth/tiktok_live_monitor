const { WebcastPushConnection } = require('tiktok-live-connector');

// Default to a popular user or the one the user is watching
const tiktokUsername = process.argv[2] || "nctg0076zzp";

console.log(`Connecting to ${tiktokUsername}...`);

const tiktokConnection = new WebcastPushConnection(tiktokUsername);

tiktokConnection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
    if (state.roomInfo && state.roomInfo.stream_url) {
        console.log("Stream URL Data (JSON):");
        console.log(JSON.stringify(state.roomInfo.stream_url, null, 2));
    } else {
        console.log("No stream_url found in roomInfo.");
    }
    process.exit(0);
}).catch(err => {
    console.error('Failed to connect:', err.message);
    if (err.message.includes("not found")) {
        console.log("User might be offline or username is incorrect.");
    }
    process.exit(1);
});
