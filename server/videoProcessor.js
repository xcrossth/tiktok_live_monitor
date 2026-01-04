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
 * @param {import('socket.io').Server} [io] - Optional Socket.IO instance to emit progress
 */
const processLeftoverRecordings = async (io) => {
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
            await convertToMp4(mkvPath, mp4Path, io, mkvFile);
            console.log(`[VideoProcessor] Successfully converted ${mkvFile} to MP4.`);
            convertedCount++;

            // Delete the original MKV file
            fs.unlinkSync(mkvPath);
            console.log(`[VideoProcessor] Deleted original file: ${mkvFile}`);

            // Emit completion event
            if (io) {
                io.emit('conversionProgress', {
                    filename: mkvFile,
                    percent: 100,
                    timemark: 'Done',
                    nav: 'finished'
                });
            }

        } catch (err) {
            console.error(`[VideoProcessor] Failed to convert ${mkvFile}:`, err);
            if (io) {
                io.emit('conversionProgress', {
                    filename: mkvFile,
                    error: err.message,
                    nav: 'error'
                });
            }
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
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @param {import('socket.io').Server} [io]
 * @param {string} filename
 */
const convertToMp4 = (inputPath, outputPath, io, filename) => {
    return new Promise((resolve, reject) => {
        let lastLogTime = 0;
        let inputFileSize = 0;

        try {
            const stat = fs.statSync(inputPath);
            inputFileSize = stat.size;
            console.log(`[VideoProcessor] Input file size: ${(inputFileSize / 1024 / 1024).toFixed(2)} MB`);
        } catch (e) {
            console.error(`[VideoProcessor] Could not get file size for ${filename}:`, e);
        }

        ffmpeg(inputPath)
            .outputOptions(['-c copy', '-bsf:a aac_adtstoasc'])
            .output(outputPath)
            .on('progress', (progress) => {
                const timemark = progress.timemark || '00:00:00';
                let percent = progress.percent ? Math.round(progress.percent) : 0;

                // Fallback: Estimate percent based on file size (Output Size / Input Size) using stream copy
                // progress.targetSize is in KB. Input size is in Bytes.
                if ((!percent || percent === 0) && inputFileSize > 0 && progress.targetSize > 0) {
                    const currentSizeBytes = progress.targetSize * 1024;
                    percent = Math.round((currentSizeBytes / inputFileSize) * 100);
                    // Clamp to 99% until actually done (output might be slightly larger/smaller)
                    if (percent > 99) percent = 99;
                }

                // Log every 2 seconds or on major percent change
                const now = Date.now();
                if (now - lastLogTime > 2000 || percent === 100) {
                    console.log(`[VideoProcessor] Converting ${filename}: ${percent}% (${timemark})`);
                    lastLogTime = now;
                }

                if (io) {
                    io.emit('conversionProgress', {
                        filename: filename,
                        percent: percent,
                        timemark: timemark
                    });
                }
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
};

module.exports = {
    processLeftoverRecordings
};
