import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioProcessingService} from '../dist/modules/audio-processing/audio-processing.service.js';

const service = new AudioProcessingService({}, {}, {}, {}, {}, {}, {get:()=>undefined});
const letters = keys => [...keys].map(key=>({key,text:''}));
test('Part 1 TTS reads the four statements from content, omitting answer letters',()=>{
  const q={part:1,content:'(A) First statement.\n(B) Second statement.\n(C) Third statement.\n(D) Fourth statement.',options:letters('ABCD')};
  const sequence=service.part12Sequence(q,'voice-one');
  assert.deepEqual(sequence.map(s=>s.text),['First statement.','Second statement.','Third statement.','Fourth statement.']);
  assert.ok(sequence.every(s=>s.voiceId==='voice-one'));
});
test('Part 2 TTS keeps the prompt and three responses in their separate voices',()=>{
  const q={part:2,content:'Where is the meeting?\n(A) At the office.\n(B) Tomorrow.\n(C) Ask the manager.',options:letters('ABC')};
  const sequence=service.part12Sequence(q,'prompt-voice','response-voice');
  assert.deepEqual(sequence.map(s=>s.text),['Where is the meeting?','At the office.','Tomorrow.','Ask the manager.']);
  assert.equal(sequence[0].voiceId,'prompt-voice');
  assert.ok(sequence.slice(1).every(s=>s.voiceId==='response-voice'));
});
test('Legacy text options remain compatible, incomplete embedded scripts are rejected',()=>{
  const q={part:1,content:'',options:[...'ABCD'].map(key=>({key,text:`Statement ${key}`}))};
  assert.equal(service.part12Sequence(q).length,4);
  assert.throws(()=>service.part12Sequence({part:1,content:'(A) Only one statement.',options:letters('ABCD')}),/ABCD|A\/B\/C\/D/);
});
