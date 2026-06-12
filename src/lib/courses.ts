export const REGISTRATION_FEE = 20000;

export type CourseKey = "english" | "computer" | "swahili" | "french";

export const COURSES: Record<CourseKey, { label: string; fee: number; levels: string[] }> = {
  english: {
    label: "English",
    fee: 130000,
    levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"],
  },
  computer: { label: "Computer", fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
  swahili: { label: "Swahili", fee: 300000, levels: ["Beginner", "Intermediate", "Advanced"] },
  french: { label: "French", fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
};

export const formatUGX = (n: number) =>
  `UGX ${new Intl.NumberFormat("en-UG").format(n)}`;
