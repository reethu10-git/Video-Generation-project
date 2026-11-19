---
name: video-generation
description: Full prompt-to-video workflow orchestrator for creating high-definition educational videos using HTML, GSAP, Nexus Polly voiceover, Playwright frame capture, and FFmpeg assembly.
---

# Video Generation Skill

Use this skill when the user wants to generate, modify, or assemble motion-graphics explainer videos from natural language prompts.

## Architecture

```
User Prompt
    │
    ▼
1. Script & Scene Breakdown (Nexus AI / GPT)
    │
    ├──> Narration Text ──> Nexus Polly Audio Synthesis (.mp3)
    │                           │
    │                           ▼
    │                   Audio Duration Measured + Padded (ffprobe)
    │                           │
    └──> Visual Layout Specs ───┼──> Dynamic HTML + GSAP Scenes (.html)
                                │
                                ▼
                        scenes-manifest.json
                                │
                                ▼
                    2. Playwright Headless Browser
                       (Deterministic frame stepping)
                                │
                                ▼
                    3. PNG Frame Capture (1920x1080)
                                │
                                ▼
                    4. FFmpeg Video + Audio Assembly
                                │
                                ▼
                       Final MP4 Master Video
```

## How to Trigger Generation

Execute the master generator script:

```bash
node scripts/generate-video.js --prompt "<TOPIC_OR_INSTRUCTION>" --duration <SECONDS>
```

Parameters:
* `--prompt`, `-p`: Natural language topic or prompt (e.g. `"How Convolutional Neural Networks Work"`)
* `--duration`, `-d`: Target video duration in seconds (default: 60)
* `--fps`: Frame rate for rendering (default: 30)
* `--output`, `-o`: Custom output filename (optional)

## Scene Layout Archetypes

When generating or editing HTML scenes:
* **`cards`**: 3-column glowing glassmorphic feature cards with icons and tags.
* **`flow`**: Step-by-step horizontal computational pipeline connected by directional neon arrows.
* **`tokens`**: Discrete linguistic/data unit blocks with IDs and type badges.
* **`diagram`**: Multi-panel architectural visualization or network graph.
* **`hero`**: Central highlighted insight with large high-impact typography.

## Quality Standards

* **1920x1080 Fixed Canvas**: Always enforce viewport bounds.
* **Deterministic Stepping**: All animation is controlled via `window.seekTimeline(timeInSeconds)`.
* **Zero Frame Drops**: Because Playwright steps the timeline programmatically, every single frame renders cleanly at exact intervals.
