import { createNodeHandler } from '../server/http-node.js';
import { verify } from '../server/services/reputation.js';

export default createNodeHandler(
  verify,
  () => ({ GOOGLE_SAFE_BROWSING_API_KEY: process.env.GOOGLE_SAFE_BROWSING_API_KEY }),
  { maxBodyBytes: 20_000, errorMessage: 'Could not complete link verification.' },
);
