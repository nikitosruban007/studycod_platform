/**
 * Hybrid Grading Pipeline - Interfaces and Types
 * 
 * Architecture for next-generation code evaluation system
 * combining: Tests + AST Analysis + LLM Code Critique
 */

/**
 * Input: Student's code submission
 */
export interface CodeSubmission {
  code: string;
  language: "JAVA" | "PYTHON";
  taskId: number;
  userId: number;
  testData: TestDataItem[];
}

export interface TestDataItem {
  input: string;
  output: string;
  explanation?: string;
}

/**
 * Test Runner Result
 */
export interface TestRunnerResult {
  passed: boolean;
  passedCount: number;
  totalCount: number;
  testResults: Array<{
    testIndex: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error?: string;
  }>;
  correctnessScore: number; // 0.0 - 1.0 (based on passed tests)
}

/**
 * AST Analysis Result
 */
export interface ASTAnalysisResult {
  complexityScore: number; // 0.0 - 1.0 (higher = better complexity management)
  metrics: {
    cyclomaticComplexity: number;
    maxNestingDepth: number;
    hasRecursion: boolean;
    hasLoops: boolean;
    functionCount: number;
    averageFunctionLength: number;
  };
  violations: Array<{
    type: "FORBIDDEN_CONSTRUCT" | "COMPLEXITY_THRESHOLD" | "CODE_SMELL";
    severity: "LOW" | "MEDIUM" | "HIGH";
    message: string;
    line?: number;
  }>;
  suggestions: Array<{
    type: "OPTIMIZATION" | "REFACTORING" | "BEST_PRACTICE";
    message: string;
    line?: number;
  }>;
}

/**
 * LLM Code Critique Result
 */
export interface LLMCodeCritiqueResult {
  styleScore: number; // 0.0 - 1.0 (code style, readability, maintainability)
  feedback: {
    readability: string;
    style: string;
    logic: string;
    optimizations: string[];
    warnings: string[];
  };
  detailedAnalysis: {
    namingConventions: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    codeOrganization: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    errorHandling: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NONE";
    documentation: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NONE";
  };
}

/**
 * Final Grading Result
 */
export interface HybridGradingResult {
  // Individual scores (0.0 - 1.0)
  correctnessScore: number;
  complexityScore: number;
  styleScore: number;
  
  // Weighted final score (0.0 - 1.0)
  finalScore: number;
  
  // Weights used for calculation
  weights: {
    correctness: number; // Default: 0.6
    complexity: number;  // Default: 0.25
    style: number;       // Default: 0.15
  };
  
  // Detailed feedback
  feedback: {
    testResults: TestRunnerResult;
    astAnalysis: ASTAnalysisResult;
    llmCritique?: LLMCodeCritiqueResult; // Optional if tests failed
  };
  
  // Overall feedback message
  overallFeedback: string;
  
  // Grade in points (e.g., 0-12)
  gradePoints: number;
  maxPoints: number;
}

/**
 * Grading Configuration
 */
export interface GradingConfig {
  weights: {
    correctness: number;
    complexity: number;
    style: number;
  };
  astAnalysis: {
    enabled: boolean;
    maxComplexity: number;
    forbiddenConstructs: string[];
  };
  llmCritique: {
    enabled: boolean;
    onlyIfTestsPass: boolean; // Only run LLM if all tests pass
    provider: "cloudflare" | "openrouter";
    model?: string;
  };
  maxPoints: number;
}

