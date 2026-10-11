export const arenaStats = {
  rank: 128,
  rankChange: 24,
  rating: 1250,
  ratingChange: 35,
  total: 86,
  wins: 52,
  losses: 34,
  streak: 5,
  bestStreak: 8,
  winRate: 60.5,
};

export const friends = [
  {
    name: "Lê Hoàng Minh",
    initials: "HM",
    color: "blue",
    rating: 1320,
    online: true,
  },
  {
    name: "Trần Phương Thảo",
    initials: "PT",
    color: "rose",
    rating: 1285,
    online: true,
  },
  {
    name: "Nguyễn Thanh Tùng",
    initials: "TT",
    color: "amber",
    rating: 1410,
    online: true,
  },
  {
    name: "Vũ Hoài An",
    initials: "HA",
    color: "teal",
    rating: 1190,
    online: false,
  },
];

export const demoQuestions = [
  {
    word: "Challenge",
    options: ["Thử thách", "Cơ hội", "Thành công", "Kinh nghiệm"],
    answer: 0,
  },
  {
    word: "Improve",
    options: ["Ghi nhớ", "Cải thiện", "Khám phá", "So sánh"],
    answer: 1,
  },
  {
    word: "Achievement",
    options: ["Cuộc thi", "Thói quen", "Thành tựu", "Mục tiêu"],
    answer: 2,
  },
  {
    word: "Confident",
    options: ["Kiên nhẫn", "Sáng tạo", "Chăm chỉ", "Tự tin"],
    answer: 3,
  },
  {
    word: "Opportunity",
    options: ["Cơ hội", "Kiến thức", "Kỹ năng", "Tiến bộ"],
    answer: 0,
  },
];

export type ArenaMatch = {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl?: string;
  won: boolean;
  draw: boolean;
  score: [number, number];
  minutes: number;
  mode: "rank" | "friend" | "room";
  points: number;
};
