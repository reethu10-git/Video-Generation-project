---
description: Generate a complete motion-graphics explainer video from a topic or prompt.
---

Generate a complete motion-graphics explainer video for the following topic:

**Topic/Prompt:** $1

### Execution Instructions:
1. Break down the topic into 4 to 6 clear, educational scenes.
2. Formulate clear voiceover narration for each scene (~18-25 words each).
3. Execute the automated video generator:
   ```bash
   node scripts/generate-video.js --prompt "$1" --duration 60
   ```
4. Verify the final assembled MP4 in `output/` and present the output details, duration, and scene structure.
