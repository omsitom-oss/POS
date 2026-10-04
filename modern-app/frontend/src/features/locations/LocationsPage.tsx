import { useCallback, useMemo, useState } from 'react'
import { Button, EmptyState, FormField, IconButton, LoadingState, Modal, SearchInput, SwitchInput, TextInput } from '../../components/shared'
import { useLoadEffect } from '../../components/useLoadEffect'
import { Icon } from '../../components/icons'
import { PageHeader, type Locale } from '../../layouts/AppLayout'

type Country = { countryId: number; nameAr: string; nameEn: string; isActive: boolean; activeCityCount: number }
type City = { cityId: number; countryId: number; nameAr: string; nameEn: string; isActive: boolean }

export function LocationsPage({ locale, onBack }: { locale: Locale; onBack: () => void }) {
  const ar = locale === 'ar'
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<Record<number, City[]>>({})
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'country' | 'city' | null>(null)
  const [editing, setEditing] = useState<{ kind: 'country' | 'city'; id: number } | null>(null)
  const [draft, setDraft] = useState({ nameAr: '', nameEn: '' })
  const [saving, setSaving] = useState(false)

  const loadTree = useCallback(async () => {
    const response = await fetch(`/api/locations/countries${showInactive ? '?includeInactive=true' : ''}`)
    if (!response.ok) { setLoading(false); return }
    const next = await response.json() as Country[]
    const entries = await Promise.all(next.map(async country => {
      const result = await fetch(`/api/locations/countries/${country.countryId}/cities${showInactive ? '?includeInactive=true' : ''}`)
      return [country.countryId, result.ok ? await result.json() as City[] : []] as const
    }))
    setCountries(next); setCities(Object.fromEntries(entries)); setExpanded(current => current.size ? current : new Set(next.slice(0, 1).map(country => country.countryId))); setLoading(false)
  }, [showInactive])
  // Initial and filter changes synchronize the tree with the local POS API.
  useLoadEffect(loadTree)
  const visibleCountries = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return query ? countries.filter(country => [country.nameAr, country.nameEn].some(value => value.toLocaleLowerCase().includes(query)) || (cities[country.countryId] ?? []).some(city => [city.nameAr, city.nameEn].some(value => value.toLocaleLowerCase().includes(query)))) : countries }, [countries, cities, search])
  function toggle(countryId: number) { setOpenMenu(null); setExpanded(current => { const next = new Set(current); if (next.has(countryId)) next.delete(countryId); else next.add(countryId); return next }); select(`country:${countryId}`) }
  function select(next: string) { if (next !== selected) setOpenMenu(null); setSelected(next) }
  function openAdd(kind: 'country' | 'city') { setEditing(null); setDraft({ nameAr: '', nameEn: '' }); setModal(kind); setOpenMenu(null) }
  function openEdit(kind: 'country' | 'city', item: Country | City) { setEditing({ kind, id: kind === 'country' ? (item as Country).countryId : (item as City).cityId }); setDraft({ nameAr: item.nameAr, nameEn: item.nameEn }); setModal(kind); setOpenMenu(null) }
  async function save() {
    if (!draft.nameAr.trim() || !draft.nameEn.trim()) return
    const countryId = selected.startsWith('country:') ? Number(selected.slice(8)) : null
    if (modal === 'city' && !countryId && !editing) return
    setSaving(true)
    const url = editing ? (editing.kind === 'country' ? `/api/locations/countries/${editing.id}` : `/api/locations/cities/${editing.id}`) : modal === 'country' ? '/api/locations/countries' : `/api/locations/countries/${countryId}/cities`
    const active = editing?.kind === 'country' ? countries.find(item => item.countryId === editing.id)?.isActive : editing ? cities[countryId ?? 0]?.find(item => item.cityId === editing.id)?.isActive : true
    const response = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, isActive: active ?? true }) })
    if (response.ok) { setModal(null); setEditing(null); setLoading(true); await loadTree() }
    setSaving(false)
  }
  const menu = (key: string, kind: 'country' | 'city', item: Country | City) => <details className="location-tree-menu" open={openMenu === key} onClick={event => event.stopPropagation()}><summary aria-label={ar ? 'الإجراءات' : 'Actions'} onClick={event => { event.preventDefault(); setOpenMenu(openMenu === key ? null : key) }}><Icon name="more" size={18} /></summary><div><button type="button" onClick={() => openEdit(kind, item)}>{ar ? 'تعديل' : 'Edit'}</button><button type="button">{ar ? 'تعطيل' : 'Deactivate'}</button></div></details>

  return <div className="settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <button type="button" className="locations-back" onClick={onBack}>{ar ? '‹ الإعدادات' : '‹ Settings'}</button>
    <PageHeader title={ar ? 'المواقع' : 'Locations'} description={ar ? 'إدارة الدول والمدن في هيكل هرمي.' : 'Manage countries and cities in a clear hierarchy.'} actions={<Button variant="primary" onClick={() => openAdd('country')}><Icon name="plus" size={18} />{ar ? 'إضافة موقع' : 'Add Location'}</Button>} />
    <section className="locations-tree-panel"><div className="locations-tree-toolbar"><SearchInput aria-label={ar ? 'بحث في المواقع' : 'Search locations'} placeholder={ar ? 'ابحث في المواقع' : 'Search locations'} value={search} onChange={event => setSearch(event.target.value)} /><SwitchInput label={ar ? 'عرض غير النشط' : 'Show inactive'} checked={showInactive} onChange={event => setShowInactive(event.target.checked)} /></div>
      {loading ? <LoadingState /> : visibleCountries.length ? <div className="locations-tree" role="tree" aria-label={ar ? 'شجرة المواقع' : 'Locations tree'}>{visibleCountries.map(country => { const countryCities = cities[country.countryId] ?? []; const isOpen = expanded.has(country.countryId); return <div className="location-tree-branch" key={country.countryId}><div className={`location-tree-row location-tree-country${selected === `country:${country.countryId}` ? ' is-selected' : ''}${country.isActive ? '' : ' is-inactive'}`} role="treeitem" aria-expanded={isOpen} onClick={() => toggle(country.countryId)}><span className="location-tree-chevron" aria-hidden="true"><Icon name={isOpen ? 'chevron-down' : ar ? 'chevron-left' : 'chevron-right'} size={17} /></span><span className="location-tree-icon"><Icon name="globe" size={21} /></span><strong>{ar ? country.nameAr : country.nameEn}</strong><small>{country.activeCityCount} {ar ? 'مدن' : 'cities'}</small><span className="location-tree-spacer" /><IconButton label={ar ? 'إضافة مدينة' : 'Add city'} onClick={event => { event.stopPropagation(); select(`country:${country.countryId}`); openAdd('city') }}><Icon name="plus" size={17} /></IconButton>{menu(`country:${country.countryId}`, 'country', country)}</div>{isOpen && countryCities.map(city => <div className={`location-tree-row location-tree-city${selected === `city:${city.cityId}` ? ' is-selected' : ''}${city.isActive ? '' : ' is-inactive'}`} role="treeitem" key={city.cityId} onClick={() => select(`city:${city.cityId}`)}><span className="location-tree-branch-line" aria-hidden="true" /><span className="location-tree-icon"><Icon name="city" size={20} /></span><span>{ar ? city.nameAr : city.nameEn}</span><span className="location-tree-spacer" />{menu(`city:${city.cityId}`, 'city', city)}</div>)}</div> })}</div> : <EmptyState title={search ? (ar ? 'لا توجد نتائج' : 'No results') : (ar ? 'لا توجد مواقع' : 'No locations yet')} detail={ar ? 'أضف أول دولة للبدء.' : 'Add the first country to begin.'} />}
    </section>
    <Modal open={Boolean(modal)} title={modal === 'city' ? (editing ? (ar ? 'تعديل المدينة' : 'Edit City') : (ar ? 'إضافة مدينة' : 'Add City')) : (editing ? (ar ? 'تعديل الدولة' : 'Edit Country') : (ar ? 'إضافة موقع' : 'Add Location'))} closeLabel={ar ? 'إغلاق' : 'Close'} onClose={() => !saving && setModal(null)} busy={saving} footer={<><Button variant="ghost" disabled={saving} onClick={() => setModal(null)}>{ar ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" loading={saving} onClick={() => void save()}>{ar ? 'حفظ' : 'Save'}</Button></>}><div className="settings-form"><FormField label={ar ? 'الاسم بالعربية' : 'Arabic name'} required><TextInput autoFocus dir="rtl" value={draft.nameAr} onChange={event => setDraft({ ...draft, nameAr: event.target.value })} /></FormField><FormField label={ar ? 'الاسم بالإنجليزية' : 'English name'} required><TextInput dir="ltr" value={draft.nameEn} onChange={event => setDraft({ ...draft, nameEn: event.target.value })} /></FormField></div></Modal>
  </div>
}
