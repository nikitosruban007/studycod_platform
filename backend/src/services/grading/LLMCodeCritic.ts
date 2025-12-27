/**
 * LLMCodeCritic - AI-powered code critique
 * 
 * Uses LLM to analyze code quality:
 * - Readability
 * - Code style
 * - Logic errors
 * - Potential optimizations
 * 
 * IMPORTANT: Only runs if tests pass (configurable)
 */

import { CodeSubmission, LLMCodeCritiqueResult } from './interfaces';
import { getLLMOrchestrator } from '../llm/LLMOrchestrator';

export interface ILLMCodeCritic {
  /**
   * Analyzes code quality using LLM
   * @param submission Student's code submission
   * @param taskDescription Optional task description for context
   * @returns LLM critique with style score and detailed feedback
   */
  critique(
    submission: CodeSubmission,
    taskDescription?: string
  ): Promise<LLMCodeCritiqueResult>;
}

export class LLMCodeCritic implements ILLMCodeCritic {
  async critique(
    submission: CodeSubmission,
    taskDescription?: string
  ): Promise<LLMCodeCritiqueResult> {
    const { code, language } = submission;
    const orchestrator = getLLMOrchestrator();

    const langName = language === "JAVA" ? "Java" : "Python";

    const systemPrompt = `Ти досвідчений code reviewer. Аналізуй код студента на:
1. Читабельність та зрозумілість
2. Дотримання стилю коду та best practices
3. Логічні помилки та потенційні баги
4. Можливі оптимізації
5. Якість іменування змінних та функцій
6. Організація коду
7. Обробка помилок
8. Документація

Відповідай українською мовою у форматі JSON.`;

    const userPrompt = `
Проаналізуй наступний код на мові ${langName}:

${taskDescription ? `Контекст завдання:\n${taskDescription}\n\n` : ''}
Код студента:
\`\`\`${langName.toLowerCase()}
${code}
\`\`\`

Надай детальний аналіз у форматі JSON:
{
  "readability": "детальний опис читабельності коду",
  "style": "оцінка стилю коду та дотримання best practices",
  "logic": "виявлені логічні помилки або потенційні проблеми",
  "optimizations": ["список можливих оптимізацій"],
  "warnings": ["список попереджень"],
  "namingConventions": "EXCELLENT|GOOD|FAIR|POOR",
  "codeOrganization": "EXCELLENT|GOOD|FAIR|POOR",
  "errorHandling": "EXCELLENT|GOOD|FAIR|POOR|NONE",
  "documentation": "EXCELLENT|GOOD|FAIR|POOR|NONE"
}

ВАЖЛИВО:
- Будь конструктивним та конкретним
- Вказуй конкретні рядки коду, де можливо
- Надавай практичні рекомендації
- Відповідай ТІЛЬКИ JSON без markdown блоків
`.trim();

    try {
      // Use LLM orchestrator to generate critique
      // Access the provider through the orchestrator's internal structure
      // For now, we'll use a direct approach with getLLMProvider
      const { getLLMProvider } = await import('../llm/provider');
      const provider = getLLMProvider();
      
      const response = await provider.generateJSON<{
        readability: string;
        style: string;
        logic: string;
        optimizations: string[];
        warnings: string[];
        namingConventions: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
        codeOrganization: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
        errorHandling: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NONE";
        documentation: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NONE";
      }>(
        userPrompt,
        {
          type: "object",
          properties: {
            readability: { type: "string" },
            style: { type: "string" },
            logic: { type: "string" },
            optimizations: { type: "array", items: { type: "string" } },
            warnings: { type: "array", items: { type: "string" } },
            namingConventions: { type: "string", enum: ["EXCELLENT", "GOOD", "FAIR", "POOR"] },
            codeOrganization: { type: "string", enum: ["EXCELLENT", "GOOD", "FAIR", "POOR"] },
            errorHandling: { type: "string", enum: ["EXCELLENT", "GOOD", "FAIR", "POOR", "NONE"] },
            documentation: { type: "string", enum: ["EXCELLENT", "GOOD", "FAIR", "POOR", "NONE"] },
          },
          required: ["readability", "style", "logic", "optimizations", "warnings", "namingConventions", "codeOrganization", "errorHandling", "documentation"],
        },
        systemPrompt,
        {
          timeout: 30000,
          temperature: 0.7,
          maxTokens: 2000,
        }
      );

      // Calculate style score based on detailed analysis
      const styleScore = this.calculateStyleScore(response);

      return {
        styleScore,
        feedback: {
          readability: response.readability,
          style: response.style,
          logic: response.logic,
          optimizations: response.optimizations,
          warnings: response.warnings,
        },
        detailedAnalysis: {
          namingConventions: response.namingConventions,
          codeOrganization: response.codeOrganization,
          errorHandling: response.errorHandling,
          documentation: response.documentation,
        },
      };
    } catch (error: any) {
      // If LLM fails, return neutral score
      console.error("LLM Code Critique failed:", error);
      return {
        styleScore: 0.5, // Neutral score
        feedback: {
          readability: "Не вдалося проаналізувати читабельність коду.",
          style: "Не вдалося проаналізувати стиль коду.",
          logic: "Не вдалося проаналізувати логіку коду.",
          optimizations: [],
          warnings: [],
        },
        detailedAnalysis: {
          namingConventions: "FAIR",
          codeOrganization: "FAIR",
          errorHandling: "NONE",
          documentation: "NONE",
        },
      };
    }
  }

  /**
   * Calculates style score based on detailed analysis
   */
  private calculateStyleScore(analysis: {
    namingConventions: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    codeOrganization: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    errorHandling: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NONE";
    documentation: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NONE";
  }): number {
    const scores = {
      EXCELLENT: 1.0,
      GOOD: 0.75,
      FAIR: 0.5,
      POOR: 0.25,
      NONE: 0.0,
    };

    const namingScore = scores[analysis.namingConventions];
    const orgScore = scores[analysis.codeOrganization];
    const errorScore = scores[analysis.errorHandling];
    const docScore = scores[analysis.documentation];

    // Weighted average
    // Naming and organization are more important than documentation
    return (
      namingScore * 0.3 +
      orgScore * 0.3 +
      errorScore * 0.25 +
      docScore * 0.15
    );
  }
}

