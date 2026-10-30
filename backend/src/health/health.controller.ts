import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface HealthOkResponse {
  status: 'ok';
  timestamp: string;
  database: 'connected';
}

export interface HealthErrorResponse {
  status: 'error';
  database: 'disconnected';
}

export type HealthResponse = HealthOkResponse | HealthErrorResponse;

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    if (!this.connection || this.connection.readyState !== 1) {
      throw new HttpException(
        { status: 'error', database: 'disconnected' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    };
  }
}
