import { Injectable } from '@nestjs/common';
import { MqService } from '@appstack-io/mq';
import { IntegrityService } from './integrity.service';
import { ArangodbService } from '@appstack-io/arangodb';

const REMOVE_TEMPS_QUEUE_NAME = 'remove.temps';
const REMOVE_TEMPS_JOB_INTERVAL = 60 * 1000;
const MILLIS_AGO = 60 * 1000;

@Injectable()
export class RemoveTempsWorkerService {
  constructor(
    private mq: MqService,
    private service: IntegrityService,
    private arangodb: ArangodbService,
  ) {}

  async onJob(collection: string): Promise<void> {
    await this.service.removeTemps({
      collection,
      millisAgo: MILLIS_AGO,
    });
  }

  private async triggerRepeatingJob(collection: string) {
    const queue = `${REMOVE_TEMPS_QUEUE_NAME}.${collection}`;
    await this.mq.publish({
      queue,
      message: {},
      opts: {
        repeat: { every: REMOVE_TEMPS_JOB_INTERVAL },
        repeatJobKey: queue,
        jobId: queue,
      },
    });
  }

  private async startWorker(collection: string) {
    await this.mq.startWorker({
      queue: `${REMOVE_TEMPS_QUEUE_NAME}.${collection}`,
      handler: async () => {
        await this.onJob(collection);
      },
      opts: {
        limiter: { max: 1, duration: REMOVE_TEMPS_JOB_INTERVAL },
      },
    });
  }

  async init(collection: string): Promise<void> {
    await this.arangodb.utils.tryDdl(
      () => this.arangodb.db.createCollection(collection, {}), // TODO: dangerous because would lock in empty options.
      () =>
        this.arangodb.db.collection(collection).ensureIndex({
          name: `idx-${collection}-is-temp-v1`,
          type: 'persistent',
          fields: ['isTemp'],
        }),
    );
    await this.triggerRepeatingJob(collection);
    await this.startWorker(collection);
  }
}
