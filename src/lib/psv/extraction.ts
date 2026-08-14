import type { ExtractedField } from "@/types/psv";

/**
 * Document extraction abstraction.
 * AI extraction is NOT verification — never label outputs as Verified.
 */
export interface DocumentExtractionService {
  extract(input: {
    fileName: string;
    documentType?: string | null;
    mimeType?: string | null;
  }): Promise<ExtractedField[]>;
}

/**
 * Heuristic POC extractor from filename / declared type.
 * Swap for Claude vision/OCR later without changing callers.
 */
export class HeuristicDocumentExtractionService
  implements DocumentExtractionService
{
  async extract(input: {
    fileName: string;
    documentType?: string | null;
    mimeType?: string | null;
  }): Promise<ExtractedField[]> {
    const name = input.fileName.toLowerCase();
    const type = (input.documentType ?? "").toLowerCase();
    const sourceDocument = input.fileName;

    if (type.includes("license") || name.includes("license") || name.includes("lic")) {
      const smyth = name.includes("smyth");
      return [
        {
          field: "document_type",
          value: "medical_license",
          confidence: 0.7,
          sourceDocument,
        },
        {
          field: "provider_name",
          value: smyth ? "Jane A. Smyth" : null,
          confidence: smyth ? 0.8 : 0.3,
          sourceDocument,
        },
        {
          field: "license_number",
          value: smyth ? "SZ99999" : name.includes("sz10229") ? "SZ10229" : null,
          confidence: 0.55,
          sourceDocument,
        },
        {
          field: "license_state",
          value: name.includes("fl") || name.includes("florida") || smyth ? "FL" : null,
          confidence: 0.45,
          sourceDocument,
        },
        {
          field: "status",
          value: "Extracted (heuristic — not verified)",
          confidence: 0.4,
          sourceDocument,
        },
      ];
    }

    if (type.includes("cv") || name.includes("cv") || name.includes("resume")) {
      return [
        {
          field: "document_type",
          value: "cv",
          confidence: 0.75,
          sourceDocument,
        },
      ];
    }

    if (type.includes("dea") || name.includes("dea")) {
      return [
        {
          field: "document_type",
          value: "dea_certificate",
          confidence: 0.7,
          sourceDocument,
        },
      ];
    }

    return [
      {
        field: "document_type",
        value: input.documentType ?? "supporting_document",
        confidence: 0.35,
        sourceDocument,
      },
    ];
  }
}

export function getDocumentExtractionService(): DocumentExtractionService {
  return new HeuristicDocumentExtractionService();
}
