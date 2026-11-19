import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { getNexusConfig, getPollyConfig, generatePollySpeech, generateScriptWithNexus } from './nexus.js';
import { generateSceneHtml } from './scene-generator.js';
import { renderScenesParallel, renderSceneFrames } from './renderer.js';
import { assembleSceneVideo, concatenateScenes, validateVideoFile } from './assembler.js';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Measure exact audio duration with ffprobe.
 */
async function getAudioDuration(filePath) {
  const safePath = filePath.replace(/\\/g, '/');
  const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${safePath}"`);
  return parseFloat(stdout.trim());
}

/**
 * Compute SHA-256 hash for cache verification.
 */
function computeHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Load or initialize cache manifest.
 */
function loadCacheManifest() {
  const cachePath = path.join(ROOT_DIR, 'scenes', 'cache-manifest.json');
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Save cache manifest.
 */
function saveCacheManifest(cacheData) {
  const cachePath = path.join(ROOT_DIR, 'scenes', 'cache-manifest.json');
  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
}

/**
 * Generate a complete multi-scene educational video from a single prompt.
 * Optimized with browser reuse, parallel rendering pool, fast stream copying, and telemetry.
 *
 * @param {Object} options
 * @param {string} options.prompt - Video topic and instructions
 * @param {number} [options.targetDuration=30] - Target duration in seconds
 * @param {number} [options.fps=30] - Frame rate
 * @param {number} [options.concurrency=2] - Parallel rendering worker count
 * @param {string} [options.outputName] - Desired output filename
 * @returns {Promise<Object>}
 */
export async function generateVideoFromPrompt({
  prompt,
  targetDuration = 30,
  fps = 30,
  concurrency = 2,
  outputName = null
}) {
  const totalPipelineStart = Date.now();
  console.log('\n=============================================================');
  console.log('   Pi Video Orchestrator: High-Performance Generation Pipeline');
  console.log('=============================================================');
  console.log(`Prompt: "${prompt}"`);
  console.log(`Target Duration: ${targetDuration}s | FPS: ${fps} | Workers: ${concurrency}\n`);

  const nexusConfig = getNexusConfig();
  const pollyConfig = getPollyConfig();

  if (!pollyConfig.hasKey) {
    throw new Error('NEXUS_API_KEY is missing or invalid in environment. Cannot synthesize voice.');
  }

  // Telemetry metrics
  const telemetry = {
    llmRequests: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    llmReasoningTokens: 0,
    llmTotalTokens: 0,
    llmSpend: 0,
    pollyRequests: 0,
    pollyCharacters: 0,
    pollySpend: 0,
    timings: {
      llmSeconds: 0,
      pollySeconds: 0,
      sceneGenSeconds: 0,
      browserLaunchSeconds: 0,
      renderSeconds: 0,
      sceneAssemblySeconds: 0,
      concatSeconds: 0,
      totalPipelineSeconds: 0
    }
  };

  // 1. Duration & Scene Calibration
  // Calculate calibrated scene count based on requested duration (average ~9.5-10s per scene)
  const targetSceneDuration = 9.8;
  const targetSceneCount = Math.max(2, Math.round(targetDuration / targetSceneDuration));
  const sceneTargetSec = Math.round((targetDuration / targetSceneCount) * 10) / 10;
  const targetWords = Math.max(12, Math.round((sceneTargetSec - 1.0) * 2.4));
  const wordMin = Math.max(10, targetWords - 2);
  const wordMax = targetWords + 2;

  console.log(`[Step 1/6] Planning script: calibrated for ${targetDuration}s (${targetSceneCount} scenes, ~${targetWords} words/scene)...`);

  const llmStart = Date.now();
  let scriptData = null;

  if (nexusConfig.hasKey) {
    telemetry.llmRequests++;
    const scriptPrompt = `Write an educational video script for an animated explainer video based on this prompt:
"${prompt}"

Target total duration: ${targetDuration} seconds.
You MUST break the script into EXACTLY ${targetSceneCount} distinct, modular scenes (roughly ${sceneTargetSec} seconds each).

Return your response in pure JSON format with this exact structure:
{
  "title": "Title of the Video",
  "targetDuration": ${targetDuration},
  "scenes": [
    {
      "id": "scene1",
      "sceneNumber": 1,
      "title": "Scene Title",
      "subtitle": "Brief subtitle or concept",
      "layout": "cards",
      "narration": "Narration text calibrated to exactly ${wordMin}-${wordMax} words for natural pacing.",
      "elements": [
        { "title": "Concept", "desc": "Brief explanation", "icon": "✦", "tag": "Core" }
      ]
    }
  ]
}
Return ONLY valid JSON. Keep narrations to ${wordMin}-${wordMax} words per scene so the total video tightly adheres to ${targetDuration} seconds.`;

    const res = await generateScriptWithNexus(scriptPrompt, 'You are an elite educational video producer and scriptwriter. Return ONLY valid JSON.');
    if (res.success) {
      try {
        let clean = res.content.trim();
        if (clean.startsWith('```')) {
          clean = clean.replace(/^```json?\s*/i, '').replace(/```$/, '').trim();
        }
        scriptData = JSON.parse(clean);
        console.log(` -> Successfully generated ${scriptData.scenes.length} calibrated scenes via Nexus AI!`);

        // Record token telemetry if exposed in raw response
        if (res.raw?.usage) {
          telemetry.llmInputTokens = res.raw.usage.prompt_tokens || 0;
          telemetry.llmOutputTokens = res.raw.usage.completion_tokens || 0;
          telemetry.llmReasoningTokens = res.raw.usage.completion_tokens_details?.reasoning_tokens || 0;
          telemetry.llmTotalTokens = res.raw.usage.total_tokens || (telemetry.llmInputTokens + telemetry.llmOutputTokens);
          telemetry.llmSpend = (telemetry.llmInputTokens * 0.00000022) + (telemetry.llmOutputTokens * 0.00000132);
        }
      } catch (err) {
        console.warn(' -> Could not parse LLM output as JSON. Using calibrated structured script engine.');
      }
    }
  }

  // Fallback to structured calibrated script engine
  if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
    console.log(' -> Using calibrated structured scene template engine.');
    scriptData = createDefaultSceneBreakdown(prompt, targetDuration, targetSceneCount);
  }

  telemetry.timings.llmSeconds = (Date.now() - llmStart) / 1000;

  const safeTitle = (outputName || scriptData.title || 'educational_explainer')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const audioDir = path.join(ROOT_DIR, 'assets', 'audio');
  const scenesDir = path.join(ROOT_DIR, 'scenes');
  const tempDir = path.join(ROOT_DIR, 'temp');
  const outputDir = path.join(ROOT_DIR, 'output');

  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(scenesDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const cacheManifest = loadCacheManifest();

  // 2. Synthesize Audio for all scenes via Nexus Polly
  console.log('\n[Step 2/6] Synthesizing narration audio via Nexus AWS Polly...');
  const pollyStart = Date.now();
  const manifestScenes = [];
  const sceneRenderTasks = [];
  let totalCalculatedDuration = 0;

  for (let i = 0; i < scriptData.scenes.length; i++) {
    const s = scriptData.scenes[i];
    const sceneNum = i + 1;
    const audioFileName = `${safeTitle}_scene_${sceneNum}.mp3`;
    const audioPath = path.join(audioDir, audioFileName);

    console.log(` -> Scene ${sceneNum}/${scriptData.scenes.length}: "${s.title}"`);
    const charCount = s.narration ? s.narration.length : 0;
    telemetry.pollyCharacters += charCount;

    // Check if audio file exists and is valid
    const audioExists = fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0;
    if (!audioExists) {
      telemetry.pollyRequests++;
      const speechRes = await generatePollySpeech(s.narration, audioPath);
      if (!speechRes.success) {
        throw new Error(`Failed to synthesize voice for scene ${sceneNum}: ${speechRes.error}`);
      }
    } else {
      console.log(`    (Reusing existing audio: ${audioFileName})`);
    }

    const exactDuration = await getAudioDuration(audioPath);
    // Keep short requested videos within target while preserving a brief breath.
    const padding = targetDuration <= 30 ? 0.5 : 1.0;
    const paddedDuration = Math.round((exactDuration + padding) * 10) / 10;
    totalCalculatedDuration += paddedDuration;

    // 3. Programmatically generate the HTML + GSAP Scene
    const sceneFileName = `${safeTitle}_scene_${sceneNum}.html`;
    const sceneFilePath = path.join(scenesDir, sceneFileName);

    const sceneHtml = generateSceneHtml({
      title: s.title,
      subtitle: s.subtitle || s.visualDescription,
      narration: s.narration,
      layout: s.layout || 'cards',
      elements: s.elements || [],
      duration: paddedDuration
    });
    fs.writeFileSync(sceneFilePath, sceneHtml, 'utf-8');

    // Hash check for scene caching
    const sceneHash = computeHash(`${s.narration}__${sceneHtml}__${paddedDuration}`);
    const sceneFramesDir = path.join(tempDir, `gen_scene_${sceneNum}_frames`);
    const sceneVideoPath = path.join(tempDir, `gen_scene_${sceneNum}.mp4`);

    const isCached = cacheManifest[sceneHash] &&
      fs.existsSync(sceneVideoPath) &&
      fs.statSync(sceneVideoPath).size > 0;

    manifestScenes.push({
      id: `scene${sceneNum}`,
      sceneNumber: sceneNum,
      title: s.title,
      duration: paddedDuration,
      audioDuration: exactDuration,
      audioFile: `assets/audio/${audioFileName}`,
      file: `scenes/${sceneFileName}`,
      narration: s.narration,
      hash: sceneHash,
      isCached
    });

    sceneRenderTasks.push({
      sceneNumber: sceneNum,
      sceneFile: sceneFilePath,
      outputDir: sceneFramesDir,
      audioPath,
      videoPath: sceneVideoPath,
      duration: paddedDuration,
      hash: sceneHash,
      isCached
    });
  }

  telemetry.timings.pollySeconds = (Date.now() - pollyStart) / 1000;
  telemetry.pollySpend = telemetry.pollyCharacters * 0.000004;

  // 4. Update scenes-manifest.json
  console.log('\n[Step 3/6] Generating scenes manifest with synchronized timings...');
  const manifest = {
    title: scriptData.title,
    totalDuration: Math.round(totalCalculatedDuration),
    fps,
    width: 1920,
    height: 1080,
    scenes: manifestScenes
  };

  const manifestPath = path.join(scenesDir, 'scenes-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(` -> Calibrated total duration: ${manifest.totalDuration}s across ${manifest.scenes.length} scenes.`);

  // 5. Parallel Rendering Worker Pool (Playwright)
  console.log('\n[Step 4/6] Deterministic frame rendering via Playwright worker pool...');
  const uncachedTasks = sceneRenderTasks.filter(t => !t.isCached);

  if (uncachedTasks.length > 0) {
    console.log(` -> Rendering ${uncachedTasks.length}/${sceneRenderTasks.length} scenes with ${concurrency} workers...`);
    const poolResult = await renderScenesParallel(uncachedTasks, {
      concurrency,
      fps,
      width: manifest.width,
      height: manifest.height
    });

    telemetry.timings.browserLaunchSeconds = poolResult.browserLaunchSeconds;
    telemetry.timings.renderSeconds = poolResult.totalRenderSeconds;
  } else {
    console.log(` -> All ${sceneRenderTasks.length} scenes found in cache! Zero frames to render.`);
  }

  // 6. Assemble individual scene videos
  console.log('\n[Step 5/6] Encoding scene videos (-preset fast -tune animation)...');
  const sceneAssemblyStart = Date.now();
  const sceneVideoPaths = [];

  for (let i = 0; i < sceneRenderTasks.length; i++) {
    const task = sceneRenderTasks[i];
    if (!task.isCached || !fs.existsSync(task.videoPath)) {
      await assembleSceneVideo({
        framesDir: task.outputDir,
        outputVideoPath: task.videoPath,
        fps,
        duration: task.duration,
        audioPath: task.audioPath
      });
      // Update cache manifest
      cacheManifest[task.hash] = {
        videoPath: task.videoPath,
        updatedAt: new Date().toISOString()
      };
    } else {
      console.log(`[Assembler] Scene ${task.sceneNumber} loaded from cache.`);
    }
    sceneVideoPaths.push(task.videoPath);
  }

  saveCacheManifest(cacheManifest);
  telemetry.timings.sceneAssemblySeconds = (Date.now() - sceneAssemblyStart) / 1000;

  // 7. Concatenate scenes into master video
  console.log('\n[Step 6/6] Assembling final master MP4 video...');
  const finalFileName = `${safeTitle}.mp4`;
  const finalVideoPath = path.join(outputDir, finalFileName);

  const concatResult = await concatenateScenes(sceneVideoPaths, finalVideoPath);
  telemetry.timings.concatSeconds = concatResult.concatSeconds;

  // 8. Validate video file
  const validation = await validateVideoFile(finalVideoPath);
  telemetry.timings.totalPipelineSeconds = (Date.now() - totalPipelineStart) / 1000;

  // Print Comprehensive Benchmark and Telemetry Report
  printBenchmarkReport({
    manifest,
    finalVideoPath,
    validation,
    telemetry,
    concurrency,
    usedCopy: concatResult.usedCopy
  });

  return {
    success: true,
    videoPath: finalVideoPath,
    manifest,
    validation,
    telemetry
  };
}

/**
 * Print detailed performance and cost report.
 */
function printBenchmarkReport({ manifest, finalVideoPath, validation, telemetry, concurrency, usedCopy }) {
  console.log('\n=============================================================');
  console.log('       Video Generation Completed — Performance & Telemetry  ');
  console.log('=============================================================');
  console.log(`Title:          ${manifest.title}`);
  console.log(`File:           ${finalVideoPath}`);
  console.log(`Duration:       ${validation.duration} (Requested target: ${manifest.totalDuration}s)`);
  console.log(`Resolution:     ${validation.resolution} @ ${validation.fps} fps`);
  console.log(`File Size:      ${validation.fileSize}`);
  console.log(`Concat Mode:    ${usedCopy ? 'Fast Stream Copy (-c copy)' : 'Re-encode fallback'}`);
  console.log(`Workers:        ${concurrency} concurrent browser pages`);

  console.log('\n--- Execution Timings Breakdown ---');
  console.log(`1. LLM Script Generation:       ${telemetry.timings.llmSeconds.toFixed(2)}s`);
  console.log(`2. Polly Voice Narration:       ${telemetry.timings.pollySeconds.toFixed(2)}s`);
  console.log(`3. Browser Launch & Setup:      ${telemetry.timings.browserLaunchSeconds.toFixed(2)}s`);
  console.log(`4. Frame-by-Frame Rendering:    ${telemetry.timings.renderSeconds.toFixed(2)}s`);
  console.log(`5. Scene FFmpeg Encoding:       ${telemetry.timings.sceneAssemblySeconds.toFixed(2)}s`);
  console.log(`6. Master Concatenation:        ${telemetry.timings.concatSeconds.toFixed(2)}s`);
  console.log(`-------------------------------------------------------------`);
  console.log(`TOTAL PIPELINE TIME:            ${telemetry.timings.totalPipelineSeconds.toFixed(2)}s (${(telemetry.timings.totalPipelineSeconds / 60).toFixed(2)} min)`);

  console.log('\n--- API Credits & Token Consumption ---');
  console.log(`Nexus LLM Requests:             ${telemetry.llmRequests}`);
  console.log(`LLM Tokens (Input):             ${telemetry.llmInputTokens}`);
  console.log(`LLM Tokens (Output):            ${telemetry.llmOutputTokens} (Reasoning: ${telemetry.llmReasoningTokens})`);
  console.log(`LLM Tokens (Total):             ${telemetry.llmTotalTokens}`);
  console.log(`Nexus LLM Cost:                 $${telemetry.llmSpend.toFixed(6)} (${(telemetry.llmSpend * 10000).toFixed(2)} credits)`);
  console.log(`Polly Requests:                 ${telemetry.pollyRequests} (${telemetry.pollyCharacters} characters)`);
  console.log(`Polly Voice Cost:               $${telemetry.pollySpend.toFixed(6)} (${(telemetry.pollySpend * 10000).toFixed(2)} credits)`);
  console.log(`TOTAL NEXUS API SPEND:          $${(telemetry.llmSpend + telemetry.pollySpend).toFixed(6)} (${((telemetry.llmSpend + telemetry.pollySpend) * 10000).toFixed(2)} credits)`);
  console.log('=============================================================\n');
}

/**
 * Create structured scene breakdown calibrated for target duration.
 */
function createDefaultSceneBreakdown(prompt, targetDuration, sceneCount) {
  const scenes = [];
  const sceneDuration = targetDuration / sceneCount;

  for (let i = 1; i <= sceneCount; i++) {
    scenes.push({
      id: `scene${i}`,
      sceneNumber: i,
      title: i === 1 ? 'Introduction & Core Concept' : i === sceneCount ? 'Conclusion & Future Impact' : `Processing Stage ${i}`,
      subtitle: `Phase ${i} of ${sceneCount}`,
      layout: i === 1 ? 'cards' : i === 2 ? 'flow' : 'hero',
      narration: i === 1
        ? `Welcome to this explainer on ${prompt}. Let's explore how it functions.`
        : i === sceneCount
        ? `Together, these principles drive modern advancements in machine learning.`
        : `Information flows through computational nodes, continuously refining predictions and minimizing error.`,
      elements: [
        { title: `Core Element ${i}`, desc: `Essential component of ${prompt}.`, icon: '✦', tag: `Phase ${i}` }
      ]
    });
  }

  return {
    title: prompt.replace(/^Create (a|an)?\s*/i, '').replace(/video\s*(explaining|about)?/i, '').trim(),
    targetDuration,
    scenes
  };
}
