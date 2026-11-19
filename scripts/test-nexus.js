import path from 'path';
import { getNexusConfig, testNexusTextGeneration, testPollyVoiceIntegration, getPollyConfig } from '../src/nexus.js';

async function main() {
  console.log('=== Nexus API & AWS Polly Connectivity Test ===\n');

  const nexusConfig = getNexusConfig();
  console.log('1. Checking Environment Variables for Nexus:');
  console.log(`   NEXUS_API_URL: ${nexusConfig.url || '(not set)'}`);
  console.log(`   NEXUS_MODEL:   ${nexusConfig.model || 'gpt-5.6-luna'}`);
  console.log(`   NEXUS_API_KEY: ${nexusConfig.hasKey ? '[CONFIGURED - REDACTED]' : '(not set)'}`);

  const pollyConfig = getPollyConfig();
  console.log('\n2. Checking Voice / Polly Configuration:');
  console.log(`   Voice URL:     ${pollyConfig.voiceUrl || '(not set)'}`);
  console.log(`   Model ID:      ${pollyConfig.model} (AWS Polly Standard)`);
  console.log(`   Voice ID:      ${pollyConfig.voiceId || 'Joanna'}`);
  console.log(`   Voice Key:     ${pollyConfig.hasKey ? '[CONFIGURED - REDACTED]' : '(not set)'}`);

  console.log('\n--- Testing Nexus Text Generation (gpt-5.6-luna) ---');
  if (!nexusConfig.hasKey) {
    console.log('⚠️  Nexus API key is not configured.');
  } else {
    console.log('Sending test prompt to Nexus...');
    const textResult = await testNexusTextGeneration();
    if (textResult.success) {
      console.log('✅ Nexus Text Generation SUCCESS!');
      console.log(`   Model:    ${textResult.model}`);
      console.log(`   Response: "${textResult.reply.trim()}"`);
    } else {
      console.log('❌ Nexus Text Generation FAILED:');
      console.log(`   Error: ${textResult.error}`);
    }
  }

  console.log('\n--- Testing AWS Polly Standard Voice Integration (polly-standard) ---');
  if (!pollyConfig.hasKey) {
    console.log('⚠️  Polly voice integration key is not configured.');
  } else {
    console.log('Sending speech synthesis request to Nexus endpoint (/v1/audio/speech)...');
    const voiceResult = await testPollyVoiceIntegration();
    if (voiceResult.success) {
      console.log('✅ AWS Polly Voice Generation SUCCESS!');
      console.log(`   Model:       ${voiceResult.model}`);
      console.log(`   Voice ID:    ${voiceResult.voiceId}`);
      console.log(`   Audio Size:  ${voiceResult.audioBytes} bytes (audio/mpeg)`);
    } else {
      console.log('❌ AWS Polly Voice Generation FAILED:');
      console.log(`   Error: ${voiceResult.error}`);
    }
  }

  console.log('\n=== Test Completed ===');
}

main().catch(err => {
  console.error('Unexpected error running test:', err);
  process.exit(1);
});
