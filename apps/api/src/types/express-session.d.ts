import "express-session";

declare module "express-session" {
  interface SessionData {
    ftnNonce?: string;
    ftnState?: string;
  }
}
