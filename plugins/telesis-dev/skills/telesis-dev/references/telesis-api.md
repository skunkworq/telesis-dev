# Telesis API Reference

Use this when the CLI does not expose a write operation.

## Auth

Use the bearer token from `TELESIS_API_TOKEN` or `~/.telesis/credentials.json` key `token`.

Required Connect JSON headers:

```text
Accept: application/json
Connect-Protocol-Version: 1
Content-Type: application/json
Authorization: Bearer <token>
```

Default endpoint: `https://api.telesis.dev`

## Service API

List services:

```json
POST /uptimeapi.v1.ServiceService/ListServices
{
  "orgId": "<org-uuid>",
  "page": { "pageSize": 100 }
}
```

Create service:

```json
POST /uptimeapi.v1.ServiceService/CreateService
{
  "orgId": "<org-uuid>",
  "name": "Example API",
  "url": "https://api.example.com/health",
  "description": "Availability monitor"
}
```

Update service:

```json
POST /uptimeapi.v1.ServiceService/UpdateService
{
  "id": "<service-uuid>",
  "name": "Example API",
  "url": "https://api.example.com/health",
  "description": "Availability monitor",
  "isPublic": true,
  "statusPageOrder": 100
}
```

## Check API

List checks:

```json
POST /uptimeapi.v1.CheckService/ListChecks
{
  "serviceId": "<service-uuid>",
  "page": { "pageSize": 100 }
}
```

Create uptime check:

```json
POST /uptimeapi.v1.CheckService/CreateCheck
{
  "serviceId": "<service-uuid>",
  "name": "API health",
  "type": "CHECK_TYPE_UPTIME",
  "config": {
    "uptime": {
      "method": "GET",
      "expectedStatusCodes": [200],
      "followRedirects": true,
      "verifySsl": true
    }
  },
  "intervalSeconds": 3600,
  "timeoutSeconds": 30
}
```

Update uptime check:

```json
POST /uptimeapi.v1.CheckService/UpdateCheck
{
  "id": "<check-uuid>",
  "name": "API health",
  "config": {
    "uptime": {
      "method": "GET",
      "expectedStatusCodes": [200],
      "followRedirects": true,
      "verifySsl": true
    }
  },
  "intervalSeconds": 3600,
  "timeoutSeconds": 30,
  "enabled": true
}
```

## Cost And Traffic Heuristics

Requests scale with:

```text
services * checks per service * locations * (seconds per month / intervalSeconds)
```

For basic availability evidence, use one location and an hourly interval unless the user needs tighter alerting. Prefer 2 hours or longer for metadata endpoints such as JWKS.
