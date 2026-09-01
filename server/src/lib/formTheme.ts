import { z } from 'zod'

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'รหัสสีต้องอยู่ในรูปแบบ #RRGGBB')
const legacyFontSizes: Record<string, number> = { small: 14, medium: 16, large: 18 }
const fontSizeSchema = z.preprocess(
  (value) => typeof value === 'string' && value in legacyFontSizes ? legacyFontSizes[value] : value,
  z.coerce.number().int().min(12).max(24),
)

export const formThemeSchema = z.object({
  preset: z.enum(['seda', 'ocean', 'forest', 'violet', 'rose', 'custom']).default('seda'),
  primaryColor: colorSchema.default('#e87522'),
  backgroundColor: colorSchema.default('#fff7eb'),
  progressColor: colorSchema.default('#16a34a'),
  progressTrackColor: colorSchema.default('#e5e7eb'),
  fontFamily: z.enum(['modern', 'friendly', 'formal', 'system']).default('modern'),
  fontSize: fontSizeSchema.default(16),
  cornerStyle: z.enum(['subtle', 'rounded', 'soft']).default('rounded'),
  contentWidth: z.enum(['compact', 'standard', 'wide']).default('standard'),
  backgroundMode: z.enum(['soft', 'gradient', 'solid']).default('soft'),
})

export type FormTheme = z.infer<typeof formThemeSchema>

export const defaultFormTheme: FormTheme = formThemeSchema.parse({})

export function parseStoredFormTheme(value: string | null | undefined): FormTheme {
  if (!value) return defaultFormTheme
  try { return formThemeSchema.parse(JSON.parse(value)) }
  catch { return defaultFormTheme }
}
