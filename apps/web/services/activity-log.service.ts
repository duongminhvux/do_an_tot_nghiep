import apiClient from '@/lib/axios';
import { store } from '@/redux/store';
import { CreateActivityLogPayload } from '@/types/activity-log';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export class ActivityLogService {
  public getUserInfo() {
    try {
      const stateUser = store?.getState?.()?.auth?.user;
      if (stateUser?._id) {
        return {
          userId: stateUser._id,
          userEmail: stateUser.email,
          userName: stateUser.username,
          role: stateUser.role || 'USER',
        };
      }

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('user');
        if (stored) {
          const user = JSON.parse(stored);
          return {
            userId: user._id,
            userEmail: user.email,
            userName: user.username,
            role: user.role || 'USER',
          };
        }
      }
    } catch {
      // Ignore user parse errors
    }
    return {};
  }

  /**
   * Safe asynchronous activity logging.
   * Never throws or interrupts caller execution.
   */
  async log(payload: CreateActivityLogPayload): Promise<boolean> {
    try {
      const userInfo = this.getUserInfo();
      const body: CreateActivityLogPayload = {
        ...userInfo,
        ...payload,
      };

      await apiClient.post('/activity-logs', body);
      return true;
    } catch (error) {
      // Intentionally silent to prevent disrupting user experience
      return false;
    }
  }

  /**
   * Specialized method for sending beacons during page unload / tab close
   */
  sendBeacon(payload: CreateActivityLogPayload): boolean {
    try {
      const userInfo = this.getUserInfo();
      const body = {
        ...userInfo,
        ...payload,
      };

      if (typeof window !== 'undefined' && navigator.sendBeacon) {
        const url = `${API_BASE_URL}/activity-logs/beacon`;
        const blob = new Blob([JSON.stringify(body)], {
          type: 'application/json',
        });
        const success = navigator.sendBeacon(url, blob);
        if (success) return true;
      }

      // Fallback if beacon is unsupported or failed
      this.log(payload);
      return true;
    } catch {
      return false;
    }
  }

  // --- Session & Navigation Logs ---

  logPageView(path: string, title?: string, metadata?: Record<string, any>) {
    return this.log({
      action: 'PAGE_VIEW',
      category: 'SESSION',
      description: `Viewed page ${title ? `"${title}"` : path}`,
      metadata: {
        path,
        title: title || (typeof document !== 'undefined' ? document.title : ''),
        ...metadata,
      },
    });
  }

  logSessionStart(metadata?: Record<string, any>) {
    return this.log({
      action: 'SESSION_START',
      category: 'SESSION',
      description: 'User started a new browsing session',
      metadata,
    });
  }

  logSessionEnd(durationMs?: number, metadata?: Record<string, any>) {
    return this.sendBeacon({
      action: 'SESSION_END',
      category: 'SESSION',
      description: 'User ended session / closed tab',
      durationMs,
      metadata,
    });
  }

  logHeartbeat(metadata?: Record<string, any>) {
    return this.log({
      action: 'HEARTBEAT',
      category: 'SESSION',
      description: 'User active heartbeat ping',
      metadata,
    });
  }

  // --- Auth Activity Logs ---

  logAuth(
    action: 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'AUTH_REGISTER',
    description: string,
    metadata?: Record<string, any>
  ) {
    return this.log({
      action,
      category: 'AUTH',
      description,
      metadata,
    });
  }

  // --- Vocabulary Activity Logs ---

  logVocabLearn(
    lessonId: string,
    lessonTitle: string,
    metadata?: Record<string, any>
  ) {
    return this.log({
      action: 'VOCABULARY_LEARN',
      category: 'VOCABULARY',
      description: `Studied vocabulary lesson "${lessonTitle}"`,
      metadata: {
        lessonId,
        lessonTitle,
        ...metadata,
      },
    });
  }

  logVocabTest(
    testType: string,
    score: number,
    total: number,
    metadata?: Record<string, any>
  ) {
    return this.log({
      action: 'VOCABULARY_TEST',
      category: 'VOCABULARY',
      description: `Completed vocabulary quiz (${score}/${total})`,
      metadata: {
        testType,
        score,
        total,
        ...metadata,
      },
    });
  }

  logVocabSave(
    wordId: string,
    wordText: string,
    isSaved: boolean,
    metadata?: Record<string, any>
  ) {
    return this.log({
      action: 'VOCABULARY_SAVE',
      category: 'VOCABULARY',
      description: isSaved
        ? `Saved vocabulary word "${wordText}"`
        : `Removed vocabulary word "${wordText}" from saved`,
      metadata: {
        wordId,
        wordText,
        isSaved,
        ...metadata,
      },
    });
  }

  // --- Dictation Activity Logs ---

  logDictationStart(
    lessonId: string,
    title: string,
    metadata?: Record<string, any>
  ) {
    return this.log({
      action: 'DICTATION_START',
      category: 'DICTATION',
      description: `Started dictation exercise "${title}"`,
      metadata: {
        lessonId,
        title,
        ...metadata,
      },
    });
  }

  logDictationSubmit(
    lessonId: string,
    title: string,
    accuracy: number,
    durationMs?: number,
    metadata?: Record<string, any>
  ) {
    return this.log({
      action: 'DICTATION_SUBMIT',
      category: 'DICTATION',
      description: `Submitted dictation exercise "${title}" (Accuracy: ${Math.round(accuracy)}%)`,
      durationMs,
      metadata: {
        lessonId,
        title,
        accuracy,
        ...metadata,
      },
    });
  }

  // --- Assessment / TOEIC Activity Logs ---

  logToeicStart(
    examId: string,
    examName: string,
    mode: string = 'full',
    metadata?: Record<string, any>
  ) {
    return this.log({
      action: 'TOEIC_START',
      category: 'ASSESSMENT',
      description: `Started TOEIC test "${examName}" (${mode} mode)`,
      metadata: {
        examId,
        examName,
        mode,
        ...metadata,
      },
    });
  }

  logToeicSubmit(
    examId: string,
    examName: string,
    score: number,
    durationMs?: number,
    metadata?: Record<string, any>
  ) {
    return this.log({
      action: 'TOEIC_SUBMIT',
      category: 'ASSESSMENT',
      description: `Submitted TOEIC test "${examName}" (Score: ${score})`,
      durationMs,
      metadata: {
        examId,
        examName,
        score,
        ...metadata,
      },
    });
  }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;
