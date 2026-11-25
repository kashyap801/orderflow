import { validateEnvironment } from '@orderflow/common';

describe('validateEnvironment', () => {
  const valid = {
    NODE_ENV: 'test',
    MONGODB_URI_ORDER: 'mongodb://localhost:27017/orderflow_test',
  };

  it('applies safe defaults', () => {
    const environment = validateEnvironment(valid);

    expect(environment.NODE_ENV).toBe('test');
    expect(environment.PORT).toBe(3001);
    expect(environment.MONGODB_MAX_RETRIES).toBe(5);
    expect(environment.REDIS_ENABLED).toBe('false');
    expect(environment.KAFKA_ENABLED).toBe('false');
  });

  it('converts numeric strings to integers', () => {
    const environment = validateEnvironment({ ...valid, PORT: '3010', MONGODB_MAX_RETRIES: '2' });

    expect(environment.PORT).toBe(3010);
    expect(environment.MONGODB_MAX_RETRIES).toBe(2);
  });

  it('allows a service to configure only its own MongoDB URI', () => {
    const environment = validateEnvironment({
      NODE_ENV: 'test',
      MONGODB_URI_INVENTORY: 'mongodb://localhost:27017/orderflow_inventory',
    });

    expect(environment.MONGODB_URI_ORDER).toBeUndefined();
    expect(environment.MONGODB_URI_INVENTORY).toBe('mongodb://localhost:27017/orderflow_inventory');
  });

  it('rejects an invalid environment', () => {
    expect(() => validateEnvironment({ ...valid, NODE_ENV: 'invalid' })).toThrow(
      /Invalid environment configuration/,
    );
    expect(() => validateEnvironment({ ...valid, PORT: 'not-a-number' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
