import {describe,it,expect,vi,afterEach} from 'vitest';
import {parseEnglishIpa,wiktionaryIpa} from './wiktionary-ipa.js';
afterEach(()=>vi.unstubAllGlobals());
describe('English Wiktionary IPA fallback',()=>{
  it('supplements a missing accent from a linked capitalized form without replacing the known accent',async()=>{
    const fetch=vi.fn(async(url:string)=>({ok:true,text:async()=>JSON.stringify({parse:{text:{'*':new URL(url).searchParams.get('page')==='Linked'?'<h2 id="English">English</h2><h3 id="Pronunciation">Pronunciation</h3><li>(Received Pronunciation) IPA(key): <span class="IPA">/uk/</span></li>':'<h2 id="English">English</h2><a href="/wiki/Linked#English">Linked</a><h3 id="Pronunciation">Pronunciation</h3><li>(US) IPA(key): <span class="IPA">/us/</span></li>'}}})}));
    vi.stubGlobal('fetch',fetch);
    expect(await wiktionaryIpa('linked')).toEqual({us:'/us/',uk:'/uk/'});
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('reads a shared RP/General American pronunciation from current HTML classes',()=>{
    const html='<h2 id="English">English</h2><h3 id="Pronunciation">Pronunciation</h3><ul><li>(Received Pronunciation, General American, Canada, Australia) IPA(key): <span class="IPA nowrap">/ˈh&#230;v/</span></li><li>(New Zealand) IPA: <span class="IPA">/hev/</span></li><li>(unstressed form) IPA: <span class="IPA">/əv/</span></li></ul><h3 id="Verb">Verb</h3><h2 id="Danish">Danish</h2><h3 id="Pronunciation_2">Pronunciation</h3><li><span class="IPA">/not-English/</span></li>';
    expect(parseEnglishIpa(html)).toEqual({us:'/ˈhæv/',uk:'/ˈhæv/'});
  });
  it('prefers accent-specific IPA and ignores definitions or foreign-language IPA',()=>{
    const html='<h2 id="English">English</h2><h3 id="Pronunciation">Pronunciation</h3><li>(US) IPA(key): <span class="IPA nowrap">/us/</span></li><li>(UK) IPA(key): <span class="IPA">/uk/</span></li><h3 id="Noun">Noun</h3><li><span class="IPA">/unrelated/</span></li><h2 id="French">French</h2><h3 id="Pronunciation_2">Pronunciation</h3><li><span class="IPA">/foreign/</span></li>';
    expect(parseEnglishIpa(html)).toEqual({us:'/us/',uk:'/uk/'});
    expect(parseEnglishIpa('<h2 id="German">German</h2><h3 id="Pronunciation">Pronunciation</h3><li><span class="IPA">/test/</span></li>')).toEqual({});
  });
  it('uses an unqualified English IPA but never a weak form as the main pronunciation',()=>{
    expect(parseEnglishIpa('<h2 id="English">English</h2><h4 id="Pronunciation">Pronunciation</h4><li>(stressed form) enPR: hăz, IPA(key): <span class="IPA nowrap">/hæz/</span></li><li>(has to) IPA(key): <span class="IPA">/hæs/</span></li>')).toEqual({us:'/hæz/',uk:'/hæz/'});
    expect(parseEnglishIpa('<h2 id="English">English</h2><h3 id="Pronunciation">Pronunciation</h3><li>IPA(key): <span class="IPA nowrap">/test/</span></li>')).toEqual({us:'/test/',uk:'/test/'});
    expect(parseEnglishIpa('<h2 id="English">English</h2><h3 id="Pronunciation">Pronunciation</h3><li>(weak form) IPA(key): <span class="IPA nowrap">/ə/</span></li>')).toEqual({});
  });
});
