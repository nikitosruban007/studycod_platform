/**
 * Path aliases configuration for AI Service
 * This file sets up module resolution so that backend modules can be imported correctly
 * 
 * This is needed because LLMOrchestrator uses relative imports like '../utils/taskValidator'
 * which work when executed from backend, but fail when imported from AI Service.
 * 
 * The solution is to ensure NODE_PATH includes backend/src so that relative imports
 * resolve correctly from the backend/src directory structure.
 */

import 'module-alias/register';

// Note: module-alias reads _moduleAliases from package.json
// The aliases are defined there for better compatibility
// However, for relative imports like '../utils/taskValidator' to work,
// we need NODE_PATH to be set to ../backend/src (done in package.json scripts)
