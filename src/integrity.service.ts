import { Injectable, OnModuleInit } from '@nestjs/common';
import { ArangodbService } from '@appstack-io/arangodb';
import { ClientService } from '@appstack-io/client';
import * as capitalize from 'lodash.capitalize';
import * as process from 'process';

@Injectable()
export class IntegrityService implements OnModuleInit {
  collections = process.env.ASIO_INTEGRITY_COLLECTIONS.split(',');

  constructor(
    private arangodb: ArangodbService,
    private clientService: ClientService,
  ) {}

  async *findByPermissionIntegrityWarning(
    collection: string,
  ): AsyncGenerator<{ id: string }> {
    const query = `
      FOR doc IN @collection
      FILTER doc.integrityWarning == true 
      RETURN doc
    `;
    const vars = {
      collection,
    };
    const cursor = await this.arangodb.db.query(query, vars);
    while (cursor.hasNext) {
      const next = await cursor.next();
      yield this.arangodb.utils.format(next);
    }
  }

  async updateOne(input: { collection: string; id: string }): Promise<void> {
    await this.clientService.invokeUnaryInernal({
      service: `${capitalize(input.collection)}Service`,
      method: 'UpdateOne',
      data: { id: input.id },
    });
  }

  async removeTemps(input: {
    collection: string;
    millisAgo: number;
  }): Promise<void> {
    const query = `
      FOR doc IN @collection
      FILTER doc.isTemp == true
      AND doc.createdAt < (DATE_NOW() - @millisAgo)
      REMOVE doc in conversation
    `;
    const vars = {
      ...input,
    };
    await this.arangodb.db.query(query, vars);
  }

  async onModuleInit(): Promise<void> {
    await this.arangodb.utils.tryDdl(
      ...this.collections.map(
        (collection) => () => this.arangodb.db.createCollection(collection, {}), // TODO: dangerous because would lock in empty options.
      ),
      ...this.collections.map(
        (collection) => () =>
          this.arangodb.db.collection(collection).ensureIndex({
            name: `idx-${collection}-integrity-warning-v1`,
            type: 'persistent',
            fields: ['integrityWarning'],
          }),
      ),
      ...this.collections.map(
        (collection) => () =>
          this.arangodb.db.collection(collection).ensureIndex({
            name: `idx-${collection}-is-temp-v1`,
            type: 'persistent',
            fields: ['isTemp'],
          }),
      ),
    );
  }
}
