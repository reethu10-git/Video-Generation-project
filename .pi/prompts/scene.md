---
description: Create or inspect a specific animated HTML GSAP scene.
---

Create or customize a specific scene for the video generator:

**Scene Target:** $1

### Instructions:
1. Review the existing scene in `scenes/` if it exists, or author a new scene HTML file using `templates/base-scene.html`.
2. Ensure `window.seekTimeline(timeInSeconds)` is implemented and linked to the master GSAP timeline.
3. Update `scenes/scenes-manifest.json` with the updated scene duration, audio path, and narration.
