/**
 * Validates AI-generated task JSON response
 */

export interface TaskGenerationSchema {
  title: string;
  topic: string;
  difficulty: number;
  theoryMarkdown: string;
  practicalTask: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  examples: Array<{
    input: string;
    output: string;
    explanation: string;
  }>;
  codeTemplate: string;
}

/**
 * Validates and normalizes task generation response
 */
export function validateTaskGenerationResponse(data: any): TaskGenerationSchema {
  // Check if it's an object
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response: expected object');
  }

  // Required fields validation
  const errors: string[] = [];

  if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('title must be a non-empty string');
  }

  if (typeof data.topic !== 'string' || !data.topic.trim()) {
    errors.push('topic must be a non-empty string');
  }

  if (typeof data.difficulty !== 'number' || data.difficulty < 1 || data.difficulty > 5) {
    errors.push('difficulty must be a number between 1 and 5');
  }

  if (typeof data.theoryMarkdown !== 'string' || !data.theoryMarkdown.trim()) {
    errors.push('theoryMarkdown must be a non-empty string');
  }

  if (typeof data.practicalTask !== 'string' || !data.practicalTask.trim()) {
    errors.push('practicalTask must be a non-empty string');
  }

  if (typeof data.inputFormat !== 'string') {
    errors.push('inputFormat must be a string');
  }

  if (typeof data.outputFormat !== 'string') {
    errors.push('outputFormat must be a string');
  }

  if (typeof data.constraints !== 'string') {
    errors.push('constraints must be a string');
  }

  if (!Array.isArray(data.examples)) {
    errors.push('examples must be an array');
  } else {
    data.examples.forEach((ex: any, idx: number) => {
      if (typeof ex.input !== 'string') {
        errors.push(`examples[${idx}].input must be a string`);
      }
      if (typeof ex.output !== 'string') {
        errors.push(`examples[${idx}].output must be a string`);
      }
      if (typeof ex.explanation !== 'string') {
        errors.push(`examples[${idx}].explanation must be a string`);
      }
    });
  }

  if (typeof data.codeTemplate !== 'string' || !data.codeTemplate.trim()) {
    errors.push('codeTemplate must be a non-empty string');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  // Normalize and return
  return {
    title: data.title.trim(),
    topic: data.topic.trim(),
    difficulty: Math.max(1, Math.min(5, Math.round(data.difficulty))),
    theoryMarkdown: data.theoryMarkdown.trim(),
    practicalTask: data.practicalTask.trim(),
    inputFormat: (data.inputFormat || '').trim(),
    outputFormat: (data.outputFormat || '').trim(),
    constraints: (data.constraints || '').trim(),
    examples: (data.examples || []).map((ex: any) => ({
      input: String(ex.input || '').trim(),
      output: String(ex.output || '').trim(),
      explanation: String(ex.explanation || '').trim(),
    })),
    codeTemplate: data.codeTemplate.trim(),
  };
}

/**
 * Simple JSON extraction: find first { and last }
 * This is more reliable than complex brace counting
 * Based on Python service approach
 */
export function extractJsonObject(text: string): string {
  // Remove markdown code blocks first
  let cleaned = text.trim();
  const codeBlockStart = cleaned.indexOf('```');
  if (codeBlockStart !== -1) {
    const codeBlockEnd = cleaned.lastIndexOf('```');
    if (codeBlockEnd !== -1 && codeBlockEnd > codeBlockStart) {
      cleaned = cleaned.substring(codeBlockStart + 3, codeBlockEnd);
      // Remove language tag if present
      cleaned = cleaned.replace(/^(?:json|JSON)\s*/i, '');
      cleaned = cleaned.trim();
    }
  }
  
  // Simple extraction: first { to last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output');
  }
  return cleaned.substring(start, end + 1);
}

/**
 * Attempts to fix common JSON formatting issues
 * Simplified approach based on Python service
 */
export function tryFixJsonResponse(content: string): any {
  try {
    // Simple extraction: first { to last }
    const jsonStr = extractJsonObject(content);
    
    // Try to parse
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Fix common issues: trailing commas
      const fixed = jsonStr.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(fixed);
    }
  } catch (e) {
    throw new Error(`Failed to extract/parse JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}
