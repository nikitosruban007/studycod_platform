/**
 * AssessmentType - Тип оцінки
 * 
 * КРИТИЧНО: Це жорстка модель, яка визначає логіку обробки оцінок.
 * 
 * PRACTICE: домашні завдання, вправи
 * - Входять у середні
 * - Не можуть замінити контрольну
 * 
 * INTERMEDIATE: тематичні/проміжні оцінки
 * - Входять у середні
 * - Не можуть замінити контрольну
 * 
 * CONTROL: контрольна робота (ФІНАЛ)
 * - НЕ входять у середні
 * - Зберігаються в control_grade
 * - Впливають на фінальний результат
 */
export enum AssessmentType {
  PRACTICE = "PRACTICE",      // домашні, вправи
  INTERMEDIATE = "INTERMEDIATE", // тематичні
  CONTROL = "CONTROL"         // контрольна (ФІНАЛ)
}

/**
 * Runtime check: перевірка, що CONTROL не зберігається як INTERMEDIATE
 */
export function validateAssessmentType(
  type: AssessmentType,
  controlWorkId: number | null | undefined,
  targetField?: string
): void {
  if (type === AssessmentType.CONTROL) {
    if (!controlWorkId) {
      throw new Error(
        `CONTROL assessment must have controlWorkId. ` +
        `Got: controlWorkId=${controlWorkId}, type=${type}`
      );
    }
    if (targetField && targetField !== 'control_grade' && targetField !== 'grade') {
      throw new Error(
        `CONTROL assessment cannot be stored in field '${targetField}'. ` +
        `Must use 'control_grade' or 'grade' in SummaryGrade.`
      );
    }
  }
  
  if (type === AssessmentType.INTERMEDIATE || type === AssessmentType.PRACTICE) {
    if (controlWorkId) {
      throw new Error(
        `INTERMEDIATE/PRACTICE assessment cannot have controlWorkId. ` +
        `Got: controlWorkId=${controlWorkId}, type=${type}`
      );
    }
  }
}

