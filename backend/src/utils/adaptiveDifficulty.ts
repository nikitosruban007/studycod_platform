// Утиліта для розрахунку адаптивної складності без oscillation

/**
 * Розраховує адаптивну складність на основі історії оцінок
 */
export function calculateAdaptiveDifus(
  averageGrade: number,
  last3Grades: number[],
  topicIndex: number
): number {
  // Базовий difus залежить від теми (перші теми легші)
  const baseDifus = topicIndex < 5 ? 0 : topicIndex < 10 ? 0.5 : 1;

  // Адаптація на основі оцінок
  if (averageGrade >= 9 && last3Grades.length === 3 && last3Grades.every((g) => g >= 9)) {
    // Всі останні 3 оцінки 9+ → підвищити
    return Math.min(1, baseDifus + 0.3);
  } else if (averageGrade >= 7 && last3Grades.length === 3 && last3Grades.every((g) => g >= 7)) {
    // Всі останні 3 оцінки 7+ → залишити як є
    return baseDifus;
  } else if (averageGrade < 6 || (last3Grades.length > 0 && last3Grades.some((g) => g < 5))) {
    // Середня < 6 або є оцінка < 5 → знизити
    return Math.max(0, baseDifus - 0.3);
  }

  return baseDifus;
}

/**
 * Отримує стабільну складність з захистом від oscillation
 */
export async function getStableDifus(
  userId: number,
  lang: "JAVA" | "PYTHON",
  topicIndex: number,
  userRepo: () => any,
  gradeRepo: () => any
): Promise<number> {
  const user = await userRepo().findOne({ where: { id: userId } });
  if (!user) {
    return topicIndex < 5 ? 0 : topicIndex < 10 ? 0.5 : 1;
  }

  // Отримуємо останні 5 оцінок для цієї мови через QueryBuilder
  const grades = await gradeRepo()
    .createQueryBuilder("grade")
    .leftJoinAndSelect("grade.task", "task")
    .where("grade.user_id = :userId", { userId })
    .andWhere("task.lang = :lang", { lang })
    .orderBy("grade.createdAt", "DESC")
    .take(5)
    .getMany();

  const validGrades = grades.filter(
    (g: any) => g.total !== null && g.total !== undefined
  );

  if (validGrades.length < 3) {
    // Недостатньо даних - повертаємо базовий difus
    const currentDifus = lang === "JAVA" ? user.difusJava : user.difusPython;
    return currentDifus;
  }

  const last5Grades = validGrades.slice(0, 5).map((g: any) => g.total ?? 0);
  const last3Grades = last5Grades.slice(0, 3);
  const averageGrade = last5Grades.reduce((sum: number, g: number) => sum + g, 0) / last5Grades.length;

  const newDifus = calculateAdaptiveDifus(averageGrade, last3Grades, topicIndex);
  const currentDifus = lang === "JAVA" ? user.difusJava : user.difusPython;

  // Захист від oscillation: змінювати тільки якщо різниця >= 0.3
  if (Math.abs(newDifus - currentDifus) >= 0.3) {
    // Перевірити, чи не змінювали нещодавно (через lastDifusChange або кількість завдань)
    const lastChange = (user as any).lastDifusChange || new Date(0);
    const daysSinceChange = Math.floor(
      (new Date().getTime() - new Date(lastChange).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Змінювати тільки якщо пройшло >= 1 день або менше 3 завдань
    if (daysSinceChange >= 1 || validGrades.length < 3) {
      // Оновити difus
      if (lang === "JAVA") {
        user.difusJava = newDifus;
      } else {
        user.difusPython = newDifus;
      }
      (user as any).lastDifusChange = new Date();
      await userRepo().save(user);
      return newDifus;
    }
  }

  return currentDifus;
}


/**
 * Розраховує адаптивну складність на основі історії оцінок
 */
export function calculateAdaptiveDifus(
  averageGrade: number,
  last3Grades: number[],
  topicIndex: number
): number {
  // Базовий difus залежить від теми (перші теми легші)
  const baseDifus = topicIndex < 5 ? 0 : topicIndex < 10 ? 0.5 : 1;

  // Адаптація на основі оцінок
  if (averageGrade >= 9 && last3Grades.length === 3 && last3Grades.every((g) => g >= 9)) {
    // Всі останні 3 оцінки 9+ → підвищити
    return Math.min(1, baseDifus + 0.3);
  } else if (averageGrade >= 7 && last3Grades.length === 3 && last3Grades.every((g) => g >= 7)) {
    // Всі останні 3 оцінки 7+ → залишити як є
    return baseDifus;
  } else if (averageGrade < 6 || (last3Grades.length > 0 && last3Grades.some((g) => g < 5))) {
    // Середня < 6 або є оцінка < 5 → знизити
    return Math.max(0, baseDifus - 0.3);
  }

  return baseDifus;
}

/**
 * Отримує стабільну складність з захистом від oscillation
 */
export async function getStableDifus(
  userId: number,
  lang: "JAVA" | "PYTHON",
  topicIndex: number,
  userRepo: () => any,
  gradeRepo: () => any
): Promise<number> {
  const user = await userRepo().findOne({ where: { id: userId } });
  if (!user) {
    return topicIndex < 5 ? 0 : topicIndex < 10 ? 0.5 : 1;
  }

  // Отримуємо останні 5 оцінок для цієї мови через QueryBuilder
  const grades = await gradeRepo()
    .createQueryBuilder("grade")
    .leftJoinAndSelect("grade.task", "task")
    .where("grade.user_id = :userId", { userId })
    .andWhere("task.lang = :lang", { lang })
    .orderBy("grade.createdAt", "DESC")
    .take(5)
    .getMany();

  const validGrades = grades.filter(
    (g: any) => g.total !== null && g.total !== undefined
  );

  if (validGrades.length < 3) {
    // Недостатньо даних - повертаємо базовий difus
    const currentDifus = lang === "JAVA" ? user.difusJava : user.difusPython;
    return currentDifus;
  }

  const last5Grades = validGrades.slice(0, 5).map((g: any) => g.total ?? 0);
  const last3Grades = last5Grades.slice(0, 3);
  const averageGrade = last5Grades.reduce((sum: number, g: number) => sum + g, 0) / last5Grades.length;

  const newDifus = calculateAdaptiveDifus(averageGrade, last3Grades, topicIndex);
  const currentDifus = lang === "JAVA" ? user.difusJava : user.difusPython;

  // Захист від oscillation: змінювати тільки якщо різниця >= 0.3
  if (Math.abs(newDifus - currentDifus) >= 0.3) {
    // Перевірити, чи не змінювали нещодавно (через lastDifusChange або кількість завдань)
    const lastChange = (user as any).lastDifusChange || new Date(0);
    const daysSinceChange = Math.floor(
      (new Date().getTime() - new Date(lastChange).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Змінювати тільки якщо пройшло >= 1 день або менше 3 завдань
    if (daysSinceChange >= 1 || validGrades.length < 3) {
      // Оновити difus
      if (lang === "JAVA") {
        user.difusJava = newDifus;
      } else {
        user.difusPython = newDifus;
      }
      (user as any).lastDifusChange = new Date();
      await userRepo().save(user);
      return newDifus;
    }
  }

  return currentDifus;
}

