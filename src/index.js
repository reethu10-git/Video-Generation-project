import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getNexusConfig, getPollyConfig, generatePollySpeech } from './nexus.js';
import { renderSceneFrames } from './renderer.js';
import { assembleSceneVideo, concatenateScenes, validateVideoFile } from './assembler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function main() {
  console.log('====================================================');
  console.log('   HTML + GSAP Video Generator Pipeline Starting    ');
  console.log('====================================================\n');

  // 1. Check Nexus & Voice configuration
  const nexusConfig = getNexusConfig();
  const pollyConfig = getPollyConfig();

  console.log('[Pipeline] Step 1: Configuration Check');
  console.log(` - Nexus Text Generation: ${nexusConfig.isConfigured ? 'READY (configured)' : 'NOT CONFIGURED (fallback to manifest)'}`);
  console.log(` - Polly Voice Synthesis: ${pollyConfig.isConfigured ? 'READY (configured)' : 'NOT CONFIGURED (fallback to synthetic)'}\n`);

  // 2. Load Scene Manifest
  const manifestPath = path.join(ROOT_DIR, 'scenes', 'scenes-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Scene manifest not found at: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`[Pipeline] Step 2: Loaded Project Manifest: "${manifest.title}"`);
  console.log(` - Total Scenes: ${manifest.scenes.length}`);
  console.log(` - Target Duration: ${manifest.totalDuration}s`);
  console.log(` - Video Resolution: ${manifest.width}x${manifest.height} @ ${manifest.fps}fps\n`);

  const tempDir = path.join(ROOT_DIR, 'temp');
  const outputDir = path.join(ROOT_DIR, 'output');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const sceneVideoPaths = [];

  // 3. Render and assemble each scene
  for (let i = 0; i < manifest.scenes.length; i++) {
    const scene = manifest.scenes[i];
    console.log(`\n----------------------------------------------------`);
    console.log(`[Pipeline] Processing Scene ${i + 1}/${manifest.scenes.length}: ${scene.title}`);
    console.log(`Narration: "${scene.narration}"`);

    const sceneFramesDir = path.join(tempDir, `scene_${i + 1}_frames`);
    const pregeneratedAudio = scene.audioFile ? path.join(ROOT_DIR, scene.audioFile) : null;
    const sceneAudioPath = (pregeneratedAudio && fs.existsSync(pregeneratedAudio))
      ? pregeneratedAudio
      : path.join(tempDir, `scene_${i + 1}_audio.mp3`);
    const sceneVideoPath = path.join(tempDir, `scene_${i + 1}.mp4`);

    // Voice Synthesis with AWS Polly Standard via Navigate Labs Nexus
    if (!fs.existsSync(sceneAudioPath)) {
      if (!pollyConfig.hasKey) {
        throw new Error(`Polly voice generation failed: NEXUS_API_KEY is not configured.`);
      }
      console.log(`[Pipeline] Synthesizing narration with Polly (${pollyConfig.voiceId})...`);
      const speechRes = await generatePollySpeech(scene.narration, sceneAudioPath);
      if (!speechRes.success) {
        throw new Error(`Polly voice generation failed for scene ${i + 1}: ${speechRes.error}`);
      }
      console.log(`[Pipeline] Generated audio: ${speechRes.audioBytes} bytes`);
    } else {
      console.log(`[Pipeline] Using verified Polly audio: ${path.basename(sceneAudioPath)}`);
    }

    // Frame Capture with Playwright
    await renderSceneFrames({
      sceneFile: path.join(ROOT_DIR, scene.file),
      outputDir: sceneFramesDir,
      duration: scene.duration,
      fps: manifest.fps,
      width: manifest.width,
      height: manifest.height
    });

    // Assemble individual scene MP4 with audio
    if (!fs.existsSync(sceneAudioPath)) {
      throw new Error(`Audio file missing for scene ${i + 1}: ${sceneAudioPath}`);
    }

    await assembleSceneVideo({
      framesDir: sceneFramesDir,
      outputVideoPath: sceneVideoPath,
      fps: manifest.fps,
      duration: scene.duration,
      audioPath: sceneAudioPath
    });

    sceneVideoPaths.push(sceneVideoPath);
  }

  // 4. Concatenate scenes into final video
  console.log('\n----------------------------------------------------');
  console.log('[Pipeline] Step 4: Assembling Final Master Video');
  const safeTitle = (manifest.title || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const finalVideoPath = path.join(outputDir, `${safeTitle}.mp4`);
  await concatenateScenes(sceneVideoPaths, finalVideoPath);

  // Also maintain alias transformers_explainer.mp4 for convenience if title contains transformer
  if (safeTitle.includes('transformer')) {
    const aliasPath = path.join(outputDir, 'transformers_explainer.mp4');
    fs.copyFileSync(finalVideoPath, aliasPath);
  }

  // 5. Validate final MP4
  console.log('\n[Pipeline] Step 5: Validating Final MP4');
  const validation = await validateVideoFile(finalVideoPath);

  console.log('\n====================================================');
  console.log('   Video Pipeline Completed Successfully!           ');
  console.log('====================================================');
  console.log(`File:       ${finalVideoPath}`);
  console.log(`Valid:      ${validation.valid}`);
  console.log(`Size:       ${validation.fileSize}`);
  console.log(`Duration:   ${validation.duration}`);
  console.log(`Resolution: ${validation.resolution}`);
  console.log(`FPS:        ${validation.fps}`);
  console.log(`Has Audio:  ${validation.hasAudio}`);
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('[Pipeline] Fatal error during video generation:', err);
  process.exit(1);
});
