/**
 * Appearance preferences — colour theme + typography.
 * Applied via documentElement data attributes; CSS tokens in globals.css.
 */

export const APPEARANCE_THEME_KEY = 'srp_appearance_theme'
export const APPEARANCE_TYPE_KEY = 'srp_appearance_type'

export type AppearanceTheme = 'navy' | 'forest'
export type AppearanceType = 'modern' | 'classic'

export function readAppearanceTheme(): AppearanceTheme {
  if (typeof window === 'undefined') return 'navy'
  const v = localStorage.getItem(APPEARANCE_THEME_KEY)
  return v === 'forest' ? 'forest' : 'navy'
}

export function readAppearanceType(): AppearanceType {
  if (typeof window === 'undefined') return 'modern'
  const v = localStorage.getItem(APPEARANCE_TYPE_KEY)
  return v === 'classic' ? 'classic' : 'modern'
}

export function applyAppearance(theme?: AppearanceTheme, type?: AppearanceType) {
  if (typeof document === 'undefined') return
  const t = theme ?? readAppearanceTheme()
  const ty = type ?? readAppearanceType()
  document.documentElement.dataset.theme = t
  document.documentElement.dataset.type = ty
}

export function saveAppearanceTheme(theme: AppearanceTheme) {
  localStorage.setItem(APPEARANCE_THEME_KEY, theme)
  applyAppearance(theme, readAppearanceType())
}

export function saveAppearanceType(type: AppearanceType) {
  localStorage.setItem(APPEARANCE_TYPE_KEY, type)
  applyAppearance(readAppearanceTheme(), type)
}

/** Inline script for layout <head> — prevents FOUC before React hydrates. */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${APPEARANCE_THEME_KEY}')||'navy';var y=localStorage.getItem('${APPEARANCE_TYPE_KEY}')||'modern';if(t!=='forest')t='navy';if(y!=='classic')y='modern';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-type',y);}catch(e){document.documentElement.setAttribute('data-theme','navy');document.documentElement.setAttribute('data-type','modern');}})();`
