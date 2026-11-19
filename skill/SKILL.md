---
name: html-gsap-video-generator
description: Reusable video-generation skill using HTML5, CSS3, JavaScript, GSAP animations, Playwright browser frame capture, and FFmpeg assembly.
---

# HTML + GSAP Video Generator Skill

This skill guides the automated creation of high-definition (1080p, 60fps/30fps) motion-graphics videos using web technologies (HTML, CSS, JS, GSAP) captured frame-by-frame via headless Playwright and encoded into MP4 with FFmpeg.

## Core Architecture

```
[Prompt / Topic]
       │
       ▼
1. Script & Scene Generation (Nexus AI / Script Engine)
       │
       ├──> Narration Script ──> TTS / Polly Audio Generation
       └──> Visual Scene Spec ──> HTML + GSAP Timelines
                                          │
                                          ▼
                               2. Playwright Headless Browser
                                  (Deterministic Frame Stepping)
                                          │
                                          ▼
                               3. Frame Capture (1920x1080 PNGs)
                                          │
                                          ▼
                               4. FFmpeg Video + Audio Assembly
                                          │
                                          ▼
                                  Final MP4 Output
```

## Scene Construction Standards

1. **Resolution & Canvas**:
   - Fixed viewport: `1920px` width by `1080px` height.
   - Root container styled with `overflow: hidden; position: relative; width: 1920px; height: 1080px;`.
   - Dark modern aesthetics: deep slate/navy backgrounds (`#0a0f1d`, `#0b1120`), high-contrast typography, crisp neon/gradient accents (`#38bdf8`, `#818cf8`, `#34d399`).

2. **GSAP Animation Rules**:
   - Master timeline `gsap.timeline({ paused: true })`.
   - **Deterministic Stepping**:
     To render at exact FPS without frame drops, the timeline is paused and stepped programmatically via `timeline.seek(time)` or `timeline.progress(t)`.
     This guarantees identical, silky-smooth renders independent of CPU/GPU speed.
   - Use standard easing functions (`power2.out`, `power3.inOut`, `back.out(1.7)`).
   - Clean element lifecycle: enter, hold/highlight, exit.

3. **Audio & Narration Synchronization**:
   - Audio is generated per scene using AWS Polly Standard via Nexus voice integration.
   - Scene timeline duration is matched to the exact duration of the scene's voiceover plus padding (e.g. 0.5s pre-roll, 0.5s post-roll).

4. **Playwright Capture Process**:
   - Launch Chromium with viewport `{ width: 1920, height: 1080 }` and device scale factor 1.
   - Wait for fonts and assets to load (`document.fonts.ready`).
   - Calculate total frames: `totalFrames = Math.ceil(durationInSeconds * fps)`.
   - Loop `frameIndex` from 0 to `totalFrames`:
     - `page.evaluate((t) => window.seekTimeline(t), currentTime);`
     - `page.screenshot({ path: framePath, type: 'png' });`

5. **FFmpeg Compilation**:
   - Assemble frames: `ffmpeg -framerate {fps} -i frame_%05d.png -i scene_audio.mp3 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest output.mp4`
   - Concatenate multi-scene outputs seamlessly.
