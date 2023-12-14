import { Module } from '@nestjs/common';
import { IntegrityWarningWorkerService } from './integrityWarningWorker.service';
import { MqModule } from '@appstack-io/mq';
import { RemoveTempsWorkerService } from './removeTempsWorker.service';
import { IntegrityService } from './integrity.service';
import { ClientModule } from '@appstack-io/client';
import { ArangodbModule } from '@appstack-io/arangodb';

@Module({
  imports: [MqModule, ArangodbModule, ClientModule],
  providers: [
    IntegrityWarningWorkerService,
    RemoveTempsWorkerService,
    IntegrityService,
  ],
})
export class IntegrityWorkerModule {
  static getDirname() {
    return __dirname;
  }
}
