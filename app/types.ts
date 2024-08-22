export interface Company {
  name: string;
  industry: string;
  description: string;
  scoreItems: any[];
}

export interface ScoreItem {
  name: string;
  value: string | number;
}