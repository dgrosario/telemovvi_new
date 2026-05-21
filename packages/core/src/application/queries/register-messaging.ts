import { User } from "../../domain/entities/user";
import { NotAuthorized } from "../../domain/errors/not-authorized";
import { JWTTokenDriver } from "../../infra/drivers/token-driver";
import { UsersDatabaseRepository } from "../../infra/repositories/users-repository";

interface TokenDriver {
  decode(token: string): string | null;
}

interface UsersRepository {
  retrieve(id: string): Promise<User | null>;
}

export class RegisterMessaging {
  constructor(
    private readonly tokenDriver: TokenDriver,
    private readonly usersRepository: UsersRepository
  ) {}

  async execute(input: InputDTO) {
    const userId = this.tokenDriver.decode(input.token);

    if (!userId) throw NotAuthorized.throw();

    const user = await this.usersRepository.retrieve(userId);

    if (!user || user.email !== "omnichannel@omnichannel.com.br")
      throw NotAuthorized.throw();

    return input.challenge;
  }

  static instance() {
    return new RegisterMessaging(
      JWTTokenDriver.instance(),
      UsersDatabaseRepository.instance()
    );
  }
}
type InputDTO = {
  token: string;
  challenge: string;
};
