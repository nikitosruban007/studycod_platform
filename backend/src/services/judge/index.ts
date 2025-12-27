/**
 * Експорт всіх компонентів системи перевірки рішень
 */
export * from "./types/Task";
export * from "./engine/TaskValidator";
export * from "./engine/JudgeEngine";
export * from "./validators";

// Основні функції для зручності
export { judgeSolution } from "./engine/JudgeEngine";
export { validateTaskConfig } from "./engine/TaskValidator";
export {
  getCustomValidator,
  registerCustomValidator,
  customValidators,
} from "./validators";
