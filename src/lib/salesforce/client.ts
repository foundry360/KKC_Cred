type SalesforceAuth = {
  accessToken: string;
  instanceUrl: string;
  issuedAt: number;
};

let cachedAuth: SalesforceAuth | null = null;

export function isSalesforceConfigured(): boolean {
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

/**
 * Prefer Client Credentials (External Client App / server-to-server).
 * Fall back to username-password if SF_USERNAME + SF_PASSWORD are set.
 */
export async function getSalesforceAuth(): Promise<SalesforceAuth> {
  if (!isSalesforceConfigured()) {
    throw new Error("Salesforce credentials are not configured");
  }

  if (cachedAuth && Date.now() - cachedAuth.issuedAt < 30 * 60 * 1000) {
    return cachedAuth;
  }

  const clientId = process.env.SF_CLIENT_ID!;
  const clientSecret = process.env.SF_CLIENT_SECRET!;
  const preferPassword =
    (process.env.SF_AUTH_FLOW || "").toLowerCase() === "password";

  let token: { access_token: string; instance_url: string } | null = null;
  let lastError: Error | null = null;

  if (!preferPassword) {
    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });
      token = await requestToken(body);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (!token && process.env.SF_USERNAME && process.env.SF_PASSWORD) {
    try {
      const body = new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        client_secret: clientSecret,
        username: process.env.SF_USERNAME,
        password: process.env.SF_PASSWORD,
      });
      token = await requestToken(body);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (!token) {
    throw (
      lastError ||
      new Error(
        "Salesforce auth failed. Enable Client Credentials Flow on the External Client App (with a Run As user), or set SF_USERNAME/SF_PASSWORD for password flow.",
      )
    );
  }

  cachedAuth = {
    accessToken: token.access_token,
    instanceUrl: token.instance_url,
    issuedAt: Date.now(),
  };
  return cachedAuth;
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
