/**
 * HybridGradingPipeline - Main orchestrator for hybrid grading system
 * 
 * Combines:
 * 1. TestRunner (correctness)
 * 2. ASTAnalyzer (complexity)
 * 3. LLMCodeCritic (style)
 * 
 * Flow:
 * 1. Run tests first
 * 2. If tests fail → minimal score, skip AST/LLM
 * 3. If tests pass → run AST analysis and LLM critique
 * 4. Calculate weighted final score
 */

import {
  CodeSubmission,
  HybridGradingResult,
  GradingConfig,
  TestRunnerResult,
  ASTAnalysisResult,
  LLMCodeCritiqueResult,
} from './interfaces';
import { TestRunner, ITestRunner } from './TestRunner';
import { ASTAnalyzer, IASTAnalyzer } from './ASTAnalyzer';
import { LLMCodeCritic, ILLMCodeCritic } from './LLMCodeCritic';

export interface IHybridGradingPipeline {
  /**
   * Grades student code using hybrid approach
   * @param submission Student's code submission
   * @param config Grading configuration
   * @param taskDescription Optional task description for LLM context
   * @returns Complete grading result with scores and feedback
   */
  grade(
    submission: CodeSubmission,
    config: GradingConfig,
    taskDescription?: string
  ): Promise<HybridGradingResult>;
}

export class HybridGradingPipeline implements IHybridGradingPipeline {
  constructor(
    private testRunner: ITestRunner = new TestRunner(),
    private astAnalyzer: IASTAnalyzer = new ASTAnalyzer(),
    private llmCritic: ILLMCodeCritic = new LLMCodeCritic()
  ) {}

  async grade(
    submission: CodeSubmission,
    config: GradingConfig,
    taskDescription?: string
  ): Promise<HybridGradingResult> {
    // Step 1: Run tests (ALWAYS - this is the foundation)
    const testResults = await this.testRunner.runTests(submission);

    // Step 2: If tests fail, return minimal score
    if (!testResults.passed) {
      return this.createMinimalScoreResult(
        testResults,
        config,
        "Код не проходить тести. Виправте помилки перед подальшою оцінкою."
      );
    }

    // Step 3: Tests passed - run AST analysis and LLM critique
    let astAnalysis: ASTAnalysisResult | undefined;
    let llmCritique: LLMCodeCritiqueResult | undefined;

    // Run AST analysis if enabled
    // NOTE: ASTAnalyzer is not yet fully implemented, so we use neutral scores
    if (config.astAnalysis.enabled) {
      try {
        astAnalysis = await this.astAnalyzer.analyze(submission);
      } catch (error) {
        // AST analysis not implemented yet - use neutral score
        if (error instanceof Error && error.message.includes("not yet implemented")) {
          astAnalysis = this.createNeutralASTResult();
        } else {
          console.error("AST Analysis failed:", error);
          astAnalysis = this.createNeutralASTResult();
        }
      }
    } else {
      astAnalysis = this.createNeutralASTResult();
    }

    // Run LLM critique if enabled and tests passed
    if (config.llmCritique.enabled) {
      if (!config.llmCritique.onlyIfTestsPass || testResults.passed) {
        try {
          llmCritique = await this.llmCritic.critique(submission, taskDescription);
        } catch (error: any) {
          console.error("LLM Critique failed:", error);
          // Continue with neutral style score
          llmCritique = this.createNeutralLLMResult();
        }
      }
    } else {
      llmCritique = this.createNeutralLLMResult();
    }

    // Step 4: Calculate weighted final score
    const finalScore = this.calculateFinalScore(
      testResults.correctnessScore,
      astAnalysis.complexityScore,
      llmCritique?.styleScore ?? 0.5,
      config.weights
    );

    // Step 5: Generate overall feedback
    const overallFeedback = this.generateOverallFeedback(
      testResults,
      astAnalysis,
      llmCritique
    );

    // Step 6: Calculate grade points
    const gradePoints = Math.round(finalScore * config.maxPoints);

    return {
      correctnessScore: testResults.correctnessScore,
      complexityScore: astAnalysis.complexityScore,
      styleScore: llmCritique?.styleScore ?? 0.5,
      finalScore,
      weights: config.weights,
      feedback: {
        testResults,
        astAnalysis,
        llmCritique,
      },
      overallFeedback,
      gradePoints,
      maxPoints: config.maxPoints,
    };
  }

  /**
   * Creates result with minimal score when tests fail
   */
  private createMinimalScoreResult(
    testResults: TestRunnerResult,
    config: GradingConfig,
    message: string
  ): HybridGradingResult {
    const finalScore = testResults.correctnessScore * config.weights.correctness;
    const gradePoints = Math.round(finalScore * config.maxPoints);

    return {
      correctnessScore: testResults.correctnessScore,
      complexityScore: 0.0, // No complexity score if tests fail
      styleScore: 0.0, // No style score if tests fail
      finalScore,
      weights: config.weights,
      feedback: {
        testResults,
        astAnalysis: this.createNeutralASTResult(),
        llmCritique: undefined, // Skip LLM if tests fail
      },
      overallFeedback: message,
      gradePoints,
      maxPoints: config.maxPoints,
    };
  }

  /**
   * Creates neutral AST result (used when AST analysis is disabled or fails)
   */
  private createNeutralASTResult(): ASTAnalysisResult {
    return {
      complexityScore: 0.5, // Neutral score
      metrics: {
        cyclomaticComplexity: 0,
        maxNestingDepth: 0,
        hasRecursion: false,
        hasLoops: false,
        functionCount: 0,
        averageFunctionLength: 0,
      },
      violations: [],
      suggestions: [],
    };
  }

  /**
   * Creates neutral LLM result (used when LLM critique is disabled or fails)
   */
  private createNeutralLLMResult(): LLMCodeCritiqueResult {
    return {
      styleScore: 0.5, // Neutral score
      feedback: {
        readability: "Стиль коду не було проаналізовано.",
        style: "Стиль коду не було проаналізовано.",
        logic: "Логіка коду не була проаналізована.",
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

  /**
   * Calculates weighted final score
   */
  private calculateFinalScore(
    correctness: number,
    complexity: number,
    style: number,
    weights: GradingConfig['weights']
  ): number {
    return (
      correctness * weights.correctness +
      complexity * weights.complexity +
      style * weights.style
    );
  }

  /**
   * Generates overall feedback message
   */
  private generateOverallFeedback(
    testResults: TestRunnerResult,
    astAnalysis: ASTAnalysisResult,
    llmCritique?: LLMCodeCritiqueResult
  ): string {
    const parts: string[] = [];

    // Test results
    if (testResults.passed) {
      parts.push(`✅ Всі тести пройдені (${testResults.passedCount}/${testResults.totalCount}).`);
    } else {
      parts.push(`❌ Тести не пройдені (${testResults.passedCount}/${testResults.totalCount}).`);
    }

    // Complexity feedback
    if (astAnalysis.complexityScore >= 0.8) {
      parts.push("✅ Код має хорошу структуру та управління складністю.");
    } else if (astAnalysis.complexityScore >= 0.6) {
      parts.push("⚠️ Складність коду в межах норми, але є простір для покращення.");
    } else {
      parts.push("⚠️ Код має високу складність. Рекомендується спрощення.");
    }

    if (astAnalysis.violations.length > 0) {
      parts.push(`⚠️ Виявлено ${astAnalysis.violations.length} порушень best practices.`);
    }

    // Style feedback
    if (llmCritique) {
      if (llmCritique.styleScore >= 0.8) {
        parts.push("✅ Відмінний стиль коду та читабельність.");
      } else if (llmCritique.styleScore >= 0.6) {
        parts.push("⚠️ Стиль коду хороший, але є рекомендації для покращення.");
      } else {
        parts.push("⚠️ Стиль коду потребує покращення.");
      }
    }

    return parts.join(" ");
  }
}

/**
 * Default grading configuration
 */
export const DEFAULT_GRADING_CONFIG: GradingConfig = {
  weights: {
    correctness: 0.6,  // 60% - tests are most important
    complexity: 0.25,  // 25% - code structure matters
    style: 0.15,       // 15% - style is nice to have
  },
  astAnalysis: {
    enabled: true,
    maxComplexity: 10,
    forbiddenConstructs: [
      // Java
      "System.exit",
      "Runtime.exec",
      // Python
      "eval",
      "exec",
      "__import__",
    ],
  },
  llmCritique: {
    enabled: true,
    onlyIfTestsPass: true, // Only run LLM if all tests pass
    provider: "cloudflare",
  },
  maxPoints: 12,
};

