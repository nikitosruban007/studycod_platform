/**
 * TestRunner - Executes student code against test cases
 * 
 * This is the foundation of the grading system.
 * If tests fail, the code gets minimal score regardless of other factors.
 */

import { CodeSubmission, TestRunnerResult } from './interfaces';
import { executeCodeWithInput } from '../codeExecutionService';

export interface ITestRunner {
  /**
   * Runs all test cases against student's code
   * @param submission Student's code submission
   * @returns Test execution results with correctness score
   */
  runTests(submission: CodeSubmission): Promise<TestRunnerResult>;
}

export class TestRunner implements ITestRunner {
  async runTests(submission: CodeSubmission): Promise<TestRunnerResult> {
    const { code, language, testData } = submission;
    const testResults: TestRunnerResult['testResults'] = [];
    let passedCount = 0;

    for (let i = 0; i < testData.length; i++) {
      const test = testData[i];
      
      try {
        // Execute code with test input (stdout is used for comparison)
        const exec = await executeCodeWithInput(code, language, test.input, 10000);
        const actualOutput = exec.stdout ?? "";

        // Normalize outputs for comparison (trim, handle whitespace)
        const normalizedExpected = this.normalizeOutput(test.output);
        const normalizedActual = this.normalizeOutput(actualOutput);

        const passed = normalizedExpected === normalizedActual;
        if (passed) passedCount++;

        testResults.push({
          testIndex: i + 1,
          input: test.input,
          expectedOutput: test.output,
          actualOutput,
          passed,
        });
      } catch (error: any) {
        testResults.push({
          testIndex: i + 1,
          input: test.input,
          expectedOutput: test.output,
          actualOutput: '',
          passed: false,
          error: error.message || 'Execution error',
        });
      }
    }

    // Calculate correctness score: passed tests / total tests
    const correctnessScore = testData.length > 0 
      ? passedCount / testData.length 
      : 0;

    return {
      passed: passedCount === testData.length,
      passedCount,
      totalCount: testData.length,
      testResults,
      correctnessScore,
    };
  }

  /**
   * Normalizes output for comparison (handles whitespace, newlines, etc.)
   */
  private normalizeOutput(output: string): string {
    return output
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }
}

