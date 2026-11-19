import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Inspect video streams using ffprobe.
 */
async function probeFile(filePath) {
  const safePath = filePath.replace(/\\/g, '/');
  const { stdout } = await execPromise(`ffprobe -v error -show_format -show_streams -print_format json "${safePath}"`);
  return JSON.parse(stdout);
}

/**
 * Assemble frames into an MP4 video with optional audio using FFmpeg.
 * Uses `-preset fast -tune animation` for fast vector/GSAP motion-graphics encoding.
 */
export async function assembleSceneVideo({
  framesDir,
  outputVideoPath,
  fps = 30,
  audioPath = null,
  duration = null
}) {
  const startTime = Date.now();
  fs.mkdirSync(path.dirname(outputVideoPath), { recursive: true });

  const framePattern = path.join(framesDir, 'frame_%05d.png').replace(/\\/g, '/');
  const safeOutputPath = outputVideoPath.replace(/\\/g, '/');
  const safeDuration = duration || 5.0;

  let cmd = '';
  if (audioPath && fs.existsSync(audioPath)) {
    const safeAudioPath = audioPath.replace(/\\/g, '/');
    cmd = `ffmpeg -y -framerate ${fps} -i "${framePattern}" -i "${safeAudioPath}" -filter_complex "[1:a]apad[a]" -map 0:v -map "[a]" -t ${safeDuration} -c:v libx264 -preset fast -tune animation -pix_fmt yuv420p -c:a aac -b:a 192k "${safeOutputPath}"`;
  } else {
    // Generate video with silent stereo audio stream to ensure universal media player compatibility
    cmd = `ffmpeg -y -framerate ${fps} -i "${framePattern}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${safeDuration} -c:v libx264 -preset fast -tune animation -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${safeOutputPath}"`;
  }

  console.log(`[Assembler] Compiling scene: ${path.basename(outputVideoPath)} (-preset fast -tune animation)...`);
  await execPromise(cmd);

  if (!fs.existsSync(outputVideoPath)) {
    throw new Error(`Failed to generate video: ${outputVideoPath}`);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  return {
    outputVideoPath,
    encodingSeconds: elapsed
  };
}

/**
 * Concatenate multiple scene MP4 files into one final MP4 video.
 * Validates stream compatibility and uses fast stream copy `-c copy` with automatic re-encode fallback.
 */
export async function concatenateScenes(sceneVideoPaths, finalOutputPath) {
  const startTime = Date.now();
  fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });

  const listFilePath = path.join(path.dirname(finalOutputPath), 'concat_list.txt');
  const fileContent = sceneVideoPaths
    .map(p => `file '${path.resolve(p).replace(/\\/g, '/')}'`)
    .join('\n');

  fs.writeFileSync(listFilePath, fileContent, 'utf-8');

  const safeListPath = listFilePath.replace(/\\/g, '/');
  const safeFinalPath = finalOutputPath.replace(/\\/g, '/');

  // Verify stream compatibility for fast stream copying (-c copy)
  let streamsCompatible = true;
  try {
    const probeFirst = await probeFile(sceneVideoPaths[0]);
    const vFirst = probeFirst.streams?.find(s => s.codec_type === 'video');

    for (let i = 1; i < sceneVideoPaths.length; i++) {
      const probeScene = await probeFile(sceneVideoPaths[i]);
      const vScene = probeScene.streams?.find(s => s.codec_type === 'video');
      if (
        !vScene ||
        vScene.codec_name !== vFirst?.codec_name ||
        vScene.width !== vFirst?.width ||
        vScene.height !== vFirst?.height
      ) {
        streamsCompatible = false;
        break;
      }
    }
  } catch (err) {
    streamsCompatible = false;
  }

  let usedCopy = false;

  if (streamsCompatible) {
    try {
      console.log(`[Assembler] Streams verified compatible. Attempting fast concatenation (-c copy)...`);
      const copyCmd = `ffmpeg -y -f concat -safe 0 -i "${safeListPath}" -c copy "${safeFinalPath}"`;
      await execPromise(copyCmd);
      usedCopy = true;
      console.log(`[Assembler] Fast concatenation complete (-c copy).`);
    } catch (err) {
      console.warn(`[Assembler] Fast copy failed (${err.message}). Falling back to safe re-encode...`);
      usedCopy = false;
    }
  }

  if (!usedCopy) {
    console.log(`[Assembler] Re-encoding scenes into final master video (-c:v libx264 -preset fast)...`);
    const encodeCmd = `ffmpeg -y -f concat -safe 0 -i "${safeListPath}" -c:v libx264 -preset fast -tune animation -pix_fmt yuv420p -c:a aac -b:a 192k "${safeFinalPath}"`;
    await execPromise(encodeCmd);
  }

  // Clean up concat list file
  if (fs.existsSync(listFilePath)) {
    fs.unlinkSync(listFilePath);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  return {
    finalOutputPath,
    concatSeconds: elapsed,
    usedCopy
  };
}

/**
 * Validate the final MP4 video file and extract stream details.
 */
export async function validateVideoFile(videoPath) {
  if (!fs.existsSync(videoPath)) {
    return {
      valid: false,
      error: `File does not exist: ${videoPath}`
    };
  }

  const stats = fs.statSync(videoPath);
  if (stats.size === 0) {
    return {
      valid: false,
      error: 'Generated video file is 0 bytes.'
    };
  }

  try {
    const data = await probeFile(videoPath);
    const videoStream = data.streams?.find(s => s.codec_type === 'video');
    const audioStream = data.streams?.find(s => s.codec_type === 'audio');

    return {
      valid: true,
      fileSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      duration: `${parseFloat(data.format?.duration || 0).toFixed(2)}s`,
      resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
      fps: videoStream ? Math.round(eval(videoStream.r_frame_rate || '30')) : 30,
      hasAudio: Boolean(audioStream),
      rawDuration: parseFloat(data.format?.duration || 0)
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message
    };
  }
}
