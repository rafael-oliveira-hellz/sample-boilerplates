export const PORTO_DESIGN_TOKENS = {
  color: {
    navy: '#003E7E',
    blue: '#00A0DF',
    blueStrong: '#0077C8',
    orange: '#F58220',
    orangeSoft: '#FFF2E5',
    ice: '#EEF7FC',
    mist: '#F7FBFE',
    border: '#D7E8F4',
    text: '#163047',
    textSoft: '#5E7D95',
    panel: 'rgba(255, 255, 255, 0.98)'
  },
  radius: {
    xl: '30px',
    lg: '22px',
    md: '16px',
    sm: '12px'
  },
  shadow: {
    lg: '0 24px 60px rgba(0, 62, 126, 0.12)',
    md: '0 16px 36px rgba(0, 62, 126, 0.08)',
    sm: '0 10px 24px rgba(16, 38, 56, 0.08)'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px'
  }
} as const;

export type PortoDesignTokens = typeof PORTO_DESIGN_TOKENS;
