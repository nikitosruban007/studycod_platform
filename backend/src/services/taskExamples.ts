/**
 * Few-shot learning examples for task generation
 * Stores and retrieves successful task examples to improve AI generation
 */

import { AppDataSource } from '../data-source';
import { Task } from '../entities/Task';

const taskRepo = () => AppDataSource.getRepository(Task);

export interface TaskExample {
  topic: string;
  language: "JAVA" | "PYTHON";
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
 * Extracts task example from a Task entity
 */
function extractTaskExample(task: Task, topicTitle: string): TaskExample | null {
  try {
    // Parse description to extract components
    const desc = task.description || task.descriptionMarkdown || '';
    
    // Try to extract practical task, input/output format, constraints, examples
    // This is a simplified parser - you might want to improve it
    const practicalMatch = desc.match(/###\s*Практик[ае]\s*\n\n(.*?)(?:\n\n\*\*Формат|$)/s);
    const practicalTask = practicalMatch ? practicalMatch[1].trim() : '';
    
    const inputFormatMatch = desc.match(/\*\*Формат вхідних даних:\*\*\s*\n(.*?)(?:\n\n\*\*Формат вихідних|$)/s);
    const inputFormat = inputFormatMatch ? inputFormatMatch[1].trim() : 'Немає вхідних даних';
    
    const outputFormatMatch = desc.match(/\*\*Формат вихідних даних:\*\*\s*\n(.*?)(?:\n\n\*\*Обмеження|$)/s);
    const outputFormat = outputFormatMatch ? outputFormatMatch[1].trim() : '';
    
    const constraintsMatch = desc.match(/\*\*Обмеження:\*\*\s*\n(.*?)(?:\n\n\*\*Приклади|$)/s);
    const constraints = constraintsMatch ? constraintsMatch[1].trim() : '';
    
    // Extract examples
    const examplesMatch = desc.match(/\*\*Приклади:\*\*\s*\n(.*?)$/s);
    const examplesText = examplesMatch ? examplesMatch[1] : '';
    const examples: Array<{ input: string; output: string; explanation: string }> = [];
    
    // Parse examples (format: "Приклад N:\nВхід: ...\nВихід: ...\nПояснення: ...")
    const exampleMatches = examplesText.matchAll(/Приклад\s+\d+:\s*\nВхід:\s*(.*?)\s*\nВихід:\s*(.*?)\s*\nПояснення:\s*(.*?)(?=\nПриклад|$)/gs);
    for (const match of exampleMatches) {
      examples.push({
        input: match[1].trim(),
        output: match[2].trim(),
        explanation: match[3].trim(),
      });
    }
    
    // Extract theory (everything before "### Практика")
    const theoryMatch = desc.match(/^(.*?)(?:\n\n###\s*Практик|$)/s);
    const theoryMarkdown = theoryMatch ? theoryMatch[1].trim() : '';
    
    if (!practicalTask || !task.template) {
      return null; // Not a valid example
    }
    
    return {
      topic: topicTitle,
      language: task.lang,
      difficulty: task.difus || 0,
      theoryMarkdown,
      practicalTask,
      inputFormat,
      outputFormat,
      constraints,
      examples: examples.length > 0 ? examples : [{
        input: 'N/A',
        output: 'N/A',
        explanation: 'Приклад не надано',
      }],
      codeTemplate: task.template,
    };
  } catch (err) {
    console.error('Failed to extract task example', err);
    return null;
  }
}

/**
 * Gets few-shot examples for task generation
 * Returns up to 3 examples similar to the requested task
 */
export async function getTaskExamples(params: {
  topicTitle: string;
  lang: "JAVA" | "PYTHON";
  difus: number;
  numExamples?: number;
}): Promise<TaskExample[]> {
  try {
    const numExamples = params.numExamples || 3;
    
    // Find successful tasks (graded with good scores) for the same language
    // We'll look for tasks with similar difficulty
    const tasks = await taskRepo().find({
      where: {
        lang: params.lang,
        completed: 1, // Completed tasks are more likely to be good examples
      } as any,
      order: { createdAt: 'DESC' } as any,
      take: 20, // Get more to filter
    });
    
    // Filter and extract examples - ТІЛЬКИ приклади з точною темою
    const examples: TaskExample[] = [];
    const expectedTopicLower = params.topicTitle.toLowerCase().trim();
    
    for (const task of tasks) {
      if (examples.length >= numExamples) break;
      
      const taskTopic = task.topic?.title || 'Unknown';
      const taskTopicLower = taskTopic.toLowerCase().trim();
      
      // КРИТИЧНО: Тільки приклади з точною темою
      if (taskTopicLower !== expectedTopicLower) continue;
      
      // Prefer tasks with similar difficulty
      const taskDifus = task.difus || 0;
      const difusDiff = Math.abs(taskDifus - params.difus);
      if (difusDiff > 1 && examples.length > 0) continue; // Only skip if we already have examples
      
      const example = extractTaskExample(task, taskTopic);
      if (example) {
        examples.push(example);
      }
    }
    
    return examples;
  } catch (err) {
    console.error('Failed to get task examples', err);
    return [];
  }
}

/**
 * Formats examples for use in AI prompt
 */
export function formatExamplesForPrompt(examples: TaskExample[]): string {
  if (examples.length === 0) return '';
  
  return `\n\nПРИКЛАДИ УСПІШНИХ ЗАВДАНЬ (використовуй як зразок):\n\n${examples.map((ex, idx) => `
Приклад ${idx + 1}:
Тема: ${ex.topic}
Мова: ${ex.language}
Складність: ${ex.difficulty}

Теорія:
${ex.theoryMarkdown.substring(0, 500)}...

Практичне завдання:
${ex.practicalTask.substring(0, 300)}...

Формат вхідних: ${ex.inputFormat.substring(0, 100)}
Формат вихідних: ${ex.outputFormat.substring(0, 100)}
Обмеження: ${ex.constraints.substring(0, 100)}

Приклад виконання:
Вхід: ${ex.examples[0]?.input || 'N/A'}
Вихід: ${ex.examples[0]?.output || 'N/A'}

Код-шаблон:
\`\`\`${ex.language === 'JAVA' ? 'java' : 'python'}
${ex.codeTemplate.substring(0, 200)}...
\`\`\`
`).join('\n---\n')}`;
}

