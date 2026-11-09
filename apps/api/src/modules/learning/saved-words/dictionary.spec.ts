import {describe,it,expect,vi,afterEach} from 'vitest';
import {lookupDictionary,normalizeDictionaryTerm,dictionaryPronunciation,pluralIpa} from './dictionary.js';
afterEach(()=>vi.unstubAllGlobals());
describe('live dictionary adapter',()=>{
  it('adds regular plural endings by final sound',()=>{
    expect(pluralIpa('/ˈlɜːnə/')).toBe('/ˈlɜːnəz/');
    expect(pluralIpa('/kæt/')).toBe('/kæts/');
    expect(pluralIpa('/bʌs/')).toBe('/bʌsɪz/');
    expect(pluralIpa('[ˈlɝ.nɚ]')).toBe('[ˈlɝ.nɚz]');
    expect(pluralIpa('not ipa')).toBeUndefined();
  });
  it('fills missing plural IPA using the source-linked singular without reusing singular audio',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,status:200,text:async()=>JSON.stringify(url.includes('mymemory')?{responseStatus:200,responseData:{translatedText:'Học viên'}}:url.endsWith('/learner')?[{word:'learner',phonetics:[{text:'/ˈlɜːnə/',audio:'https://api.dictionaryapi.dev/media/pronunciations/en/learner-uk.mp3'},{text:'/ˈlɝnɚ/',audio:'https://api.dictionaryapi.dev/media/pronunciations/en/learner-us.mp3'}]}]:[{word:'learners',phonetics:[],meanings:[{partOfSpeech:'noun',definitions:[{definition:'One who learns.'}]}],sourceUrls:['https://en.wiktionary.org/wiki/learner','https://en.wiktionary.org/wiki/learners']}])})));
    const word=await lookupDictionary('learners');
    expect(word.ipa).toEqual({uk:'/ˈlɜːnəz/',us:'/ˈlɝnɚz/'});
    expect(word.ipaDerivedFrom).toBe('learner');
    expect(word.audio).toEqual({});
    expect(word.word).toBe('learners');
    expect(word.parts[0].meanings[0].translation).toEqual(['Học viên']);
  });
  it('resolves the original Commons recording when dictionary media is unavailable',async()=>{
    const fetch=vi.fn(async(url:string)=>url.includes('upload.wikimedia.org')?{ok:true,status:200,headers:new Headers({'content-type':'application/ogg'}),arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}:{ok:true,status:200,text:async()=>JSON.stringify(url.includes('commons.wikimedia.org')?{query:{pages:{'123':{imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/original.ogg'}]}}}}:url.includes('mymemory')?{responseStatus:200,responseData:{translatedText:'bản gốc'}}:[{word:'original',phonetics:[{text:'/or/',audio:'https://api.dictionaryapi.dev/media/pronunciations/en/original-us.mp3',sourceUrl:'https://commons.wikimedia.org/w/index.php?curid=123'}],meanings:[{partOfSpeech:'noun',definitions:[{definition:'An original.'}]}]}])});
    vi.stubGlobal('fetch',fetch);
    expect(await dictionaryPronunciation('original','us')).toEqual({audio:'data:audio/ogg;base64,AQID'});
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it('serves only dictionary audio as a bounded cached data URL',async()=>{
    const fetch=vi.fn(async(url:string)=>url.includes('/media/')?{ok:true,status:200,headers:new Headers({'content-type':'audio/mpeg'}),arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}:{ok:true,status:200,text:async()=>JSON.stringify(url.includes('mymemory')?{responseStatus:200,responseData:{translatedText:'người nói'}}:[{word:'speaker',phonetics:[{text:'/sp/',audio:'https://api.dictionaryapi.dev/media/pronunciations/en/speaker-us.mp3'}],meanings:[{partOfSpeech:'noun',definitions:[{definition:'One who speaks.'}]}]}])});
    vi.stubGlobal('fetch',fetch);
    expect(await dictionaryPronunciation('speaker','us')).toEqual({audio:'data:audio/mpeg;base64,AQID'});
    expect(await dictionaryPronunciation('speaker','us')).toEqual({audio:'data:audio/mpeg;base64,AQID'});
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(await dictionaryPronunciation('speaker','bad')).toEqual({audio:''});
  });
  it('normalizes caption punctuation and rejects URLs or oversized queries',()=>{
    expect(normalizeDictionaryTerm('Everybody!')).toBe('everybody');
    expect(normalizeDictionaryTerm('https://evil.test')).toBe('');
    expect(normalizeDictionaryTerm('a'.repeat(101))).toBe('');
  });
  it('keeps US and UK pronunciations distinct, translates to Vietnamese and caches results',async()=>{
    const fetch=vi.fn(async(url:string)=>({ok:true,status:200,text:async()=>JSON.stringify(url.includes('mymemory')?{responseStatus:200,responseData:{translatedText:'mọi người'}}:[{word:'everybody',phonetics:[{text:'/uk/',audio:'https://api.dictionaryapi.dev/media/everybody-uk.mp3'},{text:'/us/',audio:'https://api.dictionaryapi.dev/media/everybody-us.mp3'}],meanings:[{partOfSpeech:'pronoun',definitions:[{definition:'All people.'}]}],sourceUrls:['https://en.wiktionary.org/wiki/everybody'],license:{url:'https://creativecommons.org/licenses/by-sa/3.0/'}}])}));
    vi.stubGlobal('fetch',fetch);
    const word=await lookupDictionary('everybody');
    expect(word.ipa).toEqual({uk:'/uk/',us:'/us/'});
    expect(word.parts[0].meanings[0].translation).toEqual(['mọi người']);
    expect(word.parts[0].partOfSpeech).toBe('pronoun');
    expect(word.sourceUrl).toContain('wiktionary');
    expect(await lookupDictionary('EVERYBODY!')).toBe(word);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('returns no invented definition for missing words and handles upstream failures',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({status:404,ok:false})));
    expect(await lookupDictionary('unknownwordtest')).toBeNull();
    vi.stubGlobal('fetch',vi.fn(async()=>({status:500,ok:false})));
    await expect(lookupDictionary('upstreamfailure')).rejects.toThrow('Không kết nối');
  });
  it('retains English meaning when translation is unavailable and filters unsafe audio',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>({status:200,ok:true,text:async()=>JSON.stringify(url.includes('mymemory')?{responseStatus:429,quotaFinished:true}:[{word:'quota',phonetics:[{text:'/base/',audio:'javascript:bad'}],meanings:[{partOfSpeech:'noun',definitions:[{definition:'A limited quantity.'}]}]}])})));
    const word=await lookupDictionary('quota');
    expect(word.parts[0].meanings[0].definition).toBe('A limited quantity.');
    expect(word.parts[0].meanings[0].translation).toEqual([]);
    expect(word.audio).toEqual({});
  });
});
