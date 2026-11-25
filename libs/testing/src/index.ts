import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

export interface TestDatabase {
  readonly uri: string;
  clear(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDatabase(name = 'orderflow_test'): Promise<TestDatabase> {
  const server = await MongoMemoryServer.create();
  const uri = `${server.getUri().replace(/\/$/, '')}/${name}`;
  await mongoose.connect(uri);

  return {
    uri,
    async clear(): Promise<void> {
      const database = mongoose.connection.db;
      if (database === undefined) return;
      const collections = await database.collections();
      await Promise.all(collections.map((collection) => collection.deleteMany({})));
    },
    async close(): Promise<void> {
      await mongoose.disconnect();
      await server.stop();
    },
  };
}
