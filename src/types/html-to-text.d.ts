declare module "html-to-text" {
  export interface HtmlToTextOptions {
    selectors?: Array<{
      selector: string;
      format?: string;
      options?: Record<string, unknown>;
    }>;
    wordwrap?: number | false;
    preserveNewlines?: boolean;
    uppercaseHeadings?: boolean;
  }

  export function htmlToText(
    value: string,
    options?: HtmlToTextOptions,
  ): string;
}
