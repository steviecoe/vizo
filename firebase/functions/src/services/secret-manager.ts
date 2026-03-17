import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let client: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
  if (!client) {
    client = new SecretManagerServiceClient();
  }
  return client;
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'vizo-image-gen';

export async function getSecret(secretName: string): Promise<string> {
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  const [version] = await getClient().accessSecretVersion({ name });
  const payload = version.payload?.data;
  if (!payload) {
    throw new Error(`Secret ${secretName} has no payload`);
  }
  return typeof payload === 'string' ? payload : payload.toString();
}

export async function createOrUpdateSecret(
  secretName: string,
  value: string,
): Promise<void> {
  const parent = `projects/${projectId}`;
  const fullName = `${parent}/secrets/${secretName}`;

  try {
    await getClient().getSecret({ name: fullName });
  } catch {
    await getClient().createSecret({
      parent,
      secretId: secretName,
      secret: { replication: { automatic: {} } },
    });
  }

  await getClient().addSecretVersion({
    parent: fullName,
    payload: { data: new Uint8Array(Buffer.from(value)) },
  });
}

export function buildTenantGeminiSecretName(tenantId: string): string {
  return `tenant-${tenantId}-gemini-api-key`;
}

export function buildTenantShopifySecretName(tenantId: string): string {
  return `tenant-${tenantId}-shopify-api-key`;
}
