#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);

function usage() {
  console.log(`Usage:
  node ensure-uptime-checks.mjs <spec.json> [--dry-run]

Spec:
  {
    "orgId": "uuid",
    "services": [
      {
        "name": "Example API",
        "url": "https://api.example.com/health",
        "description": "Availability monitor",
        "isPublic": true,
        "statusPageOrder": 100,
        "checks": [
          {
            "name": "API health",
            "type": "uptime",
            "intervalSeconds": 3600,
            "timeoutSeconds": 30
          }
        ]
      }
    ]
  }`);
}

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const specPath = args.find((arg) => !arg.startsWith("--"));

if (!specPath) {
  usage();
  process.exit(2);
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadCredentials() {
  const endpointFromEnv = process.env.TELESIS_API_ENDPOINT;
  const tokenFromEnv = process.env.TELESIS_API_TOKEN || process.env.TELESIS_TOKEN;

  if (tokenFromEnv) {
    return {
      endpoint: (endpointFromEnv || "https://api.telesis.dev").replace(/\/$/, ""),
      token: tokenFromEnv,
    };
  }

  const credentialsPath =
    process.env.TELESIS_CREDENTIALS ||
    path.join(os.homedir(), ".telesis", "credentials.json");

  const credentials = readJSON(credentialsPath);
  if (!credentials.token) {
    throw new Error(`No token found in ${credentialsPath}`);
  }

  return {
    endpoint: (credentials.api_endpoint || "https://api.telesis.dev").replace(/\/$/, ""),
    token: credentials.token,
  };
}

function normalizeCheckType(type) {
  const normalized = String(type || "uptime").trim().toLowerCase();
  switch (normalized) {
    case "uptime":
    case "check_type_uptime":
      return "CHECK_TYPE_UPTIME";
    case "security":
    case "check_type_security":
      return "CHECK_TYPE_SECURITY";
    case "techdetect":
    case "tech_detect":
    case "check_type_techdetect":
      return "CHECK_TYPE_TECHDETECT";
    case "browser":
    case "check_type_browser":
      return "CHECK_TYPE_BROWSER";
    case "playwright":
    case "check_type_playwright":
      return "CHECK_TYPE_PLAYWRIGHT";
    default:
      throw new Error(`Unsupported check type: ${type}`);
  }
}

function defaultConfigForType(type) {
  if (type === "CHECK_TYPE_UPTIME") {
    return {
      uptime: {
        method: "GET",
        expectedStatusCodes: [200],
        followRedirects: true,
        verifySsl: true,
      },
    };
  }
  return {};
}

async function call(credentials, pathName, body) {
  const response = await fetch(`${credentials.endpoint}${pathName}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Connect-Protocol-Version": "1",
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.token}`,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`${pathName} ${response.status}: ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : {};
}

async function listServices(credentials, orgId) {
  const response = await call(credentials, "/uptimeapi.v1.ServiceService/ListServices", {
    orgId,
    page: { pageSize: 100 },
  });
  return response.services || [];
}

async function listChecks(credentials, serviceId) {
  const response = await call(credentials, "/uptimeapi.v1.CheckService/ListChecks", {
    serviceId,
    page: { pageSize: 100 },
  });
  return response.checks || [];
}

async function ensureService(credentials, orgId, serviceSpec, knownServices) {
  const existing = knownServices.find(
    (service) => service.url === serviceSpec.url || service.name === serviceSpec.name,
  );

  if (!existing) {
    if (dryRun) {
      return { action: "would-create", service: { ...serviceSpec, id: "<new-service>" } };
    }

    const created = await call(credentials, "/uptimeapi.v1.ServiceService/CreateService", {
      orgId,
      name: serviceSpec.name,
      url: serviceSpec.url,
      description: serviceSpec.description || "",
    });

    knownServices.push(created.service);
    return ensureService(credentials, orgId, serviceSpec, knownServices);
  }

  const updateBody = {
    id: existing.id,
    name: serviceSpec.name,
    url: serviceSpec.url,
    description: serviceSpec.description || "",
  };

  if (typeof serviceSpec.isPublic === "boolean") {
    updateBody.isPublic = serviceSpec.isPublic;
  }
  if (Number.isInteger(serviceSpec.statusPageOrder)) {
    updateBody.statusPageOrder = serviceSpec.statusPageOrder;
  }

  if (dryRun) {
    return { action: "would-update", service: { ...existing, ...updateBody } };
  }

  const updated = await call(credentials, "/uptimeapi.v1.ServiceService/UpdateService", updateBody);
  return { action: "updated", service: updated.service || existing };
}

async function ensureCheck(credentials, service, checkSpec) {
  const type = normalizeCheckType(checkSpec.type);
  const checks = service.id === "<new-service>" ? [] : await listChecks(credentials, service.id);
  const existing = checks.find((check) => check.name === checkSpec.name && check.type === type);

  const checkBody = {
    name: checkSpec.name,
    config: checkSpec.config || defaultConfigForType(type),
    intervalSeconds: checkSpec.intervalSeconds || 3600,
    timeoutSeconds: checkSpec.timeoutSeconds || 30,
  };

  if (!existing) {
    if (dryRun) {
      return { action: "would-create", check: { ...checkBody, id: "<new-check>", type } };
    }

    const created = await call(credentials, "/uptimeapi.v1.CheckService/CreateCheck", {
      serviceId: service.id,
      type,
      ...checkBody,
    });
    return { action: "created", check: created.check };
  }

  if (dryRun) {
    return { action: "would-update", check: { ...existing, ...checkBody, enabled: true } };
  }

  const updated = await call(credentials, "/uptimeapi.v1.CheckService/UpdateCheck", {
    id: existing.id,
    ...checkBody,
    enabled: true,
  });
  return { action: "updated", check: updated.check };
}

async function main() {
  const spec = readJSON(specPath);
  if (!spec.orgId) {
    throw new Error("spec.orgId is required");
  }
  if (!Array.isArray(spec.services) || spec.services.length === 0) {
    throw new Error("spec.services must contain at least one service");
  }

  const credentials = loadCredentials();
  const knownServices = await listServices(credentials, spec.orgId);
  const results = [];

  for (const serviceSpec of spec.services) {
    const serviceResult = await ensureService(credentials, spec.orgId, serviceSpec, knownServices);
    const checks = [];

    for (const checkSpec of serviceSpec.checks || []) {
      checks.push(await ensureCheck(credentials, serviceResult.service, checkSpec));
    }

    results.push({
      serviceAction: serviceResult.action,
      service: {
        id: serviceResult.service.id,
        name: serviceResult.service.name,
        url: serviceResult.service.url,
      },
      checks: checks.map((result) => ({
        action: result.action,
        id: result.check.id,
        name: result.check.name,
        type: result.check.type,
        intervalSeconds: result.check.intervalSeconds,
        timeoutSeconds: result.check.timeoutSeconds,
        enabled: result.check.enabled,
      })),
    });
  }

  console.log(JSON.stringify({ dryRun, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
