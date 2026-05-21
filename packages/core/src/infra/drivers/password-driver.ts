import bcrypt from "bcrypt";

export interface PasswordDriver {
  compare(password: string, hash: string): boolean;
  create(password: string): string;
}

export class BcryptPasswordDriver implements PasswordDriver {
  compare(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }

  create(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  static instance() {
    return new BcryptPasswordDriver();
  }
}
