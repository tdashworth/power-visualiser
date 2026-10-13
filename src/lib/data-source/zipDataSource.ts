import { parseSolutionZips, type ParseResult } from "@/lib/solutionParser";
import type { DataSource, LoadOptions } from "./types";

/**
 * DataSource backed by user-uploaded solution ZIPs, parsed entirely
 * in the browser. This is the source used by the public web app and
 * preserves the "nothing leaves the browser" privacy guarantee.
 *
 * `load()` expects `opts.input` to be a `File[]` (the uploaded zips).
 * Callers that already hold a parsed `ParseResult` (e.g. localStorage
 * cache hydration) should bypass the data source and write directly
 * to `FlowDataContext` via `handleImport`.
 */
export const zipDataSource: DataSource = {
  id: "zip",
  capabilities: {
    canImportZip: true,
    canSelectSolution: false,
    canRefresh: false,
    isPrivacyLocal: true,
  },
  async load(opts?: LoadOptions): Promise<ParseResult> {
    const files = opts?.input as File[] | undefined;
    if (!files || files.length === 0) {
      throw new Error("zipDataSource.load requires opts.input to be a non-empty File[]");
    }
    return parseSolutionZips(files, opts?.onProgress);
  },
};
