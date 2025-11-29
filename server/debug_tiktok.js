const { WebcastPushConnection } = require('tiktok-live-connector');

// User known to be live
const tiktokUsername = "nctg0076zzp";

console.log(`Connecting to ${tiktokUsername}...`);

let tiktokConnection = new WebcastPushConnection(tiktokUsername);

tiktokConnection.connect()
    .then(state => {
        console.log("Connected!");
        console.log("Room ID:", state.roomId);

        if (state.roomInfo && state.roomInfo.stream_url) {
            console.log("Stream URL Object Found!");
            console.log(JSON.stringify(state.roomInfo.stream_url, null, 2));
        } else {
            console.log("No stream_url found in roomInfo.");
            console.log("Room Info Keys:", Object.keys(state.roomInfo || {}));
        }

        process.exit(0);
    })
    .catch(err => {
        console.error("Failed to connect:", err);
        process.exit(1);
    });
