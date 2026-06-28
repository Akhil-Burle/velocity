export interface StatData {
  value: number;
  suffix: string;
  label: string;
  sublabel: string;
}

export const STATS: StatData[] = [
  { value: 1240, suffix: '+', label: 'tasks analyzed', sublabel: 'this month' },
  { value: 98, suffix: '%', label: 'on-time delivery', sublabel: 'avg across demo users' },
  { value: 3, suffix: 'x', label: 'velocity boost', sublabel: 'vs manual planning' },
];
