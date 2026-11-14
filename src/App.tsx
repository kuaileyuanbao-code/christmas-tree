import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { treeConfig, questions, isDemoQuestions, QUIZ_VERSION } from './config';
import { colors, shapes, shapeNames, getLayer, getDecorationLayer, getMaxScore, getScoreMessage, getTreeLeader, MAX_SCORE, layerNames, layoutDecorations, calculateScore, makeDemo, type Decoration, type OrnamentDesign } from './model';
import { decorationRepository, usesCloudStorage } from './storage';
import { Ornament } from './components/Ornament';
import { Icon } from './components/Icons';
import { SceneDetails } from './components/SceneDetails';
import { readMyDecorationIds, rememberDecoration } from './myDecorations';

type Screen='home'|'design'|'quiz'|'result';
const initialDesign:OrnamentDesign={kind:'preset',shape:'ball',color:'red',version:1};
const lights=Array.from({length:32},(_,i)=>{
  const y=25+i*1.75, width=(y-10)*.43;
  return {x:50+Math.sin(i*.66)*width,y,delay:`${i*.17}s`};
});
function useMobile(){const [mobile,set]=useState(window.matchMedia('(max-width: 1000px)').matches);useEffect(()=>{const m=window.matchMedia('(max-width: 1000px)');const f=()=>set(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);return mobile;}
function Modal({children,onClose,label,className=''}:{children:React.ReactNode;onClose:()=>void;label:string;className?:string}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;const previous=document.activeElement as HTMLElement;dialog?.showModal();document.body.style.overflow='hidden';return()=>{dialog?.close();document.body.style.overflow='';previous?.focus();};},[]);
  return <dialog ref={ref} aria-label={label} className={`modal ${className}`} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-content"><button className="icon-button modal-close" onClick={onClose} aria-label="关闭"><Icon name="close"/></button>{children}</div></dialog>;
}
export default function App(){
  const [screen,setScreen]=useState<Screen>('home');
  const [items,setItems]=useState<Decoration[]>([]),[loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [design,setDesign]=useState<OrnamentDesign>(initialDesign),[nickname,setNickname]=useState(''),[message,setMessage]=useState('');
  const [answers,setAnswers]=useState<number[]>([]),[questionIndex,setQuestionIndex]=useState(0),[selection,setSelection]=useState<number|null>(null);
  const [detail,setDetail]=useState<Decoration|null>(null),[highlight,setHighlight]=useState<string|null>(null);
  const [flying,setFlying]=useState(false),[saving,setSaving]=useState(false),[toast,setToast]=useState(''),[help,setHelp]=useState(false);
  const [simulation,setSimulation]=useState<number|null>(null),[devOpen,setDevOpen]=useState(false);
  const [simulationScore,setSimulationScore]=useState<number|null>(null);
  const [finder,setFinder]=useState<'all'|'mine'|'nearby'|null>(null),[search,setSearch]=useState('');
  const [nearbyItems,setNearbyItems]=useState<Decoration[]>([]);
  const [myIds,setMyIds]=useState(readMyDecorationIds);
  const mobile=useMobile(),displayItems=useMemo(()=>simulation===null?items:makeDemo(simulation).map(item=>simulationScore===null?item:{...item,score:simulationScore}),[items,simulation,simulationScore]);
  const leader=getTreeLeader(displayItems);
  const myItems=displayItems.filter(item=>myIds.includes(item.id));
  const foundItems=finder==='mine'?myItems:finder==='nearby'?nearbyItems:displayItems.filter(item=>item.nickname.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const finderTitle=finder==='mine'?'我的挂件':finder==='nearby'?'这里的挂件':'全部挂件';
  const positions=layoutDecorations(displayItems,mobile);
  const score=calculateScore(answers,questions.map(q=>q.correct));
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const submitting=useRef(false),draftId=useRef(crypto.randomUUID());
  const refreshTicket=useRef(0);
  useEffect(()=>{decorationRepository.list().then(setItems).catch(e=>setError(e.message)).finally(()=>setLoaded(true));return()=>clearTimeout(timer.current);},[]);
  useEffect(()=>{if(!highlight||detail)return;const t=setTimeout(()=>setHighlight(null),8500);return()=>clearTimeout(t);},[highlight,detail]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{if(import.meta.env.DEV){const f=(e:KeyboardEvent)=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyD'){e.preventDefault();setDevOpen(v=>!v);}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f);}},[]);
  useEffect(()=>{
    if(!usesCloudStorage||screen!=='home')return;
    let stopped=false;
    async function refresh(){if(document.visibilityState!=='visible')return;const ticket=++refreshTicket.current;try{const next=await decorationRepository.list();if(!stopped&&ticket===refreshTicket.current){setItems(next);setError('');}}catch(e){if(!stopped&&ticket===refreshTicket.current)setError((e as Error).message);}}
    const interval=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);void refresh();
    return()=>{stopped=true;clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[screen]);
  function start(){setError('');setAnswers([]);setQuestionIndex(0);setSelection(null);setMessage('');draftId.current=crypto.randomUUID();setScreen('design');}
  function choose(index:number){if(selection!==null)return;setSelection(index);const next=[...answers,index];setAnswers(next);timer.current=setTimeout(()=>{setSelection(null);if(questionIndex===questions.length-1)setScreen('result');else setQuestionIndex(q=>q+1);},650);}
  function closeFlow(){clearTimeout(timer.current);setSelection(null);setScreen('home');}
  function find(mode:'all'|'mine'){setSearch('');setFinder(mode);}
  function locate(item:Decoration){setHighlight(item.id);setFinder(null);setDetail(item);}
  function openOrnament(item:Decoration,event:MouseEvent<HTMLButtonElement>){
    // 键盘可直接打开每一枚；触摸/鼠标点到重叠处时列出此处挂件，避免挡住底下的人。
    if(event.detail===0){setDetail(item);return;}
    const stage=event.currentTarget.closest('.tree-stage')?.getBoundingClientRect();
    const art=event.currentTarget.querySelector('.ornament-art')?.getBoundingClientRect();
    const pressed=positions.find(p=>p.item.id===item.id);
    if(!stage||!art||!pressed){setDetail(item);return;}
    const offsetX=art.x+art.width/2-(stage.x+stage.width*pressed.x/100),offsetY=art.y+art.height/2-(stage.y+stage.height*pressed.y/100);
    const baseWidth=art.width/pressed.scale,baseHeight=art.height/pressed.scale;
    const nearby=positions.filter(p=>Math.abs(stage.x+stage.width*p.x/100+offsetX-event.clientX)<=baseWidth*p.scale/2+3&&Math.abs(stage.y+stage.height*p.y/100+offsetY-event.clientY)<=baseHeight*p.scale/2+3).map(p=>p.item);
    if(nearby.length>1){setNearbyItems(nearby);setFinder('nearby');}else setDetail(nearby[0]??item);
  }
  async function submit(){
    if(submitting.current)return;submitting.current=true;setSaving(true);setError('');
    const item:Decoration={id:draftId.current,nickname:nickname.trim(),message:message.trim(),score,maxScore:MAX_SCORE,design:{...design},createdAt:new Date().toISOString()};
    try {const saved=await decorationRepository.add(item,{answers,quizVersion:QUIZ_VERSION});rememberDecoration(saved.id);setMyIds(readMyDecorationIds());++refreshTicket.current;const next=await decorationRepository.list();setItems(next);setSimulation(null);setScreen('home');setHighlight(saved.id);setFlying(true);setTimeout(()=>{setFlying(false);setToast('挂好啦！');},1400);}
    catch(e){setError((e as Error).message);}finally{setSaving(false);submitting.current=false;}
  }
  const colorName=colors.find(c=>c.id===design.color)!.name;
  return <div className="app-shell">
    <header className="site-header">
      <a className="cottage-link" href="#admin">树主小屋</a>
      <button className="help-button" onClick={()=>setHelp(true)} aria-label="怎么玩">怎么玩</button>
    </header>
    <main className="home-main">
      <section className="intro">
        <h1>{treeConfig.title}</h1>
        <p className="participant-count">{simulation===null&&!loaded?'正在读取挂件…':simulation===null&&error&&items.length===0?'暂未连接共享圣诞树':<><b>{displayItems.length}</b> 人装饰过</>}{simulation!==null&&<span className="simulation-label">模拟预览</span>}</p>
        {leader&&<button className="treetop-leader" onClick={()=>locate(leader)} aria-label={`查看当前挂得最高的${leader.nickname}的挂件`}><Icon name="sparkle"/><span>目前挂得最高的是 <strong>{leader.nickname}</strong></span><Icon name="arrow"/></button>}
      </section>
      <section className="tree-scene" aria-label="可以点击挂件的圣诞树">
        <div className="tree-stage" data-testid="tree-stage">
          <div className="tree-ground"/>
          <img className="tree-image" src={`${import.meta.env.BASE_URL}assets/tree-cozy-skirt.webp`} alt="绘本风格的圣诞树，树下铺着柔软的奶油色树裙" draggable="false"/>
          <SceneDetails/>
          <div className="tree-star" aria-label="固定树顶星星"><svg viewBox="0 0 100 100"><path d="m50 6 13 27 30 5-22 22 5 31-26-14-26 14 5-31L7 38l30-5Z" fill="#f3cc78" stroke="#9e7b49" strokeWidth="3" strokeLinejoin="round"/><path d="m36 39 12-22" fill="none" stroke="#fff0b9" strokeWidth="4" strokeLinecap="round"/></svg></div>
          <svg className="garlands" viewBox="0 0 100 136" aria-hidden="true"><path d="M38 39Q50 47 64 43M28 66q25 15 46 3M20 92q30 16 60 3M15 114q34 15 70 2" fill="none" stroke="#778b59" strokeOpacity=".6" strokeWidth=".4"/></svg>
          <div className="light-layer" aria-hidden="true">{lights.map((l,i)=><i key={i} style={{left:`${l.x}%`,top:`${l.y}%`,animationDelay:l.delay}}/>)}</div>
          {positions.map(({item,x,y,scale})=><button key={item.id} data-testid="tree-ornament" data-score={item.score} data-layer={getDecorationLayer(item)} data-id={item.id} className={`tree-ornament ${highlight===item.id?'new-ornament':''} ${highlight===item.id&&flying?'flying':''}`} style={{left:`${x}%`,top:`${y}%`,'--ornament-scale':scale,'--flight-x':`${(50-x)*4}px`,'--flight-y':`${(108-y)*6}px`} as CSSProperties} onClick={event=>openOrnament(item,event)} aria-label={`${item.nickname}的${shapeNames[item.design.shape]}，答对${item.score}/${getMaxScore(item)}题`}><Ornament design={item.design}/>{highlight===item.id&&<span className="new-indicator"/>}</button>)}
        </div>
        <div className="tree-toolbar">
          <button className="finder-button" onClick={()=>find('all')}>全部挂件 <span>{displayItems.length}</span></button>
          <button className="finder-button" onClick={()=>find('mine')}>我的挂件</button>
        </div>
      </section>
      <button className="primary main-cta" onClick={start} disabled={!loaded||flying}><Icon name="heart"/>我也来挂一个</button>
    </main>
    {screen==='home'&&error&&<div className="global-error" role="alert">{error}</div>}
    {toast&&<div className="toast" role="status"><Icon name="check"/>{toast}</div>}
    {finder&&<Modal onClose={()=>setFinder(null)} label={finderTitle} className="finder-modal">
      <h2 className="modal-title">{finderTitle}</h2>
      {finder==='all'&&<input className="finder-search" aria-label="搜索挂件昵称" placeholder="输入昵称，找到自己或朋友" value={search} onChange={event=>setSearch(event.target.value)}/>}
      {foundItems.length>0?<div className="finder-grid">{foundItems.map(item=><button key={item.id} className="finder-card" onClick={()=>locate(item)} aria-label={`查看并定位${item.nickname}的挂件`}>
        <Ornament design={item.design} hanging={false}/><span className="finder-name">{item.nickname}</span>{finder==='mine'&&<span className="finder-score">{item.score}/{getMaxScore(item)} 分</span>}
      </button>)}</div>:<p className="finder-empty">{finder==='mine'?'还没有自己的挂件。':'没有找到，试试其他昵称吧。'}</p>}
    </Modal>}
    {screen!=='home'&&<Modal onClose={closeFlow} label={screen==='design'?'设计圣诞挂件':screen==='quiz'?`${questions.length}道圣诞小题`:'答题成绩与留言'} className={screen==='design'?'design-modal':''}>
      {screen==='design'?<>
        <h2 className="modal-title">设计你的挂件</h2>
        <div className="diy-layout">
          <div className="design-preview" aria-label={`${colorName}的${shapeNames[design.shape]}`}><Ornament design={design}/></div>
          <div className="design-controls">
            <label className="field-label">造型</label>
            <div className="shape-grid">{shapes.map(s=><button key={s} className={`shape-option ${design.shape===s?'selected':''}`} onClick={()=>setDesign(d=>({...d,shape:s}))} aria-label={shapeNames[s]} aria-pressed={design.shape===s}><Ornament design={{...design,shape:s}}/><span>{shapeNames[s]}</span></button>)}</div>
            <label className="field-label color-label">颜色</label>
            <div className="color-options">{colors.map(c=><button key={c.id} aria-label={c.name} aria-pressed={design.color===c.id} className={design.color===c.id?'selected':''} style={{'--swatch':c.hex} as CSSProperties} onClick={()=>setDesign(d=>({...d,color:c.id}))}>{design.color===c.id&&<Icon name="check"/>}</button>)}</div>
            <label className="field-label" htmlFor="nickname">昵称 <small>{Array.from(nickname).length}/12</small></label>
            <input id="nickname" value={nickname} onChange={e=>setNickname(Array.from(e.target.value).slice(0,12).join(''))} placeholder="怎么称呼你？" autoComplete="nickname"/>
          </div>
        </div>
        <div className="modal-bottom"><button className="primary" disabled={!nickname.trim()} onClick={()=>setScreen('quiz')}>开始答题<Icon name="arrow"/></button></div>
      </>:screen==='quiz'?<div className="quiz-content">
        <div className="quiz-topline"><span className="demo-tag">{isDemoQuestions?'演示题目':'关于我的小题'}</span><span className="question-count">{questionIndex+1}<small> / {questions.length}</small></span></div>
        <div className="progress-track"><i style={{width:`${(questionIndex+1)/questions.length*100}%`}}/></div>
        <div key={questionIndex} className="question-body"><h2>{questions[questionIndex].title}</h2><div className="answer-options">{questions[questionIndex].options.map((text,i)=><button key={i} disabled={selection!==null} className={selection===i?`chosen ${i===questions[questionIndex].correct?'answer-correct':'answer-wrong'}`:''} data-feedback={selection===i?(i===questions[questionIndex].correct?'correct':'wrong'):undefined} aria-label={selection===i?`${'ABCD'[i]} ${text}，${i===questions[questionIndex].correct?'回答正确':'回答错误'}`:undefined} onClick={()=>choose(i)}><span>{'ABCD'[i]}</span>{text}{selection===i&&<Icon name={i===questions[questionIndex].correct?'check':'close'}/>}</button>)}</div></div>
      </div>:<div className="result-content">
        <div className="result-ornament"><Ornament design={design}/></div>
        <h2>{getScoreMessage(score)}</h2>
        <p className="result-score">答对 <strong data-testid="final-score">{score}</strong> / {questions.length} 题</p>
        <div className="placement-note">你的挂件将挂在 <span>{layerNames[getLayer(score)]}</span></div>
        <label className="message-label" htmlFor="message">留言<span>{Array.from(message).length}/80</span></label>
        <textarea id="message" rows={3} placeholder="写一句祝福吧（选填）" value={message} onChange={e=>setMessage(Array.from(e.target.value).slice(0,80).join(''))}/>
        {error&&<p className="error-text" role="alert">{error}</p>}
        <button className="primary submit-button" disabled={saving} onClick={submit}>{saving?'正在挂上…':'把挂件挂上去'}<Icon name="heart"/></button>
      </div>}
    </Modal>}
    {detail&&<Modal onClose={()=>setDetail(null)} label={`${detail.nickname}的圣诞祝福`} className="detail-modal">
      <div className="detail-art"><Ornament design={detail.design}/></div><h2>{detail.nickname}</h2>
      <blockquote>{detail.message||'圣诞快乐！'}</blockquote>{detail.demo&&<p className="demo-note">模拟留言</p>}
    </Modal>}
    {help&&<Modal onClose={()=>setHelp(false)} label="怎么玩" className="help-modal">
      <h2>怎么玩</h2><ol><li>选挂件、配颜色，写下昵称。</li><li>回答{questions.length}道题，答对越多挂得越高。</li><li>留下留言，把挂件挂到树上。</li></ol>
      <p className="help-tip">点击树上的挂件，就能看到朋友的留言。</p>
      <p className="help-tip">成绩决定挂树区域，运气决定区域内的高低。最高的位置会为幸运的朋友亮名。</p>
      <button className="primary" onClick={()=>{setHelp(false);start();}}>开始装饰<Icon name="arrow"/></button>
    </Modal>}
    {import.meta.env.DEV&&devOpen&&<aside className="dev-panel" aria-label="开发调试"><button className="icon-button" onClick={()=>setDevOpen(false)} aria-label="关闭调试"><Icon name="close"/></button><b>开发预览 · 不修改存档</b><div>{[8,10,30,60,120].map(n=><button key={n} onClick={()=>{setSimulation(n);setSimulationScore(null);}}>模拟 {n} 人</button>)}<button onClick={()=>{setSimulation(8);setSimulationScore(10);}}>模拟 8 人同得 10 分</button><button onClick={()=>{setSimulation(30);setSimulationScore(7);}}>模拟 30 人同得 7 分</button></div><button onClick={()=>setSimulation(null)}>回到我的存档（{items.length}）</button><small>显示 {positions.length} / {displayItems.length}<br/>Ctrl + Shift + D 开关</small></aside>}
  </div>;
}
