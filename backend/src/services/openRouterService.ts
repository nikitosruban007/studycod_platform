import { callOpenRouter, OpenRouterRequest } from './openRouterClient';
import { validateTaskGenerationResponse, tryFixJsonResponse } from '../utils/taskValidator';
import { getTaskExamples, formatExamplesForPrompt } from './taskExamples';
import { pickOpenRouterKey } from './openRouterKeys';

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

function getDifficultyPrompt(difus: number): string {
  if (difus < 0.2) return "Рівень: ПОЧАТКОВИЙ (Дуже легко). Завдання має бути максимально простим, лише на відпрацювання синтаксису. Жодних складних алгоритмів.";
  if (difus < 0.4) return "Рівень: ЛЕГКИЙ. Просте завдання, мінімум умов. Фокус на розумінні теми.";
  if (difus < 0.6) return "Рівень: СЕРЕДНІЙ. Додай 1-2 прості умови або розгалуження. Стандартна складність.";
  if (difus < 0.8) return "Рівень: ВИЩЕ СЕРЕДНЬОГО. Потрібно трохи подумати. Можна додати неочевидний момент в умові.";
  return "Рівень: СКЛАДНИЙ. Завдання на логічне мислення. Вимагає оптимізації або обробки граничних випадків.";
}

export async function generateTaskWithAI(params: {
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
  const apiKey = pickOpenRouterKey();
  if (!apiKey) throw new Error('AI_GENERATION_FAILED: No OpenRouter API keys configured');

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const difus = params.difus ?? 0;
  const difficultyPrompt = getDifficultyPrompt(difus);
  const langName = params.lang === "JAVA" ? "Java" : "Python";

  let taskTypeDescription = "";
  if (params.isControl) {
    taskTypeDescription = `КОНТРОЛЬНА РОБОТА. Студент пройшов теми: ${params.prevTopics || params.topicTitle}. Створи комплексне практичне завдання, що охоплює пройдений матеріал.`;
  } else if (params.isFirstTask) {
    taskTypeDescription = `ВСТУПНЕ завдання для теми "${params.topicTitle}". Завдання має поєднувати теорію та практику.`;
  } else if (params.numInTopic === 2) {
    taskTypeDescription = `ДРУГЕ практичне завдання для відпрацювання теми "${params.topicTitle}".`;
  } else {
    taskTypeDescription = `ТРЕТЄ фінальне практичне завдання по темі "${params.topicTitle}" для закріплення матеріалу.`;
  }

  const jsonSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      topic: { type: "string" },
      difficulty: { type: "number", minimum: 1, maximum: 5 },
      theoryMarkdown: { type: "string" },
      practicalTask: { type: "string" },
      inputFormat: { type: "string" },
      outputFormat: { type: "string" },
      constraints: { type: "string" },
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
        },
        minItems: 1
      },
      codeTemplate: { type: "string" }
    },
    required: ["title", "topic", "difficulty", "theoryMarkdown", "practicalTask", "inputFormat", "outputFormat", "constraints", "examples", "codeTemplate"]
  };

  const systemPrompt = `Ти досвідчений викладач програмування. Створюй якісні практичні завдання для студентів.

ВИМОГИ:
1. Завдання має бути РОЗРАХОВАНЕ НА КОНСОЛЬНУ ПРОГРАМУ
2. Має бути ПЕРЕВІРЮВАНИМ: чіткий INPUT/OUTPUT, обмеження, приклади
3. Теорія має бути ДЕТАЛЬНОЮ з прикладами коду
4. Практичне завдання має бути КОНКРЕТНИМ
5. Код-шаблон має бути ВАЛІДНИМ ${langName} кодом

ВІДПОВІДАЙ ТІЛЬКИ ВАЛІДНИМ JSON БЕЗ БУДЬ-ЯКИХ ПОЯСНЕНЬ.`;

  const examples = await getTaskExamples({
    topicTitle: params.topicTitle,
    lang: params.lang,
    difus,
    numExamples: 2,
  });

  const examplesText = formatExamplesForPrompt(examples);

  const userPrompt = `
${taskTypeDescription}

${difficultyPrompt}

Мова програмування: ${langName}

Теорія з теми (для контексту):
${params.theory.slice(0, 3000)}
${examplesText}

Створи повне завдання (теорія + практика) у форматі JSON згідно з цією схемою:
${JSON.stringify(jsonSchema, null, 2)}

ВАЖЛИВО:
- Для Java: codeTemplate має містити ТІЛЬКИ порожній клас Main з методом main.
- Для Python: codeTemplate має містити ТІЛЬКИ порожню функцію main() з if __name__ == "__main__"
- Відповідай ТІЛЬКИ JSON, без markdown блоків, без пояснень.
`.trim();

  const supportsJsonMode = !model.includes('gemma') && !model.includes('google/') && !model.includes('free');

  const baseRequest: OpenRouterRequest = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
    temperature: 0.8,
    max_tokens: 6000,
  };

  let lastContent: string | null = null;
  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callOpenRouter(baseRequest, {
        timeout: 30000,
        maxRetries: 0,
        userId: params.userId,
        topicId: params.topicId,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty AI response');
      lastContent = content;

      let parsed: any = null;
      try {
        parsed = JSON.parse(content.trim());
      } catch {
        parsed = tryFixJsonResponse(content);
      }

      const validated = validateTaskGenerationResponse(parsed);

      return {
        title: validated.title,
        topic: validated.topic,
        difficulty: validated.difficulty,
        theoryMarkdown: validated.theoryMarkdown,
        practicalTask: validated.practicalTask,
        inputFormat: validated.inputFormat,
        outputFormat: validated.outputFormat,
        constraints: validated.constraints,
        examples: validated.examples,
        codeTemplate: validated.codeTemplate,
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries && (err.message?.includes('not enabled') || err.message?.includes('INVALID_ARGUMENT')) && (baseRequest as any).response_format) {
        const { response_format, ...withoutJson } = baseRequest as any;
        Object.assign(baseRequest, withoutJson);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (attempt < maxRetries && (err.message?.toLowerCase().includes('parse') || err.message?.toLowerCase().includes('json') || err.message?.toLowerCase().includes('validation'))) {
        const repairPrompt = `Помилка форматування JSON. Виправ наступну відповідь, щоб вона була валідним JSON об'єктом без markdown блоків.

Помилка: ${err.message}
Попередня відповідь:
${lastContent?.substring(0, 2000) || 'N/A'}

Поверни ТІЛЬКИ виправлений JSON об'єкт, який точно відповідає схемі.`;

        const repairRequest: OpenRouterRequest = {
          ...baseRequest,
          messages: [
            { role: 'system', content: 'Виправ невалідний JSON. Поверни ТІЛЬКИ виправлений JSON без пояснень.' },
            { role: 'user', content: repairPrompt },
          ],
          temperature: 0.0,
        };

        try {
          const repairResponse = await callOpenRouter(repairRequest, {
            timeout: 30000,
            maxRetries: 0,
            userId: params.userId,
            topicId: params.topicId,
          });
          const repairContent = repairResponse.choices?.[0]?.message?.content;
          if (repairContent) {
            lastContent = repairContent;
            let parsedRepair: any = null;
            try {
              parsedRepair = JSON.parse(repairContent.trim());
            } catch {
              parsedRepair = tryFixJsonResponse(repairContent);
            }
            const validated = validateTaskGenerationResponse(parsedRepair);
            return {
              title: validated.title,
              topic: validated.topic,
              difficulty: validated.difficulty,
              theoryMarkdown: validated.theoryMarkdown,
              practicalTask: validated.practicalTask,
              inputFormat: validated.inputFormat,
              outputFormat: validated.outputFormat,
              constraints: validated.constraints,
              examples: validated.examples,
              codeTemplate: validated.codeTemplate,
            };
          } else {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
        } catch {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      }

      if (attempt >= maxRetries) {
        throw new Error(`AI_GENERATION_FAILED: ${err.message || 'Unknown error'}`);
      }
    }
  }

  throw new Error(`AI_GENERATION_FAILED: All retries exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
}

export async function generateTheoryWithAI(params: {
  topicTitle: string;
  lang: "JAVA" | "PYTHON";
  userId?: number;
  topicId?: number;
}): Promise<AiTheoryResult> {
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const langName = params.lang === "JAVA" ? "Java" : "Python";

  const systemPrompt = `Ти досвідчений викладач програмування. Створюй якісні уроки з детальними поясненнями та прикладами коду. Відповідай українською мовою у форматі Markdown.`;

  const userPrompt = `Напиши детальний урок по темі: "${params.topicTitle}" для мови ${langName}.
Урок має містити:
1. Вступ до теми
2. Детальні пояснення з прикладами коду
3. Практичні приклади
4. Важливі моменти та застереження

Формат: Markdown з код-блоками для прикладів.`;

  const request: OpenRouterRequest = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  };

  try {
    const response = await callOpenRouter(request, {
      timeout: 30000,
      userId: params.userId,
      topicId: params.topicId,
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error('Empty AI response');
    return { theory: content.trim() };
  } catch (err: any) {
    throw new Error(`AI_GENERATION_FAILED: Theory generation failed: ${err.message || 'Unknown error'}`);
  }
}

export async function generateQuizWithAI(params: {
  lang: "JAVA" | "PYTHON";
  prevTopics: string;
  count?: number;
  userId?: number;
  topicId?: number;
}): Promise<AiQuizResult> {
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const langName = params.lang === "JAVA" ? "Java" : "Python";
  const questionCount = params.count || 12;

  const systemPrompt = `Ти екзаменатор з програмування. Створюй тестові питання з правильними відповідями. Відповідай ТІЛЬКИ у форматі JSON без додаткових пояснень.`;

  const userPrompt = `Створи тест виключно по мові ${langName}. Теми для питань: ${params.prevTopics}.
ВИМОГИ:
- Кількість питань: РІВНО ${questionCount}
- Кожне питання має рівно 5 варіантів відповіді (А, Б, В, Г, Д)
- Формат: ТІЛЬКИ ВАЛІДНИЙ JSON масив`;

  const supportsJsonMode = !model.includes('gemma') && !model.includes('google/') && !model.includes('free');

  const request: OpenRouterRequest = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
    temperature: 0.7,
    max_tokens: 2000,
  };

  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await callOpenRouter(request, {
        timeout: 30000,
        userId: params.userId,
        topicId: params.topicId,
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty AI response');

      let parsed: any;
      try {
        parsed = JSON.parse(content.trim());
      } catch {
        parsed = tryFixJsonResponse(content);
      }

      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.length > 0 && Array.isArray(parsed[keys[0]])) {
          parsed = parsed[keys[0]];
        }
      }

      if (!Array.isArray(parsed)) throw new Error('Response must be an array');
      if (parsed.length !== questionCount) throw new Error(`Expected ${questionCount} questions, got ${parsed.length}`);

      parsed.forEach((q: any, idx: number) => {
        if (typeof q.q !== 'string' || !q.q.trim()) throw new Error(`Question ${idx + 1}: missing or invalid 'q' field`);
        if (!Array.isArray(q.options) || q.options.length !== 5) throw new Error(`Question ${idx + 1}: must have exactly 5 options`);
        if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 4) throw new Error(`Question ${idx + 1}: 'correct' must be 0-4`);
      });

      return { quizJson: JSON.stringify(parsed) };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries && (err.message?.includes('not enabled') || err.message?.includes('INVALID_ARGUMENT')) && (request as any).response_format) {
        const { response_format, ...rest } = request as any;
        Object.assign(request, rest);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (attempt < maxRetries) {
        request.messages.push({ role: 'user', content: `Виправ формат. Поверни ТІЛЬКИ JSON масив з ${questionCount} питаннями, кожне з 5 варіантами відповіді.` });
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }

  throw new Error(`AI_GENERATION_FAILED: Quiz generation failed: ${lastError?.message || 'Unknown error'}`);
}
