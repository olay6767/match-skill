import type { CSSProperties } from 'react'

export type FormThemePreset = 'seda' | 'ocean' | 'forest' | 'violet' | 'rose' | 'custom'
export type FormFontFamily = 'modern' | 'friendly' | 'formal' | 'system'
export type FormFontSize = number
export type FormCornerStyle = 'subtle' | 'rounded' | 'soft'
export type FormContentWidth = 'compact' | 'standard' | 'wide'
export type FormBackgroundMode = 'soft' | 'gradient' | 'solid'

export type FormTheme = {
  preset: FormThemePreset
  primaryColor: string
  backgroundColor: string
  progressColor: string
  progressTrackColor: string
  fontFamily: FormFontFamily
  fontSize: FormFontSize
  cornerStyle: FormCornerStyle
  contentWidth: FormContentWidth
  backgroundMode: FormBackgroundMode
}

export const DEFAULT_FORM_THEME: FormTheme = {
  preset: 'seda',
  primaryColor: '#e87522',
  backgroundColor: '#fff7eb',
  progressColor: '#16a34a',
  progressTrackColor: '#e5e7eb',
  fontFamily: 'modern',
  fontSize: 16,
  cornerStyle: 'rounded',
  contentWidth: 'standard',
  backgroundMode: 'soft',
}

export const FORM_THEME_PRESETS: Array<{ id: Exclude<FormThemePreset, 'custom'>; label: string; primaryColor: string; backgroundColor: string }> = [
  { id: 'seda', label: 'SEDA Orange', primaryColor: '#e87522', backgroundColor: '#fff7eb' },
  { id: 'ocean', label: 'Ocean', primaryColor: '#159caf', backgroundColor: '#edfafd' },
  { id: 'forest', label: 'Forest', primaryColor: '#26845b', backgroundColor: '#eff9f3' },
  { id: 'violet', label: 'Violet', primaryColor: '#7657c5', backgroundColor: '#f4f0ff' },
  { id: 'rose', label: 'Rose', primaryColor: '#d85c79', backgroundColor: '#fff1f5' },
]

const fontStacks: Record<FormFontFamily, string> = {
  modern: '"Kanit", "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif',
  friendly: '"Leelawadee UI", "Noto Sans Thai", Arial, sans-serif',
  formal: '"TH Sarabun New", "Sarabun", Georgia, serif',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
}

const radii: Record<FormCornerStyle, string> = { subtle: '8px', rounded: '20px', soft: '30px' }
const widths: Record<FormContentWidth, string> = { compact: '480px', standard: '560px', wide: '720px' }

export type FormThemeStyle = CSSProperties & Record<`--student-${string}`, string>

export function formThemeStyle(theme: FormTheme): FormThemeStyle {
  const legacyFontSizes: Record<string, number> = { small: 14, medium: 16, large: 18 }
  const rawFontSize = theme.fontSize as number | string
  const fontSize = Math.min(24, Math.max(12, typeof rawFontSize === 'number' ? rawFontSize : legacyFontSizes[rawFontSize] ?? 16))
  return {
    '--student-accent': theme.primaryColor,
    '--student-background': theme.backgroundColor,
    '--student-progress-color': theme.progressColor || '#16a34a',
    '--student-progress-track': theme.progressTrackColor || '#e5e7eb',
    '--student-font-family': fontStacks[theme.fontFamily],
    '--student-font-body': `${fontSize}px`,
    '--student-font-small': `${Math.max(10, fontSize - 2)}px`,
    '--student-font-title': `${Math.round(fontSize * 1.875)}px`,
    '--student-font-question': `${Math.round(fontSize * 1.6875)}px`,
    '--student-card-radius': radii[theme.cornerStyle],
    '--student-content-width': widths[theme.contentWidth],
  }
}

export function studentThemePageClass(theme: FormTheme, extraClass = '') {
  return `student-page student-page--themed student-page--background-${theme.backgroundMode}${extraClass ? ` ${extraClass}` : ''}`
}
