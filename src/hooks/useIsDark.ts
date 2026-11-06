import { useSettings } from '../context/SettingsContext'
import { useMediaQuery } from './useMediaQuery'

/** Whether the resolved theme is dark (considering the "system" preference). */
export function useIsDark(): boolean {
  const { settings } = useSettings()
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  return settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
}

export interface ChartColors {
  sage: string
  sageSoft: string
  coral: string
  grid: string
  axis: string
  tooltipBg: string
  tooltipBorder: string
  text: string
}

/** Palette values for Recharts (SVG attrs can't read our channel-based tokens). */
export function chartColors(isDark: boolean): ChartColors {
  return isDark
    ? {
        sage: '#92AC98',
        sageSoft: 'rgba(146,172,152,0.22)',
        coral: '#F4986A',
        grid: '#35332F',
        axis: '#9C9890',
        tooltipBg: '#232220',
        tooltipBorder: '#35332F',
        text: '#F2F0EA',
      }
    : {
        sage: '#8FA995',
        sageSoft: 'rgba(143,169,149,0.20)',
        coral: '#F28C5B',
        grid: '#E8E6DF',
        axis: '#858585',
        tooltipBg: '#FFFFFF',
        tooltipBorder: '#E8E6DF',
        text: '#292929',
      }
}
