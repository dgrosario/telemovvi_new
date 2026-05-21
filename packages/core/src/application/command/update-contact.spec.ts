import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateContact } from "./update-contact";
import { Channel } from "../../domain/entities/channel";
import { Partner } from "../../domain/entities/partner";
import { OnContactUpsertProps } from "../../infra/controllers/evolution-event-handler";

describe("UpdateContact", () => {
  let channelsRepository: {
    retrieveByTypeAndPayload: ReturnType<typeof vi.fn>;
  };
  let partnersRepository: {
    retrieveByContactTypeAndValue: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let command: UpdateContact;

  const mockChannel = Channel.instance({
    id: "channel-123",
    name: "Test Channel",
    status: "connected",
    createdAt: new Date(),
    type: "evolution",
    payload: { instanceName: "test-instance" },
    responseChannel: null,
    deletedAt: null,
  });

  beforeEach(() => {
    channelsRepository = {
      retrieveByTypeAndPayload: vi.fn(),
    };
    partnersRepository = {
      retrieveByContactTypeAndValue: vi.fn(),
      upsert: vi.fn(),
    };

    command = new UpdateContact(channelsRepository, partnersRepository);
  });

  const createInput = (
    overrides: Partial<OnContactUpsertProps> = {}
  ): OnContactUpsertProps => ({
    instanceName: "test-instance",
    contactId: "5511999999999@s.whatsapp.net",
    contactName: "John Doe",
    ...overrides,
  });

  describe("successful contact update", () => {
    it("should update partner name when changed", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });

      const existingPartner = Partner.create({
        name: "Old Name",
        contacts: [
          {
            id: "contact-123",
            type: "evolution",
            value: "5511999999999",
            thumbnail: "",
          },
        ],
      });
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(
        existingPartner
      );

      const input = createInput({ contactName: "New Name" });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      expect(result?.partner.name).toBe("New Name");
      expect(result?.workspaceId).toBe("workspace-123");
      expect(partnersRepository.upsert).toHaveBeenCalled();
    });

    it("should update contact thumbnail when provided", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });

      const existingPartner = Partner.create({
        name: "John Doe",
        contacts: [
          {
            id: "contact-123",
            type: "evolution",
            value: "5511999999999",
            thumbnail: "",
          },
        ],
      });
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(
        existingPartner
      );

      const input = createInput({
        contactName: "John Doe",
        contactThumbnail: "https://example.com/avatar.jpg",
      });
      const result = await command.execute(input);

      expect(result).not.toBeNull();
      const contact = result?.partner.retrieveContactByValue("5511999999999");
      expect(contact?.thumbnail).toBe("https://example.com/avatar.jpg");
    });

    it("should not update when there are no changes", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });

      const existingPartner = Partner.create({
        name: "John Doe",
        contacts: [
          {
            id: "contact-123",
            type: "evolution",
            value: "5511999999999",
            thumbnail: "",
          },
        ],
      });
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(
        existingPartner
      );

      const input = createInput({ contactName: "John Doe" });
      await command.execute(input);

      expect(partnersRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe("phone number extraction", () => {
    it("should extract phone from @s.whatsapp.net format", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);

      const input = createInput({
        contactId: "5511888888888@s.whatsapp.net",
      });
      await command.execute(input);

      expect(partnersRepository.retrieveByContactTypeAndValue).toHaveBeenCalledWith(
        "evolution",
        "5511888888888",
        "workspace-123"
      );
    });

    it("should extract phone from @g.us format (group)", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);

      const input = createInput({
        contactId: "120363123456789@g.us",
      });
      await command.execute(input);

      expect(partnersRepository.retrieveByContactTypeAndValue).toHaveBeenCalledWith(
        "evolution",
        "120363123456789",
        "workspace-123"
      );
    });
  });

  describe("error handling", () => {
    it("should return null when channel is not found", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue(null);

      const input = createInput();
      const result = await command.execute(input);

      expect(result).toBeNull();
      expect(partnersRepository.retrieveByContactTypeAndValue).not.toHaveBeenCalled();
    });

    it("should return null when partner is not found (skip update)", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(null);

      const input = createInput();
      const result = await command.execute(input);

      expect(result).toBeNull();
      expect(partnersRepository.upsert).not.toHaveBeenCalled();
    });

    it("should lookup channel with evolution type and instanceName", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue(null);

      const input = createInput({ instanceName: "my-custom-instance" });
      await command.execute(input);

      expect(channelsRepository.retrieveByTypeAndPayload).toHaveBeenCalledWith(
        "evolution",
        { instanceName: "my-custom-instance" }
      );
    });
  });

  describe("return value", () => {
    it("should return isNew as false since we only update existing partners", async () => {
      channelsRepository.retrieveByTypeAndPayload.mockResolvedValue({
        channel: mockChannel,
        workspaceId: "workspace-123",
      });

      const existingPartner = Partner.create({
        name: "Old Name",
        contacts: [
          {
            id: "contact-123",
            type: "evolution",
            value: "5511999999999",
            thumbnail: "",
          },
        ],
      });
      partnersRepository.retrieveByContactTypeAndValue.mockResolvedValue(
        existingPartner
      );

      const input = createInput({ contactName: "New Name" });
      const result = await command.execute(input);

      expect(result?.isNew).toBe(false);
    });
  });
});
