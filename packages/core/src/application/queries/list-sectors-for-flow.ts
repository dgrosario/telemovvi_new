import { createDatabaseConnection } from "../../infra/database";
import { sectors, flowsInSectors } from "../../infra/database/schemas";
import { eq } from "drizzle-orm";

export class ListSectorsForFlow {
  async execute(input: InputDTO): Promise<OutputDTO[]> {
    const db = createDatabaseConnection();

    const result = await db
      .select({
        id: sectors.id,
        name: sectors.name,
        color: sectors.color,
        isDefault: sectors.isDefault,
      })
      .from(flowsInSectors)
      .innerJoin(sectors, eq(flowsInSectors.sectorId, sectors.id))
      .where(eq(flowsInSectors.flowId, input.flowId));

    return result.map((sector) => ({
      id: sector.id,
      name: sector.name,
      color: sector.color,
      isDefault: sector.isDefault,
    }));
  }

  static instance() {
    return new ListSectorsForFlow();
  }
}

type InputDTO = {
  flowId: string;
};

type OutputDTO = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
};
