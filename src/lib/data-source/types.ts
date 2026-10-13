import type { ParseResult } from "@/lib/solutionParser";

/**
 * Capabilities advertised by a DataSource so the shared UI can adapt
 * (e.g. show/hide the ZIP import button, show a refresh button,
 * pick the right privacy notice).
 */
export interface DataSourceCapabilities {
  /** Source ingests user-uploaded solution ZIPs in the browser. */
  canImportZip: boolean;
  /** Source can present a solution picker (e.g. Dataverse). */
  canSelectSolution: boolean;
  /** Source can refresh its data on demand without re-uploading. */
  canRefresh: boolean;
  /**
   * True when all processing stays inside the user's browser and no
   * data is sent off-device. Drives the privacy notice copy.
   */
  isPrivacyLocal: boolean;
}

export type DataSourceId = "zip" | "dataverse";

export interface LoadOptions {
  /** Optional progress callback for sources that load incrementally. */
  onProgress?: (current: number, total: number) => void;
  /** Source-specific payload (e.g. files for ZIP, solution ids for Dataverse). */
  input?: unknown;
}

/**
 * Common contract for everything that can produce the app's
 * { flows, edges, actions } model. The web app uses ZipDataSource;
 * the Power Apps Code App will use DataverseDataSource.
 */
export interface DataSource {
  readonly id: DataSourceId;
  readonly capabilities: DataSourceCapabilities;
  load(opts?: LoadOptions): Promise<ParseResult>;
  refresh?(): Promise<ParseResult>;
}
