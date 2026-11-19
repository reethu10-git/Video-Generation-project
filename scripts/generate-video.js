#!/usr/bin/env node

/**
 * CLI Video Generator Entry Point
 * Can be run directly or invoked by Pi Coding Harness.
 *
 * Usage:
 *   node scripts/generate-video.js --prompt "Create an educational video explaining neural networks" --duration 45
 */

import { generateVideoFromPrompt } from '../src/orchestrator.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let prompt = '';
  let duration = 60;
  let fps = 30;
  let concurrency = 2;
  let outputName = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--prompt' || arg === '-p') {
      prompt = args[++i];
    } else if (arg === '--duration' || arg === '-d') {
      duration = parseInt(args[++i], 10);
    } else if (arg === '--fps') {
      fps = parseInt(args[++i], 10);
    } else if (arg === '--concurrency' || arg === '-c') {
      concurrency = parseInt(args[++i], 10);
    } else if (arg === '--output' || arg === '-o') {
      outputName = args[++i];
    } else if (!prompt && !arg.startsWith('-')) {
      prompt = arg;
    }
  }

  return { prompt, duration, fps, concurrency, outputName };
}

async function main() {
  const { prompt, duration, fps, concurrency, outputName } = parseArgs();

  if (!prompt) {
    console.log(`
Usage:
  node scripts/generate-video.js --prompt "<topic or prompt>" [--duration <seconds>] [--fps <fps>] [--concurrency <workers>] [--output <filename>]

Examples:
  node scripts/generate-video.js --prompt "How Artificial Neural Networks Work" --duration 45
  node scripts/generate-video.js -p "Introduction to Attention Mechanisms" -d 60 -c 2
`);
    process.exit(1);
  }

  try {
    const result = await generateVideoFromPrompt({
      prompt,
      targetDuration: duration,
      fps,
      concurrency,
      outputName
    });

    console.log(`\n🎉 Success! Video available at: ${result.videoPath}`);
  } catch (err) {
    console.error('\n❌ Video Generation Failed:', err.message);
    process.exit(1);
  }
}

main();
