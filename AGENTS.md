# AGENTS.md - Pi Coding Harness Video Generation Instructions

Welcome to the **HTML + GSAP Video Generator** project.
As **Pi**, you are the **primary orchestrator and director** of this end-to-end prompt-to-video production system.

---

## 1. System Overview & Technology Stack

This system converts high-level natural language prompts into complete, high-definition (1080p, 30fps) motion-graphics explainer videos with synchronized voiceover narration.

* **Pi Coding Harness (`pi`)**: Master orchestrator. You interpret user requests, plan scripts, author or modify scene code, and trigger automated builds.
* **Nexus API (`src/nexus.js`)**: AI text generation (GPT) and AWS Polly Standard voiceover synthesis (`Joanna`).
* **HTML5, CSS3, & GSAP (`src/scene-generator.js`, `scenes/*.html`)**: Dynamic scene layouts with deterministic time-stepped animation.
* **Playwright (`src/renderer.js`)**: Headless Chromium frame-by-frame capture engine (1920x1080).
* **FFmpeg (`src/assembler.js`)**: Sequence frame stitcher, audio muxer, scene concatenator, and MP4 validator.

---

## 2. Standard User Workflow in Pi

When a user prompts you in Pi:
> *"Create a 60-second educational video explaining neural networks."*

You coordinate the complete workflow through these exact stages:

1. **Script & Scene Breakdown**:
   * Determine the target duration (e.g., 60 seconds).
   * Plan 4 to 7 modular scenes (~8–12 seconds per scene).
   * Define clear, educational narration (18–25 words per scene) and visual specs.
2. **Audio Synthesis (Nexus Polly)**:
   * Narrations are synthesized to MP3 files via `generatePollySpeech()` in `src/nexus.js`.
   * The exact audio duration is measured via `ffprobe`, with 1.2s padding added (0.4s pre-roll, 0.8s post-roll) to ensure natural speech pacing.
3. **Dynamic HTML + GSAP Scene Creation**:
   * Each scene is created or updated as an HTML file in `scenes/` using `src/scene-generator.js`.
   * Scenes adhere to strict 1920x1080 canvas dimensions and modern dark slate styling.
   * Animation timelines are paused (`gsap.timeline({ paused: true })`) and stepped via `window.seekTimeline(t)`.
4. **Scenes Manifest Registration**:
   * Scene metadata, timings, audio files, and HTML paths are synchronized in `scenes/scenes-manifest.json`.
5. **Frame Capture & Video Assembly**:
   * Playwright steps through every frame and captures PNG screenshots.
   * FFmpeg encodes frames with audio into scene MP4s, then concatenates them into the final video at `output/<title>.mp4`.
   * Video validity (duration, resolution, audio track) is verified automatically.

---

## 3. Available Commands for Pi

You can execute the automated pipeline directly via terminal tools:

```bash
# Generate a complete video from a prompt
node scripts/generate-video.js --prompt "Create an educational video explaining neural networks" --duration 60

# Test Nexus API & Polly connectivity
npm run test:nexus

# Run existing scene manifest pipeline
npm run pipeline
```

---

## 4. Scene Authoring & GSAP Animation Rules

When writing or modifying scenes in `scenes/`:

1. **Resolution & Canvas**:
   * Exact container: `width: 1920px; height: 1080px; overflow: hidden; position: relative;`
   * Modern dark theme: `#070b14` to `#151e36` background gradients, `#38bdf8` (sky blue) or `#818cf8` (indigo) neon accents.
2. **Deterministic Stepping Hook (MANDATORY)**:
   * Every scene **must** expose:
     ```javascript
     window.seekTimeline = function(timeInSeconds) {
       tl.seek(timeInSeconds, false);
     };
     ```
   * Never rely on live `requestAnimationFrame` or `setTimeout` for motion timing. Frame stepping must be purely deterministic.
3. **Audio-Animation Sync**:
   * Match the scene timeline duration to the padded audio duration from `scenes-manifest.json`.
4. **Element Lifecycle**:
   * Elements should smoothly enter (`power2.out`, `back.out`), hold/highlight during key speech, and cleanly transition.

---

## 5. Environment Variables & Security

* Credentials are read from `.env` (`NEXUS_API_KEY`, `NEXUS_API_URL`, `POLLY_VOICE_ID`).
* **Never hardcode or expose API keys** in generated scripts, HTML files, or Git commits.
* If credentials are missing, point the user to `.env.example`.
