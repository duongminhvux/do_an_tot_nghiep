export const endpoints = {
  login: "/api/auth/login", dashboard: "/api/dashboard", courses: "/api/courses",
  course: (slug: string) => `/api/courses/${slug}`, lesson: (course: string, lesson: string) => `/api/courses/${course}/lessons/${lesson}`,
  exercise: (id: string) => `/api/exercises/${id}`, history: "/api/history", profile: "/api/profile", settings: "/api/settings",
};
