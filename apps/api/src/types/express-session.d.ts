import "express-session";

declare module "express-session" {
  interface SessionData {
    ftnInviteCode?: string;
    ftnNonce?: string;
    ftnState?: string;
  }
}
