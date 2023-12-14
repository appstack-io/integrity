import { Injectable, OnModuleInit } from '@nestjs/common';
import { MqService } from '@appstack-io/mq';
import { IntegrityService } from './integrity.service';

const REMOVE_TEMPS_QUEUE_NAME = 'temps.removal';
const REMOVE_TEMPS_JOB_INTERVAL = 60 * 1000;
const MILLIS_AGO = 60 * 1000;

@Injectable()
export class RemoveTempsWorkerService implements OnModuleInit {
  constructor(private mq: MqService, private service: IntegrityService) {}

  async onJob(): Promise<void> {
    for (const collection of this.service.collections) {
      await this.service.removeTemps({
        collection,
        millisAgo: MILLIS_AGO,
      });
    }
  }

  private async triggerRepeatingJob() {
    await this.mq.publish({
      queue: REMOVE_TEMPS_QUEUE_NAME,
      message: {},
      opts: {
        repeat: { every: REMOVE_TEMPS_JOB_INTERVAL },
        repeatJobKey: REMOVE_TEMPS_QUEUE_NAME,
        jobId: REMOVE_TEMPS_QUEUE_NAME,
      },
    });
  }

  private async startWorker() {
    await this.mq.startWorker({
      queue: REMOVE_TEMPS_QUEUE_NAME,
      handler: async () => {
        await this.onJob();
      },
      opts: {
        limiter: { max: 1, duration: REMOVE_TEMPS_JOB_INTERVAL },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.triggerRepeatingJob();
    await this.startWorker();
  }
}
