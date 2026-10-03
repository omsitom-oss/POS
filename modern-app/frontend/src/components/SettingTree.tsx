import { useState } from 'react'
import { Button, IconButton, StatusBadge } from './shared'

export type SettingNode = { settingId: number; settingTypeId: number; parentSettingId: number | null; code: string | null; valueAr: string; valueEn: string; sortOrder: number; isActive: boolean; children: SettingNode[] }

export function SettingTree({ nodes, locale, selectedId, onSelect, onEdit, onAddChild, onToggle }: {
  nodes: SettingNode[]; locale: 'en' | 'ar'; selectedId: number | null; onSelect: (node: SettingNode) => void; onEdit: (node: SettingNode) => void; onAddChild: (node: SettingNode) => void; onToggle: (node: SettingNode) => void
}) {
  return <div className="setting-tree" role="tree">{nodes.map(node => <TreeRow key={node.settingId} node={node} locale={locale} depth={0} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onAddChild={onAddChild} onToggle={onToggle} />)}</div>
}

function TreeRow({ node, locale, depth, selectedId, onSelect, onEdit, onAddChild, onToggle }: { node: SettingNode; locale: 'en' | 'ar'; depth: number; selectedId: number | null; onSelect: (node: SettingNode) => void; onEdit: (node: SettingNode) => void; onAddChild: (node: SettingNode) => void; onToggle: (node: SettingNode) => void }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const label = locale === 'ar' ? node.valueAr : node.valueEn
  const labels = locale === 'ar' ? { collapse: 'طي العناصر', expand: 'توسيع العناصر', child: 'إضافة عنصر فرعي', edit: 'تعديل', activate: 'تفعيل', deactivate: 'تعطيل', inactive: 'غير نشط' } : { collapse: 'Collapse children', expand: 'Expand children', child: 'Add child', edit: 'Edit setting', activate: 'Reactivate', deactivate: 'Deactivate', inactive: 'Inactive' }
  return <div role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selectedId === node.settingId}>
    <div className={`setting-tree-row${selectedId === node.settingId ? ' setting-tree-selected' : ''}${node.isActive ? '' : ' setting-tree-inactive'}`} style={{ paddingInlineStart: `calc(var(--space-4) + ${depth * 24}px)` }}>
      <button className="tree-expander" aria-label={hasChildren ? (expanded ? labels.collapse : labels.expand) : label} disabled={!hasChildren} onClick={() => setExpanded(value => !value)}>{hasChildren ? (expanded ? '−' : '+') : <span className="tree-leaf" />}</button>
      <button className="tree-node-label" onClick={() => onSelect(node)}><strong>{label}</strong>{node.code && <code>{node.code}</code>}</button>
      {!node.isActive && <StatusBadge tone="warning">{labels.inactive}</StatusBadge>}
      <div className="tree-actions"><IconButton size="small" label={labels.child} onClick={() => onAddChild(node)}>＋</IconButton><IconButton size="small" label={labels.edit} onClick={() => onEdit(node)}>✎</IconButton><Button size="small" variant={node.isActive ? 'quiet' : 'secondary'} onClick={() => onToggle(node)}>{node.isActive ? labels.deactivate : labels.activate}</Button></div>
    </div>
    {hasChildren && expanded && <div role="group">{node.children.map(child => <TreeRow key={child.settingId} node={child} locale={locale} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onAddChild={onAddChild} onToggle={onToggle} />)}</div>}
  </div>
}
