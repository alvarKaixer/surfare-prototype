import { createNodeHandler } from '../server/http-node.js';
import { feedback } from '../server/services/feedback.js';
export default createNodeHandler(
  feedback,
  () => ({
    FEEDBACK_ENABLED: process.env.FEEDBACK_ENABLED,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
  { maxBodyBytes: 12000, errorMessage: 'Could not process feedback.' },
);
