import { useId } from 'react';
import { colors, type OrnamentDesign } from '../model';
export function Ornament({design,className='',hanging=true}:{design:OrnamentDesign;className?:string;hanging?:boolean}) {
  const id=useId().replace(/:/g,'');
  const color=colors.find(c=>c.id===design.color)!.hex;
  const fill=`url(#${id}-body)`, gold=`url(#${id}-gold)`;
  const shape=design.shape;
  return <svg className={`ornament-art ${className}`} viewBox="0 0 100 112" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-body`} x2="0" y2="1"><stop stopColor={color}/><stop offset="1" stopColor={color}/></linearGradient>
      <linearGradient id={`${id}-gold`} x2=".8" y2="1"><stop stopColor="#f5dfaa"/><stop offset=".45" stopColor="#e9bc6b"/><stop offset="1" stopColor="#d2a25e"/></linearGradient>
      <linearGradient id={`${id}-cookie`} x2=".8" y2="1"><stop stopColor="#e6b16b"/><stop offset="1" stopColor="#c08d58"/></linearGradient>
    </defs>
    {hanging&&<><path d="M50 3v18" stroke="#e9cc91" strokeWidth="1.5"/><ellipse cx="50" cy="24" rx="5" ry="6" fill="none" stroke={gold} strokeWidth="2"/></>}
    <g stroke="#75614f" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
    {shape==='ball'&&<><rect x="42" y="26" width="16" height="10" rx="3" fill={gold}/><circle cx="50" cy="67" r="32" fill={fill}/><path d="M22 67q28 20 57 0M23 73q26 18 54 0" fill="none" stroke={gold} strokeWidth="2"/><path d="M31 48q8-9 15-7" stroke="white" opacity=".3" strokeWidth="4" fill="none"/><circle cx="65" cy="48" r="3" fill="#fff1bb"/><path d="m47 80 3-5 3 5-3 5Z" fill={gold}/></>}
    {shape==='star'&&<><path d="m50 28 12 23 26 5-19 19 4 27-23-13-24 13 5-27L12 56l26-5Z" fill={fill} stroke={gold} strokeWidth="2"/><path d="m50 30 1 39 35-12-35 12 20 30-20-30-23 30 23-30-36-12 36 12Z" fill={gold} opacity=".28"/></>}
    {shape==='snowflake'&&<g stroke={color} strokeWidth="5" fill="none">{[0,60,120].map(r=><g key={r} transform={`rotate(${r} 50 65)`}><path d="M50 30v70m-11-59 11 9 11-9M39 89l11-9 11 9"/><path d="M50 30v70" stroke="white" strokeWidth="1.2" opacity=".8"/></g>)}<circle cx="50" cy="65" r="7" fill={gold} stroke="none"/></g>}
    {shape==='gingerbread'&&<><path d="M35 52a18 18 0 1 1 30 0l20 9q13 11 1 18L68 72l8 21q4 15-10 13L51 84l-15 22q-15 0-11-13l8-21-18 7Q2 70 15 61Z" fill={`url(#${id}-cookie)`} stroke="#eac68e" strokeWidth="1"/><path d="m19 68 10-3m42 0 10 3M31 96l5-6m29 0 5 6" stroke="#fff5df" strokeWidth="4"/><circle cx="43" cy="41" r="2" fill="#4f3025"/><circle cx="57" cy="41" r="2" fill="#4f3025"/><path d="M44 49q6 5 12 0" fill="none" stroke="white" strokeWidth="2"/><path d="m49 59-11-4v14l11-5 12 5V55Z" fill={fill}/><circle cx="50" cy="75" r="3" fill={color}/></>}
    {shape==='bear'&&<><g fill={`url(#${id}-cookie)`}><circle cx="29" cy="37" r="12"/><circle cx="70" cy="37" r="12"/><ellipse cx="50" cy="76" rx="26" ry="28"/><circle cx="50" cy="48" r="26"/><ellipse cx="24" cy="75" rx="12" ry="18" transform="rotate(25 24 75)"/><ellipse cx="77" cy="75" rx="12" ry="18" transform="rotate(-25 77 75)"/><ellipse cx="34" cy="97" rx="14" ry="11"/><ellipse cx="66" cy="97" rx="14" ry="11"/></g><ellipse cx="50" cy="57" rx="14" ry="11" fill="#efcc97"/><circle cx="40" cy="45" r="2.6" fill="#30232b"/><circle cx="60" cy="45" r="2.6" fill="#30232b"/><path d="m46 54 4 4 4-4Z" fill="#4e302e"/><path d="m50 72-14-6v15l14-4 14 4V66Z" fill={fill}/></>}
    {shape==='gift'&&<><rect x="21" y="51" width="58" height="50" rx="5" fill={fill}/><rect x="17" y="46" width="66" height="14" rx="3" fill={fill} stroke="#ffffff44"/><path d="M44 47h12v54H44Z" fill={gold}/><path d="M50 46C14 42 24 19 40 32l10 14c36-4 26-27 10-14Z" fill="none" stroke={gold} strokeWidth="6"/><path d="M27 64v26" stroke="white" strokeWidth="3" opacity=".3"/></>}
    {shape==='bow'&&<><path d="m43 67-5 39 16-12 10 12-7-39" fill={fill}/><path d="M44 58 16 36Q5 61 18 84l26-16m12-10 28-22q11 25-2 48L56 68" fill={fill} stroke={color} strokeWidth="2"/><path d="m20 46 22 17-24 12m62-29L58 63l24 12" fill="none" stroke="#ffffff66" strokeWidth="2"/><rect x="42" y="54" width="16" height="20" rx="6" fill={gold}/></>}
    {shape==='stocking'&&<><path d="m34 40 36 6-6 35q21 16 6 24c-13 6-25-7-39-15-10-5-10-14-4-23Z" fill={fill}/><path d="m30 35 45 8-3 16-45-8Z" fill="#fff0d9"/><path d="M29 68q18 6 11 27M65 83q-13 5-9 16" stroke={gold} fill="none" strokeWidth="3"/><path d="m47 61 3 6 7 1-5 5 1 7-6-4-6 3 2-7-5-5 7 1Z" fill={gold}/></>}
    {shape==='bell'&&<><ellipse cx="50" cy="92" rx="31" ry="10" fill="#715035"/><circle cx="50" cy="93" r="8" fill={gold}/><path d="M21 90q10-12 10-31c0-31 38-31 38 0q0 19 10 31Z" fill={fill} stroke={gold} strokeWidth="2"/><path d="M22 88q28 8 56 0" fill="none" stroke={gold} strokeWidth="5"/><path d="M39 51q3-11 9-11" stroke="white" opacity=".5" strokeWidth="4" fill="none"/><path d="m49 34-12-6v14l12-5 13 5V28Z" fill={gold}/></>}
    {shape==='heart'&&<><path d="M50 100C-12 62 15 16 50 43c35-27 62 19 0 57Z" fill={fill} stroke={gold} strokeWidth="1.5"/><path d="M27 47q6-7 14-3" stroke="white" opacity=".3" strokeWidth="4" fill="none"/><path d="m61 69 3 6 7 1-5 5 1 7-6-4-6 3 2-7-5-5 7 1Z" fill={gold}/></>}
    </g>
  </svg>;
}
