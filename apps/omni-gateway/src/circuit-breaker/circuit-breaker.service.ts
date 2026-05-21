import { Injectable, Logger, OnModuleDestroy, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import CircuitBreaker from "opossum";
import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from "./circuit-breaker.interface";

type AsyncFunction<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

interface BreakerEntry<TArgs extends unknown[], TResult> {
  breaker: CircuitBreaker<TArgs, TResult>;
  name: string;
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers: Map<string, BreakerEntry<unknown[], unknown>> =
    new Map();
  private readonly config: CircuitBreakerConfig;

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    this.config = {
      timeout:
        this.configService.get<number>("circuitBreaker.timeout") ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.timeout,
      errorThresholdPercentage:
        this.configService.get<number>(
          "circuitBreaker.errorThresholdPercentage"
        ) ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.errorThresholdPercentage,
      resetTimeout:
        this.configService.get<number>("circuitBreaker.resetTimeout") ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeout,
      volumeThreshold:
        this.configService.get<number>("circuitBreaker.volumeThreshold") ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.volumeThreshold,
      rollingCountTimeout:
        this.configService.get<number>("circuitBreaker.rollingCountTimeout") ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.rollingCountTimeout,
      rollingCountBuckets:
        this.configService.get<number>("circuitBreaker.rollingCountBuckets") ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.rollingCountBuckets,
    };
  }

  create<TArgs extends unknown[], TResult>(
    name: string,
    fn: AsyncFunction<TArgs, TResult>,
    customConfig?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker<TArgs, TResult> {
    const existingBreaker = this.breakers.get(name);
    if (existingBreaker) {
      return existingBreaker.breaker as CircuitBreaker<TArgs, TResult>;
    }

    const mergedConfig = { ...this.config, ...customConfig };

    const breaker = new CircuitBreaker<TArgs, TResult>(fn, {
      timeout: mergedConfig.timeout,
      errorThresholdPercentage: mergedConfig.errorThresholdPercentage,
      resetTimeout: mergedConfig.resetTimeout,
      volumeThreshold: mergedConfig.volumeThreshold,
      rollingCountTimeout: mergedConfig.rollingCountTimeout,
      rollingCountBuckets: mergedConfig.rollingCountBuckets,
    });

    this.setupEventListeners(breaker, name);

    this.breakers.set(name, {
      breaker: breaker as CircuitBreaker<unknown[], unknown>,
      name,
    });

    this.logger.log(`Circuit breaker "${name}" created with config: ${JSON.stringify(mergedConfig)}`);

    return breaker;
  }

  async fire<TArgs extends unknown[], TResult>(
    name: string,
    fn: AsyncFunction<TArgs, TResult>,
    ...args: TArgs
  ): Promise<TResult> {
    const breaker = this.create(name, fn);
    return breaker.fire(...args);
  }

  getStatus(name: string): CircuitBreakerStatus | undefined {
    const entry = this.breakers.get(name);
    if (!entry) {
      return undefined;
    }

    const { breaker } = entry;
    const stats = breaker.stats;

    return {
      name,
      state: this.mapState(breaker),
      stats: {
        failures: stats.failures,
        fallbacks: stats.fallbacks,
        successes: stats.successes,
        rejects: stats.rejects,
        fires: stats.fires,
        timeouts: stats.timeouts,
      },
    };
  }

  getAllStatuses(): CircuitBreakerStatus[] {
    return Array.from(this.breakers.keys())
      .map((name) => this.getStatus(name))
      .filter((status): status is CircuitBreakerStatus => status !== undefined);
  }

  reset(name: string): void {
    const entry = this.breakers.get(name);
    if (entry) {
      entry.breaker.close();
      this.logger.log(`Circuit breaker "${name}" manually reset`);
    }
  }

  resetAll(): void {
    this.breakers.forEach((entry) => {
      entry.breaker.close();
    });
    this.logger.log("All circuit breakers manually reset");
  }

  onModuleDestroy(): void {
    this.breakers.forEach((entry) => {
      entry.breaker.shutdown();
    });
    this.breakers.clear();
    this.logger.log("All circuit breakers shut down");
  }

  private setupEventListeners<TArgs extends unknown[], TResult>(
    breaker: CircuitBreaker<TArgs, TResult>,
    name: string
  ): void {
    breaker.on("open", () => {
      this.logger.warn(
        `Circuit breaker "${name}" OPENED - requests will be rejected`
      );
    });

    breaker.on("halfOpen", () => {
      this.logger.log(
        `Circuit breaker "${name}" HALF-OPEN - testing if service recovered`
      );
    });

    breaker.on("close", () => {
      this.logger.log(
        `Circuit breaker "${name}" CLOSED - service recovered, normal operation resumed`
      );
    });

    breaker.on("timeout", () => {
      this.logger.warn(`Circuit breaker "${name}" - request timed out`);
    });

    breaker.on("reject", () => {
      this.logger.warn(
        `Circuit breaker "${name}" - request rejected (circuit is open)`
      );
    });

    breaker.on("fallback", () => {
      this.logger.debug(`Circuit breaker "${name}" - fallback executed`);
    });

    breaker.on("failure", (error: Error) => {
      this.logger.error(
        `Circuit breaker "${name}" - request failed: ${error.message}`
      );
    });
  }

  private mapState<TArgs extends unknown[], TResult>(
    breaker: CircuitBreaker<TArgs, TResult>
  ): CircuitBreakerState {
    if (breaker.opened) {
      return CircuitBreakerState.OPEN;
    }
    if (breaker.halfOpen) {
      return CircuitBreakerState.HALF_OPEN;
    }
    return CircuitBreakerState.CLOSED;
  }
}
