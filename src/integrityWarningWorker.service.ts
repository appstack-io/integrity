import { Injectable } from '@nestjs/common';
import { MqService } from '@appstack-io/mq';
import { IntegrityService } from './integrity.service';
import { ArangodbService } from '@appstack-io/arangodb';

const INTEGRITY_QUEUE_NAME = 'integrity.warning';
const INTEGRITY_JOB_INTERVAL = 60 * 1000;

@Injectable()
export class IntegrityWarningWorkerService {
  constructor(
    private mq: MqService,
    private service: IntegrityService,
    private arangodb: ArangodbService,
  ) {}

  async onJob(
    collection: string,
    fixer: (id: string) => Promise<void>,
  ): Promise<void> {
    const cursor = this.service.findByPermissionIntegrityWarning(collection);
    for await (const next of cursor) {
      await fixer(next.id);
    }
  }

  private async triggerRepeatingJob(collection: string) {
    const queue = `${INTEGRITY_QUEUE_NAME}.${collection}`;
    await this.mq.publish({
      queue,
      message: {},
      opts: {
        repeat: { every: INTEGRITY_JOB_INTERVAL },
        repeatJobKey: queue,
        jobId: queue,
      },
    });
  }

  private async startWorker(
    collection: string,
    fixer: (id: string) => Promise<void>,
  ) {
    await this.mq.startWorker({
      queue: `${INTEGRITY_QUEUE_NAME}.${collection}`,
      handler: async () => {
        await this.onJob(collection, fixer);
      },
      opts: {
        limiter: { max: 1, duration: INTEGRITY_JOB_INTERVAL },
      },
    });
  }

  async init(
    collection: string,
    fixer: (id: string) => Promise<void>,
  ): Promise<void> {
    await this.arangodb.utils.tryDdl(
      () => this.arangodb.db.createCollection(collection, {}), // TODO: dangerous because would lock in empty options.
      () =>
        this.arangodb.db.collection(collection).ensureIndex({
          name: `idx-${collection}-integrity-warning-v1`,
          type: 'persistent',
          fields: ['integrityWarning'],
        }),
      () =>
        this.arangodb.db.collection(collection).ensureIndex({
          name: `idx-${collection}-is-temp-v1`,
          type: 'persistent',
          fields: ['isTemp'],
        }),
    );
    await this.triggerRepeatingJob(collection);
    await this.startWorker(collection, fixer);
  }
}
