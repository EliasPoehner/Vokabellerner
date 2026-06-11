export type PageId = 'landing' | 'school' | 'schulstoff' | 'gaming' | 'early-access';
export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentColor = 'primary' | 'secondary' | 'tertiary';

export interface LinkItem {
  href: string;
  target?: '_blank';
  icon: string;
  color: AccentColor;
  title: string;
  desc: string;
}

export interface SchoolCategory {
  id: string;
  icon: string;
  color: AccentColor;
  title: string;
  subtitle: string;
  count: number;
  items: LinkItem[];
}

export interface GameCard {
  href: string;
  target?: '_blank';
  emoji: string;
  title: string;
  desc: string;
}

export interface EarlyAccessCard {
  href: string;
  emoji: string;
  title: string;
  desc: string;
}
