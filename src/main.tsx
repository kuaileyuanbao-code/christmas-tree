import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
const Admin=React.lazy(()=>import('./Admin'));
function Entry(){
  const [admin,setAdmin]=React.useState(window.location.hash==='#admin');
  React.useEffect(()=>{const update=()=>setAdmin(window.location.hash==='#admin');window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  return admin?<React.Suspense fallback={<p style={{padding:24}}>正在打开树主管理…</p>}><Admin/></React.Suspense>:<App/>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Entry/></React.StrictMode>);
