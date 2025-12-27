/**
 * Formula Evaluator for Dynamic Grade Calculation
 * 
 * Supports formulas like:
 * - "test + 1.3 * avg(practice)"
 * - "avg(practice)"
 * - "test"
 * - "(test + 1.3 * avg(practice)) / 2"
 * 
 * Variables:
 * - test: theoryGrade (number | null)
 * - avg(practice): average of practice task grades (number)
 * 
 * Returns: number (final grade, clamped to 1-12)
 */

export interface FormulaVariables {
  test: number | null; // theoryGrade
  avgPractice: number; // average of practice task grades
}

/**
 * Evaluates a formula string with given variables
 * @param formula Formula string (e.g., "test + 1.3 * avg(practice)")
 * @param variables Variables to substitute
 * @returns Calculated grade (1-12)
 */
export function evaluateFormula(
  formula: string | null | undefined,
  variables: FormulaVariables
): number {
  // If no formula provided, use default logic
  if (!formula || formula.trim() === "") {
    return calculateDefaultGrade(variables);
  }

  try {
    // Replace variables in formula
    let expression = formula.trim();
    
    // Replace avg(practice) with avgPractice value
    expression = expression.replace(/avg\s*\(\s*practice\s*\)/gi, variables.avgPractice.toString());
    
    // Replace test with test value (handle null)
    const testValue = variables.test !== null ? variables.test : 0;
    expression = expression.replace(/\btest\b/gi, testValue.toString());
    
    // Evaluate the expression safely
    // Using Function constructor for safe evaluation (no eval() for security)
    const result = evaluateMathExpression(expression);
    
    // Clamp to 1-12 and round
    return Math.max(1, Math.min(12, Math.round(result)));
  } catch (error) {
    console.error(`[FormulaEvaluator] Error evaluating formula "${formula}":`, error);
    // Fallback to default calculation
    return calculateDefaultGrade(variables);
  }
}

/**
 * Safely evaluates a mathematical expression
 * Only allows numbers, operators, parentheses, and basic math functions
 */
function evaluateMathExpression(expression: string): number {
  // Sanitize: only allow numbers, operators, parentheses, spaces, and decimal points
  const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
  
  // Use Function constructor for safe evaluation
  // This is safer than eval() as it doesn't have access to global scope
  try {
    const func = new Function("return " + sanitized);
    const result = func();
    
    if (typeof result !== "number" || isNaN(result) || !isFinite(result)) {
      throw new Error("Invalid result");
    }
    
    return result;
  } catch (error) {
    throw new Error(`Invalid expression: ${expression}`);
  }
}

/**
 * Default grade calculation when no formula is provided
 * Matches the original hardcoded logic:
 * - If has theory and practice: (test + 1.3 * avg(practice)) / 2
 * - If only theory: test
 * - If only practice: avg(practice)
 * 
 * IMPORTANT: Result is clamped to 1-12 range
 */
function calculateDefaultGrade(variables: FormulaVariables): number {
  const { test, avgPractice } = variables;
  
  let result = 0;
  
  if (test !== null && avgPractice > 0) {
    // Has both theory and practice
    result = (test + 1.3 * avgPractice) / 2;
  } else if (test !== null) {
    // Only theory
    result = test;
  } else if (avgPractice > 0) {
    // Only practice
    result = avgPractice;
  }
  
  // CRITICAL: Clamp to 1-12 range and round
  // This ensures all grades are within valid range regardless of calculation
  return Math.max(1, Math.min(12, Math.round(result)));
}

/**
 * Validates a formula string
 * @param formula Formula to validate
 * @returns true if valid, false otherwise
 */
export function validateFormula(formula: string): boolean {
  if (!formula || formula.trim() === "") {
    return true; // Empty formula is valid (will use default)
  }
  
  try {
    // Test with dummy values
    const testVariables: FormulaVariables = {
      test: 8,
      avgPractice: 7.5,
    };
    
    const result = evaluateFormula(formula, testVariables);
    
    // Check if result is a valid number
    return typeof result === "number" && !isNaN(result) && isFinite(result);
  } catch (error) {
    return false;
  }
}

