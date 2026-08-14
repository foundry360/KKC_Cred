import { spawnSync } from "node:child_process";

type SalesforceAuth = {
  accessToken: string;
  instanceUrl: string;
  issuedAt: number;
};

let cachedAuth: SalesforceAuth | null = null;

export function isSalesforceConfigured(): boolean {
  const oauth = Boolean(
    process.env.SF_CLIENT_ID &&
      process.env.SF_CLIENT_SECRET &&
      (process.env.SF_LOGIN_URL || process.env.SF_INSTANCE_URL),
  );
  // Local CLI session is also a valid sync path
  return oauth || Boolean(process.env.SF_TARGET_ORG);
}

export function hasSalesforceOauth(): boolean {
  return Boolean(
    process.env.SF_CLIENT_ID &&
      process.env.SF_CLIENT_SECRET &&
      (process.env.SF_LOGIN_URL || process.env.SF_INSTANCE_URL),
  );
}

export function getSalesforceApiVersion(): string {
  return process.env.SF_API_VERSION || "61.0";
}

function loginHost(): string {
  return (
    process.env.SF_LOGIN_URL ||
    process.env.SF_INSTANCE_URL ||
    "https://login.salesforce.com"
  ).replace(/\/$/, "");
}

async function requestToken(
  body: URLSearchParams,
): Promise<{ access_token: string; instance_url: string }> {
  const res = await fetch(`${loginHost()}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as {
    access_token?: string;
    instance_url?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token || !json.instance_url) {
    throw new Error(
      json.error_description ||
        json.error ||
        `Salesforce auth failed (${res.status})`,
    );
  }

  return {
    access_token: json.access_token,
    instance_url: json.instance_url.replace(/\/$/, ""),
  };
}

function getCliTokenAuth(): SalesforceAuth | null {
  const org = process.env.SF_TARGET_ORG || "cred-poc";
  const res = spawnSync(
    "sf",
    ["org", "display", "--target-org", org, "--json"],
    {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, SF_TEMP_SHOW_SECRETS: "true" },
    },
  );
  if (res.status !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout || "{}") as {
      result?: { accessToken?: string; instanceUrl?: string };
    };
    const accessToken = parsed.result?.accessToken;
    const instanceUrl = parsed.result?.instanceUrl;
    if (!accessToken || !instanceUrl) return null;
    return {
      accessToken,
      instanceUrl: instanceUrl.replace(/\/$/, ""),
      issuedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Prefer OAuth (works on Vercel). Fall back to local `sf` CLI session.
 */
export async function getSalesforceAuth(): Promise<SalesforceAuth> {
  if (cachedAuth && Date.now() - cachedAuth.issuedAt < 30 * 60 * 1000) {
    return cachedAuth;
  }

  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  const preferPassword =
    (process.env.SF_AUTH_FLOW || "").toLowerCase() === "password";

  let lastError: Error | null = null;

  if (clientId && clientSecret) {
    if (!preferPassword) {
      try {
        const body = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        });
        const token = await requestToken(body);
        cachedAuth = {
          accessToken: token.access_token,
          instanceUrl: token.instance_url,
          issuedAt: Date.now(),
        };
        return cachedAuth;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    if (process.env.SF_USERNAME && process.env.SF_PASSWORD) {
      try {
        const body = new URLSearchParams({
          grant_type: "password",
          client_id: clientId,
          client_secret: clientSecret,
          username: process.env.SF_USERNAME,
          password: process.env.SF_PASSWORD,
        });
        const token = await requestToken(body);
        cachedAuth = {
          accessToken: token.access_token,
          instanceUrl: token.instance_url,
          issuedAt: Date.now(),
        };
        return cachedAuth;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  const cli = getCliTokenAuth();
  if (cli) {
    cachedAuth = cli;
    return cachedAuth;
  }

  throw (
    lastError ||
    new Error(
      "Salesforce auth failed. On Vercel set working SF_CLIENT_ID/SECRET (client_credentials). Locally ensure `sf org login` for SF_TARGET_ORG.",
    )
  );
}

export async function salesforceFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = await getSalesforceAuth();
  const url = path.startsWith("http")
    ? path
    : `${auth.instanceUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${auth.accessToken}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    cachedAuth = null;
  }
  return res;
}
