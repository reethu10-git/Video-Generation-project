/**
 * Dynamic HTML + GSAP Scene Generator
 * Programmatically authors self-contained 1920x1080 motion-graphics scenes.
 */

export function generateSceneHtml({
  title,
  subtitle = '',
  narration = '',
  layout = 'cards', // 'cards' | 'diagram' | 'flow' | 'tokens' | 'hero'
  elements = [],
  duration = 10,
  accentColor = '#38bdf8'
}) {
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeNarration = escapeHtml(narration);

  // Generate layout-specific body markup
  let layoutMarkup = '';
  if (layout === 'cards') {
    layoutMarkup = renderCardsLayout(elements, accentColor);
  } else if (layout === 'diagram') {
    layoutMarkup = renderDiagramLayout(elements, accentColor);
  } else if (layout === 'tokens') {
    layoutMarkup = renderTokensLayout(elements, accentColor);
  } else if (layout === 'flow') {
    layoutMarkup = renderFlowLayout(elements, accentColor);
  } else {
    layoutMarkup = renderHeroLayout(elements, accentColor);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }

    body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: #070b14;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #f8fafc;
    }

    #scene-container {
      position: relative;
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 20%, #151e36 0%, #070b14 75%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 70px 100px 60px 100px;
      overflow: hidden;
    }

    /* Ambient background grid */
    .bg-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      pointer-events: none;
      opacity: 0.5;
    }

    /* Header Section */
    .header-zone {
      position: relative;
      z-index: 10;
      text-align: center;
      width: 100%;
      max-width: 1400px;
    }

    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38bdf8;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }

    .title {
      font-size: 52px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
    }

    .subtitle {
      font-size: 22px;
      color: #94a3b8;
      max-width: 900px;
      margin: 0 auto;
      line-height: 1.5;
    }

    /* Main Visual Stage */
    .stage-zone {
      position: relative;
      z-index: 5;
      flex: 1;
      width: 100%;
      max-width: 1600px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 30px 0;
    }

    /* Cards Layout */
    .cards-wrapper {
      display: flex;
      gap: 36px;
      width: 100%;
      justify-content: center;
      align-items: stretch;
    }

    .info-card {
      flex: 1;
      max-width: 440px;
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 20px;
      padding: 36px 32px;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
      overflow: hidden;
    }

    .info-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, ${accentColor}, transparent);
    }

    .card-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      color: #38bdf8;
      margin-bottom: 8px;
    }

    .card-title {
      font-size: 26px;
      font-weight: 700;
      color: #f1f5f9;
    }

    .card-desc {
      font-size: 17px;
      color: #94a3b8;
      line-height: 1.6;
    }

    .card-tag {
      margin-top: auto;
      font-size: 13px;
      font-weight: 600;
      color: ${accentColor};
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    /* Flow Layout */
    .flow-wrapper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 1400px;
      gap: 20px;
    }

    .flow-node {
      flex: 1;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 16px;
      padding: 28px 24px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .flow-arrow {
      font-size: 32px;
      color: ${accentColor};
      opacity: 0.8;
    }

    /* Diagram Layout */
    .diagram-wrapper {
      display: flex;
      gap: 50px;
      width: 100%;
      justify-content: center;
      align-items: center;
    }

    .diagram-panel {
      flex: 1;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 20px;
      padding: 36px;
    }

    /* Subtitle Banner at bottom */
    .narration-bar {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 1300px;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 18px 32px;
      display: flex;
      align-items: center;
      gap: 16px;
      backdrop-filter: blur(16px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }

    .narration-bullet {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${accentColor};
      box-shadow: 0 0 12px ${accentColor};
      flex-shrink: 0;
    }

    .narration-text {
      font-size: 19px;
      font-weight: 500;
      color: #e2e8f0;
      line-height: 1.4;
      flex: 1;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>
<body>
  <div id="scene-container">
    <div class="bg-grid"></div>

    <!-- Header -->
    <div class="header-zone">
      <div class="badge" id="badge-pill">AI Explainer</div>
      <h1 class="title" id="main-title">${safeTitle}</h1>
      ${safeSubtitle ? `<p class="subtitle" id="main-subtitle">${safeSubtitle}</p>` : ''}
    </div>

    <!-- Visual Center Stage -->
    <div class="stage-zone">
      ${layoutMarkup}
    </div>

    <!-- Narration Subtitle Bar -->
    <div class="narration-bar" id="narration-container">
      <div class="narration-bullet"></div>
      <div class="narration-text">${safeNarration}</div>
    </div>
  </div>

  <script>
    // Master Deterministic Timeline
    const tl = gsap.timeline({ paused: true });
    const SCENE_DURATION = ${Number(duration).toFixed(2)};

    // Visual choreography
    tl.fromTo('#badge-pill', 
      { opacity: 0, y: -20 }, 
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.1
    );

    tl.fromTo('#main-title',
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.3
    );

    ${safeSubtitle ? `
    tl.fromTo('#main-subtitle',
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.5
    );` : ''}

    tl.fromTo('.anim-item',
      { opacity: 0, y: 35, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.2, ease: 'back.out(1.4)' }, 0.7
    );

    tl.fromTo('#narration-container',
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.9
    );

    // Subtle breathing highlight during narration
    tl.to('.highlight-glow', {
      boxShadow: '0 0 30px rgba(56, 189, 248, 0.35)',
      duration: 1.5,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    }, 1.5);

    // Deterministic Frame Hook for Playwright
    window.seekTimeline = function(timeInSeconds) {
      tl.seek(timeInSeconds, false);
    };

    // Auto-advance indicator for debugging
    window.__SCENE_DURATION__ = SCENE_DURATION;
  </script>
</body>
</html>`;
}

function renderCardsLayout(elements, accentColor) {
  const cards = (elements && elements.length > 0) ? elements : [
    { title: 'Feature 1', desc: 'Core foundational component.', icon: '⚡', tag: 'Core' },
    { title: 'Feature 2', desc: 'Accelerates processing pipeline.', icon: '🚀', tag: 'Speed' },
    { title: 'Feature 3', desc: 'Scales seamlessly across architectures.', icon: '🌐', tag: 'Scale' }
  ];

  return `
    <div class="cards-wrapper">
      ${cards.map((c, i) => `
        <div class="info-card anim-item ${i === 1 ? 'highlight-glow' : ''}">
          <div class="card-icon">${c.icon || '✦'}</div>
          <h2 class="card-title">${escapeHtml(c.title)}</h2>
          <p class="card-desc">${escapeHtml(c.desc)}</p>
          ${c.tag ? `<div class="card-tag">${escapeHtml(c.tag)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderFlowLayout(elements, accentColor) {
  const nodes = (elements && elements.length > 0) ? elements : [
    { title: 'Input Data', desc: 'Raw information' },
    { title: 'Transformation', desc: 'Processing layers' },
    { title: 'Output Result', desc: 'Actionable insight' }
  ];

  return `
    <div class="flow-wrapper">
      ${nodes.map((n, i) => `
        <div class="flow-node anim-item">
          <h3 style="font-size: 22px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">${escapeHtml(n.title)}</h3>
          <p style="font-size: 15px; color: #94a3b8;">${escapeHtml(n.desc)}</p>
        </div>
        ${i < nodes.length - 1 ? `<div class="flow-arrow anim-item">➔</div>` : ''}
      `).join('')}
    </div>
  `;
}

function renderTokensLayout(elements, accentColor) {
  const tokens = (elements && elements.length > 0) ? elements : [
    { text: 'Transformers', id: '1024', type: 'Word' },
    { text: 'change', id: '532', type: 'Verb' },
    { text: 'modern', id: '891', type: 'Adjective' },
    { text: 'AI', id: '2048', type: 'Acronym' }
  ];

  return `
    <div style="display: flex; gap: 24px; justify-content: center; align-items: center; flex-wrap: wrap;">
      ${tokens.map(t => `
        <div class="anim-item" style="background: rgba(15, 23, 42, 0.85); border: 2px solid rgba(56, 189, 248, 0.4); border-radius: 16px; padding: 24px 32px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
          <div style="font-size: 30px; font-weight: 800; color: #f8fafc; margin-bottom: 8px;">"${escapeHtml(t.text)}"</div>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <span style="font-size: 13px; font-weight: 700; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 4px 10px; border-radius: 6px;">ID: ${escapeHtml(t.id || 'N/A')}</span>
            <span style="font-size: 13px; font-weight: 700; background: rgba(129, 140, 248, 0.15); color: #818cf8; padding: 4px 10px; border-radius: 6px;">${escapeHtml(t.type || 'Token')}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDiagramLayout(elements, accentColor) {
  return renderCardsLayout(elements, accentColor);
}

function renderHeroLayout(elements, accentColor) {
  const primary = elements?.[0] || { title: 'Core Insight', desc: 'Central breakthrough revolutionizing modern computational systems.' };
  return `
    <div class="anim-item" style="text-align: center; max-width: 900px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 24px; padding: 50px 60px; backdrop-filter: blur(16px);">
      <h2 style="font-size: 38px; font-weight: 800; color: #f8fafc; margin-bottom: 20px;">${escapeHtml(primary.title)}</h2>
      <p style="font-size: 22px; color: #cbd5e1; line-height: 1.6;">${escapeHtml(primary.desc)}</p>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
