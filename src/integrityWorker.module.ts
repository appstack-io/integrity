import { Module } from '@nestjs/common';
import { IntegrityWarningWorkerService } from './integrityWarningWorker.service';
import { MqModule } from '@appstack-io/mq';
import { RemoveTempsWorkerService } from './removeTempsWorker.service';
import { IntegrityService } from './integrity.service';
import { ArangodbModule } from '@appstack-io/arangodb';

@Module({
  imports: [MqModule, ArangodbModule],
  providers: [
    IntegrityWarningWorkerService,
    RemoveTempsWorkerService,
    IntegrityService,
  ],
  exports: [
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
