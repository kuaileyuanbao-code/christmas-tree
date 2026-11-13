function LittleGift({ color, ribbon, className }: { color: string; ribbon: string; className: string }) {
  return <svg className={className} viewBox="0 0 100 100" fill="none">
    <g stroke="#89775f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="16" y="36" width="68" height="52" rx="4" fill={color}/>
      <path d="M18 76v8h13M80 47v32" stroke="#fffbef" opacity=".25"/>
      <path d="M44 36h12v52H44Z" fill={ribbon} stroke="none"/>
      <rect x="12" y="29" width="76" height="14" rx="3" fill={color}/>
      <path d="M43 29h14v14H43Z" fill={ribbon} stroke="none"/>
      <path d="M50 29C15 29 24 6 38 15c7 4 12 14 12 14Zm0 0C85 29 76 6 62 15c-7 4-12 14-12 14Z" fill={ribbon}/>
      <path d="m50 28-7 27m7-27 11 25" stroke={ribbon} strokeWidth="4"/>
      <path d="m22 53 3 3m49 17 3 3m-52-2 3 3m46-23 3 3" stroke="#fff9e8" strokeWidth="2" opacity=".45"/>
    </g>
  </svg>;
}

export function SceneDetails() {
  return <div className="scene-details" aria-hidden="true">
    {[1,2,3].map(i=><svg key={i} className={`scene-sparkle sparkle-${i}`} viewBox="0 0 18 18"><path d="M9 1c0 5-3 8-8 8 5 0 8 3 8 8 0-5 3-8 8-8-5 0-8-3-8-8Z" fill="#d8b87b"/></svg>)}
    <LittleGift className="little-gift gift-left" color="#b77c6c" ribbon="#f0d9ac"/>
    <LittleGift className="little-gift gift-right" color="#94a386" ribbon="#f2e4c7"/>
  </div>;
}
