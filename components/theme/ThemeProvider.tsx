'use client'

import { useEffect } from 'react'
import { loadPersistedTheme } from '@/lib/theme/apply'

export function ThemeProvider() {
  useEffect(() => {
    loadPersistedTheme()
  }, [])

  return null
}
