const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

const RECORDINGS_DIR = 'recordings';

// Ensure ffmpeg path is set
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Checks for MKV files that do not have a corresponding MP4 file
 * and converts them.
 */
const processLeftoverRecordings = async () => {
    console.log('[VideoProcessor] Checking for leftover recordings...');

    if (!fs.existsSync(RECORDINGS_DIR)) {
        console.log('[VideoProcessor] Recordings directory not found.');
        return;
    }

    const files = fs.readdirSync(RECORDINGS_DIR);
    const mkvFiles = files.filter(f => f.endsWith('.mkv'));

    if (mkvFiles.length === 0) {
        console.log('[VideoProcessor] No MKV files found.');
        return;
    }

    let convertedCount = 0;

    for (const mkvFile of mkvFiles) {
        const basename = path.basename(mkvFile, '.mkv');
        const mp4File = `${basename}.mp4`;
        const mkvPath = path.join(RECORDINGS_DIR, mkvFile);
        const mp4Path = path.join(RECORDINGS_DIR, mp4File);

        // Check if MP4 already exists
        if (fs.existsSync(mp4Path)) {
            // If MP4 exists, we assume it was successful (or we can check size, but existence is a good first step)
            // Ideally, we might want to check if the MP4 is valid, but for now let's assume if it exists, the MKV is redundant OR it was a previous run.
            // HOWEVER, the user asked to convert "fail to convert".
            // If an MP4 exists, maybe we shouldn't overwrite it blindly.
            // But if the MKV persists, it might mean cleanup didn't happen.
            // Let's Skip if MP4 exists to be safe, maybe the MKV wasn't deleted for some reason.
            // console.log(`[VideoProcessor] MP4 already exists for ${mkvFile}, skipping.`);
            continue;
        }

        console.log(`[VideoProcessor] Found leftover file: ${mkvFile}. Starting conversion...`);

        try {
            await convertToMp4(mkvPath, mp4Path);
            console.log(`[VideoProcessor] Successfully converted ${mkvFile} to MP4.`);
            convertedCount++;

            // Delete the original MKV file
            fs.unlinkSync(mkvPath);
            console.log(`[VideoProcessor] Deleted original file: ${mkvFile}`);
        } catch (err) {
            console.error(`[VideoProcessor] Failed to convert ${mkvFile}:`, err);
        }
    }

    if (convertedCount === 0) {
        console.log('[VideoProcessor] No files needed conversion.');
    } else {
        console.log(`[VideoProcessor] Recovery complete. Converted ${convertedCount} files.`);
    }
};

/**
 * Converts a single MKV file to MP4 using stream copy
 */
const convertToMp4 = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions(['-c copy', '-bsf:a aac_adtstoasc'])
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
};

module.exports = {
    processLeftoverRecordings
};
