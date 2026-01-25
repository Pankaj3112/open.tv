declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }

  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
    }
  }
}

export {};
