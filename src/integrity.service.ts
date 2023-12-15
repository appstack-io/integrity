import { Injectable } from '@nestjs/common';
import { ArangodbService } from '@appstack-io/arangodb';

@Injectable()
export class IntegrityService {
  constructor(private arangodb: ArangodbService) {}

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
}
