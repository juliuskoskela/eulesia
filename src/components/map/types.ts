export type MapFilterType = "municipalities" | "agora" | "clubs" | "places";
export type TimePreset = "week" | "month" | "year" | "all";

export interface MapFilterState {
  types: MapFilterType[];
  timePreset: TimePreset;
  dateFrom?: string;
  dateTo?: string;
  scopes?: ("local" | "national" | "european")[];
  languages?: string[];
  tags?: string[];
}

export const DEFAULT_FILTERS: MapFilterState = {
  types: ["municipalities", "agora", "clubs", "places"],
  timePreset: "all",
};
