import fs from 'fs';
import path from 'path';
import { generateScriptWithNexus } from '../src/nexus.js';

async function main() {
  console.log('=== Calling Nexus AI (gpt-5.6-luna) for Transformer Video Script ===\n');

  const prompt = `Write a comprehensive, professional educational video script for a 90-second animated explainer video titled:
"How Transformers Work in Artificial Intelligence"

Structure the script into exactly 9 distinct scenes (approximately 10 seconds per scene, totaling 90 seconds).
The 9 scenes must cover:
Scene 1: Introduction - Why Transformers revolutionized AI, shifting from sequential processing to parallel attention.
Scene 2: The Problem with Traditional Sequential Models - How RNNs and LSTMs struggled with long-range dependencies and slow sequential bottlenecks.
Scene 3: What Are Tokens? - Breaking raw text and sentences into discrete computational units (words, subwords, punctuation).
Scene 4: Token Embeddings and Positional Encoding - Converting tokens to rich continuous vectors and injecting mathematical order via sinusoidal positional encodings.
Scene 5: Self-Attention - How words dynamically communicate and understand relationships across the entire sentence simultaneously.
Scene 6: Query, Key, and Value - The database lookup analogy: Query vectors search Key vectors to weight and extract Value information.
Scene 7: Multi-Head Attention - Running multiple attention heads in parallel to capture distinct linguistic perspectives (syntax, semantics, coreference).
Scene 8: Feed-Forward Networks and Transformer Layers - Residual connections, LayerNorm, and feed-forward networks refining representations layer by layer.
Scene 9: Conclusion - How this scalable architecture powers modern foundation models, LLMs, and modern artificial intelligence.

Return your response in pure JSON format with this exact structure:
{
  "title": "How Transformers Work in Artificial Intelligence",
  "targetDuration": 90,
  "scenes": [
    {
      "id": "scene1",
      "sceneNumber": 1,
      "title": "Introduction: The Transformer Revolution",
      "visualDescription": "...",
      "narration": "..."
    },
    ...
  ]
}
Make sure each scene's narration is clear, engaging, educational, and paced for roughly 18-25 words (about 8-10 seconds when spoken clearly).`;

  const res = await generateScriptWithNexus(prompt, 'You are an elite AI researcher, video director, and pedagogical scriptwriter. Return ONLY valid JSON.');

  if (!res.success) {
    console.error('❌ Nexus Script Generation failed:', res.error);
    process.exit(1);
  }

  console.log('✅ Nexus AI Script Generation Successful!');
  console.log('Model used:', res.model);

  // Extract JSON from response (handling potential markdown code fences)
  let cleanJson = res.content.trim();
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```json?\s*/i, '').replace(/```$/, '').trim();
  }

  const parsed = JSON.parse(cleanJson);
  const outPath = path.resolve('scenes', 'transformers-script.json');
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2));
  console.log(`Saved generated script to: ${outPath}`);
  console.log(`Total scenes generated: ${parsed.scenes.length}`);

  parsed.scenes.forEach(s => {
    console.log(`\nScene ${s.sceneNumber}: ${s.title}`);
    console.log(`Narration: "${s.narration}"`);
  });
}

main().catch(err => {
  console.error('Fatal error in script generation:', err);
  process.exit(1);
});
