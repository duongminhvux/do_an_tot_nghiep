/** SQL row contracts for the optional media settings API. */
export interface AudioWorkerSettingsDocument {
  key: string;
  maxWorkers: number;
  backlogThreshold: number;
}
