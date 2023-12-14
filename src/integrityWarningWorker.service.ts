import { Injectable, OnModuleInit } from '@nestjs/common';
import { MqService } from '@appstack-io/mq';
import { IntegrityService } from './integrity.service';

const INTEGRITY_QUEUE_NAME = 'integrity.warning';
const INTEGRITY_JOB_INTERVAL = 60 * 1000;

@Injectable()
export class IntegrityWarningWorkerService implements OnModuleInit {
  constructor(private mq: MqService, private service: IntegrityService) {}

  async onJob(): Promise<void> {
    for (const collection of this.service.collections) {
      const cursor = this.service.findByPermissionIntegrityWarning(collection);
      for await (const next of cursor) {
        await this.service.updateOne({
          collection,
          id: next.id,
        });
      }
    }
  }

  private async triggerRepeatingJob() {
    await this.mq.publish({
      queue: INTEGRITY_QUEUE_NAME,
      message: {},
      opts: {
        repeat: { every: INTEGRITY_JOB_INTERVAL },
        repeatJobKey: INTEGRITY_QUEUE_NAME,
        jobId: INTEGRITY_QUEUE_NAME,
      },
    });
  }

  private async startWorker() {
    await this.mq.startWorker({
      queue: INTEGRITY_QUEUE_NAME,
      handler: async () => {
        await this.onJob();
      },
      opts: {
        limiter: { max: 1, duration: INTEGRITY_JOB_INTERVAL },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.triggerRepeatingJob();
    await this.startWorker();
  }
}
