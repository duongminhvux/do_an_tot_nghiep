import { AttemptStatus, ContentStatus, DictationMode, ExerciseType, ProgressStatus, ToeicPart, UserRole, UserStatus } from "@/domain/enums";
import type { Course, CourseEnrollment, Lesson, LessonProgress, ListeningAttempt, ListeningExercise, User } from "@/domain/entities";
import type { UserSettingsDto } from "@/domain/dto";

export const users: User[] = [
  { id: "user-student", fullName: "Anna Peterson", email: "student@listenup.test", role: UserRole.STUDENT, status: UserStatus.ACTIVE, targetLevel: "B2 — Upper intermediate", learningGoal: "Speak confidently at work" },
  { id: "user-blocked", fullName: "Blocked Student", email: "blocked@listenup.test", role: UserRole.STUDENT, status: UserStatus.BLOCKED, targetLevel: "B1", learningGoal: "Travel" },
];

export const courses: Course[] = [
  { id: "course-everyday", slug: "everyday-conversations", title: "Everyday Conversations", category: "General English", description: "Learn daily conversations and expressions for real-life situations.", level: "Beginner", status: ContentStatus.PUBLISHED, theme: "person" },
  { id: "course-business", slug: "business-english-listening", title: "Business English Listening", category: "Business English", description: "Improve your listening in meetings, presentations and negotiations.", level: "Intermediate", status: ContentStatus.PUBLISHED, theme: "meeting" },
  { id: "course-toeic", slug: "toeic-listening-mastery", title: "TOEIC Listening Mastery", category: "TOEIC", description: "Master every TOEIC listening part with targeted guided practice.", level: "Advanced", status: ContentStatus.PUBLISHED, theme: "headphones" },
];

const vocab = [
  { term: "objection", pronunciation: "/əbˈdʒek.ʃən/", definition: "A reason for disagreeing" },
  { term: "concern", pronunciation: "/kənˈsɜːn/", definition: "A worry or important matter" },
  { term: "clarify", pronunciation: "/ˈklær.ɪ.faɪ/", definition: "Make something easier to understand" },
];
const expressions = [
  { phrase: "I see your point, however…", meaning: "A polite way to disagree" },
  { phrase: "That’s a valid concern.", meaning: "Acknowledge another viewpoint" },
  { phrase: "Let me clarify that.", meaning: "Offer a clearer explanation" },
];

export const lessons: Lesson[] = [
  { id: "lesson-intros", courseId: "course-business", slug: "introductions", order: 1, title: "Introductions", description: "Introduce yourself and colleagues naturally.", duration: 12, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
  { id: "lesson-meeting", courseId: "course-business", slug: "before-the-meeting", order: 2, title: "Before the Meeting", description: "Prepare for a productive business meeting.", duration: 14, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
  { id: "lesson-objections", courseId: "course-business", slug: "handling-objections", order: 3, title: "Handling Objections", description: "Learn how to recognize objections clearly and respond with confidence and sensitivity.", duration: 15, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
  { id: "lesson-followup", courseId: "course-business", slug: "meeting-follow-up", order: 4, title: "Meeting Follow-up", description: "Confirm actions after a meeting.", duration: 11, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
  { id: "lesson-smalltalk", courseId: "course-everyday", slug: "friendly-small-talk", order: 1, title: "Friendly Small Talk", description: "Start friendly conversations with confidence.", duration: 10, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
  { id: "lesson-cafe", courseId: "course-everyday", slug: "at-the-cafe", order: 2, title: "At the Café", description: "Order food and handle common requests.", duration: 13, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
  { id: "lesson-toeic-photos", courseId: "course-toeic", slug: "photographs", order: 1, title: "Part 1: Photographs", description: "Choose the sentence that best describes a photograph.", duration: 18, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
  { id: "lesson-toeic-talks", courseId: "course-toeic", slug: "short-talks", order: 2, title: "Part 4: Short Talks", description: "Answer questions about short workplace talks.", duration: 22, status: ContentStatus.PUBLISHED, vocabulary: vocab, expressions },
];

const audio = { id: "audio-tone", url: "generated://listenup-tone", duration: 16, mimeType: "audio/wav" };
export const exercises: ListeningExercise[] = [
  { id: "dictation-objections", lessonId: "lesson-objections", title: "Business Telephone Conversation", type: ExerciseType.DICTATION, status: ContentStatus.PUBLISHED, maxListenCount: 3, maxAttemptCount: 3, passThreshold: 80, dictationMode: DictationMode.SENTENCE, correctAnswer: "I'm calling to confirm our meeting on Friday. Please let me know if there are any changes." },
  { id: "dictation-cafe", lessonId: "lesson-cafe", title: "Ordering at the Café", type: ExerciseType.DICTATION, status: ContentStatus.PUBLISHED, maxListenCount: 3, maxAttemptCount: 3, passThreshold: 80, dictationMode: DictationMode.PARAGRAPH, correctAnswer: "Could I have a cup of coffee and a cheese sandwich, please?" },
  { id: "toeic-photos", lessonId: "lesson-toeic-photos", title: "TOEIC Test & Conversation", type: ExerciseType.TOEIC, status: ContentStatus.PUBLISHED, maxListenCount: 3, maxAttemptCount: 3, passThreshold: 70, toeicPart: ToeicPart.PART_1, groups: [{ id: "group-photo", audio, image: "station", questions: [{ id: "q-photo-1", prompt: "What is happening in the picture?", correctOptionId: "q1-a", explanation: "The suitcase is placed beside the traveler.", options: [{ id: "q1-a", label: "A", text: "A suitcase has been placed beside a traveler." }, { id: "q1-b", label: "B", text: "The passengers are boarding a bus." }, { id: "q1-c", label: "C", text: "A meeting is taking place." }, { id: "q1-d", label: "D", text: "The platform is being cleaned." }] }] }] },
  { id: "toeic-talks", lessonId: "lesson-toeic-talks", title: "Short Talks Practice", type: ExerciseType.TOEIC, status: ContentStatus.PUBLISHED, maxListenCount: 2, maxAttemptCount: 3, passThreshold: 70, toeicPart: ToeicPart.PART_4, groups: [{ id: "group-talk", audio: { ...audio, duration: 32 }, transcript: "Welcome to this morning's product briefing.", questions: [
    { id: "q-talk-1", prompt: "What is the purpose of the talk?", correctOptionId: "q2-b", explanation: "The speaker introduces a product briefing.", options: [{ id: "q2-a", label: "A", text: "To announce a delay" }, { id: "q2-b", label: "B", text: "To introduce a product briefing" }, { id: "q2-c", label: "C", text: "To welcome a new employee" }, { id: "q2-d", label: "D", text: "To change a reservation" }] },
    { id: "q-talk-2", prompt: "What will listeners most likely do next?", correctOptionId: "q3-c", explanation: "The briefing will continue with a demonstration.", options: [{ id: "q3-a", label: "A", text: "Leave the building" }, { id: "q3-b", label: "B", text: "Call a customer" }, { id: "q3-c", label: "C", text: "Watch a demonstration" }, { id: "q3-d", label: "D", text: "Complete an invoice" }] },
  ] }] },
];

export const enrollments: CourseEnrollment[] = courses.map((course, index) => ({ id: `enrollment-${index + 1}`, userId: "user-student", courseId: course.id, enrolledAt: `2026-0${index + 1}-10T09:00:00.000Z` }));
export const lessonProgress: LessonProgress[] = [
  { userId: "user-student", lessonId: "lesson-intros", status: ProgressStatus.COMPLETED },
  { userId: "user-student", lessonId: "lesson-meeting", status: ProgressStatus.COMPLETED },
  { userId: "user-student", lessonId: "lesson-objections", status: ProgressStatus.IN_PROGRESS, lastOpenedAt: "2026-07-13T08:30:00.000Z" },
  { userId: "user-student", lessonId: "lesson-smalltalk", status: ProgressStatus.COMPLETED },
  { userId: "user-student", lessonId: "lesson-cafe", status: ProgressStatus.IN_PROGRESS },
  { userId: "user-student", lessonId: "lesson-toeic-photos", status: ProgressStatus.COMPLETED },
];
export const seedAttempts: ListeningAttempt[] = [
  { id: "attempt-pass-1", userId: "user-student", exerciseId: "dictation-cafe", status: AttemptStatus.SUBMITTED, attemptNumber: 1, listenCount: 2, answers: [{ value: "Could I have a cup of coffee and cheese sandwich please" }], score: 88, passed: true, startedAt: "2026-07-10T08:00:00.000Z", submittedAt: "2026-07-10T08:05:00.000Z" },
  { id: "attempt-toeic-1", userId: "user-student", exerciseId: "toeic-photos", status: AttemptStatus.SUBMITTED, attemptNumber: 1, listenCount: 1, answers: [{ questionId: "q-photo-1", value: "q1-a" }], score: 100, passed: true, startedAt: "2026-07-11T08:00:00.000Z", submittedAt: "2026-07-11T08:04:00.000Z" },
];
export const defaultSettings: UserSettingsDto = { emailNotifications: true, learningReminder: true, playbackSpeed: 1, reducedMotion: false };
