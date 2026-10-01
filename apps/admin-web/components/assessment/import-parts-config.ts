import { QuestionItem } from '@/types';

export interface ExamPartConfig {
  id: number;
  section: 'LISTENING' | 'READING';
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  desc: string;
  descEn: string;
  badge: string;
  badgeEn: string;
  questionCountHint: string;
  color: string;
  tagBg: string;
  hasPassage: boolean;
  hasAudio: boolean;
  hasImage: boolean;
  optionsCount: number;
  clusterSize: number;
  exerciseType: string;
  exerciseTypeName: string;
  exerciseTypeNameEn: string;
  exerciseTypeDesc: string;
  exerciseTypeDescEn: string;
  formatRules: string[];
  formatRulesEn: string[];
  sampleText: string;
  blankTemplate: string;
}

export function getAvailableParts(
  exam: { type?: string; section?: string },
  locale: string = 'vi',
): ExamPartConfig[] {
  const isToeic = (exam.type || 'TOEIC').toUpperCase() === 'TOEIC';

  if (isToeic) {
    const parts: ExamPartConfig[] = [
      {
        id: 1,
        section: 'LISTENING',
        title: 'Part 1 – Photographs',
        titleEn: 'Part 1 – Photographs',
        subtitle: 'Mô tả hình ảnh',
        subtitleEn: 'Photograph Description',
        desc: 'Nghe 4 phương án miêu tả (A, B, C, D) và chọn câu miêu tả đúng nhất bức tranh.',
        descEn: 'Listen to 4 statements (A, B, C, D) and choose the one that best describes the photograph.',
        badge: '4 lựa chọn • Kèm hình ảnh & Audio',
        badgeEn: '4 options • Image & Audio required',
        questionCountHint: '6 câu hỏi (Câu 1 - 6)',
        color: 'border-amber-200 bg-amber-50/60 text-amber-800',
        tagBg: 'bg-amber-100 text-amber-700',
        hasPassage: false,
        hasAudio: true,
        hasImage: true,
        optionsCount: 4,
        clusterSize: 1,
        exerciseType: 'PHOTO_DESCRIPTION',
        exerciseTypeName: 'Mô tả hình ảnh (Photographs)',
        exerciseTypeNameEn: 'Photograph Description',
        exerciseTypeDesc: 'Mỗi câu hỏi tương ứng với 1 hình ảnh và 1 file âm thanh nghe 4 phương án A, B, C, D.',
        exerciseTypeDescEn: 'Each question corresponds to 1 photograph and 1 audio file with options A, B, C, D.',
        formatRules: [
          'Khai báo link ảnh ở dòng: Image: https://... (hoặc đường dẫn ảnh).',
          'Khai báo link âm thanh ở dòng: Audio: https://... (tùy chọn nếu làm bài trên giấy/máy).',
          '4 phương án A, B, C, D miêu tả hành động, vị trí của người hoặc đồ vật trong ảnh.',
          'Dòng đáp án đúng: Answer: B hoặc Đáp án: B.',
          'Lời giải chi tiết: Explanation: [Nội dung giải thích bức tranh].',
        ],
        formatRulesEn: [
          'Declare image URL line: Image: https://...',
          'Declare audio URL line: Audio: https://...',
          'Provide 4 statements A, B, C, D describing the picture.',
          'Correct answer line: Answer: B',
          'Detailed explanation: Explanation: [Describe reasons].',
        ],
        sampleText: `1. Look at the photo and choose the best statement.
Image: https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80
Audio: https://example.com/audio/toeic_p1_01.mp3
A. A man is writing in a notebook.
B. A man is speaking on the telephone.
C. A man is adjusting his glasses.
D. A man is organizing his desk.

Answer: B

Explanation:
Trong hình ảnh, người đàn ông đang cầm ống nghe điện thoại và trao đổi trong văn phòng.

2. Look at the photo and choose the best statement.
Image: https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80
Audio: https://example.com/audio/toeic_p1_02.mp3
A. Some people are walking down the staircase.
B. People are seated around a conference table.
C. A presenter is writing on the whiteboard.
D. The meeting room is completely empty.

Answer: B

Explanation:
Các thành viên đang ngồi họp xung quanh bàn làm việc lớn.`,
        blankTemplate: `[Thứ tự câu]. [Nội dung câu hỏi]
Image: [Link ảnh nếu có]
Audio: [Link file nghe audio nếu có]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án đúng A/B/C/D]
Explanation: [Giải thích chi tiết]`,
      },
      {
        id: 2,
        section: 'LISTENING',
        title: 'Part 2 – Question & Response',
        titleEn: 'Part 2 – Question & Response',
        subtitle: 'Hỏi & Đáp (3 lựa chọn A, B, C)',
        subtitleEn: 'Question & Response (3 options)',
        desc: 'Nghe 1 câu hỏi hoặc câu phát biểu, sau đó chọn 1 trong 3 câu phản hồi thích hợp nhất (A, B, C).',
        descEn: 'Listen to a question or statement and select the best response out of 3 choices (A, B, C).',
        badge: '3 lựa chọn (A, B, C) • Không có lựa chọn D',
        badgeEn: '3 options (A, B, C) • No option D',
        questionCountHint: '25 câu hỏi (Câu 7 - 31)',
        color: 'border-rose-200 bg-rose-50/60 text-rose-800',
        tagBg: 'bg-rose-100 text-rose-700',
        hasPassage: false,
        hasAudio: true,
        hasImage: false,
        optionsCount: 3,
        clusterSize: 1,
        exerciseType: 'QUESTION_RESPONSE',
        exerciseTypeName: 'Hỏi & Đáp (Question & Response)',
        exerciseTypeNameEn: 'Question & Response',
        exerciseTypeDesc: 'Đặc thù Part 2 chỉ có đúng 3 phương án A, B, C. Không có phương án D.',
        exerciseTypeDescEn: 'Part 2 strictly has 3 choices: A, B, C. There is NO option D.',
        formatRules: [
          'ĐẶC BIỆT LƯU Ý: Part 2 chỉ gồm 3 phương án A, B, C (KHÔNG CÓ D).',
          'Khai báo link audio ở dòng: Audio: https://...',
          'Nội dung câu hỏi có thể là câu hỏi WH-, Yes/No, câu hỏi đuôi hoặc lời phát biểu/đề nghị.',
          'Dòng đáp án đúng: Answer: A hoặc Answer: B hoặc Answer: C.',
          'Lời giải: Explanation: [Phân tích câu hỏi và phản hồi phù hợp].',
        ],
        formatRulesEn: [
          'IMPORTANT: Part 2 only has 3 choices: A, B, C (No option D).',
          'Declare audio URL line: Audio: https://...',
          'Question can be a WH- question, Yes/No question, or a polite request/statement.',
          'Correct answer line: Answer: A (or B, or C).',
          'Explanation: Explanation: [Explain response context].',
        ],
        sampleText: `7. Where is the quarterly marketing conference being held?
Audio: https://example.com/audio/toeic_p2_01.mp3
A. At the Grand Plaza Hotel in Chicago.
B. No, I haven't submitted the report yet.
C. Yes, it starts at 9:00 AM tomorrow.

Answer: A

Explanation:
Câu hỏi hỏi về địa điểm ("Where"), đáp án A trả lời chính xác tên khách sạn ("At the Grand Plaza Hotel").

8. Could you please review this draft contract before noon?
Audio: https://example.com/audio/toeic_p2_02.mp3
A. Yes, I will look at it right after this meeting.
B. About fifteen pages long.
C. In the conference room on the second floor.

Answer: A

Explanation:
Câu đề nghị lịch sự ("Could you please..."), đáp án A nhận lời phù hợp ("Yes, I will look at it...").`,
        blankTemplate: `[Thứ tự câu]. [Nội dung câu hỏi/câu phát biểu]
Audio: [Link audio]
A. [Phản hồi A]
B. [Phản hồi B]
C. [Phản hồi C]
Answer: [A, B hoặc C]
Explanation: [Giải thích]`,
      },
      {
        id: 3,
        section: 'LISTENING',
        title: 'Part 3 – Conversations',
        titleEn: 'Part 3 – Short Conversations',
        subtitle: 'Đoạn hội thoại (Chùm 3 câu hỏi)',
        subtitleEn: 'Conversations (3 questions per audio)',
        desc: 'Nghe đoạn hội thoại giữa 2 hoặc 3 người và trả lời chùm 3 câu hỏi liên tiếp.',
        descEn: 'Listen to a dialogue between 2-3 speakers and answer a cluster of 3 consecutive questions.',
        badge: 'Chùm 3 câu hỏi kèm đoạn hội thoại',
        badgeEn: 'Cluster of 3 questions per dialogue',
        questionCountHint: '39 câu hỏi (13 đoạn, mỗi đoạn 3 câu)',
        color: 'border-blue-200 bg-blue-50/60 text-blue-800',
        tagBg: 'bg-blue-100 text-blue-700',
        hasPassage: true,
        hasAudio: true,
        hasImage: false,
        optionsCount: 4,
        clusterSize: 3,
        exerciseType: 'CONVERSATION',
        exerciseTypeName: 'Đoạn hội thoại (Short Conversations)',
        exerciseTypeNameEn: 'Short Conversations',
        exerciseTypeDesc: 'Mỗi đoạn hội thoại đi kèm đúng chùm 3 câu hỏi liên tiếp. Có file Audio và Transcript.',
        exerciseTypeDescEn: 'Each dialogue comes with a cluster of 3 questions, an Audio file, and optional Transcript.',
        formatRules: [
          'Mở đầu bằng Passage: để khai báo đoạn hội thoại chung.',
          'Dòng Title: [Tiêu đề hoặc ngữ cảnh của đoạn hội thoại].',
          'Dòng Audio: https://... (File nghe chung cho cả 3 câu hỏi).',
          'Dòng Transcript: [Lời thoại giữa các nhân vật Man/Woman].',
          'Ngay bên dưới là chùm 3 câu hỏi liên tiếp (mỗi câu gồm 4 đáp án A, B, C, D, Answer và Explanation).',
        ],
        formatRulesEn: [
          'Start with Passage: to declare the shared conversation.',
          'Title: [Topic / context of conversation].',
          'Audio: https://... (Shared audio file for the 3 questions).',
          'Transcript: [Dialogue script between speakers].',
          'Follow with exactly 3 consecutive questions (each with options A, B, C, D, Answer, and Explanation).',
        ],
        sampleText: `Passage:
Title: Cuộc đối thoại về đặt vé máy bay công tác
Audio: https://example.com/audio/toeic_p3_01.mp3
Transcript:
Man: Hi Sarah, did you manage to book the flights for our business trip to Singapore next Monday?
Woman: Not yet, David. The morning flights were completely sold out, so I'm looking at afternoon departures.
Man: That's fine as long as we arrive before the evening dinner with our clients.
Woman: Perfect, I will book the 2:00 PM flight right away and send you the confirmation email.

32. What are the speakers discussing?
A. Rescheduling a client dinner
B. Booking travel arrangements
C. Applying for a business visa
D. Preparing a presentation for Singapore

Answer: B

Explanation:
Người đàn ông hỏi "did you manage to book the flights for our business trip", chủ đề chính là đặt vé máy bay di chuyển.

33. What problem does the woman mention?
A. The flight prices are too high
B. The office printer is broken
C. Morning flights are unavailable
D. Her passport has expired

Answer: C

Explanation:
Người phụ nữ giải thích: "The morning flights were completely sold out".

34. What will the woman do next?
A. Book a 2:00 PM flight
B. Call the hotel receptionist
C. Cancel the evening meeting
D. Review the client contract

Answer: A

Explanation:
Người phụ nữ nói: "I will book the 2:00 PM flight right away".`,
        blankTemplate: `Passage:
Title: [Tiêu đề cuộc hội thoại]
Audio: [Link audio đoạn hội thoại]
Transcript:
[Lời thoại nhân vật 1]
[Lời thoại nhân vật 2]

[Câu 1]. [Nội dung câu hỏi 1]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 2]. [Nội dung câu hỏi 2]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 3]. [Nội dung câu hỏi 3]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]`,
      },
      {
        id: 4,
        section: 'LISTENING',
        title: 'Part 4 – Talks',
        titleEn: 'Part 4 – Short Talks',
        subtitle: 'Bài nói độc thoại (Chùm 3 câu hỏi)',
        subtitleEn: 'Short Talks (3 questions per talk)',
        desc: 'Nghe bài nói độc thoại (thông báo, bản tin thời tiết, tin nhắn thoại) và trả lời chùm 3 câu hỏi.',
        descEn: 'Listen to a monologue talk (announcement, news, voicemail) and answer a cluster of 3 questions.',
        badge: 'Chùm 3 câu hỏi kèm bài nói độc thoại',
        badgeEn: 'Cluster of 3 questions per talk',
        questionCountHint: '30 câu hỏi (10 bài nói, mỗi bài 3 câu)',
        color: 'border-purple-200 bg-purple-50/60 text-purple-800',
        tagBg: 'bg-purple-100 text-purple-700',
        hasPassage: true,
        hasAudio: true,
        hasImage: false,
        optionsCount: 4,
        clusterSize: 3,
        exerciseType: 'SHORT_TALK',
        exerciseTypeName: 'Bài nói độc thoại (Short Talks)',
        exerciseTypeNameEn: 'Short Talks',
        exerciseTypeDesc: 'Mỗi bài nói độc thoại đi kèm chùm 3 câu hỏi liên tiếp. Có file Audio và Transcript.',
        exerciseTypeDescEn: 'Each monologue comes with a cluster of 3 questions, an Audio file, and Transcript.',
        formatRules: [
          'Mở đầu bằng Passage: để khai báo bài nói chung.',
          'Dòng Title: [Tiêu đề bài nói (Thông báo, tin tức, tin nhắn thoại...)].',
          'Dòng Audio: https://... (File nghe chung cho cả 3 câu hỏi).',
          'Dòng Transcript: [Nội dung bài nói độc thoại].',
          'Kèm theo chùm 3 câu hỏi liên tiếp (mỗi câu gồm 4 đáp án A, B, C, D, Answer và Explanation).',
        ],
        formatRulesEn: [
          'Start with Passage: to declare the monologue talk.',
          'Title: [Topic of talk (Announcement, news, voicemail...)].',
          'Audio: https://... (Shared audio file).',
          'Transcript: [Script of monologue].',
          'Follow with a cluster of 3 consecutive questions with options A, B, C, D, Answer, and Explanation.',
        ],
        sampleText: `Passage:
Title: Thông báo bảo trì hệ thống mạng nội bộ
Audio: https://example.com/audio/toeic_p4_01.mp3
Transcript:
Attention all staff members. This is an announcement from the IT Department. Our internal server network will undergo scheduled maintenance this Saturday from 8:00 AM to 4:00 PM. During this period, remote access to email and shared company folders will be temporarily suspended. Please make sure to save all in-progress files locally before leaving on Friday afternoon. If you experience any persistent issues on Monday morning, please contact the IT Helpdesk at extension 404.

71. Who most likely is making the announcement?
A. An IT department staff member
B. The human resources director
C. A building security officer
D. A customer service representative

Answer: A

Explanation:
Người nói mở đầu: "This is an announcement from the IT Department".

72. What will happen on Saturday?
A. The office will host a client orientation
B. Scheduled network maintenance will take place
C. A fire drill will be conducted
D. New computers will be delivered

Answer: B

Explanation:
Người nói thông báo: "Our internal server network will undergo scheduled maintenance this Saturday".

73. What are listeners instructed to do before Friday afternoon?
A. Change their computer passwords
B. Submit their weekly timesheets
C. Save important files locally
D. Turn off the office lights

Answer: C

Explanation:
Người nói nhắc nhở: "Please make sure to save all in-progress files locally before leaving on Friday afternoon".`,
        blankTemplate: `Passage:
Title: [Tiêu đề bài nói]
Audio: [Link audio bài nói]
Transcript:
[Nội dung bài nói độc thoại]

[Câu 1]. [Nội dung câu hỏi 1]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 2]. [Nội dung câu hỏi 2]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 3]. [Nội dung câu hỏi 3]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]`,
      },
      {
        id: 5,
        section: 'READING',
        title: 'Part 5 – Incomplete Sentences',
        titleEn: 'Part 5 – Incomplete Sentences',
        subtitle: 'Hoàn thành câu đơn (Ngữ pháp & Từ vựng)',
        subtitleEn: 'Incomplete Sentences (Grammar & Vocab)',
        desc: 'Điền từ hoặc cụm từ phù hợp nhất vào chỗ trống trong câu đơn, kiểm tra ngữ pháp và từ vựng.',
        descEn: 'Select the best word or phrase to complete each sentence, testing grammar and vocabulary.',
        badge: 'Trắc nghiệm ngữ pháp & từ vựng câu đơn',
        badgeEn: 'Single sentence grammar & vocab',
        questionCountHint: '30 câu hỏi (Câu 101 - 130)',
        color: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
        tagBg: 'bg-emerald-100 text-emerald-700',
        hasPassage: false,
        hasAudio: false,
        hasImage: false,
        optionsCount: 4,
        clusterSize: 1,
        exerciseType: 'INCOMPLETE_SENTENCE',
        exerciseTypeName: 'Hoàn thành câu đơn (Incomplete Sentences)',
        exerciseTypeNameEn: 'Incomplete Sentences',
        exerciseTypeDesc: 'Mỗi câu hỏi là một câu đơn độc lập có chỗ trống ______ và 4 phương án A, B, C, D.',
        exerciseTypeDescEn: 'Each question is an independent single sentence with a blank ______ and 4 choices A, B, C, D.',
        formatRules: [
          'Đánh số thứ tự câu hỏi: 101. hoặc Câu 101:.',
          'Nội dung câu hỏi chứa chỗ trống ______ hoặc ---.',
          '4 phương án trắc nghiệm A., B., C., D..',
          'Dòng đáp án đúng: Answer: B hoặc Đáp án: B.',
          'Dòng giải thích: Explanation: [Phân tích ngữ pháp, từ loại, cấu trúc câu].',
        ],
        formatRulesEn: [
          'Question numbering: 101. or Question 101:.',
          'Question sentence containing blank ______ or ---.',
          '4 choices: A., B., C., D..',
          'Correct answer: Answer: B.',
          'Explanation: Explanation: [Grammar/vocabulary explanation].',
        ],
        sampleText: `101. The manager ______ the report yesterday.

A. review
B. reviewed
C. reviewing
D. reviews

Answer: B

Explanation:
"Yesterday" indicates that the action happened in the past, so the simple past form "reviewed" is correct.

102. Mr. Henderson was _______ promoted to Senior Marketing Director after the successful launch of the campaign.

A. prompt
B. promptly
C. promptness
D. prompted

Answer: B

Explanation:
Cần một phó từ (adverb) bổ nghĩa cho động từ "promoted" ở thể bị động -> chọn "promptly".

103. All department managers must submit their annual budget proposals _______ Friday at 5:00 PM.

A. before
B. during
C. among
D. between

Answer: A

Explanation:
"before Friday at 5:00 PM" chỉ mốc thời gian trước thời hạn quy định.`,
        blankTemplate: `[Thứ tự câu]. [Câu văn chứa chỗ trống ______]

A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]

Answer: [Đáp án]

Explanation:
[Giải thích ngữ pháp/từ vựng]`,
      },
      {
        id: 6,
        section: 'READING',
        title: 'Part 6 – Text Completion',
        titleEn: 'Part 6 – Text Completion',
        subtitle: 'Hoàn thành đoạn văn (Chùm 4 câu hỏi)',
        subtitleEn: 'Text Completion (4 blanks per text)',
        desc: 'Đoạn văn có 4 chỗ trống liên tiếp [1], [2], [3], [4] cần điền từ/cụm từ/câu phù hợp ngữ cảnh.',
        descEn: 'A passage with 4 blanks [1], [2], [3], [4] to be filled with words, phrases, or full sentences.',
        badge: 'Đoạn văn kèm đúng 4 chỗ trống',
        badgeEn: 'Passage with 4 blanks',
        questionCountHint: '16 câu hỏi (4 đoạn, mỗi đoạn 4 câu)',
        color: 'border-teal-200 bg-teal-50/60 text-teal-800',
        tagBg: 'bg-teal-100 text-teal-700',
        hasPassage: true,
        hasAudio: false,
        hasImage: true,
        optionsCount: 4,
        clusterSize: 4,
        exerciseType: 'TEXT_COMPLETION',
        exerciseTypeName: 'Hoàn thành đoạn văn (Text Completion)',
        exerciseTypeNameEn: 'Text Completion',
        exerciseTypeDesc: 'Mỗi bài đọc Part 6 có đúng 4 chỗ trống liên tiếp. Có thể dùng dạng văn bản hoặc ảnh chụp bài đọc.',
        exerciseTypeDescEn: 'Each Part 6 passage contains exactly 4 blanks. Can be text or scanned image.',
        formatRules: [
          'Mở đầu bằng Passage: để khai báo bài đọc.',
          'Dòng Title: [Tiêu đề bài viết, email, thư từ, thông báo nội bộ].',
          'Dòng Content: [Nội dung đoạn văn chứa các chỗ trống [1], [2], [3], [4] hoặc [131], [132]...] (Hoặc Image: https://... nếu là ảnh bài đọc).',
          'Ngay sau đó là đúng chùm 4 câu hỏi liên tiếp tương ứng với 4 chỗ trống.',
          'Mỗi câu hỏi có 4 phương án A, B, C, D, Answer và Explanation.',
          'Có thể nhập nhiều đoạn văn liên tiếp cùng lúc (Đoạn văn 1 kèm chùm 4 câu hỏi, Đoạn văn 2 kèm chùm 4 câu hỏi...).',
        ],
        formatRulesEn: [
          'Start with Passage: to declare the reading text.',
          'Title: [Passage title: Email, Memo, Letter...].',
          'Content: [Passage content with blanks [1], [2], [3], [4]] (or Image: https://...).',
          'Follow with exactly 4 consecutive questions for the 4 blanks.',
          'Each question has choices A, B, C, D, Answer, and Explanation.',
          'Supports multiple consecutive passages in a single import (Passage 1 with 4 questions, Passage 2 with 4 questions...).',
        ],
        sampleText: `Passage:
Title: Thông báo nội bộ về vị trí kỹ sư phần mềm
Content:
To: All Team Members
From: HR Department
Subject: New Software Engineer Position

We are excited to announce an opening for a Senior Software Engineer within our Mobile Development team. The ideal candidate will have at least five years of experience with React Native and modern cloud infrastructure. [1] _______.

Employees who refer qualified candidates will be eligible for our internal referral bonus program. [2] _______ you know someone who would be an excellent fit, please submit their resume to hr@company.com by October 15. [3] _______ interviews will begin the following week. We appreciate your continuous support in building our team [4] _______.

131. Which choice best fits blank [1]?
A. The project was unfortunately cancelled last week.
B. Detailed job requirements can be found on our intranet portal.
C. Please turn off your monitors before leaving.
D. The cafeteria will be closed for renovation.

Answer: B

Explanation:
Chỉ dẫn ứng viên và nhân viên xem chi tiết mô tả công việc trên cổng thông tin nội bộ.

132. Which word best fits blank [2]?
A. Although
B. Because
C. If
D. Unless

Answer: C

Explanation:
Mệnh đề điều kiện giả định "If you know someone..." (Nếu bạn biết ai đó...).

133. Which word best fits blank [3]?
A. Preliminary
B. Preliminarily
C. Preliminaries
D. Prelim

Answer: A

Explanation:
Cần tính từ đứng trước danh từ "interviews" -> "Preliminary" (vòng phỏng vấn sơ bộ).

134. Which word best fits blank [4]?
A. effectively
B. effectiveness
C. effect
D. effective

Answer: A

Explanation:
Cần trạng từ bổ nghĩa cho động từ "building" -> chọn "effectively".

Passage 2:
Title: Thông báo bảo trì hệ thống dịch vụ đám mây
Content:
Dear Valued Customers,
Please be informed that our cloud services will undergo scheduled system maintenance on Sunday between 1:00 AM and 5:00 AM. During this period, our web portal will be [1] _______ unavailable.
We apologize for any inconvenience this may cause and appreciate your [2] _______. Our technical team is working hard to ensure that all systems are upgraded [3] _______. If you experience any persistent issues following the maintenance, please contact our support desk [4] _______.

135. Which word best fits blank [1]?
A. temporary
B. temporarily
C. temporariness
D. temporal

Answer: B

Explanation:
Cần phó từ (adverb) "temporarily" bổ nghĩa cho tính từ "unavailable".

136. Which word best fits blank [2]?
A. understanding
B. understand
C. understandably
D. understood

Answer: A

Explanation:
Đứng sau tính từ sở hữu "your" cần một danh từ -> "understanding".

137. Which word best fits blank [3]?
A. smoothly
B. smoothness
C. smooth
D. smoothen

Answer: A

Explanation:
Bổ nghĩa cho động từ "upgraded" cần trạng từ "smoothly".

138. Which phrase best fits blank [4]?
A. as soon as possible
B. much more slow
C. before next year
D. without any delay

Answer: A

Explanation:
Cụm từ "as soon as possible" (càng sớm càng tốt) phù hợp ngữ cảnh liên hệ hỗ trợ.`,
        blankTemplate: `Passage:
Title: [Tiêu đề đoạn văn]
Content:
[Nội dung đoạn văn có các chỗ trống [1] _______, [2] _______, [3] _______, [4] _______]

[Câu 1]. Which choice best fits blank [1]?
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 2]. Which choice best fits blank [2]?
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 3]. Which choice best fits blank [3]?
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 4]. Which choice best fits blank [4]?
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]`,
      },
      {
        id: 7,
        section: 'READING',
        title: 'Part 7 – Reading Comprehension',
        titleEn: 'Part 7 – Reading Comprehension',
        subtitle: 'Đọc hiểu đoạn văn (Đơn / Kép / Ba)',
        subtitleEn: 'Reading Comprehension (Single / Multi)',
        desc: 'Đọc hiểu các bài báo, email, thông báo, lịch trình, hóa đơn và trả lời chùm 2 - 5 câu hỏi.',
        descEn: 'Read articles, emails, announcements, invoices, schedules and answer clusters of 2 - 5 questions.',
        badge: 'Đoạn văn đơn / kép / ba đoạn kèm câu hỏi',
        badgeEn: 'Single / Double / Triple passage clusters',
        questionCountHint: '54 câu hỏi (Câu 147 - 200)',
        color: 'border-indigo-200 bg-indigo-50/60 text-indigo-800',
        tagBg: 'bg-indigo-100 text-indigo-700',
        hasPassage: true,
        hasAudio: false,
        hasImage: true,
        optionsCount: 4,
        clusterSize: 3,
        exerciseType: 'READING_COMPREHENSION',
        exerciseTypeName: 'Đọc hiểu đoạn văn (Reading Comprehension)',
        exerciseTypeNameEn: 'Reading Comprehension',
        exerciseTypeDesc: 'Gồm các bài đọc đơn lẻ hoặc đa đoạn văn kèm chùm từ 2 đến 5 câu hỏi đọc hiểu.',
        exerciseTypeDescEn: 'Consists of single or multi-passages followed by clusters of 2 to 5 comprehension questions.',
        formatRules: [
          'Mở đầu bằng Passage: để khai báo bài đọc.',
          'Dòng Title: [Tiêu đề bài đọc (Thư tín, thông báo, hóa đơn, bài báo...)].',
          'Dòng Content: [Nội dung bài đọc chi tiết] (hoặc Image: https://... nếu là bài đọc dạng hình ảnh/hóa đơn scan).',
          'Theo sau là chùm câu hỏi liên quan (từ 2 đến 5 câu hỏi).',
          'Mỗi câu hỏi có 4 phương án A, B, C, D, Answer và Explanation.',
        ],
        formatRulesEn: [
          'Start with Passage: to declare the reading material.',
          'Title: [Passage title: Letter, memo, invoice, article...].',
          'Content: [Full reading content] (or Image: https://... if scanned image/table).',
          'Follow with a cluster of 2 to 5 questions related to the passage.',
          'Each question has choices A, B, C, D, Answer, and Explanation.',
        ],
        sampleText: `Passage:
Title: Thư xác nhận giao hàng thiết bị văn phòng
Content:
Apex Office Supplies Ltd.
120 Business Park Blvd, Suite 400
Date: October 1, 2026

Dear Ms. Anderson,
Thank you for your recent order #A-8942 placed on September 29. We are pleased to inform you that all requested ergonomic office chairs and adjustable standing desks have been packed and handed over to FastTrack Logistics for standard delivery.

Your items are scheduled to arrive at your downtown facility on Thursday, October 3. Please ensure an authorized representative is available to inspect the cargo and sign the receipt. Should you have any questions regarding your shipment, feel free to call our customer support desk.

Sincerely,
Mark Roberts
Logistics Coordinator

147. What is the primary purpose of this letter?
A. To advertise a seasonal furniture sale
B. To confirm shipment details of an order
C. To request payment for an overdue invoice
D. To apologize for a shipping delay

Answer: B

Explanation:
Bức thư nhằm xác nhận thông tin đơn hàng đã xuất kho và ngày dự kiến giao hàng.

148. When is the order expected to be delivered?
A. September 29
B. October 1
C. October 3
D. October 15

Answer: C

Explanation:
Đoạn 2 nêu rõ thời gian giao: "Your items are scheduled to arrive at your downtown facility on Thursday, October 3".`,
        blankTemplate: `Passage:
Title: [Tiêu đề bài đọc]
Content:
[Nội dung bài đọc]

[Câu 1]. [Nội dung câu hỏi 1]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]

[Câu 2]. [Nội dung câu hỏi 2]
A. [Phương án A]
B. [Phương án B]
C. [Phương án C]
D. [Phương án D]
Answer: [Đáp án]
Explanation: [Giải thích]`,
      },
    ];

    if (exam.section === 'LISTENING') {
      return parts.filter((p) => p.section === 'LISTENING');
    }
    if (exam.section === 'READING') {
      return parts.filter((p) => p.section === 'READING');
    }
    return parts;
  } else {
    // Non-TOEIC (IELTS / General / Custom exams)
    return [
      {
        id: 1,
        section: 'LISTENING',
        title: 'Listening – Section 1',
        titleEn: 'Listening – Section 1',
        subtitle: 'Hội thoại đời thường (Social Dialogue)',
        subtitleEn: 'Social Context Dialogue',
        desc: 'Cuộc trò chuyện giữa hai người trong bối cảnh xã hội đời thường (đặt phòng, hỏi thông tin, đăng ký).',
        descEn: 'A conversation between two speakers in an everyday social context (booking, inquiry, registration).',
        badge: 'Trắc nghiệm / Điền từ kèm Audio',
        badgeEn: 'Multiple choice / Gap fill with Audio',
        questionCountHint: '10 câu hỏi (Câu 1 - 10)',
        color: 'border-sky-200 bg-sky-50/60 text-sky-800',
        tagBg: 'bg-sky-100 text-sky-700',
        hasPassage: true,
        hasAudio: true,
        hasImage: false,
        optionsCount: 4,
        clusterSize: 3,
        exerciseType: 'IELTS_LISTENING_S1',
        exerciseTypeName: 'Hội thoại đời thường (Section 1)',
        exerciseTypeNameEn: 'Social Context Dialogue',
        exerciseTypeDesc: 'Cuộc hội thoại hỏi đáp thông tin với file Audio và chùm câu hỏi trắc nghiệm.',
        exerciseTypeDescEn: 'Everyday social conversation with Audio and multiple-choice questions.',
        formatRules: [
          'Passage: mở đầu đoạn nghe.',
          'Title: [Tên tình huống].',
          'Audio: https://... (File âm thanh đoạn nghe).',
          'Transcript: [Lời thoại các nhân vật].',
          'Các câu hỏi trắc nghiệm kèm 4 đáp án A, B, C, D.',
        ],
        formatRulesEn: [
          'Passage: declares listening section.',
          'Title: [Context title].',
          'Audio: https://... (Audio file URL).',
          'Transcript: [Dialogue script].',
          'Questions with options A, B, C, D, Answer, and Explanation.',
        ],
        sampleText: `Passage:
Title: Accommodation Booking Inquiry
Audio: https://example.com/audio/ielts_s1_01.mp3
Transcript:
Officer: Good morning, City Accommodation Services. How can I help you today?
Student: Hello, I'm calling to inquire about student housing near the university campus for the upcoming fall semester.
Officer: Certainly. May I have your full name and field of study?
Student: My name is Alex Turner, and I will be starting my Master's degree in Architecture.

1. What program is Alex Turner enrolled in?
A. Civil Engineering
B. Architecture
C. Urban Planning
D. Business Administration

Answer: B

Explanation:
The student clearly states: "I will be starting my Master's degree in Architecture".

2. When will the student begin their studies?
A. Summer break
B. Fall semester
C. Spring term
D. Winter break

Answer: B

Explanation:
The student states: "...for the upcoming fall semester".`,
        blankTemplate: `Passage:
Title: [Tiêu đề đoạn nghe]
Audio: [Link audio]
Transcript:
[Lời thoại hội thoại]

1. [Nội dung câu hỏi 1]
A. [Lựa chọn A]
B. [Lựa chọn B]
C. [Lựa chọn C]
D. [Lựa chọn D]
Answer: [Đáp án]
Explanation: [Giải thích]`,
      },
      {
        id: 2,
        section: 'READING',
        title: 'Reading – Academic Passage',
        titleEn: 'Reading – Academic Passage',
        subtitle: 'Bài đọc học thuật (Reading Comprehension)',
        subtitleEn: 'Academic Reading Passage',
        desc: 'Văn bản học thuật từ sách báo, tài liệu chuyên ngành kèm chùm câu hỏi trắc nghiệm đọc hiểu.',
        descEn: 'Academic text from journals or books with a cluster of reading comprehension questions.',
        badge: 'Bài đọc học thuật kèm chùm câu hỏi',
        badgeEn: 'Academic text with question cluster',
        questionCountHint: '13 câu hỏi (Câu 1 - 13)',
        color: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
        tagBg: 'bg-emerald-100 text-emerald-700',
        hasPassage: true,
        hasAudio: false,
        hasImage: true,
        optionsCount: 4,
        clusterSize: 4,
        exerciseType: 'ACADEMIC_READING',
        exerciseTypeName: 'Bài đọc học thuật (Academic Reading)',
        exerciseTypeNameEn: 'Academic Reading Passage',
        exerciseTypeDesc: 'Văn bản đọc hiểu học thuật kèm chùm câu hỏi trắc nghiệm phân tích thông tin.',
        exerciseTypeDescEn: 'Academic reading text with comprehension and inference questions.',
        formatRules: [
          'Passage: mở đầu bài đọc.',
          'Title: [Tiêu đề bài nghiên cứu/học thuật].',
          'Content: [Toàn bộ nội dung bài đọc].',
          'Các câu hỏi đọc hiểu kèm 4 đáp án A, B, C, D.',
          'Đáp án đúng Answer: ... và giải thích Explanation: ...',
        ],
        formatRulesEn: [
          'Passage: declares reading material.',
          'Title: [Article/Research title].',
          'Content: [Full academic text].',
          'Multiple choice questions with choices A, B, C, D.',
          'Correct answer Answer: ... and Explanation: ...',
        ],
        sampleText: `Passage:
Title: The Evolution of Renewable Energy Technologies
Content:
Over the past two decades, renewable energy sources have transitioned from niche experimental technologies into mainstream power generation solutions. In particular, photovoltaic solar panels and offshore wind turbines have demonstrated exponential efficiency gains alongside dramatic cost reductions. Recent engineering breakthroughs in perovskite solar cells promise to exceed traditional silicon efficiency limits, making clean energy accessible to developing economies worldwide.

1. What has occurred regarding renewable energy over the past 20 years?
A. It has become significantly more expensive to manufacture
B. It has transitioned from experimental to mainstream generation
C. It has been replaced by traditional fossil fuels
D. It has faced declining international adoption

Answer: B

Explanation:
The text directly states: "...renewable energy sources have transitioned from niche experimental technologies into mainstream power generation solutions".

2. What breakthrough is mentioned regarding solar cells?
A. The use of diamond coating
B. The development of perovskite materials
C. The elimination of silicon mining
D. Wireless electricity transmission

Answer: B

Explanation:
The passage notes: "Recent engineering breakthroughs in perovskite solar cells promise to exceed traditional silicon efficiency limits...".`,
        blankTemplate: `Passage:
Title: [Tiêu đề bài đọc]
Content:
[Nội dung bài đọc]

1. [Nội dung câu hỏi 1]
A. [Lựa chọn A]
B. [Lựa chọn B]
C. [Lựa chọn C]
D. [Lựa chọn D]
Answer: [Đáp án]
Explanation: [Giải thích]`,
      },
    ];
  }
}

/**
 * Check if the question edit card should show the image URL input field based on Part & Question
 */
export function shouldShowQuestionImageInput(
  part?: ExamPartConfig | null,
  question?: Partial<QuestionItem>,
): boolean {
  if (!part) return false;
  // If the question already has an imageUrl parsed from text, always allow viewing/editing it
  if (question?.imageUrl) return true;
  // Part 1 Photograph description: every question needs an image
  if (part.id === 1 && part.section === 'LISTENING') return true;
  // If part supports images and does not have a passage (standalone image question)
  if (part.hasImage && !part.hasPassage) return true;
  return false;
}

/**
 * Check if the question edit card should show the audio URL input field based on Part & Question
 */
export function shouldShowQuestionAudioInput(
  part?: ExamPartConfig | null,
  question?: Partial<QuestionItem>,
): boolean {
  if (!part) return false;
  // Reading parts NEVER have audio
  if (part.section === 'READING') return false;
  // If the question already has an audioUrl parsed from text, allow viewing/editing it
  if (question?.audioUrl) return true;
  // Part 1 and Part 2 are listening parts with individual audio per question
  if ((part.id === 1 || part.id === 2) && part.section === 'LISTENING') return true;
  // Standalone listening questions without shared passage
  if (part.section === 'LISTENING' && part.hasAudio && !part.hasPassage) return true;
  return false;
}

export interface ParsedPassageItem {
  id: string;
  title?: string;
  content?: string;
  audioUrl?: string;
  imageUrl?: string;
}

/**
 * Enhanced Natural Parser that handles standard numbering, tags, and cluster passages (supports multiple passages)
 */
export function parseQuestionsFromText(
  rawText: string,
  currentPart: ExamPartConfig,
): {
  passages: ParsedPassageItem[];
  passage: ParsedPassageItem | null;
  questions: (Partial<QuestionItem> & { passageTempId?: string })[];
} {
  const lines = rawText.split(/\r?\n/);
  const passages: ParsedPassageItem[] = [];
  const questions: (Partial<QuestionItem> & { passageTempId?: string })[] = [];

  let currentPassage: ParsedPassageItem | null = null;
  let inPassage = false;
  let inTranscript = false;

  let currentQ: (Partial<QuestionItem> & { passageTempId?: string }) | null = null;
  let currentOptions: { key: 'A' | 'B' | 'C' | 'D'; text: string }[] = [];
  let inExplanation = false;

  const finalizeCurrentQuestion = () => {
    if (currentQ && currentQ.content) {
      if (currentOptions.length > 0) {
        currentQ.options = [...currentOptions];
        if (!currentQ.correctAnswer) {
          const firstOpt = currentOptions[0];
          if (firstOpt) {
            currentQ.correctAnswer = firstOpt.key;
          }
        }
      }
      questions.push({ ...currentQ });
    }
    currentQ = null;
    currentOptions = [];
    inExplanation = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const line = rawLine.trim();

    if (!line) {
      if (inPassage && currentPassage && currentPassage.content) {
        currentPassage.content += '\n';
      }
      continue;
    }

    // 1. Passage header: Passage: or Đoạn văn: or [PASSAGE] (e.g. Passage 1:, Passage 2:)
    const passageHeaderMatch = line.match(
      /^(?:Passage|Đoạn văn|Doan van|Đoạn hội thoại|Bài đọc|Bài nói|\[PASSAGE\])(?:\s+\d+)?[:\s\-]*(.*)$/i,
    );

    if (passageHeaderMatch) {
      finalizeCurrentQuestion();
      inPassage = true;
      inTranscript = false;

      const inlineTitle = passageHeaderMatch[1]?.trim();
      const pIndex = passages.length + 1;
      currentPassage = {
        id: `passage-${pIndex}`,
        title: inlineTitle || `${currentPart.subtitle || 'Đoạn văn'} #${pIndex}`,
        content: '',
        audioUrl: undefined,
        imageUrl: undefined,
      };
      passages.push(currentPassage);
      continue;
    }

    if (inPassage && currentPassage) {
      const titleMatch = line.match(/^(?:Title|Tiêu đề|Tieu de)[:\s]*(.*)$/i);
      if (titleMatch) {
        currentPassage.title = (titleMatch[1] || '').trim();
        continue;
      }

      const pAudioMatch = line.match(/^(?:Audio|Âm thanh|Am thanh|\[AUDIO\])[:\s]+(.*)$/i);
      if (pAudioMatch && pAudioMatch[1]) {
        currentPassage.audioUrl = pAudioMatch[1].trim();
        continue;
      }

      const pImgMatch = line.match(/^(?:Image|Ảnh|Hình ảnh|\[IMAGE\])[:\s]+(.*)$/i);
      if (pImgMatch && pImgMatch[1]) {
        currentPassage.imageUrl = pImgMatch[1].trim();
        continue;
      }

      if (line.match(/^(?:Transcript|Lời thoại|Content|Nội dung)[:\s]*/i)) {
        inTranscript = true;
        const textMatch = line.match(
          /^(?:Transcript|Lời thoại|Content|Nội dung)[:\s]*(.*)$/i,
        );
        if (textMatch && textMatch[1] && textMatch[1].trim()) {
          currentPassage.content = (currentPassage.content ? currentPassage.content + '\n' : '') + textMatch[1].trim();
        }
        continue;
      }
    }

    // 2. Check for question start: 101. or 1. or Câu 101: or [QUESTION]
    const questionMatch = line.match(
      /^(?:(?:Câu|Cau|Question)\s*(\d+)[:\.]?|(\d+)[\.\)]|\[QUESTION\])\s*(.*)$/i,
    );

    if (questionMatch) {
      finalizeCurrentQuestion();
      inPassage = false;
      inTranscript = false;

      const qContent = (questionMatch[3] || '').trim();
      currentQ = {
        content: qContent,
        options: [],
        correctAnswer: 'A',
        explanation: '',
        passageTempId: currentPassage ? currentPassage.id : undefined,
        passageTitle: currentPassage ? currentPassage.title : undefined,
      };
      continue;
    }

    // If still in passage block and haven't hit question
    if (inPassage && currentPassage) {
      currentPassage.content = (currentPassage.content ? currentPassage.content + '\n' : '') + line;
      continue;
    }

    // If no active question, continue
    if (!currentQ) {
      continue;
    }

    // 3. Check Image / Audio
    const imgMatch = line.match(/^(?:Image|Ảnh|Hình ảnh|\[IMAGE\])[:\s]+(.*)$/i);
    if (imgMatch && imgMatch[1]) {
      currentQ.imageUrl = imgMatch[1].trim();
      continue;
    }

    const audioMatch = line.match(/^(?:Audio|Âm thanh|Am thanh|\[AUDIO\])[:\s]+(.*)$/i);
    if (audioMatch && audioMatch[1]) {
      currentQ.audioUrl = audioMatch[1].trim();
      continue;
    }

    // 4. Check Options: A. / B. / C. / D. or A) or (A)
    const optMatch = line.match(/^(?:([A-D])[\.\)]|\(([A-D])\))\s+(.*)$/i);
    if (optMatch) {
      const key = ((optMatch[1] || optMatch[2]) as string).toUpperCase() as
        | 'A'
        | 'B'
        | 'C'
        | 'D';
      const text = (optMatch[3] || '').trim();
      currentOptions.push({ key, text });
      inExplanation = false;
      continue;
    }

    // 5. Check Answer: Answer: B, Đáp án: B, Key: B, [ANSWER]: B
    const ansMatch = line.match(
      /^(?:answer|đáp án|dap an|key|\[ANSWER\])[:\s\-]+(?:\()?([A-D])(?:\))?/i,
    );
    if (ansMatch && ansMatch[1]) {
      currentQ.correctAnswer = ansMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      inExplanation = false;
      continue;
    }

    // 6. Check Explanation: Explanation: ... or Giải thích: ... or [EXPLANATION]:
    const expMatch = line.match(
      /^(?:explanation|giải thích|giai thich|lời giải|loi giai|\[EXPLANATION\])[:\s\-]*(.*)$/i,
    );
    if (expMatch) {
      inExplanation = true;
      if (expMatch[1] && expMatch[1].trim()) {
        currentQ.explanation = expMatch[1].trim();
      }
      continue;
    }

    // 7. Multiline continuation
    if (inExplanation) {
      currentQ.explanation = (currentQ.explanation ? currentQ.explanation + '\n' : '') + line;
    } else if (currentOptions.length === 0) {
      currentQ.content += ' ' + line;
    }
  }

  finalizeCurrentQuestion();

  const validPassages = currentPart.hasPassage
    ? passages.filter((p) => p.title || p.content || p.audioUrl || p.imageUrl)
    : [];

  return {
    passages: validPassages,
    passage: validPassages[0] || null,
    questions,
  };
}

/**
 * Generates tailored Word HTML document based on Exam, Part, and specific Exercise Type
 */
export function generateWordTemplateHtml(
  examName: string,
  examType: string,
  part: ExamPartConfig,
  locale: string = 'vi',
): string {
  const isEn = locale === 'en';

  const rulesListHtml = (isEn ? part.formatRulesEn : part.formatRules)
    .map((r) => `<li>${r}</li>`)
    .join('');

  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${part.title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.6; margin: 24px; }
        .header-table { width: 100%; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        h1 { color: #1e40af; font-size: 16pt; margin: 0 0 6px 0; }
        .meta-pill { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 9.5pt; margin-right: 8px; }
        .guide-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 5px solid #2563eb; padding: 14px 18px; margin-bottom: 24px; border-radius: 4px; }
        .guide-box h3 { margin-top: 0; color: #0f172a; font-size: 12pt; }
        .guide-box ul { margin: 8px 0; padding-left: 20px; }
        .guide-box li { margin-bottom: 6px; font-size: 10pt; color: #334155; }
        .section-title { color: #0f172a; font-size: 13pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 28px; margin-bottom: 14px; }
        pre { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 16px; font-family: 'Consolas', 'Courier New', monospace; font-size: 10pt; white-space: pre-wrap; color: #0f172a; border-radius: 4px; line-height: 1.5; }
        .blank-box { background-color: #ffffff; border: 2px dashed #94a3b8; padding: 16px; font-family: 'Consolas', monospace; font-size: 10pt; white-space: pre-wrap; color: #475569; margin-top: 10px; }
        .footer-note { margin-top: 30px; font-size: 9pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="header-table">
        <h1>${isEn ? 'QUESTION IMPORT TEMPLATE' : 'MẪU SOẠN ĐỀ THI IMPORT'}: ${part.title.toUpperCase()}</h1>
        <div>
          <span class="meta-pill">${examType || 'TOEIC'}</span>
          <span class="meta-pill">${part.section}</span>
          <span class="meta-pill">${isEn ? part.exerciseTypeNameEn : part.exerciseTypeName}</span>
          <span class="meta-pill">${part.optionsCount} ${isEn ? 'Options' : 'Phương án'} (${part.optionsCount === 3 ? 'A, B, C' : 'A, B, C, D'})</span>
        </div>
        <p style="color: #64748b; font-size: 10pt; margin: 8px 0 0 0;">
          <strong>${isEn ? 'Exam' : 'Đề thi'}:</strong> ${examName} • <strong>${isEn ? 'Structure' : 'Quy chuẩn'}:</strong> ${isEn ? part.exerciseTypeDescEn : part.exerciseTypeDesc}
        </p>
      </div>

      <div class="guide-box">
        <h3>${isEn ? 'SPECIFIC FORMATTING RULES FOR THIS EXERCISE' : 'QUY TẮC ĐỊNH DẠNG RIÊNG CHO PHẦN NÀY'}</h3>
        <ul>${rulesListHtml}</ul>
      </div>

      <h3 class="section-title">PHẦN 1: NỘI DUNG MẪU CHUẨN (${isEn ? 'COMPLETE REALISTIC SAMPLE' : 'VÍ DỤ MẪU HOÀN CHỈNH'})</h3>
      <p style="font-size: 10pt; color: #64748b; margin-bottom: 8px;">
        ${isEn ? 'You can copy the format below into your questions:' : 'Bạn có thể tham khảo hoặc copy cấu trúc mẫu bên dưới:'}
      </p>
      <pre>${part.sampleText}</pre>

      <h3 class="section-title">PHẦN 2: KHUNG ĐIỀN ĐỀ THI TRỐNG (${isEn ? 'BLANK FILL-IN TEMPLATE' : 'ĐIỀN CÂU HỎI CỦA BẠN VÀO ĐÂY'})</h3>
      <p style="font-size: 10pt; color: #64748b; margin-bottom: 8px;">
        ${isEn ? 'Copy this template and replace the bracketed placeholders with your actual exam content:' : 'Chép khung này và điền trực tiếp nội dung đề thi của bạn vào các vị trí trong ngoặc vuông:'}
      </p>
      <div class="blank-box">${part.blankTemplate}</div>

      <div class="footer-note">
        ${isEn ? 'Generated automatically by Assessment Question Import System' : 'Được tạo tự động bởi Hệ thống Quản trị Khảo thí & Soạn thảo Đề thi'}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates tailored TXT template file based on Exam, Part, and specific Exercise Type
 */
export function generateTxtTemplate(
  examName: string,
  examType: string,
  part: ExamPartConfig,
  locale: string = 'vi',
): string {
  const isEn = locale === 'en';
  const rules = isEn ? part.formatRulesEn : part.formatRules;

  return `# ====================================================================
# ${isEn ? 'IMPORT QUESTION TEMPLATE' : 'MẪU CÂU HỎI IMPORT'}: ${part.title.toUpperCase()}
# ${isEn ? 'Exam' : 'Đề thi'}: ${examName} (${examType || 'TOEIC'})
# ${isEn ? 'Section' : 'Phần'}: ${part.section}
# ${isEn ? 'Exercise Type' : 'Loại bài tập'}: ${isEn ? part.exerciseTypeNameEn : part.exerciseTypeName}
# ${isEn ? 'Options Count' : 'Số lựa chọn'}: ${part.optionsCount} (${part.optionsCount === 3 ? 'A, B, C - KHÔNG CÓ D' : 'A, B, C, D'})
# ====================================================================
#
# ${isEn ? 'FORMATTING RULES FOR THIS PART' : 'CÁC QUY TẮC CẦN LƯU Ý CHO PHẦN NÀY'}:
${rules.map((r) => `# - ${r}`).join('\n')}
#
# ====================================================================
# PHẦN 1: NỘI DUNG MẪU CHUẨN (${isEn ? 'SAMPLE QUESTIONS' : 'VÍ DỤ MẪU HOÀN CHỈNH'}):
# ====================================================================

${part.sampleText}

# ====================================================================
# PHẦN 2: KHUNG ĐIỀN ĐỀ THI TRỐNG (${isEn ? 'BLANK TEMPLATE' : 'KHUNG MẪU TRỐNG'}):
# ====================================================================

${part.blankTemplate}
`;
}
