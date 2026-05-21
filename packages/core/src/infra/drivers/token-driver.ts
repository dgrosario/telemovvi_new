import jwt from "jsonwebtoken";
export interface TokenDriver {
  create(userId: string): string;
}

export class JWTTokenDriver implements TokenDriver {
  create(userId: string): string {
    const token = jwt.sign({ id: userId }, "shhh-omnichannelai");

    return token;
  }

  decode(token: string): string | null {
    const user = jwt.decode(token) as { id: string };
    if (!user.id) return null;
    return user.id;
  }

  static instance() {
    return new JWTTokenDriver();
  }
}
