import { CloudflareAIProvider } from './CloudflareAIProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { validateTaskGenerationResponse, tryFixJsonResponse } from '../../../../shared/utils/taskValidator';
import { AIResponseValidator, AIValidationError } from './AIResponseValidator';

export interface AiTaskGenerationResult {
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

export interface AiTheoryResult {
  theory: string;
}

export interface AiQuizResult {
  quizJson: string;
}

export interface TestDataExample {
  input: string;
  output: string;
  explanation?: string;
}

function getDifficultyPrompt(difus: number): string {
  if (difus < 0.2) return "Рівень: ПОЧАТКОВИЙ (Дуже легко). Завдання має бути максимально простим, лише на відпрацювання синтаксису. Жодних складних алгоритмів.";
  if (difus < 0.4) return "Рівень: ЛЕГКИЙ. Просте завдання, мінімум умов. Фокус на розумінні теми.";
  if (difus < 0.6) return "Рівень: СЕРЕДНІЙ. Додай 1-2 прості умови або розгалуження. Стандартна складність.";
  if (difus < 0.8) return "Рівень: ВИЩЕ СЕРЕДНЬОГО. Потрібно трохи подумати. Можна додати неочевидний момент в умові.";
  return "Рівень: СКЛАДНИЙ. Завдання на логічне мислення. Вимагає оптимізації або обробки граничних випадків.";
}

function isCloudflareError(error: any): boolean {
  if (!error) return false;
  const message = error.message || String(error);
  return (
    message.includes('AI_GENERATION_FAILED') ||
    message.includes('CloudflareAI') ||
    message.includes('Cloudflare Worker') ||
    message.includes('timeout') ||
    message.includes('CLOUDFLARE_AI_URL not configured') ||
    message.includes('Failed to parse') ||
    message.includes('Empty response')
  );
}

function shouldFallbackToOpenRouter(error: any): boolean {
  if (!error) return false;
  // Якщо є явний маркер fallback
  if (error.shouldFallback) return true;
  const message = error.message || String(error);
  // 502 від Worker - одразу fallback
  return message.includes('502') || message.includes('Bad Gateway');
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const message = error.message || String(error);
  return (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('Failed to parse') ||
    message.includes('Empty response') ||
    message.includes('Invalid JSON')
  );
}

export class LLMOrchestrator {
  private cloudflareProvider: CloudflareAIProvider;
  private openRouterProvider: OpenRouterProvider;

  constructor() {
    this.cloudflareProvider = new CloudflareAIProvider();
    this.openRouterProvider = new OpenRouterProvider();
  }

  async generateTaskWithAI(params: {
    topicTitle: string;
    theory: string;
    lang: "JAVA" | "PYTHON";
    numInTopic: number;
    isFirstTask: boolean;
    difus?: number;
    isControl?: boolean;
    prevTopics?: string;
    userId?: number;
    topicId?: number;
    language?: "uk" | "en";
  }): Promise<AiTaskGenerationResult> {
    // CloudflareAI temporarily disabled
    // try {
    //   if (this.cloudflareProvider && typeof (this.cloudflareProvider as any).generateTaskWithAI === 'function') {
    //     const result = await (this.cloudflareProvider as any).generateTaskWithAI(params, { language: params.language ?? "uk" });
    //     // Strict validation before caching
    //     const validated = AIResponseValidator.validateGenerateTask(result);
    //     
    //     // Step 3: Cache successful result
    //     await this.cacheService.set('generateTask', params, validated);
    //     
    //     return validated;
    //   }
    // } catch (error: any) {
    //   // При 502 від Worker - одразу fallback
    //   if (shouldFallbackToOpenRouter(error)) {
    //     console.log('[LLMOrchestrator] Cloudflare Worker returned 502, falling back to OpenRouter', { error: error.message });
    //   } else if (error instanceof AIValidationError || isRetryableError(error)) {
    //     console.log('[LLMOrchestrator] CloudflareAI failed or validation failed, falling back to OpenRouter', { error: error.message });
    //   } else if (isCloudflareError(error)) {
    //     // Інші помилки Cloudflare (не 4xx) - fallback
    //     console.log('[LLMOrchestrator] CloudflareAI error, falling back to OpenRouter', { error: error.message });
    //   } else {
    //     // Не Cloudflare помилки - не fallback, кидаємо далі
    //     throw error;
    //   }
    // }
    console.log('[LLMOrchestrator] CloudflareAI temporarily disabled, using OpenRouter directly');

    const result = await this.generateTaskWithAI_OpenRouter(params);
    return result;
  }

  /**
   * Крок A: Генерація semantic anchor для жорсткої прив'язки до теми
   * Повертає тільки anchor: topic (immutable), coreOperation, allowedScope, forbiddenScope
   */
  private async generateTaskAnchor(params: {
    topicTitle: string;
    lang: "JAVA" | "PYTHON";
    userId?: number;
    topicId?: number;
  }): Promise<{ topic: string; coreOperation: string; allowedScope: string[]; forbiddenScope: string[] }> {
    const langName = params.lang === "JAVA" ? "Java" : "Python";

    const anchorSchema = {
      type: "object",
      properties: {
        topic: { type: "string", description: `Тема завдання (ОБОВ'ЯЗКОВО "${params.topicTitle}")` },
        coreOperation: { type: "string", description: "Одна чітке формулювання того, ЩО саме потрібно зробити" },
        allowedScope: {
          type: "array",
          items: { type: "string" },
          description: "Що дозволено робити, які дії дозволені"
        },
        forbiddenScope: {
          type: "array",
          items: { type: "string" },
          description: "Що категорично заборонено, які дії НЕ МОЖНА виконувати"
        }
      },
      required: ["topic", "coreOperation", "allowedScope", "forbiddenScope"]
    };

    const systemPrompt = `Ти семантичний архітектор навчальних завдань. Створюй anchor для завдання. Відповідай ТІЛЬКИ JSON.`;

    const userPrompt = `Створи semantic anchor для завдання з теми "${params.topicTitle}" (мова: ${langName}).

КРИТИЧНО ВАЖЛИВО:
- Поле "topic" в JSON ОБОВ'ЯЗКОВО має дорівнювати "${params.topicTitle}" точно (1:1)
- coreOperation: ОДНА дія, що саме потрібно зробити (не список, не багато дій)
- allowedScope: що дозволено робити в завданні
- forbiddenScope: що категорично заборонено робити (інші теми, інші операції)

Поверни ТІЛЬКИ JSON без пояснень.`;

    const parsed = await this.openRouterProvider.generateJSON<{ topic: string; coreOperation: string; allowedScope: string[]; forbiddenScope: string[] }>(
      userPrompt,
      anchorSchema,
      systemPrompt,
      {
        timeout: 30000,
        maxRetries: 0,
        userId: params.userId,
        topicId: params.topicId,
        temperature: 0.2,
        maxTokens: 500,
      }
    );

    // HARD VALIDATION ANCHOR (НЕ LLM!)
    if (parsed.topic.trim() !== params.topicTitle.trim()) {
      throw new Error(`ANCHOR_TOPIC_MISMATCH: Expected topic "${params.topicTitle}", but anchor contains "${parsed.topic}". Topic must exactly match.`);
    }

    if (parsed.coreOperation.trim().length < 10) {
      throw new Error(`ANCHOR_TOO_VAGUE: coreOperation "${parsed.coreOperation}" is too vague (less than 10 characters). Generation aborted.`);
    }

    return parsed;
  }

  /**
   * Крок B: Генерація повного завдання з anchor
   * anchor передається як immutable input - не можна змінити
   */
  private async generateTaskFromAnchor(params: {
    topicTitle: string;
    theory: string;
    lang: "JAVA" | "PYTHON";
    anchor: { topic: string; coreOperation: string; allowedScope: string[]; forbiddenScope: string[] };
    difus?: number;
    userId?: number;
    topicId?: number;
  }): Promise<AiTaskGenerationResult> {
    const langName = params.lang === "JAVA" ? "Java" : "Python";
    const difficultyPrompt = getDifficultyPrompt(params.difus ?? 0);

    const jsonSchema = {
      type: "object",
      properties: {
        title: { type: "string", description: "Назва завдання" },
        topic: { type: "string", description: `Тема завдання (ОБОВ'ЯЗКОВО "${params.anchor.topic}")` },
        difficulty: { type: "number", description: "Складність 0-5" },
        theoryMarkdown: { type: "string", description: "Теорія у форматі Markdown" },
        practicalTask: { type: "string", description: "Практичне завдання" },
        inputFormat: { type: "string", description: "Формат вхідних даних" },
        outputFormat: { type: "string", description: "Формат вихідних даних" },
        constraints: { type: "string", description: "Обмеження" },
        examples: {
          type: "array",
          items: {
            type: "object",
            properties: {
              input: { type: "string" },
              output: { type: "string" },
              explanation: { type: "string" }
            },
            required: ["input", "output", "explanation"]
          }
        },
        codeTemplate: { type: "string", description: "Шаблон коду" }
      },
      required: ["title", "topic", "difficulty", "theoryMarkdown", "practicalTask", "inputFormat", "outputFormat", "constraints", "examples", "codeTemplate"]
    };

    const systemPrompt = `Ти досвідчений викладач програмування. Створюй якісні завдання з теорією та практикою. Відповідай українською мовою у форматі JSON згідно з наданою схемою.

КРИТИЧНО: Поле "topic" в JSON ОБОВ'ЯЗКОВО має дорівнювати "${params.anchor.topic}". НЕ змінюй anchor.`;

    const userPrompt = `
SEMANTIC ANCHOR (IMMUTABLE - НЕ ЗМІНЮЙ):
- Тема: ${params.anchor.topic}
- Основна операція: ${params.anchor.coreOperation}
- Дозволено: ${params.anchor.allowedScope.join(', ')}
- Заборонено: ${params.anchor.forbiddenScope.join(', ')}

Мова програмування: ${langName}
${difficultyPrompt}

КРИТИЧНО ВАЖЛИВО:
1. Поле "topic" в JSON ОБОВ'ЯЗКОВО має дорівнювати "${params.anchor.topic}" (immutable)
2. Практичне завдання (practicalTask) ОБОВ'ЯЗКОВО має містити "${params.anchor.coreOperation}"
3. Будь-який контент поза allowedScope = ПОМИЛКА
4. Будь-який контент з forbiddenScope = ПОМИЛКА
5. ЗАБОРОНЕНО створювати multi-task структури (Завдання 1, Завдання 2, Контрольна робота з кількома завданнями)
6. Одне завдання = одна операція "${params.anchor.coreOperation}"

Теорія з теми (для контексту):
${params.theory.slice(0, 2000)}

ШАБЛОН КОДУ (codeTemplate) - ЗАБОРОНЕНО писати реалізацію:
- Для Java: ТІЛЬКИ порожній клас Main з методом main та TODO-коментарем
- Для Python: ТІЛЬКИ порожня функція main() з if __name__ == "__main__" та TODO-коментарем
- ЗАБОРОНЕНО: писати реалізацію, готовий код

ВХІДНІ ДАНІ (inputFormat):
- Якщо завдання потребує читання з консолі: "Програма читає з консолі: [опис]"
- Якщо НЕ потребує: "Немає вхідних даних. Використовуйте значення, які ви вкажете в коді."

Відповідай ТІЛЬКИ JSON, без markdown блоків, без пояснень.
`.trim();

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const parsed = await this.openRouterProvider.generateJSON<any>(
          userPrompt,
          jsonSchema,
          systemPrompt,
          {
            timeout: 30000,
            maxRetries: 0,
            userId: params.userId,
            topicId: params.topicId,
            temperature: 0.2,
            maxTokens: 4000,
          }
        );

        const validated = AIResponseValidator.validateGenerateTask(parsed, params.anchor.topic);
        
        // ЖОРСТКИЙ SEMANTIC GATE
        const practicalTaskLower = validated.practicalTask.toLowerCase();
        const coreOperationLower = params.anchor.coreOperation.toLowerCase();
        const titleLower = validated.title.toLowerCase();

        // Перевірка coreOperation - перевіряємо в practicalTask або title
        const coreOperationWords = coreOperationLower.split(/\s+/).filter(w => w.length > 3);
        const coreOperationMentioned = practicalTaskLower.includes(coreOperationLower) || 
          titleLower.includes(coreOperationLower) ||
          (coreOperationWords.length > 0 && coreOperationWords.some(word => 
            practicalTaskLower.includes(word) || titleLower.includes(word)
          ));

        if (!coreOperationMentioned) {
          throw new Error(`CORE_OPERATION_MISSING: Practical task or title does not contain core operation "${params.anchor.coreOperation}". Generation aborted.`);
        }

        // Перевірка forbiddenScope
        for (const forbidden of params.anchor.forbiddenScope) {
          const forbiddenLower = forbidden.toLowerCase();
          if (practicalTaskLower.includes(forbiddenLower) || validated.title.toLowerCase().includes(forbiddenLower)) {
            throw new Error(`FORBIDDEN_SCOPE_VIOLATION: Task contains forbidden scope "${forbidden}". Generation aborted.`);
          }
        }

        // ЖОРСТКО ЗАБОРОНИТИ MULTI-TASK
        const multiTaskMarkers = [
          "завдання 1",
          "завдання 2",
          "завдання 3",
          "контрольна робота:",
          "## завдання",
          "підзадача",
          "задача 1",
          "задача 2"
        ];

        const taskContentLower = (validated.title + " " + validated.practicalTask).toLowerCase();
        for (const marker of multiTaskMarkers) {
          if (taskContentLower.includes(marker)) {
            throw new Error(`MULTI_TASK_NOT_ALLOWED: Task contains multi-task marker "${marker}". Single task only. Generation aborted.`);
          }
        }

        return validated;
      } catch (err: any) {
        lastError = err;
        if (err.message && (
          err.message.includes('TOPIC_MISMATCH_HARD_FAIL') ||
          err.message.includes('CORE_OPERATION_MISSING') ||
          err.message.includes('FORBIDDEN_SCOPE_VIOLATION') ||
          err.message.includes('MULTI_TASK_NOT_ALLOWED')
        )) {
          if (attempt < maxRetries) {
            console.log(`[LLMOrchestrator] Retrying due to semantic gate failure (attempt ${attempt + 1}/${maxRetries}): ${err.message}`);
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw err;
        }
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`AI_GENERATION_FAILED: ${err.message || 'Unknown error'}`);
      }
    }

    throw new Error(`AI_GENERATION_FAILED: All retries exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async generateTaskWithAI_OpenRouter(params: {
    topicTitle: string;
    theory: string;
    lang: "JAVA" | "PYTHON";
    numInTopic: number;
    isFirstTask: boolean;
    difus?: number;
    isControl?: boolean;
    prevTopics?: string;
    userId?: number;
    topicId?: number;
  }): Promise<AiTaskGenerationResult> {
    // Крок A: Генерація semantic anchor з жорсткою прив'язкою до теми
    const anchor = await this.generateTaskAnchor({
      topicTitle: params.topicTitle,
      lang: params.lang,
      userId: params.userId,
      topicId: params.topicId,
    });

    // Крок B: Генерація повного завдання з anchor (anchor immutable)
    const result = await this.generateTaskFromAnchor({
      topicTitle: params.topicTitle,
      theory: params.theory,
      lang: params.lang,
      anchor: anchor,
      difus: params.difus,
      userId: params.userId,
      topicId: params.topicId,
    });

    return result;
  }

  async generateTheoryWithAI(params: {
    topicTitle: string;
    lang: "JAVA" | "PYTHON";
    taskDescription?: string;
    taskType?: "PRACTICE" | "CONTROL";
    difficulty?: number;
    userId?: number;
    topicId?: number;
    language?: "uk" | "en";
  }): Promise<AiTheoryResult> {
    // CloudflareAI temporarily disabled
    // try {
    //   if (this.cloudflareProvider && typeof (this.cloudflareProvider as any).generateTheoryWithAI === 'function') {
    //     const result = await (this.cloudflareProvider as any).generateTheoryWithAI(params, { language: params.language ?? "uk" });
    //     const validated = AIResponseValidator.validateGenerateTheory(result);
    //     
    //     await this.cacheService.set('generateTheory', params, validated);
    //     return validated;
    //   }
    // } catch (error: any) {
    //   // При 502 від Worker - одразу fallback
    //   if (shouldFallbackToOpenRouter(error)) {
    //     console.log('[LLMOrchestrator] Cloudflare Worker returned 502, falling back to OpenRouter', { error: error.message });
    //   } else if (error instanceof AIValidationError || isRetryableError(error)) {
    //     console.log('[LLMOrchestrator] CloudflareAI failed or validation failed, falling back to OpenRouter', { error: error.message });
    //   } else if (isCloudflareError(error)) {
    //     // Інші помилки Cloudflare (не 4xx) - fallback
    //     console.log('[LLMOrchestrator] CloudflareAI error, falling back to OpenRouter', { error: error.message });
    //   } else {
    //     // Не Cloudflare помилки - не fallback, кидаємо далі
    //     throw error;
    //   }
    // }
    console.log('[LLMOrchestrator] CloudflareAI temporarily disabled, using OpenRouter directly');

    const result = await this.generateTheoryWithAI_OpenRouter(params);
    return result;
  }

  private async generateTheoryWithAI_OpenRouter(params: {
    topicTitle: string;
    lang: "JAVA" | "PYTHON";
    taskDescription?: string;
    taskType?: "PRACTICE" | "CONTROL";
    difficulty?: number;
    userId?: number;
    topicId?: number;
  }): Promise<AiTheoryResult> {
    const langName = params.lang === "JAVA" ? "Java" : "Python";

    const systemPrompt = `Ти досвідчений викладач програмування. Створюй якісні уроки з детальними поясненнями та прикладами коду. Відповідай українською мовою у форматі Markdown.`;

    let userPrompt: string;
    
    if (params.taskDescription && params.taskType) {
      const taskTypeText = params.taskType === "CONTROL" ? "контрольного" : "практичного";
      userPrompt = `Створи теорію для ${taskTypeText} завдання з теми "${params.topicTitle}" для мови ${langName}.

Опис завдання:
${params.taskDescription}

Теорія має:
- Пояснювати ключові концепції, необхідні для виконання завдання
- Містити приклади коду
- Бути структурованою та зрозумілою
- Бути у форматі Markdown`;
    } else {
      userPrompt = `Створи теорію для теми "${params.topicTitle}" для мови ${langName}.

Теорія має:
- Пояснювати ключові концепції теми
- Містити приклади коду
- Бути структурованою та зрозумілою
- Бути у форматі Markdown`;
    }

    try {
      const content = await this.openRouterProvider.generateText(userPrompt, systemPrompt, {
        timeout: 30000,
        userId: params.userId,
        topicId: params.topicId,
        temperature: 0.7,
        maxTokens: 3000,
      });
      const validated = AIResponseValidator.validateGenerateTheory({ theory: content.trim() });
      
      return validated;
    } catch (error: any) {
      throw new Error(`AI_GENERATION_FAILED: ${error.message || 'Unknown error'}`);
    }
  }

  async generateQuizWithAI(params: {
    lang: "JAVA" | "PYTHON";
    prevTopics: string;
    count?: number;
    userId?: number;
    topicId?: number;
    language?: "uk" | "en";
  }): Promise<AiQuizResult> {
    // CloudflareAI temporarily disabled
    // try {
    //   if (this.cloudflareProvider && typeof (this.cloudflareProvider as any).generateQuizWithAI === 'function') {
    //     const result = await (this.cloudflareProvider as any).generateQuizWithAI(params, { language: params.language ?? "uk" });
    //     const validated = AIResponseValidator.validateGenerateQuiz(result, params.count);
    //     
    //     await this.cacheService.set('generateQuiz', params, validated);
    //     return validated;
    //   }
    // } catch (error: any) {
    //   // При 502 від Worker - одразу fallback
    //   if (shouldFallbackToOpenRouter(error)) {
    //     console.log('[LLMOrchestrator] Cloudflare Worker returned 502, falling back to OpenRouter', { error: error.message });
    //   } else if (error instanceof AIValidationError || isRetryableError(error)) {
    //     console.log('[LLMOrchestrator] CloudflareAI failed or validation failed, falling back to OpenRouter', { error: error.message });
    //   } else if (isCloudflareError(error)) {
    //     // Інші помилки Cloudflare (не 4xx) - fallback
    //     console.log('[LLMOrchestrator] CloudflareAI error, falling back to OpenRouter', { error: error.message });
    //   } else {
    //     // Не Cloudflare помилки - не fallback, кидаємо далі
    //     throw error;
    //   }
    // }
    console.log('[LLMOrchestrator] CloudflareAI temporarily disabled, using OpenRouter directly');

    const result = await this.generateQuizWithAI_OpenRouter(params);
    return result;
  }

  private async generateQuizWithAI_OpenRouter(params: {
    lang: "JAVA" | "PYTHON";
    prevTopics: string;
    count?: number;
    userId?: number;
    topicId?: number;
  }): Promise<AiQuizResult> {
    const langName = params.lang === "JAVA" ? "Java" : "Python";
    const questionCount = params.count || 12;

    const systemPrompt = `Ти екзаменатор з програмування. Створюй тестові питання з правильними відповідями. Відповідай ТІЛЬКИ у форматі JSON масиву без додаткових пояснень, коментарів або тексту до або після JSON.`;

    let userPrompt = `Створи тест виключно по мові ${langName}. Теми для питань: ${params.prevTopics}.
ВИМОГИ:
- Кількість питань: РІВНО ${questionCount}
- Кожне питання має рівно 5 варіантів відповіді (А, Б, В, Г, Д)
- Формат: ТІЛЬКИ ВАЛІДНИЙ JSON масив без жодного додаткового тексту
- Кожне питання має формат: {"q": "питання", "options": ["А", "Б", "В", "Г", "Д"], "correct": 0}
- Відповідай ТІЛЬКИ JSON масивом, без пояснень, без markdown, без code blocks`;

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const content = await this.openRouterProvider.generateText(userPrompt, systemPrompt, {
          timeout: 30000,
          userId: params.userId,
          topicId: params.topicId,
          temperature: 0.7,
          maxTokens: 3000,
        });
        
        if (!content) throw new Error('Empty AI response');

        let parsed: any;
        try {
          parsed = JSON.parse(content.trim());
        } catch (firstError) {
          try {
            let cleaned = content.trim();
            const codeBlockStart = cleaned.indexOf('```');
            if (codeBlockStart !== -1) {
              const codeBlockEnd = cleaned.lastIndexOf('```');
              if (codeBlockEnd !== -1 && codeBlockEnd > codeBlockStart) {
                cleaned = cleaned.substring(codeBlockStart + 3, codeBlockEnd);
                cleaned = cleaned.replace(/^(?:json|JSON)\s*/i, '');
                cleaned = cleaned.trim();
              }
            }
            
            const jsonStart = cleaned.indexOf('[');
            const objStart = cleaned.indexOf('{');
            let startPos = -1;
            let isArray = false;
            
            if (jsonStart !== -1 && (objStart === -1 || jsonStart < objStart)) {
              startPos = jsonStart;
              isArray = true;
            } else if (objStart !== -1) {
              startPos = objStart;
              isArray = false;
            }
            
            if (startPos !== -1) {
              let depth = 0;
              let inString = false;
              let escapeNext = false;
              let endPos = startPos;
              
              for (let i = startPos; i < cleaned.length; i++) {
                const char = cleaned[i];
                
                if (escapeNext) {
                  escapeNext = false;
                  continue;
                }
                
                if (char === '\\') {
                  escapeNext = true;
                  continue;
                }
                
                if (char === '"' && !escapeNext) {
                  inString = !inString;
                  continue;
                }
                
                if (!inString) {
                  if ((isArray && char === '[') || (!isArray && char === '{')) {
                    depth++;
                  } else if ((isArray && char === ']') || (!isArray && char === '}')) {
                    depth--;
                    if (depth === 0) {
                      endPos = i + 1;
                      break;
                    }
                  }
                }
              }
              
              if (endPos > startPos) {
                let fixed = cleaned.substring(startPos, endPos).replace(/,(\s*[}\]])/g, '$1').trim();
                if (isArray) {
                  const lastBracket = fixed.lastIndexOf(']');
                  if (lastBracket !== -1) {
                    fixed = fixed.substring(0, lastBracket + 1);
                  }
                } else {
                  const lastBrace = fixed.lastIndexOf('}');
                  if (lastBrace !== -1) {
                    fixed = fixed.substring(0, lastBrace + 1);
                  }
                }
                parsed = JSON.parse(fixed);
              } else {
                throw new Error('Could not find end of JSON');
              }
            } else {
              parsed = tryFixJsonResponse(content);
            }
          } catch (secondError) {
            parsed = tryFixJsonResponse(content);
          }
        }

        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          const keys = Object.keys(parsed);
          if (keys.length > 0 && Array.isArray(parsed[keys[0]])) {
            parsed = parsed[keys[0]];
          }
        }

        // Strict validation - no auto-fixing
        const validated = AIResponseValidator.validateGenerateQuiz(parsed, questionCount);
        
        return validated;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          userPrompt += `\n\nВиправ формат. Поверни ТІЛЬКИ JSON масив з ${questionCount} питаннями, кожне з 5 варіантами відповіді. БЕЗ жодного тексту до або після JSON. БЕЗ markdown. БЕЗ пояснень. ТІЛЬКИ чистий JSON масив.`;
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      }
    }

    throw new Error(`AI_GENERATION_FAILED: Quiz generation failed: ${lastError?.message || 'Unknown error'}`);
  }

  async generateTaskCondition(params: {
    topicTitle: string;
    taskType: "PRACTICE" | "CONTROL";
    difficulty?: number;
    language: "JAVA" | "PYTHON";
    userId?: number;
    topicId?: number;
    userLanguage?: "uk" | "en";
  }): Promise<{ description: string }> {
    // CloudflareAI temporarily disabled
    // try {
    //   if (this.cloudflareProvider && typeof (this.cloudflareProvider as any).generateTaskCondition === 'function') {
    //     const result = await (this.cloudflareProvider as any).generateTaskCondition(params, { language: params.userLanguage ?? "uk" });
    //     const validated = AIResponseValidator.validateGenerateTaskCondition(result);
    //     
    //     await this.cacheService.set('generateTaskCondition', cacheParams, validated);
    //     return validated;
    //   }
    // } catch (error: any) {
    //   // При 502 від Worker - одразу fallback
    //   if (shouldFallbackToOpenRouter(error)) {
    //     console.log('[LLMOrchestrator] Cloudflare Worker returned 502, falling back to OpenRouter', { error: error.message });
    //   } else if (error instanceof AIValidationError || isRetryableError(error)) {
    //     console.log('[LLMOrchestrator] CloudflareAI failed or validation failed, falling back to OpenRouter', { error: error.message });
    //   } else if (isCloudflareError(error)) {
    //     // Інші помилки Cloudflare (не 4xx) - fallback
    //     console.log('[LLMOrchestrator] CloudflareAI error, falling back to OpenRouter', { error: error.message });
    //   } else {
    //     // Не Cloudflare помилки - не fallback, кидаємо далі
    //     throw error;
    //   }
    // }
    console.log('[LLMOrchestrator] CloudflareAI temporarily disabled, using OpenRouter directly');

    const result = await this.generateTaskCondition_OpenRouter(params);
    return result;
  }

  private async generateTaskCondition_OpenRouter(params: {
    topicTitle: string;
    taskType: "PRACTICE" | "CONTROL";
    difficulty?: number;
    language: "JAVA" | "PYTHON";
    userId?: number;
    topicId?: number;
    userLanguage?: "uk" | "en";
  }): Promise<{ description: string }> {
    const langName = params.language === "JAVA" ? "Java" : "Python";
    const difficulty = params.difficulty ?? 3;
    const difficultyPrompt = getDifficultyPrompt(difficulty / 5);

    const taskTypeText = params.taskType === "CONTROL" 
      ? "КОНТРОЛЬНЕ завдання для перевірки знань по темі"
      : "ПРАКТИЧНЕ завдання для відпрацювання матеріалу";

    const isEnglish = params.userLanguage === "en";
    const systemPrompt = isEnglish 
      ? `You are an experienced programming teacher. Create clear, detailed task descriptions with examples.`
      : `Ти досвідчений викладач програмування. Створюй чіткі, детальні умови завдань з прикладами.`;

    const userPrompt = isEnglish
      ? `Create a detailed task description for ${taskTypeText.toLowerCase()} "${params.topicTitle}" for ${langName} language.

CRITICAL: The task MUST be specifically about the topic "${params.topicTitle}". If the topic is "harmonic mean of array" - the task must be about harmonic mean of array, not about other topics.

${difficultyPrompt}

REQUIREMENTS:
- The task description MUST be specifically about the topic "${params.topicTitle}"
- Do not create tasks about other topics
- The practical task must directly relate to the topic "${params.topicTitle}"
- The task description must be detailed and comprehensive
- Include a clear problem statement
- Provide input/output format specifications
- Include at least 2-3 examples with input and expected output
- Explain what the program should do step by step
- Format: Markdown with proper headings and code blocks
- The task should be related to the topic "${params.topicTitle}"

Return ONLY the task description in Markdown format without additional comments.`
      : `Створи детальну умову ${taskTypeText.toLowerCase()} "${params.topicTitle}" для мови ${langName}.

КРИТИЧНО ВАЖЛИВО: Завдання МАЄ бути саме про тему "${params.topicTitle}". Якщо тема "середнє гармонічне масиву" - завдання має бути про середнє гармонічне масиву, а не про інші теми.

${difficultyPrompt}

ВИМОГИ:
- Завдання МАЄ бути саме про тему "${params.topicTitle}"
- Не створюй завдання про інші теми
- Практичне завдання має безпосередньо стосуватися теми "${params.topicTitle}"
- Умова має бути детальною та повною
- Включи чітке формулювання задачі
- Вкажи формат вводу/виводу
- Додай принаймні 2-3 приклади з вхідними даними та очікуваним результатом
- Поясни, що має робити програма покроково
- Формат: Markdown з правильними заголовками та код-блоками

Поверни ТІЛЬКИ умову завдання у форматі Markdown без додаткових коментарів.`;

    try {
      const content = await this.openRouterProvider.generateText(userPrompt, systemPrompt, {
        timeout: 30000,
        userId: params.userId,
        topicId: params.topicId,
        temperature: 0.7,
        maxTokens: 1500,
        language: params.userLanguage || "uk",
      });
      const validated = AIResponseValidator.validateGenerateTaskCondition({ description: content.trim() });
      
      return validated;
    } catch (error: any) {
      throw new Error(`AI_GENERATION_FAILED: ${error.message || 'Unknown error'}`);
    }
  }

  async generateTaskTemplate(params: {
    topicTitle: string;
    language: "JAVA" | "PYTHON";
    description?: string;
    userId?: number;
    topicId?: number;
    userLanguage?: "uk" | "en";
  }): Promise<{ template: string }> {
    // CloudflareAI temporarily disabled
    // try {
    //   if (this.cloudflareProvider && typeof (this.cloudflareProvider as any).generateTaskTemplate === 'function') {
    //     const result = await (this.cloudflareProvider as any).generateTaskTemplate(params, { language: params.userLanguage ?? "uk" });
    //     const validated = AIResponseValidator.validateGenerateTaskTemplate(result);
    //     
    //     await this.cacheService.set('generateTaskTemplate', params, validated);
    //     return validated;
    //   }
    // } catch (error: any) {
    //   // При 502 від Worker - одразу fallback
    //   if (shouldFallbackToOpenRouter(error)) {
    //     console.log('[LLMOrchestrator] Cloudflare Worker returned 502, falling back to OpenRouter', { error: error.message });
    //   } else if (error instanceof AIValidationError || isRetryableError(error)) {
    //     console.log('[LLMOrchestrator] CloudflareAI failed or validation failed, falling back to OpenRouter', { error: error.message });
    //   } else if (isCloudflareError(error)) {
    //     // Інші помилки Cloudflare (не 4xx) - fallback
    //     console.log('[LLMOrchestrator] CloudflareAI error, falling back to OpenRouter', { error: error.message });
    //   } else {
    //     // Не Cloudflare помилки - не fallback, кидаємо далі
    //     throw error;
    //   }
    // }
    console.log('[LLMOrchestrator] CloudflareAI temporarily disabled, using OpenRouter directly');

    const result = await this.generateTaskTemplate_OpenRouter(params);
    return result;
  }

  private async generateTaskTemplate_OpenRouter(params: {
    topicTitle: string;
    language: "JAVA" | "PYTHON";
    description?: string;
    userId?: number;
    topicId?: number;
  }): Promise<{ template: string }> {
    const langName = params.language === "JAVA" ? "Java" : "Python";

    const systemPrompt = `Ти досвідчений викладач програмування. Створюй порожні шаблони коду з TODO-коментарями. ЗАБОРОНЕНО писати реалізацію або готовий код.`;

    const userPrompt = `Створи порожній шаблон коду для завдання "${params.topicTitle}" на мові ${langName}.

${params.description ? `Опис завдання:\n${params.description}\n\n` : ''}

КРИТИЧНО ВАЖЛИВО - ШАБЛОН МАЄ БУТИ ПОРОЖНІМ:

ЗАБОРОНЕНО:
- Писати реалізацію логіки
- Писати готовий код
- Писати відповідь
- Писати обчислення
- Писати алгоритм

ДОЗВОЛЕНО:
- Тільки структура (клас/функція)
- TODO-коментар з інструкцією
- Необхідні імпорти (якщо потрібні для структури)

ВИМОГИ:
- Для Java: ТІЛЬКИ порожній клас Main з методом main та TODO-коментарем
- Для Python: ТІЛЬКИ порожня функція main() з if __name__ == "__main__" та TODO-коментарем
- Без реалізації логіки
- Без markdown блоків

Приклад ПРАВИЛЬНОГО шаблону для Java:
\`\`\`java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        // TODO: реалізуйте рішення задачі
    }
}
\`\`\`

Приклад ПРАВИЛЬНОГО шаблону для Python:
\`\`\`python
def main():
    # TODO: реалізуйте рішення задачі
    pass

if __name__ == "__main__":
    main()
\`\`\`

Приклад НЕПРАВИЛЬНОГО шаблону (ЗАБОРОНЕНО):
\`\`\`java
public class Main {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3};
        double result = calculate(arr);
        System.out.println(result);
    }
    
    static double calculate(int[] arr) {
        // реалізація
    }
}
\`\`\`

Поверни ТІЛЬКИ код без markdown блоків та пояснень.`;

    try {
      const content = await this.openRouterProvider.generateText(userPrompt, systemPrompt, {
        timeout: 30000,
        userId: params.userId,
        topicId: params.topicId,
        temperature: 0.3,
        maxTokens: 1000,
      });
      
      let template = content.trim();
      template = template.replace(/^```\w*\n?/gm, '');
      template = template.replace(/```$/gm, '');
      template = template.trim();
      
      const validated = AIResponseValidator.validateGenerateTaskTemplate({ template });
      
      return validated;
    } catch (error: any) {
      throw new Error(`AI_GENERATION_FAILED: ${error.message || 'Unknown error'}`);
    }
  }

  async generateTestDataWithAI(params: {
    taskDescription: string;
    taskTitle: string;
    lang: "JAVA" | "PYTHON";
    count: number;
    userId?: number;
  }): Promise<TestDataExample[]> {
    // CloudflareAI temporarily disabled
    // try {
    //   if (this.cloudflareProvider && typeof (this.cloudflareProvider as any).generateTestDataWithAI === 'function') {
    //     const result = await (this.cloudflareProvider as any).generateTestDataWithAI(params, { language: params.language ?? "uk" });
    //     const validated = AIResponseValidator.validateGenerateTestData(result, params.count);
    //     return validated;
    //   }
    // } catch (error: any) {
    //   // При 502 від Worker - одразу fallback
    //   if (shouldFallbackToOpenRouter(error)) {
    //     console.log('[LLMOrchestrator] Cloudflare Worker returned 502, falling back to OpenRouter', { error: error.message });
    //   } else if (error instanceof AIValidationError || isRetryableError(error)) {
    //     console.log('[LLMOrchestrator] CloudflareAI failed or validation failed, falling back to OpenRouter', { error: error.message });
    //   } else if (isCloudflareError(error)) {
    //     // Інші помилки Cloudflare (не 4xx) - fallback
    //     console.log('[LLMOrchestrator] CloudflareAI error, falling back to OpenRouter', { error: error.message });
    //   } else {
    //     // Не Cloudflare помилки - не fallback, кидаємо далі
    //     throw error;
    //   }
    // }
    console.log('[LLMOrchestrator] CloudflareAI temporarily disabled, using OpenRouter directly');

    const result = await this.generateTestDataWithAI_OpenRouter(params);
    return result;
  }

  private async generateTestDataWithAI_OpenRouter(params: {
    taskDescription: string;
    taskTitle: string;
    lang: "JAVA" | "PYTHON";
    count: number;
    userId?: number;
  }): Promise<TestDataExample[]> {
    const langName = params.lang === "JAVA" ? "Java" : "Python";

    const jsonSchema = {
      type: "object",
      properties: {
        tests: {
          type: "array",
          items: {
            type: "object",
            properties: {
              input: { type: "string", description: "Вхідні дані для тесту (текст або числа через пробіл)" },
              output: { type: "string", description: "Очікуваний вивід програми" },
              explanation: { type: "string", description: "Пояснення тесту (опціонально)" }
          },
            required: ["input", "output"]
          },
          minItems: params.count,
          maxItems: params.count
        }
      },
      required: ["tests"]
    };

    const systemPrompt = `Ти досвідчений викладач програмування. Твоя задача - створити тестові дані для перевірки програм учнів.

ВИМОГИ:
1. Створи РІВНО ${params.count} тестових прикладів
2. Кожен тест має мати НЕПОРОЖНІ input та output
3. Тести мають покривати різні випадки: базові, граничні, складні
4. Input та output мають бути у форматі, який можна прочитати з консолі
5. Для масивів використовуй формат: числа через пробіл (наприклад: "1 2 3 4 5")
6. Всі тести мають бути ВАЛІДНИМИ для завдання

ВІДПОВІДАЙ ТІЛЬКИ ВАЛІДНИМ JSON БЕЗ БУДЬ-ЯКИХ ПОЯСНЕНЬ.`;

    // Перевіряємо, чи завдання потребує вхідних даних
    const taskDesc = params.taskDescription.slice(0, 2000);
    const needsInput = !taskDesc.includes("Немає вхідних даних") && 
                       (taskDesc.includes("читати") || 
                        taskDesc.includes("читайте") || 
                        taskDesc.includes("введення") ||
                        taskDesc.includes("input") ||
                        taskDesc.includes("вхідні дані"));

    const userPrompt = `
Завдання: ${params.taskTitle}

Опис завдання:
${taskDesc}

Мова програмування: ${langName}

${needsInput ? `
⚠️ ЗАВДАННЯ ПОТРЕБУЄ ВХІДНИХ ДАНИХ з консолі.
Створи РІВНО ${params.count} тестових прикладів з РІЗНИМИ значеннями в input.
` : `
⚠️ ЗАВДАННЯ НЕ ПОТРЕБУЄ ВХІДНИХ ДАНИХ - використовуються тільки захардкоджені значення.
Створи ${params.count} тестів, де:
- input може бути порожнім рядком "" або нерелевантним значенням
- output має відповідати очікуваному результату програми з захардкодженими значеннями
- Різні тести можуть мати різні output (якщо завдання дозволяє варіативність)
`}

Створи тестові дані у форматі JSON згідно з цією схемою:
${JSON.stringify(jsonSchema, null, 2)}

ВАЖЛИВО:
- Всі тести мають мати НЕПОРОЖНІ output
- ${needsInput ? 'Input має бути різним для кожного тесту' : 'Input може бути порожнім, якщо завдання не потребує вхідних даних'}
- Тести мають бути різноманітними (різні випадки)
- Відповідай ТІЛЬКИ JSON, без markdown блоків, без пояснень
`.trim();

    try {
      const parsed = await this.openRouterProvider.generateJSON<{ tests: TestDataExample[] }>(
        userPrompt,
        jsonSchema,
        systemPrompt,
        {
          timeout: 30000,
          maxRetries: 1,
          userId: params.userId,
          temperature: 0.7,
          maxTokens: 2000,
        }
      );

      // Strict validation - no auto-fixing, no filtering
      const validated = AIResponseValidator.validateGenerateTestData(parsed, params.count);
      
      return validated;
    } catch (error: any) {
      console.error("Error generating test data with AI:", error);
      throw error;
    }
  }
}

let orchestratorInstance: LLMOrchestrator | null = null;

export function getLLMOrchestrator(): LLMOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new LLMOrchestrator();
  }
  return orchestratorInstance;
}

