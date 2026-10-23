/** Infrastructure collections use stable string keys rather than ObjectId keys.
 * MongoDB Driver v6+ otherwise assumes ObjectId for _id when the collection
 * document type is omitted. These types mirror database/init.js.
 */
export interface DatabaseVersionDocument {
  _id: string;
  role: string;
  schemaVersion: number;
  schemaChecksum: string;
  initializedAt?: Date;
  appliedAt?: Date;
  projectionStartTime?: unknown;
}

export interface AudioWorkerSettingsDocument {
  _id: string;
  maxWorkers?: number;
  backlogThreshold?: number;
}
