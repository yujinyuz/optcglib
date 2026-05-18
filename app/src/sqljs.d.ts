declare module 'sql.js' {
  export interface Database {
    exec(sql: string, params?: (string | number | null)[]): {
      columns: string[];
      values: (string | number | null)[][];
    }[];
  }

  export interface QueryResults {
    columns: string[];
    values: (string | number | null)[][];
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<{
    Database: new (data?: Uint8Array) => Database;
  }>;
}
