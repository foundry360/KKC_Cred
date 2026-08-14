import type { PSVRequest, PSVResult } from "@/types/psv";

/**
 * Modular PSV provider contract.
 * Add new sources without changing UI or orchestration.
 */
export interface PSVProvider {
  readonly id: string;
  readonly sourceName: string;
  readonly sourceMode: "live" | "poc";
  verify(input: PSVRequest): Promise<PSVResult>;
}
