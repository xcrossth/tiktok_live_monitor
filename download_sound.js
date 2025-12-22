const https = require('https');
const fs = require('fs');
const path = require('path');

// Doorbell sound from SoundJay
const url = "https://www.soundjay.com/door/sounds/doorbell-1.mp3";
const dest = path.join(__dirname, 'client', 'public', 'ding.mp3');

console.log(`Downloading ${url} to ${dest}...`);

const file = fs.createWriteStream(dest);
const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.soundjay.com/'
    }
};

https.get(url, options, (response) => {
    if (response.statusCode !== 200) {
        console.error(`Failed to download: ${response.statusCode} - ${response.statusMessage}`);
        // Consume response data to free up memory
        response.resume();
        return;
    }
    response.pipe(file);
    file.on('finish', () => {
        file.close(() => {
            console.log('Download completed.');
        });
    });
}).on('error', (err) => {
    fs.unlink(dest, () => { });
    console.error(`Error: ${err.message}`);
});
