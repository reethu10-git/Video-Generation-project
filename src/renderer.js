import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Render a single HTML scene on an existing Playwright page.
 * Avoids re-launching the browser process.
 *
 * @param {import('playwright').Page} page
 * @param {Object} options
 * @param {string} options.sceneFile - Relative or absolute path to scene HTML
 * @param {string} options.outputDir - Directory where PNG frames will be saved
 * @param {number} options.duration - Duration in seconds
 * @param {number} [options.fps=30] - Frame rate
 * @param {number} [options.width=1920] - Frame width
 * @param {number} [options.height=1080] - Frame height
 */
export async function renderSceneWithPage(page, {
  sceneFile,
  outputDir,
  duration,
  fps = 30,
  width = 1920,
  height = 1080
}) {
  const resolvedScenePath = path.isAbsolute(sceneFile)
    ? sceneFile
    : path.resolve(ROOT_DIR, sceneFile);

  if (!fs.existsSync(resolvedScenePath)) {
    throw new Error(`Scene file not found: ${resolvedScenePath}`);
  }

  // Ensure output directory exists and is clean
  fs.mkdirSync(outputDir, { recursive: true });

  const totalFrames = Math.ceil(duration * fps);
  const sceneName = path.basename(sceneFile);
  console.log(`[Renderer] Loading: ${sceneName} (${duration}s @ ${fps}fps = ${totalFrames} frames)`);

  const startTime = Date.now();

  // Navigate to scene HTML file URL
  const fileUrl = `file://${resolvedScenePath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'load' });

  // Wait for fonts & assets
  await page.evaluate(async () => {
    if (document.fonts) {
      await document.fonts.ready;
    }
  });

  // Verify GSAP timeline hook exists
  const hasSeekHook = await page.evaluate(() => typeof window.seekTimeline === 'function');
  if (!hasSeekHook) {
    console.warn(`[Renderer] Warning: window.seekTimeline is not defined in ${sceneFile}. Fallback timing will be used.`);
  }

  // Frame capture loop
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const currentTime = frameIndex / fps;

    if (hasSeekHook) {
      await page.evaluate((t) => window.seekTimeline(t), currentTime);
    }

    const frameName = `frame_${String(frameIndex).padStart(5, '0')}.png`;
    const framePath = path.join(outputDir, frameName);

    await page.screenshot({
      path: framePath,
      type: 'png'
    });

    if ((frameIndex + 1) % 45 === 0 || frameIndex === totalFrames - 1) {
      const pct = Math.round(((frameIndex + 1) / totalFrames) * 100);
      process.stdout.write(`\r[Renderer] ${sceneName}: ${frameIndex + 1} / ${totalFrames} frames (${pct}%)`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n[Renderer] ${sceneName} frame capture complete in ${elapsed}s.`);

  return {
    outputDir,
    totalFrames,
    fps,
    duration,
    renderTimeSeconds: parseFloat(elapsed)
  };
}

/**
 * Render multiple scenes concurrently using a shared browser instance and worker pool.
 *
 * @param {Array<Object>} sceneTasks - List of scene configurations
 * @param {Object} [options]
 * @param {number} [options.concurrency=2] - Number of parallel workers
 * @param {number} [options.fps=30] - Frame rate
 * @param {number} [options.width=1920] - Frame width
 * @param {number} [options.height=1080] - Frame height
 * @returns {Promise<{ results: Array<any>, totalRenderSeconds: number, browserLaunchSeconds: number }>}
 */
export async function renderScenesParallel(sceneTasks, {
  concurrency = 2,
  fps = 30,
  width = 1920,
  height = 1080
} = {}) {
  const browserLaunchStart = Date.now();
  console.log(`\n[Renderer Pool] Launching single persistent Chromium browser (Concurrency: ${concurrency})...`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--allow-file-access-from-files',
      '--disable-web-security',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding'
    ]
  });

  const browserLaunchSeconds = (Date.now() - browserLaunchStart) / 1000;
  console.log(`[Renderer Pool] Browser launched in ${browserLaunchSeconds.toFixed(2)}s.`);

  const renderStart = Date.now();
  const results = new Array(sceneTasks.length);
  const queue = sceneTasks.map((task, index) => ({ task, index }));

  // Worker loop
  async function worker(workerId) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1
    });

    try {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        console.log(`[Worker ${workerId}] Assigned Scene ${item.index + 1}/${sceneTasks.length}`);

        const result = await renderSceneWithPage(page, {
          sceneFile: item.task.sceneFile,
          outputDir: item.task.outputDir,
          duration: item.task.duration,
          fps,
          width,
          height
        });

        results[item.index] = result;
      }
    } finally {
      await page.close();
    }
  }

  // Run workers concurrently
  const activeWorkers = Math.min(concurrency, sceneTasks.length);
  const workerPromises = [];
  for (let w = 1; w <= activeWorkers; w++) {
    workerPromises.push(worker(w));
  }

  await Promise.all(workerPromises);
  await browser.close();

  const totalRenderSeconds = (Date.now() - renderStart) / 1000;
  console.log(`[Renderer Pool] All ${sceneTasks.length} scenes rendered in ${totalRenderSeconds.toFixed(2)}s.`);

  return {
    results,
    totalRenderSeconds,
    browserLaunchSeconds
  };
}

/**
 * Backward-compatible single-scene renderer (Legacy / Fallback).
 */
export async function renderSceneFrames(options) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--allow-file-access-from-files', '--disable-web-security']
  });

  const page = await browser.newPage({
    viewport: { width: options.width || 1920, height: options.height || 1080 },
    deviceScaleFactor: 1
  });

  try {
    return await renderSceneWithPage(page, options);
  } finally {
    await browser.close();
  }
}
