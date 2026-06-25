'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface CellNavProps {
  slug: string
  cycle: number
  stage: string
  isMember: boolean
  isEditor: boolean
  isOwner: boolean
  isAdmin: boolean
}

const STAGES = ['FORMING', 'BRIEFING', 'SUBMISSION', 'EDITING', 'PROMOTION', 'COMPLETE']

export function CellNav({ slug, cycle, stage, isMember, isEditor, isOwner, isAdmin }: CellNavProps) {
  const pathname = usePathname()
  const base = `/cells/${slug}`

  const link = (href: string, label: string) => {
    const active = pathname === href
    return (
      <Link
        key={href}
        href={href}
        className={`block font-mono text-xs px-3 py-1.5 transition-colors ${
          active ? 'bg-near-black text-off-white' : 'text-olive hover:text-near-black'
        }`}
      >
        {label}
      </Link>
    )
  }

  const after = (...s: string[]) => s.some(x => STAGES.indexOf(stage) >= STAGES.indexOf(x))

  return (
    <div className="flex flex-col gap-px">
      {link(base, 'Overview')}
      {isMember && after('BRIEFING') && link(`${base}/brief`, 'Brief')}
      {isMember && !isEditor && after('SUBMISSION') && link(`${base}/submit`, 'Submit')}
      {isEditor && after('EDITING') && link(`${base}/edit`, 'Edit')}
      {isMember && after('PROMOTION') && link(`${base}/promote`, 'Promote')}
      {after('PROMOTION') && link(`${base}/publication/${cycle}`, 'Publication')}
      {(isOwner || isAdmin) && stage === 'FORMING' && link(`${base}/settings`, 'Settings')}
      {(isEditor || isOwner || isAdmin) && after('EDITING') && link(`${base}/settings/design`, 'House Style')}
    </div>
  )
}
