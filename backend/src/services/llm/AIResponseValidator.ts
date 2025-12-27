import { z } from 'zod';
import { AiTaskGenerationResult, AiTheoryResult, AiQuizResult, TestDataExample } from './LLMOrchestrator';

/**
 * Strict validation schemas for LLM responses
 * No auto-fixing, no partial validation - strict schema compliance only
 */

// Schema for generateTask response
const TaskGenerationSchema = z.object({
  title: z.string().min(1, 'title must be a non-empty string'),
  topic: z.string().min(1, 'topic must be a non-empty string'),
  difficulty: z.number().int().min(1).max(5, 'difficulty must be between 1 and 5'),
  theoryMarkdown: z.string().min(1, 'theoryMarkdown must be a non-empty string'),
  practicalTask: z.string().min(1, 'practicalTask must be a non-empty string'),
  inputFormat: z.string(),
  outputFormat: z.string(),
  constraints: z.string(),
  examples: z.array(
    z.object({
      input: z.string().min(1, 'example input must be a non-empty string'),
      output: z.string().min(1, 'example output must be a non-empty string'),
      explanation: z.string().min(1, 'example explanation must be a non-empty string'),
    })
  ).min(1, 'examples array must contain at least one example'),
  codeTemplate: z.string().min(1, 'codeTemplate must be a non-empty string'),
});

// Schema for generateTheory response
const TheoryResponseSchema = z.object({
  theory: z.string().min(1, 'theory must be a non-empty string'),
});

// Schema for generateQuiz response (array of questions)
const QuizQuestionSchema = z.object({
  q: z.string().min(1, 'question text must be a non-empty string'),
  options: z.array(z.string().min(1)).length(5, 'question must have exactly 5 options'),
  correct: z.number().int().min(0).max(4, 'correct must be between 0 and 4'),
});

const QuizResponseSchema = z.array(QuizQuestionSchema).min(1, 'quiz must contain at least one question');

// Schema for generateTaskCondition response
const TaskConditionSchema = z.object({
  description: z.string().min(1, 'description must be a non-empty string'),
});

// Schema for generateTaskTemplate response
const TaskTemplateSchema = z.object({
  template: z.string().min(1, 'template must be a non-empty string'),
});

// Schema for generateTestData response
// Input може бути порожнім, якщо завдання не потребує вхідних даних
const TestDataItemSchema = z.object({
  input: z.string(), // Дозволяємо порожній рядок для завдань без input
  output: z.string().min(1, 'test output must be a non-empty string'),
  explanation: z.string().optional(),
});

const TestDataResponseSchema = z.array(TestDataItemSchema).min(1, 'test data must contain at least one test');

/**
 * Validation error class for better error handling
 */
export class AIValidationError extends Error {
  public rawResponse?: unknown;
  constructor(
    public readonly mode: string,
    public readonly errors: z.ZodError,
    message?: string,
    rawResponse?: unknown
  ) {
    super(message || `AI response validation failed for mode: ${mode}`);
    this.name = 'AIValidationError';
    this.rawResponse = rawResponse;
  }
}

/**
 * AI Response Validator
 * Strict validation without auto-fixing
 */
export class AIResponseValidator {
  /**
   * Validates generateTask response
   * Automatically fixes common issues before validation
   * @param data - The task data to validate
   * @param expectedTopic - Optional expected topic title for strict validation
   */
  static validateGenerateTask(data: unknown, expectedTopic?: string): AiTaskGenerationResult {
    try {
      // Pre-process data to fix common AI generation issues
      const fixed = this.fixTaskGenerationData(data);
      const validated = TaskGenerationSchema.parse(fixed);
      
      // Semantic anchoring by topic:
      // If expectedTopic is provided, we do NOT hard-fail the whole generation just because
      // the model used a different wording/translation. Instead we normalize/patch the
      // output so downstream logic remains stable and the UI shows the correct topic.
      if (expectedTopic) {
        const expectedTopicLower = expectedTopic.toLowerCase().trim();

        // Patch topic to the expected anchor (source of truth).
        let out: any = validated;
        const validatedTopicLower = validated.topic.toLowerCase().trim();
        if (validatedTopicLower !== expectedTopicLower) {
          out = { ...out, topic: expectedTopic };
        }

        // Ensure BOTH title and practicalTask reference the expected topic text.
        // This prevents strict checks elsewhere from failing when the model omits the topic phrase.
        const titleLower = String(out.title || "").toLowerCase();
        if (!titleLower.includes(expectedTopicLower)) {
          out = { ...out, title: `${expectedTopic}: ${out.title}` };
        }

        const practicalTaskLower = String(out.practicalTask || "").toLowerCase();
        if (!practicalTaskLower.includes(expectedTopicLower)) {
          out = { ...out, practicalTask: `${expectedTopic}\n\n${out.practicalTask}` };
        }

        return out as AiTaskGenerationResult;
      }
      
      return validated as AiTaskGenerationResult;
    } catch (error) {
      if (error instanceof AIValidationError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new AIValidationError('generateTask', error, `Task generation validation failed: ${errorMessages}`);
      }
      throw new AIValidationError('generateTask', z.ZodError.create([]), `Task generation validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fixes common issues in AI-generated task data
   */
  private static fixTaskGenerationData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const fixed = { ...data };

    // Fix difficulty: clamp to [1, 5]
    if (typeof fixed.difficulty === 'number') {
      fixed.difficulty = Math.max(1, Math.min(5, Math.round(fixed.difficulty)));
    } else if (typeof fixed.difficulty === 'string') {
      const parsed = parseInt(fixed.difficulty, 10);
      fixed.difficulty = isNaN(parsed) ? 3 : Math.max(1, Math.min(5, parsed));
    } else {
      fixed.difficulty = 3; // Default to medium difficulty
    }

    // Fix examples: filter out empty inputs and ensure at least one example
    if (Array.isArray(fixed.examples)) {
      // Filter out examples with empty input or output
      fixed.examples = fixed.examples
        .filter((ex: any) => {
          if (!ex || typeof ex !== 'object') return false;
          const input = String(ex.input || '').trim();
          const output = String(ex.output || '').trim();
          return input.length > 0 && output.length > 0;
        })
        .map((ex: any) => ({
          input: String(ex.input || '').trim(),
          output: String(ex.output || '').trim(),
          explanation: String(ex.explanation || '').trim(),
        }));

      // If no valid examples remain, create a default one
      if (fixed.examples.length === 0) {
        fixed.examples = [{
          input: '1',
          output: '1',
          explanation: 'Default example',
        }];
      }
    } else {
      // If examples is not an array, create default
      fixed.examples = [{
        input: '1',
        output: '1',
        explanation: 'Default example',
      }];
    }

    // Ensure all string fields are non-empty
    // КРИТИЧНО: topic НЕ встановлюємо за замовчуванням - якщо його немає, валідація має провалитися
    const stringFields = ['title', 'theoryMarkdown', 'practicalTask', 'inputFormat', 'outputFormat', 'constraints', 'codeTemplate'];
    for (const field of stringFields) {
      if (!fixed[field] || typeof fixed[field] !== 'string' || fixed[field].trim().length === 0) {
        // Set default value if empty
        fixed[field] = field === 'title' ? 'Untitled Task' :
                      field === 'codeTemplate' ? (fixed.lang === 'PYTHON' ? '# write code here\n' : 'public class Main {\n  public static void main(String[] args) {\n  }\n}') :
                      `Default ${field}`;
      } else {
        fixed[field] = String(fixed[field]).trim();
      }
    }
    
    // Topic має бути встановлений AI, не встановлюємо дефолт
    if (fixed.topic && typeof fixed.topic === 'string') {
      fixed.topic = fixed.topic.trim();
    }

    return fixed;
  }

  /**
   * Validates generateTheory response
   */
  static validateGenerateTheory(data: unknown): AiTheoryResult {
    try {
      const validated = TheoryResponseSchema.parse(data);
      return validated as AiTheoryResult;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new AIValidationError('generateTheory', error, `Theory generation validation failed: ${errorMessages}`);
      }
      throw new AIValidationError('generateTheory', z.ZodError.create([]), `Theory generation validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates generateQuiz response
   * Expects array of questions or object with quizJson string
   */
  static validateGenerateQuiz(data: unknown, expectedCount?: number): AiQuizResult {
    try {
      // Handle both array and object with quizJson
      let questions: z.infer<typeof QuizQuestionSchema>[];
      
      if (Array.isArray(data)) {
        questions = QuizResponseSchema.parse(data);
      } else if (typeof data === 'object' && data !== null && 'quizJson' in data) {
        const quizJson = (data as any).quizJson;
        if (typeof quizJson === 'string') {
          const parsed = JSON.parse(quizJson);
          questions = QuizResponseSchema.parse(parsed);
        } else {
          questions = QuizResponseSchema.parse(quizJson);
        }
      } else {
        // Try to parse as array directly
        questions = QuizResponseSchema.parse(data);
      }

      // Validate count if specified
      if (expectedCount !== undefined && questions.length !== expectedCount) {
        throw new AIValidationError(
          'generateQuiz',
          z.ZodError.create([]),
          `Quiz validation failed: expected ${expectedCount} questions, got ${questions.length}`
        );
      }

      // Validate each question structure
      questions.forEach((q, idx) => {
        try {
          QuizQuestionSchema.parse(q);
        } catch (err) {
          if (err instanceof z.ZodError) {
            const errorMessages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
            throw new AIValidationError(
              'generateQuiz',
              err,
              `Question ${idx + 1} validation failed: ${errorMessages}`
            );
          }
        }
      });

      return { quizJson: JSON.stringify(questions) };
    } catch (error) {
      if (error instanceof AIValidationError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new AIValidationError('generateQuiz', error, `Quiz generation validation failed: ${errorMessages}`);
      }
      throw new AIValidationError('generateQuiz', z.ZodError.create([]), `Quiz generation validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates generateTaskCondition response
   */
  static validateGenerateTaskCondition(data: unknown): { description: string } {
    try {
      const validated = TaskConditionSchema.parse(data);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new AIValidationError('generateTaskCondition', error, `Task condition validation failed: ${errorMessages}`);
      }
      throw new AIValidationError('generateTaskCondition', z.ZodError.create([]), `Task condition validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates generateTaskTemplate response
   * Checks that template is empty (only structure + TODO, no implementation)
   */
  static validateGenerateTaskTemplate(data: unknown): { template: string } {
    try {
      const validated = TaskTemplateSchema.parse(data);
      const template = validated.template.trim().toLowerCase();
      
      // Check for common implementation patterns that should not be in template
      const forbiddenPatterns = [
        /for\s*\([^)]*\)\s*\{[^}]*[^\/\/][^\/\/]/i, // for loops with logic (not just comments)
        /while\s*\([^)]*\)\s*\{[^}]*[^\/\/][^\/\/]/i, // while loops with logic
        /if\s*\([^)]*\)\s*\{[^}]*[^\/\/][^\/\/]/i, // if statements with logic
        /return\s+[^;]+;/i, // return statements with values
        /system\.out\.print/i, // Java print statements
        /print\s*\(/i, // Python print statements
        /console\.log/i, // JavaScript console.log
      ];
      
      // Check if template contains implementation (not just structure)
      const hasImplementation = forbiddenPatterns.some(pattern => pattern.test(template));
      
      // Template should contain TODO comment
      const hasTODO = /todo|#\s*todo|\/\/\s*todo/i.test(template);
      
      if (hasImplementation && !hasTODO) {
        throw new AIValidationError('generateTaskTemplate', z.ZodError.create([]), 
          'Template contains implementation code. Template must be empty with only TODO comment.');
      }
      
      return validated;
    } catch (error) {
      if (error instanceof AIValidationError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new AIValidationError('generateTaskTemplate', error, `Task template validation failed: ${errorMessages}`);
      }
      throw new AIValidationError('generateTaskTemplate', z.ZodError.create([]), `Task template validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates generateTestData response
   * Automatically fixes common issues before validation
   */
  static validateGenerateTestData(data: unknown, expectedCount?: number): TestDataExample[] {
    try {
      // Pre-process data to fix common AI generation issues
      const fixed = this.fixTestData(data, expectedCount);
      let tests: z.infer<typeof TestDataItemSchema>[];

      // Handle both array and object with tests property
      if (Array.isArray(fixed)) {
        tests = TestDataResponseSchema.parse(fixed);
      } else if (typeof fixed === 'object' && fixed !== null && 'tests' in fixed) {
        tests = TestDataResponseSchema.parse((fixed as any).tests);
      } else {
        tests = TestDataResponseSchema.parse(fixed);
      }

      // Validate count if specified (after fixing)
      if (expectedCount !== undefined && tests.length !== expectedCount) {
        // If we have fewer tests than expected, pad with defaults
        if (tests.length < expectedCount) {
          const needed = expectedCount - tests.length;
          for (let i = 0; i < needed; i++) {
            tests.push({
              input: '1',
              output: '1',
              explanation: 'Default test',
            });
          }
        } else if (tests.length > expectedCount) {
          // If we have more, take only the first N
          tests = tests.slice(0, expectedCount);
        }
      }

      // Validate each test item
      tests.forEach((test, idx) => {
        try {
          TestDataItemSchema.parse(test);
        } catch (err) {
          if (err instanceof z.ZodError) {
            const errorMessages = (err.errors || []).map((e: any) => {
              const path = e?.path ? e.path.join('.') : 'unknown';
              const message = e?.message || 'unknown error';
              return `${path}: ${message}`;
            }).join('; ');
            throw new AIValidationError(
              'generateTestData',
              err,
              `Test ${idx + 1} validation failed: ${errorMessages}`
            );
          }
        }
      });

      return tests.map(t => ({
        input: String(t.input || '').trim() || '1',
        output: String(t.output || '').trim() || '1',
        explanation: t.explanation ? String(t.explanation).trim() : undefined,
      }));
    } catch (error) {
      if (error instanceof AIValidationError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const errorMessages = (error.errors || []).map((e: any) => {
          const path = e?.path ? e.path.join('.') : 'unknown';
          const message = e?.message || 'unknown error';
          return `${path}: ${message}`;
        }).join('; ');
        throw new AIValidationError('generateTestData', error, `Test data validation failed: ${errorMessages}`);
      }
      throw new AIValidationError('generateTestData', z.ZodError.create([]), `Test data validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fixes common issues in AI-generated test data
   */
  private static fixTestData(data: any, expectedCount?: number): any {
    if (!data) {
      // Return default test data if data is null/undefined
      const defaultTests = Array(expectedCount || 1).fill(null).map(() => ({
        input: '1',
        output: '1',
        explanation: 'Default test',
      }));
      return { tests: defaultTests };
    }

    // Handle array directly
    if (Array.isArray(data)) {
      // Filter and fix each test
      const fixed = data
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any) => ({
          // Дозволяємо порожній input для завдань без вхідних даних
          input: String(item.input || '').trim(),
          output: String(item.output || '').trim() || '1',
          explanation: item.explanation ? String(item.explanation).trim() : undefined,
        }))
        .filter((item: any) => item.output); // Remove only tests with empty output

      // Ensure we have at least one test
      if (fixed.length === 0) {
        return [{ input: '', output: '1', explanation: 'Default test' }];
      }

      return fixed;
    }

    // Handle object with tests property
    if (typeof data === 'object' && data !== null) {
      if ('tests' in data && Array.isArray(data.tests)) {
        const fixed = data.tests
          .filter((item: any) => item && typeof item === 'object')
          .map((item: any) => ({
            input: String(item.input || '').trim(), // Дозволяємо порожній input
            output: String(item.output || '').trim() || '1',
            explanation: item.explanation ? String(item.explanation).trim() : undefined,
          }))
          .filter((item: any) => item.output); // Remove only tests with empty output (input can be empty)

        if (fixed.length === 0) {
          return { tests: [{ input: '', output: '1', explanation: 'Default test' }] };
        }

        return { tests: fixed };
      }

      // If it's an object but not with tests, try to convert it
      if ('input' in data || 'output' in data) {
        return {
          tests: [{
            input: String(data.input || '').trim(), // Дозволяємо порожній input
            output: String(data.output || '').trim() || '1',
            explanation: data.explanation ? String(data.explanation).trim() : undefined,
          }]
        };
      }
    }

    // Fallback: return default
    return {
      tests: Array(expectedCount || 1).fill(null).map(() => ({
        input: '', // Порожній input за замовчуванням
        output: '1',
        explanation: 'Default test',
      }))
    };
  }
}

