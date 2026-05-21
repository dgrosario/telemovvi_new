import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorResult,
} from "@nestjs/terminus";
import { RabbitMQPublisherService } from "../publishers/rabbitmq-publisher.service";
import { RabbitMQConsumerService } from "../consumers/rabbitmq-consumer.service";
import {
  CircuitBreakerService,
  CircuitBreakerState,
  CircuitBreakerStatus,
} from "../circuit-breaker";
import { RedisService } from "../database/redis.service";
import { MainDatabaseService } from "../database/main-database.service";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private rabbitMQPublisher: RabbitMQPublisherService,
    private rabbitMQConsumer: RabbitMQConsumerService,
    private circuitBreakerService: CircuitBreakerService,
    private redisService: RedisService,
    private mainDatabaseService: MainDatabaseService
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.rabbitMQPublisher.checkHealth("rabbitmq-publisher"),
      () => this.rabbitMQConsumer.checkHealth("rabbitmq-consumer"),
      () => this.checkCircuitBreakers(),
      () => this.checkRedis(),
      () => this.checkMainDatabase(),
    ]);
  }

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.rabbitMQPublisher.checkHealth("rabbitmq"),
      () => this.checkRedis(),
    ]);
  }

  @Get("circuit-breakers")
  getCircuitBreakersStatus(): CircuitBreakerStatus[] {
    return this.circuitBreakerService.getAllStatuses();
  }

  private checkCircuitBreakers(): HealthIndicatorResult {
    const statuses = this.circuitBreakerService.getAllStatuses();

    const openCircuits = statuses.filter(
      (s) => s.state === CircuitBreakerState.OPEN
    );

    const isHealthy = openCircuits.length === 0;

    const details: Record<string, { state: CircuitBreakerState; stats: CircuitBreakerStatus["stats"] }> = {};
    for (const status of statuses) {
      details[status.name] = {
        state: status.state,
        stats: status.stats,
      };
    }

    return {
      "circuit-breakers": {
        status: isHealthy ? "up" : "down",
        openCircuits: openCircuits.map((c) => c.name),
        details,
      },
    };
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      await this.redisService.healthCheck();
      return {
        redis: {
          status: "up",
        },
      };
    } catch (error) {
      return {
        redis: {
          status: "down",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  private async checkMainDatabase(): Promise<HealthIndicatorResult> {
    if (!this.mainDatabaseService.isConnected()) {
      return {
        "main-database": {
          status: "up",
          message: "Main database not configured (optional)",
        },
      };
    }

    try {
      await this.mainDatabaseService.healthCheck();
      return {
        "main-database": {
          status: "up",
        },
      };
    } catch (error) {
      return {
        "main-database": {
          status: "down",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}
