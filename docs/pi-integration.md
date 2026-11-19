# Pi Coding Harness Integration Guide

This guide details how **Pi Coding Harness** (`@earendil-works/pi-coding-agent`) is integrated into the HTML + GSAP Video Generator as the primary orchestrating agent and how **Nexus API** is configured as its native LLM provider.

---

## 1. What Pi Coding Harness Does

Pi Coding Harness is the central coordinator and director of the entire prompt-to-video workflow:
* **Interprets User Prompts**: Parses natural language requests such as *"Create a 60-second educational video explaining neural networks"*.
* **Reasons with Nexus LLM**: Uses **Nexus AI (`gpt-5.6-luna` / `gpt-6-luna`)** for script ideation, scene planning, and GSAP animation design.
* **Separates Voice & Text Pipelines**:
  * **Nexus LLM (`/v1/chat/completions`)**: Powers Pi's reasoning, coding, and scene generation.
  * **Nexus Polly (`/v1/audio/speech`)**: Powers studio-grade voiceover narration (`polly-standard`, `Joanna`).
* **Coordinates Subsystems**: Bridges Nexus LLM, Nexus Polly voiceover, dynamic HTML/GSAP scene authoring, Playwright frame capture, and FFmpeg video assembly.
* **Maintains Consistency**: Enforces strict 1920x1080 resolution, dark slate modern aesthetics, deterministic animation stepping (`window.seekTimeline`), and millisecond-accurate audio sync.

---

## 2. Nexus API Provider Configuration in Pi

Pi communicates with the **Navigate Labs Nexus API** via its native **OpenAI-compatible completions protocol** (`openai-completions`).

### `models.json` Configuration (`~/.pi/agent/models.json` & `.pi/models.json`)

```json
{
  "$schema": "https://pi.dev/schemas/models.schema.json",
  "providers": {
    "nexus": {
      "name": "Nexus AI",
      "baseUrl": "https://nexusapi.navigatelabs.ai/v1",
      "api": "openai-completions",
      "apiKey": "$NEXUS_API_KEY",
      "models": [
        {
          "id": "gpt-5.6-luna",
          "name": "Nexus GPT-5.6 Luna",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 16384
        },
        {
          "id": "gpt-6-luna",
          "name": "Nexus GPT-6 Luna",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 16384
        },
        {
          "id": "claude-haiku-5-5",
          "name": "Nexus Claude Haiku 5.5",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 200000,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

### Stored Authentication (`~/.pi/agent/auth.json`)

Authentication is managed securely through Pi's native credential store:
```json
{
  "nexus": {
    "type": "api_key",
    "key": "sk-..."
  }
}
```
*(Or dynamically via the `NEXUS_API_KEY` environment variable in `.env`).*

### Default Model Selection (`~/.pi/agent/settings.json`)

To make Nexus the default provider without needing manual flags on launch:
```json
{
  "defaultProvider": "nexus",
  "defaultModel": "gpt-5.6-luna"
}
```

---

## 3. Project Configuration & Discovery

Pi automatically detects project-specific context and capabilities through these files:

* **`AGENTS.md` (Project Root)**: Pi's executive operational guide for video orchestration, canvas standards (1920x1080), and deterministic GSAP rules.
* **`.pi/skills/video-generation/SKILL.md`**: Video generation capability specification covering scene archetypes (`cards`, `flow`, `tokens`, `diagram`, `hero`).
* **`.pi/prompts/video.md`**: `/video` template for launching video generation directly from the Pi TUI.
* **`.pi/prompts/scene.md`**: `/scene` template for generating or editing specific scenes.

---

## 4. How to Launch and Select Models in Pi

### 1. Check Available Models
Run the model discovery command to verify that Nexus models are registered:
```bash
pi --list-models
```
Output:
```text
provider  model             context  max-out  thinking  images
nexus     claude-haiku-5-5  200K     8.2K     no        no    
nexus     gpt-5.6-luna      128K     16.4K    yes       no    
nexus     gpt-6-luna        128K     16.4K    yes       no    
```

### 2. Interactive Model Selection in Pi TUI
Launch Pi:
```bash
pi
```
* Type `/model` to open the interactive model picker.
* Select `Nexus GPT-5.6 Luna`, `Nexus GPT-6 Luna`, or `Nexus Claude Haiku 5.5`.
* Press `Ctrl+S` to lock in your preferred model as the session default.

### 3. Specify Model on CLI
```bash
pi --model nexus/gpt-5.6-luna -p "Generate a video script for neural networks"
```

---

## 5. End-to-End Workflow Execution

1. **User Request**: User prompts Pi: *"Create a 60-second educational video explaining neural networks"*.
2. **Script Planning**: Pi queries Nexus LLM (`gpt-5.6-luna`) to construct 4–7 scenes with visual layout parameters and narration.
3. **Voice Synthesis**: Narration is sent to Nexus Polly Standard (`Joanna`), generating crystal-clear MP3 files.
4. **Timing Sync**: `ffprobe` measures audio durations down to the millisecond; 1.2s padding is added for natural breath pacing.
5. **Scene Authoring**: `src/scene-generator.js` builds production HTML5/GSAP scenes with `window.seekTimeline(t)`.
6. **Frame Capture**: Playwright captures all frames deterministically at 1920x1080.
7. **Assembly**: FFmpeg muxes audio and frames, concatenates the scenes, and produces the final MP4 in `output/`.

---

## 6. Testing & Connectivity Verification

| Test Target | Command | Expected Output |
| :--- | :--- | :--- |
| **Model Registration** | `pi --list-models` | Shows `nexus` provider and models (`gpt-5.6-luna`, `gpt-6-luna`, `claude-haiku-5-5`) |
| **Nexus LLM Generation** | `pi -p "Say hello in 5 words"` | Direct text completion from Nexus GPT-5.6 Luna |
| **Nexus Polly Voice** | `npm run test:nexus` | Confirms speech synthesis via `/v1/audio/speech` (29KB MP3) |
| **Full Video Pipeline** | `node scripts/generate-video.js -p "..." -d 30` | Assembles validated 1080p MP4 with video + voice |

---

## 7. Troubleshooting

* **"No models available"**:
  Ensure `~/.pi/agent/models.json` has the `nexus` provider defined and either `auth.json` contains the API key or `NEXUS_API_KEY` is exported in the shell environment.
* **"Failed to synthesize voice: HTTP 401"**:
  Verify `NEXUS_API_KEY` in `.env` starts with `sk-`. Run `npm run test:nexus` to verify credential validity.
* **Non-interactive terminal pauses on Windows**:
  In automated scripts or non-interactive PowerShell environments, close standard input using `$null | pi -p "..."`.
