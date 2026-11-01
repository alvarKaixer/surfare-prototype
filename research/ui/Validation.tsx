import {useEffect,useState} from 'react';
import {Check,Download,RefreshCw,ShieldCheck,Target,TestTubes,Activity,Info} from 'lucide-react';
import '../validation.css';

const pct=(value:number|null|undefined)=>typeof value==='number'?(value*100).toFixed(1)+'%':'Not measured';
const when=(value:string)=>new Intl.DateTimeFormat('en-SG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Singapore'}).format(new Date(value));

function Measures({items,target=.9}:{items:{label:string,value:number|null,detail?:string}[],target?:number}){
 return <div className="validation-bars" role="img" aria-label={items.map(item=>item.label+': '+pct(item.value)+(item.detail?' ('+item.detail+')':'')).join('. ')+'. Dashed marker: '+pct(target)+' reference.'}>
  {items.map(item=><div className="measure-row" key={item.label} title={item.detail}>
   <div className="measure-label"><span>{item.label}</span><strong>{pct(item.value)}</strong></div>
   <div className="measure-track"><span className={item.value!==null&&item.value>=target?'meets':'below'} style={{width:((item.value||0)*100)+'%'}}/><i style={{left:(target*100)+'%'}}/></div>
   {item.detail&&<small>{item.detail}</small>}
  </div>)}
 </div>;
}

export default function Validation(){
 const [report,setReport]=useState<any>(null),[ai,setAi]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[mode,setMode]=useState<'model'|'currentLocal'>('model');
 async function refresh(){
  setLoading(true);setError('');
  try{
   const [snapshot,smoke]=await Promise.all([
    fetch('/validation/report.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}),
    fetch('/validation/ai-smoke.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
   ]);
   if(snapshot?.schemaVersion!==1||!snapshot.regression||!snapshot.benchmark)throw Error();
   setReport(snapshot);setAi(smoke);
  }catch{setError('The validation snapshot could not be loaded. Reconnect or refresh the page.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{refresh();},[]);
 function download(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({report,aiScenarioSnapshot:ai},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='surfare-validation-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 if(!report)return <section className="validation-page"><div className="validation-heading"><span className="eyebrow">VALIDATION</span><h1>Evidence behind the checks.</h1></div><div className="validation-empty" role="status">{error||'Loading measured results…'}{error&&<button onClick={refresh}>Try again</button>}</div></section>;
 const regression=report.regression,benchmark=report.benchmark,metrics=benchmark[mode],model=benchmark.model;
 const aiCurrent=!!ai&&ai.sourceSha256===report.sourceSha256;
 const modelCorrect=model?(model.correct??model.tp+model.tn):0;
 const totalSkipped=(regression.skipped||0)+(regression.cancelled||0);
 const aiModels:string[]=ai?[...new Set<string>(ai.rows.map((row:any)=>row.model).filter(Boolean))]:[];
 return <section className="validation-page">
  <div className="validation-heading"><div><span className="eyebrow">VALIDATION</span><h1>Evidence behind the checks.</h1><p>Real test runs. Clear scope. A 90% accuracy goal.</p></div><div className="validation-tools"><button onClick={refresh} disabled={loading}><RefreshCw size={14} className={loading?'spin':''}/>Refresh snapshot</button><button onClick={download}><Download size={14}/>Download evidence</button></div></div>
  {error&&<p className="validation-notice" role="alert">{error}</p>}
  <div className="validation-scope"><Target size={17}/><p><strong>Full-app accuracy is not established yet.</strong> The spam-model benchmark and authored AI scenarios below measure different things. Regression passes check code behavior.</p></div>
  <div className="validation-stats">
   <article><span className="stat-label"><ShieldCheck size={15}/>Offline spam classifier</span><strong>{pct(model?.accuracy)}</strong><p>{model?modelCorrect+' / '+model.count+' held-out SMS labels matched':'No matching model benchmark available'}</p><span className={'stat-tag '+(model?.accuracy>=report.target?'positive':'neutral')}>{model?.accuracy>=report.target?'Above 90% · model only':'Model benchmark'}</span></article>
   <article><span className="stat-label"><TestTubes size={15}/>Automated regressions</span><strong>{regression.passed}<em> / {regression.total}</em></strong><p>{regression.groups.length} test groups · {totalSkipped} skipped or cancelled</p><span className={'stat-tag '+(regression.successful?'positive':'neutral')}>{regression.successful?'Passing build':'Checks need review'} · not accuracy</span></article>
   <article><span className="stat-label"><Activity size={15}/>Live AI scenario matches</span><strong>{aiCurrent?ai.passed:<span className="stat-text">{ai?'Older snapshot':'Not run'}</span>}{aiCurrent&&<em> / {ai.count}</em>}</strong><p>{aiCurrent?pct(ai.matchRate)+' matched · '+ai.unavailable+' unavailable':'A current live run is needed'}</p><span className="stat-tag neutral">Authored scenarios · not population accuracy</span></article>
  </div>
  <div className="validation-grid">
   <article className="validation-card benchmark-chart"><div className="chart-heading"><div><span className="step-label">01 / HELD-OUT SMS DATA</span><h2>Classifier performance</h2></div><span className="chart-reference"><i/>90% reference</span></div>
    <div className="benchmark-toggle" aria-label="Benchmark scope"><button aria-pressed={mode==='model'} onClick={()=>setMode('model')}>Spam classifier</button><button aria-pressed={mode==='currentLocal'} disabled={!benchmark.currentLocal} onClick={()=>setMode('currentLocal')}>Local fallback</button></div>
    <p className="chart-caption">{mode==='model'?'The learned spam/ham model, before final app assessment.':'Current local checks without AI. Unconfirmed results count as misses.'}</p>
    {metrics?<><Measures items={[{label:'Accuracy',value:metrics.accuracy},{label:'Balanced accuracy',value:metrics.balancedAccuracy},{label:'Precision',value:metrics.precision},{label:'Spam recall',value:metrics.recall}]}/>
     <div className="outcome-strip" role="img" aria-label={'Correct '+(metrics.correct??metrics.tp+metrics.tn)+', wrong '+(metrics.wrong??metrics.count-metrics.tp-metrics.tn-metrics.abstain)+', unconfirmed '+metrics.abstain+' out of '+metrics.count}>
      <span style={{width:((metrics.correct??metrics.tp+metrics.tn)/metrics.count*100)+'%'}} className="correct"/><span style={{width:((metrics.wrong??metrics.count-metrics.tp-metrics.tn-metrics.abstain)/metrics.count*100)+'%'}} className="wrong"/><span style={{width:(metrics.abstain/metrics.count*100)+'%'}} className="abstain"/>
     </div><div className="outcome-legend"><span><i className="correct"/>{metrics.correct??metrics.tp+metrics.tn} correct</span><span><i className="wrong"/>{metrics.wrong??metrics.count-metrics.tp-metrics.tn-metrics.abstain} wrong</span><span><i className="abstain"/>{metrics.abstain} unconfirmed</span></div>
    </>:<p className="chart-caption">This snapshot does not contain a current result for that scope.</p>}
    <details className="validation-details"><summary>Dataset breakdown & method</summary><div className="validation-table"><table><thead><tr><th>Source</th><th>Cases</th><th>Accuracy</th><th>Recall</th></tr></thead><tbody>{Object.entries(benchmark.bySource||{}).map(([name,entry]:any)=>{const value=entry[mode];return value?<tr key={name}><td>{name}</td><td>{value.count}</td><td>{pct(value.accuracy)}</td><td>{pct(value.recall)}</td></tr>:null;})}</tbody></table></div><p>{benchmark.scope}</p><p>{benchmark.kind==='recomputed'?'Recomputed from the frozen test partition for this build.':'Archived evaluation of the matching model coefficients; the raw test corpus was not available during this build.'} Training, validation and test templates are separated before fitting. The Philippine source does not have per-message language labels.</p><p><a href="https://archive.ics.uci.edu/dataset/228/sms+spam+collection" target="_blank" rel="noreferrer">UCI SMS Spam Collection</a> · <a href="https://github.com/Yissuh/Filipino-Spam-SMS-Detection-Model" target="_blank" rel="noreferrer">Filipino SMS corpus</a></p></details>
   </article>
   <article className="validation-card"><div className="chart-heading"><div><span className="step-label">02 / CODE REGRESSIONS</span><h2>Checks that keep working</h2></div></div>
    <div className="regression-overview"><div className="regression-donut" style={{background:'conic-gradient('+(regression.successful?'#73c69a':'#efbe63')+' '+((regression.passRate||0)*360)+'deg, #e2e8ef 0deg)'}} role="img" aria-label={pct(regression.passRate)+' regression pass rate, not detection accuracy'}><div><strong>{pct(regression.passRate)}</strong><span>pass rate</span></div></div><p>{regression.passed} tests passed.<br/><span>Live providers are mocked here.</span></p></div>
    <div className="regression-groups">{regression.groups.map((group:any)=><div key={group.file} title={group.file}><span className={group.executionFailed?'group-failed':''}>{group.executionFailed?<Info size={13}/>:<Check size={13}/>}</span><p>{group.name}</p><strong>{group.passed}/{group.total}</strong></div>)}</div>
    <p className="chart-footnote">Generated from the Node test runner during the build. Any failing group blocks a new build.</p>
   </article>
  </div>
  <article className="validation-card ai-validation"><div className="chart-heading"><div><span className="step-label">03 / LIVE AI SCENARIOS</span><h2>Threats, idioms and everyday messages</h2></div>{aiCurrent&&<span className="stat-tag neutral">{ai.count} cases · {ai.completed} completed</span>}</div>
   <p className="chart-caption">Authored regression examples across English, Filipino and Taglish. A timeout, invalid response or wrong verdict counts as a miss.</p>
   {aiCurrent?<><div className="language-measures">{Object.entries(ai.byLanguage).map(([language,value]:any)=><div key={language}><Measures items={[{label:language,value:value.matchRate,detail:value.passed+' / '+value.count+' matched · '+value.unavailable+' unavailable'}]}/></div>)}</div>
    <details className="validation-details"><summary>See the recorded cases</summary><div className="scenario-list">{ai.rows.map((row:any)=><details key={row.language+row.name}><summary><span>{row.name}<small>{row.language}</small></span><em className={row.passed?'matched':'missed'}>{row.passed?'Matched':row.status!=='completed'?'Unavailable':'Mismatch'}</em></summary><p>{row.text}</p><p>Expected: {row.expected} · AI: {row.aiLevel||'unavailable'} · Final: {row.combinedLevel||'unavailable'}</p>{row.model&&<p>Model: {row.model}</p>}{row.message&&<p>{row.message}</p>}</details>)}</div></details>
    <div className="ai-snapshot-note"><Info size={14}/><p>This small, authored set does not prove 90% real-world accuracy. Free routing can select different models. {ai.notes?.map((note:string)=><span key={note}>{note}</span>)}<span>Recorded {when(ai.generatedAt)} SGT.</span></p></div>
   </>:<div className="validation-empty">{ai?'The detector has changed since the recorded AI run. That older score is not presented as current.':'No live AI scenario snapshot has been recorded for this build.'}</div>}
  </article>
  <details className="validation-reproduce"><summary>Sources, scope & reproducibility</summary><p>Independent validation of the complete app on contemporary threats, benign messages, images and QR codes is still needed. Spam/ham labels do not establish personal safety. The 90% goal must be evaluated on a defined, independently labeled set; these charts do not certify all content types or languages.</p><p>Regression and local-model snapshots refresh with the build. Live AI snapshots are explicit runs against the local server and consume provider quota. Refresh snapshot only reloads the saved evidence; it does not rerun tests or send messages.</p><code>npm run validation:report</code><code>npm run validation:ai</code><p>Detector fingerprint: <span className="fingerprint">{report.sourceSha256}</span></p><p>Model fingerprint: <span className="fingerprint">{benchmark.modelSha256}</span></p>{aiModels.length>0&&<p>Models in the recorded scenario run: {aiModels.join(', ')}.</p>}</details>
  <p className="validation-updated">Build snapshot · {when(report.generatedAt)} SGT</p>
 </section>;
}
