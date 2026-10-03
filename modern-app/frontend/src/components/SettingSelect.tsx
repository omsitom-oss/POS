import { useEffect, useState } from 'react'
import { Select } from './shared'

type Option={settingId:number;valueAr:string;valueEn:string}
export function SettingSelect({typeCode,value,onChange,locale,activeOnly=true,parentSettingId,disabled,placeholder}:{typeCode:string;value:number|'';onChange:(value:number|'')=>void;locale:'en'|'ar';activeOnly?:boolean;parentSettingId?:number|null;disabled?:boolean;placeholder?:string}) {
  const [rows,setRows]=useState<Option[]>([])
  const hasItems=typeCode!=='COMPANY_PROFILE'&&typeCode!=='CURRENCIES'
  useEffect(()=>{if(!hasItems)return;const params=new URLSearchParams({active:String(activeOnly)});if(parentSettingId!==undefined&&parentSettingId!==null)params.set('parent',String(parentSettingId));fetch(`/api/settings/types/${encodeURIComponent(typeCode)}/items?${params}`).then(r=>r.ok?r.json():[]).then(setRows).catch(()=>setRows([]))},[typeCode,activeOnly,parentSettingId,hasItems])
  return <Select value={value} disabled={disabled} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}><option value="">{placeholder??(locale==='ar'?'اختر قيمة':'Select a value')}</option>{(hasItems?rows:[]).map(item=><option key={item.settingId} value={item.settingId}>{locale==='ar'?item.valueAr:item.valueEn}</option>)}</Select>
}
