/** Bundled, decorative illustration: no external files or media requests. */
export function StudyArtwork({ kind='books',className='' }:{kind?:'books'|'exam'|'games'|'landscape';className?:string}){
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 480 300" className={className} fill="none">
    <rect width="480" height="300" rx="24" fill={kind==='landscape'?'#e0f2fe':'#eff6ff'}/>
    {kind==='landscape'?<>
      <circle cx="370" cy="65" r="32" fill="#fef3c7"/>
      <path d="M0 265 135 72 285 300H0Z" fill="#93c5fd"/>
      <path d="m138 300 170-217 172 217H138Z" fill="#60a5fa"/>
      <path d="m83 147 52-75 59 90-47-27-30 27-34-15Z" fill="#fff"/>
      <path d="m265 138 43-55 46 58-31-13-17 17-16-19-25 12Z" fill="#fff"/>
      <path d="M0 260c80-50 130 45 235 0s165-30 245 5v35H0Z" fill="#34d399"/>
    </>:<>
      <circle cx="366" cy="70" r="42" fill="#dbeafe"/>
      <circle cx="92" cy="218" r="54" fill="#e0e7ff"/>
      <rect x="90" y="217" width="310" height="18" rx="9" fill="#93c5fd"/>
      <rect x="117" y="174" width="237" height="40" rx="8" fill="#2563eb"/>
      <path d="M143 186h185M143 200h185" stroke="#bfdbfe" strokeWidth="5"/>
      <rect x="149" y="138" width="223" height="33" rx="7" fill="#818cf8"/>
      <path d="M171 150h177" stroke="#e0e7ff" strokeWidth="5"/>
      {kind==='games'?<>
        <path d="M182 63c-20 0-34 67-24 78 10 11 35-12 49-16h55c16 4 38 27 49 16 11-12-5-78-25-78H182Z" fill="#1d4ed8"/>
        <path d="M192 83v31m-15-15h30" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
        <circle cx="267" cy="87" r="6" fill="#fbbf24"/><circle cx="285" cy="105" r="6" fill="#34d399"/>
      </>:kind==='exam'?<>
        <rect x="181" y="37" width="135" height="112" rx="9" fill="white" stroke="#60a5fa" strokeWidth="4"/>
        <path d="m202 68 7 7 15-17m-22 38 7 7 15-17m14-19h56m-56 29h56m-92 30h92" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      </>:<>
        <path d="M152 45c35-7 66 5 88 24 25-20 57-30 89-24v99c-38-6-61 3-89 17-28-14-53-23-88-17V45Z" fill="white" stroke="#60a5fa" strokeWidth="4"/>
        <path d="M240 72v81m-67-82 45 14m-45 8 45 14m-45 9 45 14m44-45 43-14m-43 36 43-14m-43 37 43-14" stroke="#93c5fd" strokeWidth="5" strokeLinecap="round"/>
      </>}
    </>}
  </svg>;
}
