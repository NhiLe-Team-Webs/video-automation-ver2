/**
 * Combined server that runs both API and Worker in same process
 * This allows job storage to work with in-memory Map
 */

import './server'; // Start API server
import './worker'; // Start worker in same process

console.log('✅ Combined server started (API + Worker in same process)');
