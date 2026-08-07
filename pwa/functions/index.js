import { initializeApp } from 'firebase-admin/app';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { makeExtractCrossword } from './extractCrossword.js';

initializeApp();

// Debe coincidir con VITE_FUNCTIONS_REGION en el .env del front.
setGlobalOptions({ region: 'us-central1' });

/**
 * API key de Anthropic. Se guarda en Secret Manager, nunca en el repo:
 *
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 */
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

export const extractCrossword = makeExtractCrossword(anthropicApiKey);
export { checkWordCompletion } from './checkWordCompletion.js';
