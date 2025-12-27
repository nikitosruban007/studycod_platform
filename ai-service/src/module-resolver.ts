/**
 * Custom module resolver for AI Service
 * 
 * This resolver intercepts module resolution to fix relative imports
 * in backend modules when they are imported from AI Service.
 * 
 * When LLMOrchestrator.ts imports '../utils/taskValidator', Node.js
 * resolves it relative to the file location. This resolver ensures
 * it resolves correctly from backend/src/services/llm/ to backend/src/utils/
 */

import Module from 'module';
import path from 'path';
import fs from 'fs';

const originalResolveFilename = Module._resolveFilename;
const backendSrc = path.resolve(__dirname, '../../backend/src');

Module._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  // Check if this is a relative import from a backend module
  if (request.startsWith('../') || request.startsWith('./')) {
    // Get the parent module's filename
    const parentFilename = parent?.filename || parent?.id;
    
    if (parentFilename && parentFilename.includes('backend/src')) {
      // This is a relative import from a backend module
      // Resolve it relative to the backend/src directory structure
      const parentDir = path.dirname(parentFilename);
      const resolvedPath = path.resolve(parentDir, request);
      
      // Check if the resolved path exists
      if (fs.existsSync(resolvedPath) || fs.existsSync(resolvedPath + '.ts') || fs.existsSync(resolvedPath + '.js')) {
        return originalResolveFilename.call(this, resolvedPath, parent, isMain, options);
      }
      
      // If not found, try with .ts extension
      const withTs = resolvedPath + '.ts';
      if (fs.existsSync(withTs)) {
        return originalResolveFilename.call(this, withTs, parent, isMain, options);
      }
    }
  }
  
  // Fall back to original resolver
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

