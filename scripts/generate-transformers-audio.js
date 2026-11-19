import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generatePollySpeech } from '../src/nexus.js';

const execPromise = promisify(exec);

async function getAudioDuration(filePath) {
  const safePath = filePath.replace(/\\/g, '/');
  const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${safePath}"`);
  return parseFloat(stdout.trim());
}

async function main() {
  console.log('=== Generating AWS Polly Standard Narration & Measuring Audio ===\n');

  const scriptPath = path.resolve('scenes', 'transformers-script.json');
  const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));

  const audioDir = path.resolve('assets', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const manifestScenes = [];
  let totalCalculatedDuration = 0;

  for (let i = 0; i < scriptData.scenes.length; i++) {
    const s = scriptData.scenes[i];
    const sceneNum = i + 1;
    const audioFileName = `transformer_scene_${sceneNum}.mp3`;
    const audioPath = path.join(audioDir, audioFileName);

    console.log(`[Audio ${sceneNum}/9] Synthesizing: "${s.title}"`);
    console.log(`Text: "${s.narration}"`);

    const result = await generatePollySpeech(s.narration, audioPath);
    if (!result.success) {
      throw new Error(`Failed to synthesize audio for scene ${sceneNum}: ${result.error}`);
    }

    const exactDuration = await getAudioDuration(audioPath);
    // Add 1.2s padding (0.4s pre-roll, 0.8s post-roll) so sentences breathe and are never cut off
    const paddedDuration = Math.round((exactDuration + 1.2) * 10) / 10;
    totalCalculatedDuration += paddedDuration;

    console.log(` -> Exact audio: ${exactDuration.toFixed(2)}s | Padded scene duration: ${paddedDuration.toFixed(1)}s (${result.audioBytes} bytes)\n`);

    manifestScenes.push({
      id: `scene${sceneNum}`,
      sceneNumber: sceneNum,
      title: s.title,
      visualDescription: s.visualDescription,
      duration: paddedDuration,
      audioDuration: exactDuration,
      audioFile: `assets/audio/${audioFileName}`,
      file: `scenes/transformer-scene${sceneNum}.html`,
      narration: s.narration
    });
  }

  // Adjust slightly so total is approximately 90s
  console.log(`Total initial calculated duration: ${totalCalculatedDuration.toFixed(1)}s`);

  const manifest = {
    title: "How Transformers Work in Artificial Intelligence",
    totalDuration: Math.round(totalCalculatedDuration),
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: manifestScenes
  };

  const manifestPath = path.resolve('scenes', 'scenes-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Generated scenes-manifest.json with exact audio-synced timings!`);
  console.log(`Total Video Duration: ${manifest.totalDuration}s`);
}

main().catch(err => {
  console.error('Fatal error in audio generation:', err);
  process.exit(1);
});
