import type { SnapshotQuestion } from './attempt.types.js';
/** Called only after SELECT FOR UPDATE has acquired the current answers. */
export function calculateAttemptResult(questions:SnapshotQuestion[],selectedParts:number[],answers:Record<string,string>,startedAt:Date,now=new Date()){
  const resultFor=(items:SnapshotQuestion[])=>{
    const answered=items.filter(q=>q.options.some(option=>option.key===answers[q._id])).length;
    const correct=items.filter(q=>q.options.some(option=>option.key===answers[q._id])&&answers[q._id]===q.correctAnswer).length;
    return {total:items.length,answered,correct,incorrect:answered-correct,unanswered:items.length-answered,accuracy:items.length?Math.round(correct/items.length*10000)/100:0};
  };
  const total=resultFor(questions),listeningResult=resultFor(questions.filter(q=>q.part<=4)),readingResult=resultFor(questions.filter(q=>q.part>=5));
  return {status:'FINISHED',submittedAt:now,completedAt:now,resultVersion:1,totalQuestions:questions.length,
    partResults:selectedParts.map(part=>({part,...resultFor(questions.filter(q=>q.part===part))})),listeningResult,readingResult,
    durationSpent:Math.max(0,Math.floor((now.getTime()-new Date(startedAt).getTime())/1000)),
    answeredQuestions:total.answered,correctAnswers:total.correct,incorrectAnswers:total.incorrect,unansweredQuestions:total.unanswered,
    listeningCorrect:listeningResult.correct,readingCorrect:readingResult.correct,totalCorrect:total.correct,accuracy:total.accuracy,score:null};
}
export const COMPLETED_STATUSES=['FINISHED','COMPLETED'];
