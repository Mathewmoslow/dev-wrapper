export const colors = {
  primary: '#ffffff',
  secondary: '#808080',
  muted: '#505050',
  dim: '#303030',
  accent: '#00bfff',
  warning: '#ffb000',
  error: '#ff4444',
  success: '#00aa00',
  background: '#111111',
  border: '#252525',
  borderLight: '#303030',
} as const;

export const borders = {
  horizontal: '─',
  vertical: '│',
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  teeLeft: '├',
  teeRight: '┤',
  teeTop: '┬',
  teeBottom: '┴',
  cross: '┼',
} as const;

export const progress = {
  filled: '█',
  empty: '░',
} as const;

export const tags = {
  done: '[done]',
  warn: '[warn]',
  fail: '[fail]',
  ask: '[ask]',
  pending: '[....]',
} as const;

export const hotkeys = {
  git: '^G',
  handoff: '^H',
  quit: '^Q',
  commit: '^S',
  push: '^P',
} as const;

export function createProgressBar(
  percentage: number,
  width: number = 25
): { filled: string; empty: string } {
  const filledCount = Math.round((percentage / 100) * width);
  const emptyCount = width - filledCount;

  return {
    filled: progress.filled.repeat(filledCount),
    empty: progress.empty.repeat(emptyCount),
  };
}

export function createHorizontalRule(width: number): string {
  return borders.horizontal.repeat(width);
}

export function createBox(
  title: string,
  width: number
): { top: string; bottom: string } {
  const titlePart = `${borders.topLeft}${borders.horizontal} ${title} `;
  const remainingWidth = width - titlePart.length - 1;
  const top = titlePart + borders.horizontal.repeat(remainingWidth) + borders.topRight;
  const bottom = borders.bottomLeft + borders.horizontal.repeat(width - 2) + borders.bottomRight;

  return { top, bottom };
}
