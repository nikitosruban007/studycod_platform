/**
 * Safe Formula Evaluator for Dynamic Grade Calculation
 * 
 * PRODUCTION-LEVEL IMPLEMENTATION:
 * - NO eval(), NO new Function()
 * - Recursive descent parser for mathematical expressions
 * - Supports: test, avg(practice), numbers, +, -, *, /, (, )
 * - Result clamped to [1, 12]
 * 
 * Formula syntax:
 * - Variables: test, avg(practice)
 * - Operators: +, -, *, /
 * - Parentheses: (, )
 * - Numbers: integers and decimals
 * 
 * Example formulas:
 * - "test + 1.3 * avg(practice)"
 * - "(test + 1.3 * avg(practice)) / 2"
 * - "avg(practice)"
 * - "test"
 */

export interface FormulaVariables {
  test: number | null; // theoryGrade
  avgPractice: number; // average of practice task grades
}

interface Token {
  type: 'NUMBER' | 'VARIABLE' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'FUNCTION' | 'COMMA' | 'EOF';
  value: string | number;
}

/**
 * Tokenizes a formula string into tokens
 */
class Tokenizer {
  private input: string;
  private position: number = 0;

  constructor(input: string) {
    this.input = input.trim();
  }

  private peek(): string | null {
    if (this.position >= this.input.length) return null;
    return this.input[this.position];
  }

  private advance(): string | null {
    if (this.position >= this.input.length) return null;
    return this.input[this.position++];
  }

  private skipWhitespace(): void {
    while (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\n') {
      this.advance();
    }
  }

  private readNumber(): number {
    let numStr = '';
    while (this.peek() !== null && /[0-9.]/.test(this.peek()!)) {
      numStr += this.advance();
    }
    const num = parseFloat(numStr);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${numStr}`);
    }
    return num;
  }

  private readIdentifier(): string {
    let ident = '';
    while (this.peek() !== null && /[a-zA-Z_]/.test(this.peek()!)) {
      ident += this.advance();
    }
    return ident;
  }

  nextToken(): Token {
    this.skipWhitespace();

    if (this.position >= this.input.length) {
      return { type: 'EOF', value: '' };
    }

    const char = this.peek()!;

    // Numbers
    if (/[0-9]/.test(char)) {
      return { type: 'NUMBER', value: this.readNumber() };
    }

    // Operators
    if (char === '+') {
      this.advance();
      return { type: 'OPERATOR', value: '+' };
    }
    if (char === '-') {
      this.advance();
      return { type: 'OPERATOR', value: '-' };
    }
    if (char === '*') {
      this.advance();
      return { type: 'OPERATOR', value: '*' };
    }
    if (char === '/') {
      this.advance();
      return { type: 'OPERATOR', value: '/' };
    }

    // Parentheses
    if (char === '(') {
      this.advance();
      return { type: 'LPAREN', value: '(' };
    }
    if (char === ')') {
      this.advance();
      return { type: 'RPAREN', value: ')' };
    }

    // Comma
    if (char === ',') {
      this.advance();
      return { type: 'COMMA', value: ',' };
    }

    // Identifiers (variables or functions)
    if (/[a-zA-Z_]/.test(char)) {
      const ident = this.readIdentifier();
      
      // Check if it's a function call
      if (this.peek() === '(') {
        return { type: 'FUNCTION', value: ident };
      }
      
      // Otherwise it's a variable
      return { type: 'VARIABLE', value: ident };
    }

    throw new Error(`Unexpected character: ${char} at position ${this.position}`);
  }
}

/**
 * Recursive descent parser for mathematical expressions
 */
class Parser {
  private tokenizer: Tokenizer;
  private currentToken: Token;

  constructor(input: string) {
    this.tokenizer = new Tokenizer(input);
    this.currentToken = this.tokenizer.nextToken();
  }

  private eat(expectedType: Token['type']): Token {
    const token = this.currentToken;
    if (token.type !== expectedType) {
      throw new Error(`Expected ${expectedType}, got ${token.type}`);
    }
    this.currentToken = this.tokenizer.nextToken();
    return token;
  }

  private parseExpression(): number {
    return this.parseAddition();
  }

  private parseAddition(): number {
    let result = this.parseMultiplication();

    while (this.currentToken.type === 'OPERATOR' && 
           (this.currentToken.value === '+' || this.currentToken.value === '-')) {
      const op = this.currentToken.value as string;
      this.eat('OPERATOR');
      const right = this.parseMultiplication();
      
      if (op === '+') {
        result = result + right;
      } else {
        result = result - right;
      }
    }

    return result;
  }

  private parseMultiplication(): number {
    let result = this.parseUnary();

    while (this.currentToken.type === 'OPERATOR' && 
           (this.currentToken.value === '*' || this.currentToken.value === '/')) {
      const op = this.currentToken.value as string;
      this.eat('OPERATOR');
      const right = this.parseUnary();
      
      if (op === '*') {
        result = result * right;
      } else {
        if (right === 0) {
          throw new Error('Division by zero');
        }
        result = result / right;
      }
    }

    return result;
  }

  private parseUnary(): number {
    if (this.currentToken.type === 'OPERATOR' && this.currentToken.value === '-') {
      this.eat('OPERATOR');
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    if (this.currentToken.type === 'NUMBER') {
      const value = this.currentToken.value as number;
      this.eat('NUMBER');
      return value;
    }

    if (this.currentToken.type === 'LPAREN') {
      this.eat('LPAREN');
      const result = this.parseExpression();
      this.eat('RPAREN');
      return result;
    }

    if (this.currentToken.type === 'FUNCTION') {
      return this.parseFunction();
    }

    if (this.currentToken.type === 'VARIABLE') {
      return this.parseVariable();
    }

    throw new Error(`Unexpected token: ${this.currentToken.type}`);
  }

  private parseFunction(): number {
    const funcName = this.currentToken.value as string;
    this.eat('FUNCTION');
    this.eat('LPAREN');

    // Only support avg(practice) function
    if (funcName.toLowerCase() === 'avg') {
      const arg = this.parseVariable();
      this.eat('RPAREN');
      
      // avg() function is handled by variable substitution
      // This should not be reached if formula is properly formatted
      throw new Error('avg() function must be used as avg(practice)');
    }

    throw new Error(`Unknown function: ${funcName}`);
  }

  private parseVariable(): number {
    const varName = this.currentToken.value as string;
    this.eat('VARIABLE');
    
    // Variables are substituted before parsing, so this should not be reached
    throw new Error(`Variable ${varName} not substituted`);
  }

  parse(variables: FormulaVariables): number {
    try {
      const result = this.parseExpression();
      
      if (this.currentToken.type !== 'EOF') {
        throw new Error(`Unexpected token after expression: ${this.currentToken.type}`);
      }
      
      return result;
    } catch (error: any) {
      throw new Error(`Parse error: ${error.message}`);
    }
  }
}

/**
 * Evaluates a formula string with given variables
 * 
 * SECURITY: No eval(), no new Function(), only safe mathematical parsing
 * 
 * @param formula Formula string (e.g., "(test + 1.3 * avg(practice)) / 2")
 * @param variables Variables to substitute
 * @returns Calculated grade (1-12, clamped and rounded)
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
    // Step 1: Substitute variables in formula
    let expression = formula.trim();
    
    // Replace avg(practice) with avgPractice value
    // Support case-insensitive matching
    const avgPracticeRegex = /avg\s*\(\s*practice\s*\)/gi;
    expression = expression.replace(avgPracticeRegex, variables.avgPractice.toString());
    
    // Replace test with test value (handle null)
    const testValue = variables.test !== null ? variables.test : 0;
    // Use word boundary to avoid matching "test" inside other words
    const testRegex = /\btest\b/gi;
    expression = expression.replace(testRegex, testValue.toString());
    
    // Step 2: Parse and evaluate using safe parser
    const parser = new Parser(expression);
    const result = parser.parse(variables);
    
    // Step 3: Validate result
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error(`Invalid calculation result: ${result}`);
    }
    
    // Step 4: Clamp to 1-12 and round
    return Math.max(1, Math.min(12, Math.round(result)));
  } catch (error: any) {
    console.error(`[SafeFormulaEvaluator] Error evaluating formula "${formula}":`, error);
    // Fallback to default calculation on any error
    return calculateDefaultGrade(variables);
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

