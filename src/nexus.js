import fs from 'fs';
import path from 'path';

try {
  const dotenv = await import('dotenv');
  dotenv.default.config();
} catch (e) {
  // dotenv not installed; environment variables will be read directly
}

export function getNexusConfig() {
  const url = process.env.NEXUS_API_URL || 'https://nexusapi.navigatelabs.ai/v1';
  const key = process.env.NEXUS_API_KEY;
  const model = process.env.NEXUS_MODEL || 'gpt-5.6-luna';

  const isConfigured = Boolean(url && key && key !== 'your_nexus_api_key_here');
  return {
    url,
    model,
    isConfigured,
    // Never expose the actual key string
    hasKey: Boolean(key && key !== 'your_nexus_api_key_here')
  };
}

export function getPollyConfig() {
  const voiceUrl = process.env.NEXUS_VOICE_URL || process.env.NEXUS_API_URL || 'https://nexusapi.navigatelabs.ai/v1';
  const voiceKey = process.env.NEXUS_VOICE_API_KEY || process.env.NEXUS_API_KEY;
  const voiceId = process.env.POLLY_VOICE_ID || 'Joanna';
  const model = 'polly-standard'; // Verified Nexus Model ID for AWS Polly Standard

  const isConfigured = Boolean(voiceUrl && voiceKey && voiceKey !== 'your_nexus_api_key_here');
  return {
    voiceUrl,
    voiceId,
    model,
    isConfigured,
    hasKey: Boolean(voiceKey && voiceKey !== 'your_nexus_api_key_here')
  };
}

/**
 * Test Nexus AI text generation connectivity.
 */
export async function testNexusTextGeneration() {
  const config = getNexusConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      error: 'Nexus credentials are not configured. Please set NEXUS_API_URL and NEXUS_API_KEY in your .env file.'
    };
  }

  try {
    const endpoint = `${config.url.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXUS_API_KEY}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are an educational video scriptwriter.' },
          { role: 'user', content: 'Say "Nexus API text generation connection successful!" in under 10 words.' }
        ],
        max_tokens: 30
      })
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = response.statusText;
      }
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${errorBody || response.statusText}`
      };
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || JSON.stringify(data);
    return {
      success: true,
      model: config.model,
      reply
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Generate a complete educational video script using Nexus GPT (gpt-5.6-luna).
 *
 * @param {string} prompt - Topic and requirements for the script
 * @param {string} [systemPrompt] - System instructions
 * @returns {Promise<{ success: boolean, content?: string, raw?: any, error?: string }>}
 */
export async function generateScriptWithNexus(prompt, systemPrompt = 'You are a world-class AI educator and motion-graphics video director.') {
  const config = getNexusConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      error: 'Nexus credentials are not configured.'
    };
  }

  try {
    const endpoint = `${config.url.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXUS_API_KEY}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${err}`
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return {
      success: true,
      content,
      model: config.model,
      raw: data
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Synthesize speech audio using AWS Polly Standard via Navigate Labs Nexus.
 *
 * @param {string} text - Narration text to synthesize
 * @param {string} [outputPath] - Optional file path to save the generated mp3
 * @returns {Promise<{ success: boolean, buffer?: Buffer, outputPath?: string, error?: string }>}
 */
export async function generatePollySpeech(text, outputPath = null) {
  const config = getPollyConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      error: 'Nexus Voice / Polly configuration is missing or NEXUS_API_KEY is not set.'
    };
  }

  try {
    const endpoint = `${config.voiceUrl.replace(/\/+$/, '')}/audio/speech`;
    const key = process.env.NEXUS_VOICE_API_KEY || process.env.NEXUS_API_KEY;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: config.model, // polly-standard
        input: text,
        voice: config.voiceId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);
    }

    return {
      success: true,
      buffer,
      outputPath,
      audioBytes: buffer.length,
      voiceId: config.voiceId,
      model: config.model
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Test AWS Polly voice integration using model 'polly-standard'.
 */
export async function testPollyVoiceIntegration() {
  return generatePollySpeech('Testing AWS Polly Standard voice integration through Navigate Labs Nexus.');
}
