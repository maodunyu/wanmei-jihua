import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { generate90DayPlan } from '../lib/transformation-plan.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const initial = { age: '', height: '', weight: '', goal: 'fatloss', targetWeight: '', activityLevel: 'light', daysPerWeek: 3, sessionMin: 45, experience: 'new', trainingPlace: 'gym', equipment: 'machines,dumbbells', injuryOrPain: false, medicalRestriction: false, pregnantOrPostpartum: false, eatingDisorderHistory: false, unexplainedSymptoms: false, formulaSex: 'unknown' }
const goals = [['fatloss','减脂'],['muscle','增肌'],['strength','提升力量'],['general','整体体能'],['maintain','维持体重']]
const activities = [['sedentary','久坐少动'],['light','轻度活动'],['moderate','中等活动'],['high','高活动']]
const Field = ({label,children}) => <label className="ob-group" style={{display:'block',marginBottom:14}}><div className="ob-sub ob-sub-first">{label}</div>{children}</label>
const inputStyle = {width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--label)',fontSize:16}
export default function TransformationIntake() {
 const nav=useNavigate(), S=useStore(s=>s.S), update=useStore(s=>s.update)
 const [p,setP]=useState(()=>({...initial,...S.transformationDraft}))
 const [plan,setPlan]=useState(null)
 const [saved,setSaved]=useState(!!S.transformationPlan)
 const patch=(k,v)=>setP(x=>({...x,[k]:v}))
 const preview=()=>{update(s=>{s.transformationDraft={...p}});setPlan(generate90DayPlan(p))}
 const confirm=()=>{if(!plan||plan.status!=='ready')return;update(s=>{s.transformationPlan={...plan,assessment:{...p},confirmedAt:new Date().toISOString()};s.transformationDraft={...p}});setSaved(true)}
 return <div className="narrow ob">
  <div className="ob-top"><button className="iconbtn" onClick={()=>nav('/home')} aria-label="返回"><Icon name="chevronLeft"/></button><div className="ob-eyebrow">完美计划 · 个人评估</div><span style={{width:36}}/></div>
  <div className="ob-body">
   <h1 className="ob-h">你的90天蜕变计划</h1><p className="ob-p">先了解你的基础、目标和训练条件，再生成离线计划。估算不是医疗或营养处方。</p>
   <Field label="年龄"><input style={inputStyle} type="number" min="18" max="100" value={p.age} onChange={e=>patch('age',e.target.value)} placeholder="岁"/></Field>
   <Field label="身高（厘米）"><input style={inputStyle} type="number" value={p.height} onChange={e=>patch('height',e.target.value)} placeholder="例如 170"/></Field>
   <Field label="当前体重（公斤）"><input style={inputStyle} type="number" value={p.weight} onChange={e=>patch('weight',e.target.value)} placeholder="例如 75"/></Field>
   <Field label="主要目标"><select style={inputStyle} value={p.goal} onChange={e=>patch('goal',e.target.value)}>{goals.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
   {p.goal==='fatloss'&&<Field label="目标体重（可选，公斤）"><input style={inputStyle} type="number" value={p.targetWeight} onChange={e=>patch('targetWeight',e.target.value)} placeholder="不填也可以"/></Field>}
   <Field label="日常活动水平"><select style={inputStyle} value={p.activityLevel} onChange={e=>patch('activityLevel',e.target.value)}>{activities.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
   <Field label="每周训练天数"><select style={inputStyle} value={p.daysPerWeek} onChange={e=>patch('daysPerWeek',Number(e.target.value))}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}天</option>)}</select></Field>
   <Field label="每次可训练时长"><select style={inputStyle} value={p.sessionMin} onChange={e=>patch('sessionMin',Number(e.target.value))}>{[20,30,45,60,75,90].map(n=><option key={n} value={n}>{n}分钟</option>)}</select></Field>
   <Field label="训练经验"><select style={inputStyle} value={p.experience} onChange={e=>patch('experience',e.target.value)}><option value="new">新手/刚开始</option><option value="returning">中断后恢复</option><option value="regular">有规律训练</option></select></Field>
   <Field label="公式参数（用于基础能量估算，可不提供）"><select style={inputStyle} value={p.formulaSex} onChange={e=>patch('formulaSex',e.target.value)}><option value="unknown">不提供 / 使用宽区间估算</option><option value="male">男性公式参数</option><option value="female">女性公式参数</option></select></Field>
   <div className="card" style={{marginBottom:16}}><div className="ttl" style={{marginBottom:10}}>安全筛查（请如实选择）</div>{[['injuryOrPain','存在伤病、疼痛或活动受限'],['medicalRestriction','医生限制运动/饮食'],['pregnantOrPostpartum','妊娠或产后阶段'],['eatingDisorderHistory','有饮食障碍相关史'],['unexplainedSymptoms','存在未解释的异常症状']].map(([k,l])=><label key={k} style={{display:'flex',gap:10,alignItems:'center',padding:'9px 0'}}><input type="checkbox" checked={!!p[k]} onChange={e=>patch(k,e.target.checked)}/>{l}</label>)}</div>
   <Button block onClick={preview}>生成90天计划预览</Button>
   {plan&&<div className="card" style={{marginTop:16}}>
    <div className="ttl">计划预览</div>
    {plan.status==='ready'?<><p className="muted small">周期：{plan.startDate} 至 {plan.endDate}</p><p>目标：{goals.find(x=>x[0]===p.goal)?.[1]} · 每周 {plan.schedule.daysPerWeek} 天 · 每次 {p.sessionMin} 分钟</p><p>训练阶段：基础建立（1–14天）→ 稳定执行（15–42天）→ 渐进提升（43–70天）→ 复盘（71–90天）</p><p>蛋白质参考区间：{plan.estimate.proteinGramsPerDayRange.join('–')} 克/日</p>{plan.estimate.energy&&<p>每日能量估算：{plan.estimate.energy.dailyKcalRange.join('–')} kcal（仅为起点估算）</p>}<p className="muted small">当前版本提供阶段框架和训练频率，不会覆盖你已有的训练日历。后续将进一步生成具体动作并关联日历。</p><Button block onClick={confirm}>确认保存计划</Button></>:<><p>{plan.message}</p>{plan.missing?.length>0&&<p className="muted small">需要补充：{plan.missing.join('、')}</p>}</>}
   </div>}
   {saved&&<div className="card" style={{marginTop:12}}><div className="ttl">计划已保存</div><p className="muted small">已保存在本机应用状态中。训练日历联动将在下一阶段完成。</p></div>}
  </div>
 </div>
}
