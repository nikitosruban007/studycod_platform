"use strict";
/**
 * Validates AI-generated task JSON response
 *
 * Shared module used by both backend and ai-service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTaskGenerationResponse = validateTaskGenerationResponse;
exports.tryFixJsonResponse = tryFixJsonResponse;
/**
 * Validates and normalizes task generation response
 */
function validateTaskGenerationResponse(data) {
    // Check if it's an object
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid response: expected object');
    }
    // Required fields
    const required = ['title', 'topic', 'difficulty', 'theoryMarkdown', 'practicalTask', 'inputFormat', 'outputFormat', 'constraints', 'examples', 'codeTemplate'];
    for (const field of required) {
        if (!(field in data)) {
            throw new Error(`Invalid response: missing required field '${field}'`);
        }
    }
    // Validate types
    if (typeof data.title !== 'string')
        throw new Error('Invalid response: title must be string');
    if (typeof data.topic !== 'string')
        throw new Error('Invalid response: topic must be string');
    if (typeof data.difficulty !== 'number')
        throw new Error('Invalid response: difficulty must be number');
    if (typeof data.theoryMarkdown !== 'string')
        throw new Error('Invalid response: theoryMarkdown must be string');
    if (typeof data.practicalTask !== 'string')
        throw new Error('Invalid response: practicalTask must be string');
    if (typeof data.inputFormat !== 'string')
        throw new Error('Invalid response: inputFormat must be string');
    if (typeof data.outputFormat !== 'string')
        throw new Error('Invalid response: outputFormat must be string');
    if (typeof data.constraints !== 'string')
        throw new Error('Invalid response: constraints must be string');
    if (!Array.isArray(data.examples))
        throw new Error('Invalid response: examples must be array');
    if (typeof data.codeTemplate !== 'string')
        throw new Error('Invalid response: codeTemplate must be string');
    // Validate examples
    for (let i = 0; i < data.examples.length; i++) {
        const ex = data.examples[i];
        if (!ex || typeof ex !== 'object') {
            throw new Error(`Invalid response: example ${i} must be object`);
        }
        if (typeof ex.input !== 'string')
            throw new Error(`Invalid response: example ${i}.input must be string`);
        if (typeof ex.output !== 'string')
            throw new Error(`Invalid response: example ${i}.output must be string`);
        if (ex.explanation && typeof ex.explanation !== 'string') {
            throw new Error(`Invalid response: example ${i}.explanation must be string if present`);
        }
    }
    // Normalize and return
    return {
        title: String(data.title).trim(),
        topic: String(data.topic).trim(),
        difficulty: Number(data.difficulty),
        theoryMarkdown: String(data.theoryMarkdown).trim(),
        practicalTask: String(data.practicalTask).trim(),
        inputFormat: String(data.inputFormat).trim(),
        outputFormat: String(data.outputFormat).trim(),
        constraints: String(data.constraints).trim(),
        examples: data.examples.map((ex) => ({
            input: String(ex.input).trim(),
            output: String(ex.output).trim(),
            explanation: ex.explanation ? String(ex.explanation).trim() : '',
        })),
        codeTemplate: String(data.codeTemplate).trim(),
    };
}
/**
 * Attempts to fix common JSON parsing issues
 */
function tryFixJsonResponse(text) {
    // Remove markdown code blocks if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    }
    else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    // Try to parse
    try {
        return JSON.parse(cleaned);
    }
    catch (e) {
        // Try to find JSON object in text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            }
            catch (e2) {
                // Last resort: try to fix common issues
                let fixed = jsonMatch[0]
                    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                    .replace(/([{,]\s*)(\w+)(\s*):/g, '$1"$2"$3:') // Quote unquoted keys
                    .replace(/:\s*'([^']*)'/g, ': "$1"'); // Replace single quotes with double
                try {
                    return JSON.parse(fixed);
                }
                catch (e3) {
                    throw new Error(`Failed to parse JSON: ${e3 instanceof Error ? e3.message : 'Unknown error'}`);
                }
            }
        }
        throw new Error(`No JSON object found in response: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}
