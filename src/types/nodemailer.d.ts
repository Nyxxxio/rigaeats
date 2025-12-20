declare module 'nodemailer' {
  // Minimal typings to satisfy TypeScript in environments without @types/nodemailer
  interface Transporter {
    sendMail(mailOptions: any): Promise<any>;
  }

  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  }

  function createTransport(options: TransportOptions): Transporter;

  export { createTransport };
  export default { createTransport } as any;
}
