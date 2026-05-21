import { Controller, Get, Post, Body, Logger } from "@nestjs/common";
import { EvolutionEventConsumerService } from "./evolution-event.consumer";

interface RegisterInstanceDto {
  instanceName?: string;
  rescanAll?: boolean;
}

@Controller("evolution/consumers")
export class EvolutionConsumersController {
  private readonly logger = new Logger(EvolutionConsumersController.name);

  constructor(
    private readonly evolutionEventConsumer: EvolutionEventConsumerService
  ) {}

  @Get()
  getRegisteredInstances() {
    const instances = this.evolutionEventConsumer.getRegisteredInstances();
    return {
      status: "ok",
      registeredInstances: instances,
      count: instances.length,
    };
  }

  @Post()
  async registerInstance(@Body() body: RegisterInstanceDto) {
    if (body.rescanAll) {
      this.logger.log("Rescanning all Evolution instances...");
      const instances = await this.evolutionEventConsumer.rescanInstances();
      return {
        status: "ok",
        action: "rescan_all",
        registeredInstances: instances,
        count: instances.length,
      };
    }

    if (body.instanceName) {
      this.logger.log(`Registering instance: ${body.instanceName}`);
      const success = await this.evolutionEventConsumer.registerInstance(
        body.instanceName
      );
      return {
        status: success ? "ok" : "error",
        action: "register",
        instanceName: body.instanceName,
        message: success
          ? `Consumer registered for instance: ${body.instanceName}`
          : `Failed to register instance: ${body.instanceName}`,
      };
    }

    return {
      status: "error",
      error: "Missing instanceName or rescanAll parameter",
      usage: {
        registerOne: { instanceName: "instance-name" },
        rescanAll: { rescanAll: true },
      },
    };
  }
}
