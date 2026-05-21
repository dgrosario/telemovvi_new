import { SectorsDatabaseRepository } from "../../infra/repositories/sectors-respository";

interface SectorsRepository {
  removeMany(ids: string[]): Promise<void>;
}

export class RemoveManySectors {
  constructor(private readonly sectorsRepository: SectorsRepository) {}

  async execute(input: InputDTO) {
    if (!input.ids.length) {
      throw new Error("Nenhum setor selecionado para remoção.");
    }

    await this.sectorsRepository.removeMany(input.ids);
  }

  static instance() {
    return new RemoveManySectors(SectorsDatabaseRepository.instance());
  }
}

type InputDTO = {
  ids: string[];
};
