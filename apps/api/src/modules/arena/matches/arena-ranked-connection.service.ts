import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { sql } from '../../../postgres/sql.js';

import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaRoundService,type ArenaRoundEvent } from '../question/arena-round.service.js';
import { arenaHintLetters,maskArenaAnswer } from '../question/arena-round.utils.js';
import { ArenaMatch,ArenaMatchFinishReason,ArenaMatchType,ArenaMatchStatus as Status } from '../rows/arena-match.row.js';
import { ArenaMatchTransactions } from './arena-match-transactions.js';
import { ArenaMatchService } from './arena-match.service.js';

type Connection = { disconnectedAt: number | null; deadlineAt: number | null; pauseStartedAt: number | null; pausedMs: number; pauseCount: number; synced: boolean };
export type RankedConnectionState = {
  version: number; frozenAt: number | null; resumeAt: number | null;
  phase: 'QUESTION_ACTIVE' | 'QUESTION_RESOLVED_TRANSITION';
  remainingQuestionMs: number; remainingTransitionMs: number;
  members: Record<string, Connection>;
};
const live = [Status.PLAYING, Status.PAUSED, Status.RESUMING];
@Injectable()
export class ArenaRankedConnectionService {
  private get matches(){return new SqlRecords(this.nativeDb,'arenamatches');}
private get players(){return new SqlRecords(this.nativeDb,'arenamatchplayers');}
private get questions(){return new SqlRecords(this.nativeDb,'arenamatchquestions');}
private get answers(){return new SqlRecords(this.nativeDb,'arenaplayeranswers');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly presence: ArenaPresenceService,
private readonly rounds: ArenaRoundService,
private readonly matchService: ArenaMatchService,
private readonly transactions: ArenaMatchTransactions
  ) {}
  private async state(match: ArenaMatch): Promise<RankedConnectionState> {
    if (match.rankedState) return structuredClone(match.rankedState);
    const members: Record<string, Connection> = {};
    for (const player of await this.players.select(sql`("match_id" = ${(match as any)._id})`)) members[String(player.userId)] = {
      disconnectedAt: player.disconnectedAt?.getTime() ?? null, deadlineAt: null, pauseStartedAt: null, pausedMs: 0, pauseCount: 0, synced: true,
    };
    return { version: 0, frozenAt: null, resumeAt: null, phase: 'QUESTION_ACTIVE', remainingQuestionMs: 0, remainingTransitionMs: 0, members };
  }
  private rules(match: ArenaMatch) {
    return { ...ARENA_DEFAULTS.rankedConnection, ...match.runtimePolicy?.rankedConnection };
  }
  private online(userId: string, matchId: string) {
    return this.presence.isInMatch ? this.presence.isInMatch(userId, matchId) : this.presence.isOnline(userId);
  }
  private async save(matchId: string, state: RankedConnectionState, status?: Status) {
    state.version++;
    await this.matches.patch(sql`("id" = ${String(matchId)})`,{ rankedState: state, ...(status ? { status } : {}) });
  }
  async disconnected(matchId: string, userId: string, at = Date.now()) {
    return this.transactions.run(matchId, async () => {
      const match = await this.matches.one(sql`id=${matchId}::uuid`);
      if (!match || match.type !== ArenaMatchType.RANK || !live.includes(match.status) || await this.online(userId, matchId)) return;
      const state = await this.state(match), member = state.members[userId];
      if (!member || member.disconnectedAt !== null) return;
      member.disconnectedAt = at; member.synced = false;
      await this.players.patch(sql`("match_id" = ${match._id}) AND ("user_id" = ${String(userId)})`,{ status: 'DISCONNECTED', disconnectedAt: new Date(at) });
      await this.save(matchId, state);
    });
  }
  async restore(matchId: string, userId: string, at = Date.now()) {
    return this.transactions.run(matchId, async () => {
      await this.process(matchId, at);
      const match = await this.matches.one(sql`id=${matchId}::uuid`);
      if (!match || match.type !== ArenaMatchType.RANK) return;
      const state = await this.state(match), member = state.members[userId];
      if (!member) throw new WsException('You are not a player in this match');
      if (!live.includes(match.status)) return;
      if (!await this.online(userId, matchId)) throw new WsException('Player is offline');
      if (member.deadlineAt !== null && at > member.deadlineAt) return;
      if (member.disconnectedAt !== null) {
        if (member.pauseStartedAt !== null) member.pausedMs += Math.max(0, at-member.pauseStartedAt);
        member.disconnectedAt = null; member.deadlineAt = null; member.pauseStartedAt = null;
        member.synced = match.status === Status.PLAYING;
        await this.players.patch(sql`("match_id" = ${match._id}) AND ("user_id" = ${String(userId)})`,{ status: 'PLAYING', disconnectedAt: null });
        await this.save(matchId, state);
      }
    });
  }
  async acknowledge(matchId: string, userId: string, version: number) {
    return this.transactions.run(matchId, async () => {
      const match = await this.matches.one(sql`id=${matchId}::uuid`);
      if (!match || match.type !== ArenaMatchType.RANK || !live.includes(match.status)) return;
      const state = await this.state(match), member = state.members[userId];
      if (!member || version !== state.version || member.disconnectedAt !== null || !await this.online(userId, matchId)) return;
      member.synced = true;
      // Acknowledgements do not change the public state version.
      await this.matches.patch(sql`("id" = ${match._id})`,{ rankedState: state });
    });
  }
  async snapshot(matchId: string, userId?: string): Promise<Record<string, any>> {
    return this.transactions.run(matchId, () => this.snapshotLocked(matchId, userId));
  }
  private async snapshotLocked(matchId: string, userId?: string): Promise<Record<string, any>> {
    const match = await this.matches.one(sql`id=${matchId}::uuid`);
    if (!match || match.type !== ArenaMatchType.RANK) throw new WsException('Ranked match not found');
    const state = await this.state(match);
    if (userId && !state.members[userId]) throw new WsException('You are not a player in this match');
    const question = await this.questions.one(sql`("match_id" = ${match._id}) AND ("order" = ${match.currentQuestionIndex})`);
    const now = Date.now(), frozenNow = state.frozenAt ?? now;
    const elapsed = question?.startedAt ? Math.max(0, frozenNow-question.startedAt.getTime()) : 0;
    const answer = userId && question ? await this.answers.one(sql`("match_id" = ${match._id}) AND ("user_id" = ${String(userId)}) AND ("match_question_id" = ${question._id})`) : null;
    const history: { questionId: string; order: number; correct: boolean }[] = [];
    if (userId) for (const resolved of await this.questions.select(sql`("match_id" = ${match._id}) AND ("resolved_at" IS DISTINCT FROM ${null})`, sql`ORDER BY "order" ASC NULLS FIRST`))
      history.push({ questionId: String(resolved._id), order: resolved.order, correct: String(resolved.winnerId) === userId });
    return {
      matchId, version: state.version, status: match.status, phase: state.phase, serverNow: now,
      resumeAt: state.resumeAt, rulesSnapshot: this.rules(match),
      remainingMs: Math.max(0, match.secondsPerQuestion*1000-elapsed),
      disconnected: Object.entries(state.members).filter(([,m]) => m.disconnectedAt !== null).map(([id,m]) => ({ userId: id, deadlineAt: m.deadlineAt })),
      question: question ? {
        matchId, questionId: String(question._id), questionIndex: question.order, totalQuestions: match.questionCount,
        meaning: maskArenaAnswer(question.question, question.correctAnswer), answerLength: Array.from(question.correctAnswer).length,
        timeLimit: match.secondsPerQuestion, startedAt: question.startedAt?.toISOString(), image: question.imageUrl,
        letters: arenaHintLetters(question.correctAnswer, elapsed, match.secondsPerQuestion*1000, match.runtimePolicy?.hints),
      } : null,
      resolved: question?.resolvedAt ? {
        questionId: String(question._id), winnerId: question.winnerId ? String(question.winnerId) : null,
        timedOut: !question.winnerId, correctAnswer: question.correctAnswer, explanation: question.explanation,
        example: question.example, translation: question.translation, type: question.wordType,
      } : null,
      ...(userId ? { history, submitted: answer ? { answer: answer.selectedAnswer, attempts: answer.attempts, earnedScore: answer.earnedScore } : null } : {}),
      players: (await this.players.select(sql`("match_id" = ${match._id})`)).map(p => ({ userId: String(p.userId), score: p.score, streak: p.currentStreak })),
    };
  }
  async tick(now = Date.now()) {
    const batches: { matchId: string; events: ArenaRoundEvent[] }[] = [];
    const matches = await this.matches.select(sql`("type" = ${ArenaMatchType.RANK}) AND ("status"=ANY(${live}::text[]))`);
    for (const match of matches) {
      const matchId = String(match._id);
      const events = await this.transactions.run(matchId, () => this.process(matchId, now));
      if (events.length) batches.push({ matchId, events });
    }
    return batches;
  }
  private async process(matchId: string, now: number): Promise<ArenaRoundEvent[]> {
    let match = await this.matches.one(sql`id=${matchId}::uuid`);
    if (!match || !live.includes(match.status)) return [];
    const rules = this.rules(match), state = await this.state(match), events: ArenaRoundEvent[] = [];
    let changed = false;
    const initialVersion = state.version;
    const online = new Map<string, boolean>();
    for (const [id, member] of Object.entries(state.members)) {
      online.set(id, await this.online(id, matchId));
      if (!online.get(id) && member.disconnectedAt === null) {
        member.disconnectedAt = now; member.synced = false; changed = true;
        await this.players.patch(sql`("match_id" = ${match._id}) AND ("user_id" = ${String(id)})`,{ status: 'DISCONNECTED', disconnectedAt: new Date(now) });
      }
    }
    const absent = Object.entries(state.members).filter(([,m]) => m.disconnectedAt !== null);
    const overdueGrace = absent.filter(([,m]) => now >= m.disconnectedAt!+rules.reloadGraceSeconds*1000);
    if (overdueGrace.length && (match.status !== Status.PLAYING || rules.rankedPauseEnabled)) {
      if (state.frozenAt === null) {
        const freezeAt = Math.min(...overdueGrace.map(([,m]) => m.disconnectedAt!+rules.reloadGraceSeconds*1000));
        events.push(...await this.rounds.advanceTo(matchId, freezeAt));
        match = await this.matches.one(sql`id=${matchId}::uuid`);
        if (!match || match.status !== Status.PLAYING) return events;
        const question = await this.questions.one(sql`("match_id" = ${match._id}) AND ("order" = ${match.currentQuestionIndex})`);
        state.frozenAt = freezeAt;
        state.phase = question?.resolvedAt ? 'QUESTION_RESOLVED_TRANSITION' : 'QUESTION_ACTIVE';
        state.remainingQuestionMs = question?.startedAt ? Math.max(0, match.secondsPerQuestion*1000-(freezeAt-question.startedAt.getTime())) : match.secondsPerQuestion*1000;
        state.remainingTransitionMs = question?.resolvedAt ? Math.max(0, 3000-(freezeAt-question.resolvedAt.getTime())) : 0;
      }
      let newPause = false;
      for (const [,m] of overdueGrace) if (m.deadlineAt === null) {
        newPause = true;
        m.pauseCount++; m.pauseStartedAt = Math.max(state.frozenAt!, m.disconnectedAt!+rules.reloadGraceSeconds*1000);
        const budget = m.pauseCount > rules.maxPauseCount ? 0 : Math.max(0, rules.maxTotalPauseSeconds*1000-m.pausedMs);
        m.deadlineAt = m.pauseStartedAt+Math.min(rules.disconnectTimeoutSeconds*1000, budget);
      }
      if (match.status !== Status.PAUSED || newPause) {
        state.resumeAt = null;
        for (const m of Object.values(state.members)) m.synced = false;
        await this.save(matchId, state, Status.PAUSED); match.status = Status.PAUSED; changed = true;
        events.push({ event: 'arena:match-paused', data: { matchId, version: state.version, pauseReason: 'DISCONNECT' } });
      }
    }
    if (!rules.rankedPauseEnabled) for (const [,m] of absent) if (m.deadlineAt === null) {
      m.deadlineAt = m.disconnectedAt!+rules.disconnectTimeoutSeconds*1000; changed = true;
    }
    const expired = absent.filter(([,m]) => m.deadlineAt !== null && now > m.deadlineAt);
    if (expired.length) {
      const allAbsent = absent.length === Object.keys(state.members).length;
      // Wait for both individual deadlines before applying the no-rating policy.
      if (!allAbsent || expired.length === absent.length) {
        await this.save(matchId, state);
        if (allAbsent) {
          await this.matches.patch(sql`("id" = ${match._id})`,{ status: Status.CANCELLED, cancelReason: 'BOTH_DISCONNECTED', finishReason: ArenaMatchFinishReason.BOTH_DISCONNECTED, finishedAt: new Date(now) });
          await this.players.patch(sql`("match_id" = ${match._id})`,{ status: 'LEFT' });
        } else {
          const winner = Object.keys(state.members).find(id => !absent.some(([absentId]) => absentId === id));
          await this.matchService.finishMatch(matchId, ArenaMatchFinishReason.DISCONNECT_FORFEIT, winner);
        }
        events.push(await this.rounds.finishedEvent(matchId));
        return events;
      }
    }
    if (!absent.length && match.status === Status.PAUSED && Object.values(state.members).every(m => m.synced)) {
      state.resumeAt = now+rules.resumeCountdownSeconds*1000;
      await this.save(matchId, state, Status.RESUMING); match.status = Status.RESUMING; changed = true;
      events.push({ event: 'arena:match-resuming', data: { matchId, version: state.version, resumeAt: state.resumeAt } });
    }
    if (!absent.length && match.status === Status.RESUMING && state.resumeAt !== null && now >= state.resumeAt) {
      const shift = Math.max(0, now-state.frozenAt!);
      const question = await this.questions.one(sql`("match_id" = ${match._id}) AND ("order" = ${match.currentQuestionIndex})`);
      if (question) await this.questions.patch(sql`("id" = ${question._id})`,{
        ...(question.startedAt ? { startedAt: new Date(question.startedAt.getTime()+shift) } : {}),
        ...(question.resolvedAt ? { resolvedAt: new Date(question.resolvedAt.getTime()+shift) } : {}),
      });
      state.frozenAt = null; state.resumeAt = null;
      await this.save(matchId, state, Status.PLAYING); changed = true;
      events.push({ event: 'arena:match-resumed', data: { matchId, version: state.version } });
    }
    if (changed) {
      if (state.version === initialVersion) await this.save(matchId, state);
      // Persist connection-only changes even when no public phase changed.
      await this.matches.patch(sql`("id" = ${match._id})`,{ rankedState: state });
      events.push({ event: 'arena:match-sync', data: await this.snapshot(matchId) });
    }
    return events;
  }
}
