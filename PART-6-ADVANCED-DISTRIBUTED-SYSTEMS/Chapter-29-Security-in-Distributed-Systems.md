# Chapter 29: Security in Distributed Systems

---

## 1. Why This Matters

Security in distributed systems isn't merely an afterthought or a "feature" — it's the foundational trust fabric upon which every interaction, every data movement, and every computation relies. A single breach in a distributed system can cascade across hundreds of services, compromise millions of records, and destroy years of brand trust overnight.

### The Scale of the Problem

Consider these real-world incidents that underscore why distributed systems security demands special attention:

- **Uber (2016):** Attackers accessed a private GitHub repository containing AWS credentials, ultimately compromising data for 57 million users. The breach exploited weak secret management across distributed services.
- **Capital One (2019):** A misconfigured web application firewall in AWS led to the exposure of 100 million credit applications. The attacker exploited a server-side request forgery (SSRF) vulnerability, pivoting through the distributed cloud infrastructure.
- **SolarWinds (2020):** Attackers compromised the software build pipeline, injecting malicious code into distributed update packages that were then deployed across 18,000 organizations, including US government agencies.
- **Log4Shell (2021):** A vulnerability in a ubiquitous logging library affected virtually every Java-based distributed system globally, enabling remote code execution across microservice architectures.

### Why Security Is Different in Distributed Systems

In a monolithic application, security can be enforced at a single boundary — one authentication check, one database with access controls, one firewall. Distributed systems shatter this simplicity:

| Dimension | Monolith | Distributed System |
|---|---|---|
| **Trust boundary** | Single process boundary | Hundreds of service boundaries |
| **Attack surface** | One application entry point | Every API, queue, database, cache |
| **Network trust** | Localhost communication | Network is untrusted by default |
| **Identity** | Single user session | Service-to-service + user identity |
| **Secrets** | One config file | Secrets across 100s of services |
| **Compliance** | One audit trail | Distributed, correlated audit logs |
| **Blast radius** | Contained to one app | Lateral movement across services |
| **Key management** | Centralized | Distributed key distribution |

**The fundamental truth**: In a distributed system, the network is the computer — and the network is hostile. Every message, every API call, every data transfer must be treated as potentially compromised until proven otherwise.

### Industry Relevance

- **FAANG-level interviews** routinely test security concepts — OAuth 2.0 flows, JWT validation, mTLS, and zero trust are expected knowledge.
- **Compliance requirements** (SOC 2, HIPAA, PCI-DSS, GDPR) mandate specific security controls in distributed architectures.
- **Cloud-native architectures** introduce new threat vectors (container escape, service mesh compromise, IAM misconfiguration) that didn't exist in traditional deployments.
- **API-first architectures** mean that the API is the product — and API security is product security.

### What You Will Learn

By the end of this chapter, you will understand:

1. How authentication works across distributed services (from passwords to certificates)
2. Authorization models that scale (RBAC, ABAC, policy engines)
3. OAuth 2.0 in production — not just the textbook flows
4. JWT internals, including why "just use JWT" is dangerously oversimplified
5. mTLS for service-to-service security and how service meshes automate it
6. Zero trust architecture — from Google's BeyondCorp to your microservices
7. API security hardening, secrets management, and encryption strategies
8. Real production security architectures from Netflix, Google, and Uber

---

## 2. Beginner Intuition

### The Airport Analogy

Imagine a distributed system as an international airport complex with multiple terminals, airlines, customs checkpoints, and restricted areas.

**Authentication** is like showing your passport at check-in. You prove *who you are*. Different levels of identification exist:
- A boarding pass (API key) — proves you have access but doesn't strongly verify identity
- A passport (username/password) — government-issued identity verification
- A passport + visa + fingerprint scan (multi-factor authentication) — multiple proofs of identity
- A diplomatic credential (certificate-based auth) — machine-verified, impossible to forge

**Authorization** is like the zones you're allowed to access after clearing identity:
- Economy passengers go to gate B (role-based: your role determines your zone)
- VIP lounge access depends on your airline status AND your ticket class AND your frequent flyer tier (attribute-based: multiple attributes determine access)
- Airport security staff follow a complex rulebook that changes based on threat level (policy engine: rules determine access dynamically)

**OAuth 2.0** is like a travel agency booking system:
- You (the user) want to book a trip
- The travel agency (client application) needs to access your airline account
- Instead of giving the agency your airline password, the airline gives the agency a limited-access voucher (access token)
- The voucher expires, and you can revoke it without changing your airline password

**JWT** is like a sealed, stamped letter:
- The letter contains claims about who you are (payload)
- The envelope has a description of the seal type (header)
- The wax seal proves the letter hasn't been tampered with (signature)
- Anyone can read the letter, but only the issuer can create a valid seal

**mTLS** is like two diplomats meeting:
- Both show their diplomatic credentials to each other
- Both verify the other's credentials with their respective governments
- Only then do they begin their conversation, in a secure room (encrypted channel)

**Zero Trust** is like a building where every single door requires a badge scan:
- No matter if you're already inside the building, every room checks your identity
- There's no "trusted zone" — even the CEO badges in at every door
- Access is continuously verified, not just at the entrance

```
Traditional Security (Castle-and-Moat):
┌─────────────────────────────────────────────┐
│  Firewall (Moat)                            │
│  ┌───────────────────────────────────────┐  │
│  │  Trusted Internal Network             │  │
│  │  ┌─────┐  ┌─────┐  ┌─────┐          │  │
│  │  │Svc A│──│Svc B│──│Svc C│  No auth  │  │
│  │  └─────┘  └─────┘  └─────┘  needed!  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

Zero Trust Security:
┌─────────────────────────────────────────────┐
│  Every connection authenticated & encrypted  │
│  ┌─────┐  🔒  ┌─────┐  🔒  ┌─────┐       │
│  │Svc A│──────│Svc B│──────│Svc C│       │
│  └──┬──┘      └──┬──┘      └──┬──┘       │
│     🔒           🔒           🔒           │
│  ┌──┴──┐      ┌──┴──┐      ┌──┴──┐       │
│  │DB A │      │DB B │      │Cache│       │
│  └─────┘      └─────┘      └─────┘       │
└─────────────────────────────────────────────┘
```

### The Chain of Trust

In distributed systems, security forms a chain. Each link must be strong:

```
User → API Gateway → Service A → Service B → Database
 │         │            │           │           │
 │    Rate limit    Verify JWT   Verify mTLS  Encrypt
 │    WAF rules    Check RBAC   Policy check  at rest
 │    TLS          Audit log    Audit log     ACLs
 Auth
```

If any single link breaks — if Service B trusts all internal traffic, if the database has no encryption at rest, if secrets are hardcoded — the entire chain collapses.

---

## 3. Core Theory

### 3.1 The CIA Triad in Distributed Systems

The foundational security model consists of three properties:

**Confidentiality**: Data is accessible only to authorized parties.
- Encryption in transit (TLS, mTLS)
- Encryption at rest (AES-256, envelope encryption)
- Access control (RBAC, ABAC)
- Data masking and tokenization

**Integrity**: Data hasn't been altered in unauthorized ways.
- Digital signatures (JWT signatures, message signing)
- Checksums and hash verification
- Immutable audit logs
- Version control and change tracking

**Availability**: Systems remain accessible to authorized users.
- DDoS protection
- Rate limiting
- Circuit breakers with security awareness
- Redundant security infrastructure

### 3.2 Authentication Models

Authentication answers the question: **"Who are you?"**

#### 3.2.1 Username/Password Authentication

The most basic form. A user provides credentials that are verified against a stored hash.

**How it works in distributed systems:**

```
Client → API Gateway → Auth Service → User Database
  │          │              │               │
  │ POST     │ Forward      │ Hash password │
  │ /login   │ credentials  │ Compare hash  │
  │ {user,   │              │               │
  │  pass}   │              │ Return result │
  │          │ Generate     │               │
  │          │ session/token│               │
  │ Return   │              │               │
  │ token    │              │               │
```

**Security considerations:**
- **Never store plaintext passwords** — use bcrypt, scrypt, or Argon2id
- **Salt every hash** — prevents rainbow table attacks
- **Rate limit login attempts** — prevents brute force
- **Use constant-time comparison** — prevents timing attacks
- **Credential stuffing protection** — detect and block automated login attempts with leaked credentials

**Password hashing best practices:**

| Algorithm | Recommended | Notes |
|---|---|---|
| MD5 | ❌ Never | Broken, fast to crack |
| SHA-256 | ❌ No | Too fast, not designed for passwords |
| bcrypt | ✅ Good | Work factor adjustable |
| scrypt | ✅ Good | Memory-hard, resistant to ASIC attacks |
| Argon2id | ✅ Best | Winner of Password Hashing Competition, memory-hard + CPU-hard |

#### 3.2.2 API Key Authentication

API keys are simple bearer tokens that identify the caller. They're widely used for service-to-service communication and third-party API access.

**Types of API keys:**

1. **Simple API keys**: Random strings (e.g., `sk-abc123def456`)
2. **HMAC-signed keys**: Keys that also sign requests (like AWS Signature v4)
3. **Scoped keys**: Keys with embedded permissions (read-only, write, admin)

**API key lifecycle:**

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Create  │ ──▶ │  Active  │ ──▶ │ Rotate   │ ──▶ │ Revoke   │
│  (Issue) │     │  (Use)   │     │ (Replace)│     │ (Delete) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                                  ▲
                      │          ┌──────────┐            │
                      └────────▶ │ Expire   │ ───────────┘
                                 │ (TTL)    │
                                 └──────────┘
```

**API key vs OAuth token comparison:**

| Feature | API Key | OAuth Token |
|---|---|---|
| Represents | Application identity | User + application |
| Revocable | Yes (but cached copies linger) | Yes |
| Scoped | Typically broad | Fine-grained scopes |
| Expiry | Usually long-lived or permanent | Short-lived (minutes/hours) |
| User context | No | Yes |
| Suitable for | Server-to-server, public APIs | User-delegated access |

#### 3.2.3 Certificate-Based Authentication

X.509 certificates provide strong, cryptographic identity verification. Each party possesses a public/private key pair, and a Certificate Authority (CA) vouches for the binding between the public key and the identity.

**Certificate chain of trust:**

```
Root CA (self-signed, stored in trust store)
    │
    ├── Intermediate CA (signed by Root CA)
    │       │
    │       ├── Server Certificate (signed by Intermediate CA)
    │       │     └── CN=api.example.com
    │       │
    │       └── Client Certificate (signed by Intermediate CA)
    │             └── CN=payment-service
    │
    └── Intermediate CA 2 (signed by Root CA)
            │
            └── Server Certificate (signed by Intermediate CA 2)
                  └── CN=db.example.com
```

**Certificate fields:**
- **Subject**: Identity (CN=common name, O=organization)
- **Issuer**: CA that signed the certificate
- **Serial Number**: Unique identifier
- **Validity Period**: Not Before / Not After dates
- **Public Key**: The public key material
- **Extensions**: Subject Alternative Names (SANs), Key Usage, etc.
- **Signature**: CA's digital signature

#### 3.2.4 Multi-Factor Authentication (MFA)

MFA requires two or more independent authentication factors:

1. **Something you know**: Password, PIN
2. **Something you have**: Phone (TOTP), hardware key (YubiKey), smart card
3. **Something you are**: Fingerprint, face recognition, retina scan

**TOTP (Time-based One-Time Password) algorithm:**

```
TOTP = HOTP(key, T)
where T = floor((Current Unix Time - T0) / Time Step)

HOTP(K, C) = Truncate(HMAC-SHA-1(K, C))

Truncate extracts a 6-digit code from the HMAC result
```

**MFA in distributed systems:**

```
User → API Gateway → Auth Service → MFA Provider
  │         │             │              │
  │ Login   │             │              │
  │ u/p     │ Verify      │              │
  │         │ credentials │              │
  │         │             │ Generate     │
  │         │             │ challenge    │
  │ MFA     │             │              │
  │ prompt  │             │              │
  │         │             │              │
  │ TOTP    │ Verify      │              │
  │ code    │ TOTP        │ Validate     │
  │         │             │ code         │
  │ Token   │ Issue       │              │
  │         │ JWT         │              │
```

#### 3.2.5 Single Sign-On (SSO)

SSO allows users to authenticate once and access multiple applications. It's implemented using protocols like SAML 2.0, OpenID Connect (OIDC), or Kerberos.

**How SSO works (OIDC flow):**

```mermaid
sequenceDiagram
    participant User
    participant App1 as Application 1
    participant IdP as Identity Provider
    participant App2 as Application 2

    User->>App1: Access App1
    App1->>IdP: Redirect to IdP
    User->>IdP: Login (username/password + MFA)
    IdP->>App1: Authorization code
    App1->>IdP: Exchange code for tokens
    IdP->>App1: ID token + access token
    App1->>User: Logged in to App1

    Note over User, App2: Later, user accesses App2

    User->>App2: Access App2
    App2->>IdP: Redirect to IdP
    IdP->>IdP: User already has session
    IdP->>App2: Authorization code (no login needed)
    App2->>IdP: Exchange code for tokens
    IdP->>App2: ID token + access token
    App2->>User: Logged in to App2 (seamless)
```

**SSO protocols comparison:**

| Feature | SAML 2.0 | OpenID Connect | Kerberos |
|---|---|---|---|
| Token format | XML assertions | JWT (ID token) | Kerberos tickets |
| Transport | HTTP POST/Redirect | HTTP REST | Kerberos protocol |
| Best for | Enterprise web SSO | Modern web/mobile | Internal (Active Directory) |
| Complexity | High | Medium | High (infrastructure) |
| Mobile friendly | No | Yes | No |
| Cloud-native | Not really | Yes | No |

### 3.3 Authorization Models

Authorization answers: **"What are you allowed to do?"**

#### 3.3.1 RBAC (Role-Based Access Control)

Users are assigned roles, and roles have permissions.

```
User "alice" → Role "admin" → Permissions: [read, write, delete, manage_users]
User "bob"   → Role "viewer" → Permissions: [read]
User "carol" → Roles ["editor", "auditor"] → Permissions: [read, write, audit_logs]
```

**RBAC hierarchy:**

```
                ┌───────────┐
                │   Admin   │
                └─────┬─────┘
                      │ inherits
            ┌─────────┼─────────┐
            │         │         │
       ┌────┴───┐ ┌───┴────┐ ┌─┴──────┐
       │ Editor │ │Auditor │ │Manager │
       └────┬───┘ └───┬────┘ └────────┘
            │         │
            │    inherits
       ┌────┴─────────┴───┐
       │     Viewer        │
       └───────────────────┘
```

**RBAC pros and cons:**

| Pros | Cons |
|---|---|
| Simple to understand and implement | Can lead to role explosion |
| Easy to audit (who has what role) | Coarse-grained permissions |
| Familiar to most organizations | Doesn't handle context well |
| Good for stable permission structures | Adding new resources requires role updates |

#### 3.3.2 ABAC (Attribute-Based Access Control)

Decisions are based on attributes of the user, resource, action, and environment.

**ABAC policy example:**
```
ALLOW action=read 
  WHEN user.department = resource.department
  AND user.clearance >= resource.classification
  AND environment.time BETWEEN 09:00 AND 17:00
  AND environment.location IN ["office", "vpn"]
```

**ABAC components:**

```
┌─────────────────────────────────────────────────────────┐
│                    Policy Decision Point (PDP)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  User     │ │ Resource │ │  Action  │ │Environment│  │
│  │ Attributes│ │Attributes│ │Attributes│ │Attributes │  │
│  │           │ │          │ │          │ │           │  │
│  │ role      │ │ owner    │ │ type     │ │ time      │  │
│  │ dept      │ │ class    │ │ method   │ │ IP        │  │
│  │ clearance │ │ tags     │ │ path     │ │ location  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                       │                                  │
│              ┌────────▼────────┐                        │
│              │  Policy Rules   │                        │
│              │  (evaluation)   │                        │
│              └────────┬────────┘                        │
│                       │                                  │
│              ┌────────▼────────┐                        │
│              │ ALLOW / DENY    │                        │
│              └─────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

#### 3.3.3 Policy Engines — OPA (Open Policy Agent)

OPA is a general-purpose policy engine that decouples policy decision-making from policy enforcement. Policies are written in Rego, a declarative query language.

**OPA architecture:**

```mermaid
flowchart LR
    subgraph Services
        A[API Gateway]
        B[Microservice A]
        C[Microservice B]
        D[Kubernetes]
    end

    subgraph OPA["OPA (Policy Engine)"]
        E[Rego Policies]
        F[Policy Data]
        G[Decision Engine]
    end

    A -->|"Is user X allowed to GET /orders?"| G
    B -->|"Can service A call service B?"| G
    C -->|"Is this data export allowed?"| G
    D -->|"Can this pod be deployed?"| G

    E --> G
    F --> G
    G -->|"ALLOW / DENY + reason"| A
    G -->|"ALLOW / DENY + reason"| B
    G -->|"ALLOW / DENY + reason"| C
    G -->|"ALLOW / DENY + reason"| D
```

**Example OPA/Rego policy:**

```rego
package authz

# Allow GET requests for users with 'viewer' role
allow {
    input.method == "GET"
    input.user.roles[_] == "viewer"
}

# Allow all methods for admin role
allow {
    input.user.roles[_] == "admin"
}

# Allow users to access their own resources
allow {
    input.method == "GET"
    input.path = ["api", "users", user_id]
    input.user.id == user_id
}

# Deny access outside business hours for non-admins
deny {
    not input.user.roles[_] == "admin"
    time.hour(time.now_ns()) < 8
}

deny {
    not input.user.roles[_] == "admin"
    time.hour(time.now_ns()) > 18
}

# Final decision
decision = {"allow": true} {
    allow
    not deny
}

decision = {"allow": false, "reason": reason} {
    not allow
    reason := "Access denied: insufficient permissions"
}
```

### 3.4 OAuth 2.0 — Deep Dive

OAuth 2.0 is an authorization framework that enables third-party applications to access resources on behalf of a user without exposing the user's credentials.

#### 3.4.1 OAuth 2.0 Roles

| Role | Description | Example |
|---|---|---|
| **Resource Owner** | The user who owns the data | End user |
| **Client** | Application requesting access | Mobile app, web app |
| **Authorization Server** | Issues tokens | Auth0, Keycloak, Okta |
| **Resource Server** | Hosts protected resources | API server |

#### 3.4.2 Grant Types

**Authorization Code Grant (most common for web apps):**

```mermaid
sequenceDiagram
    participant User as Resource Owner
    participant Client as Client App
    participant AuthServer as Authorization Server
    participant API as Resource Server

    User->>Client: 1. Click "Login"
    Client->>AuthServer: 2. Redirect: /authorize?response_type=code&client_id=X&redirect_uri=Y&scope=Z&state=abc
    AuthServer->>User: 3. Show login page
    User->>AuthServer: 4. Authenticate + consent
    AuthServer->>Client: 5. Redirect to redirect_uri?code=AUTH_CODE&state=abc
    Client->>AuthServer: 6. POST /token {grant_type=authorization_code, code=AUTH_CODE, client_id=X, client_secret=S, redirect_uri=Y}
    AuthServer->>Client: 7. {access_token, refresh_token, expires_in, token_type}
    Client->>API: 8. GET /api/resource (Authorization: Bearer access_token)
    API->>API: 9. Validate token
    API->>Client: 10. Resource data
```

**Authorization Code with PKCE (for mobile/SPA):**

PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks. It's now recommended for ALL OAuth clients, not just public clients.

```
1. Client generates:
   - code_verifier: random string (43-128 chars)
   - code_challenge: BASE64URL(SHA256(code_verifier))

2. Authorization request includes:
   /authorize?...&code_challenge=CHALLENGE&code_challenge_method=S256

3. Token request includes:
   POST /token {..., code_verifier=VERIFIER}

4. Server verifies:
   BASE64URL(SHA256(code_verifier)) == stored code_challenge
```

**Client Credentials Grant (service-to-service):**

```mermaid
sequenceDiagram
    participant ServiceA as Service A (Client)
    participant AuthServer as Authorization Server
    participant ServiceB as Service B (Resource)

    ServiceA->>AuthServer: POST /token {grant_type=client_credentials, client_id=X, client_secret=S, scope=Z}
    AuthServer->>AuthServer: Validate client credentials
    AuthServer->>ServiceA: {access_token, expires_in, token_type}
    ServiceA->>ServiceB: GET /api/data (Authorization: Bearer access_token)
    ServiceB->>ServiceB: Validate token
    ServiceB->>ServiceA: Response data
```

**Grant type selection guide:**

| Scenario | Recommended Grant | Why |
|---|---|---|
| Traditional web app (server-rendered) | Authorization Code | Server can securely store client secret |
| Single-page app (SPA) | Authorization Code + PKCE | No server to store secret, PKCE prevents interception |
| Mobile app | Authorization Code + PKCE | Same as SPA |
| Service-to-service | Client Credentials | No user involved |
| CLI tool | Device Authorization | No browser available on device |
| Highly trusted first-party app | Resource Owner Password (deprecated) | Direct credential handling |

#### 3.4.3 Access Tokens and Refresh Tokens

**Access tokens:**
- Short-lived (typically 5-60 minutes)
- Sent with every API request
- Can be JWT (self-contained) or opaque (reference token)
- Contains scopes, expiry, issuer information

**Refresh tokens:**
- Long-lived (days to months)
- Used to obtain new access tokens without re-authentication
- Stored securely (never in browser localStorage)
- Should be rotated on each use (rotation prevents replay)

**Token refresh flow:**

```
┌─────────┐                              ┌──────────────────┐
│  Client │                              │  Auth Server     │
└────┬────┘                              └────────┬─────────┘
     │                                            │
     │  POST /token                               │
     │  grant_type=refresh_token                  │
     │  refresh_token=RT_OLD                      │
     │ ──────────────────────────────────────────▶│
     │                                            │
     │                      Validate refresh token│
     │                      Check if revoked      │
     │                      Generate new tokens   │
     │                      Invalidate old RT     │
     │                                            │
     │  {access_token: AT_NEW,                    │
     │   refresh_token: RT_NEW,                   │
     │   expires_in: 3600}                        │
     │ ◀──────────────────────────────────────────│
     │                                            │
```

#### 3.4.4 Token Introspection (RFC 7662)

Token introspection allows resource servers to query the authorization server about the validity and metadata of a token. This is essential for opaque tokens that can't be validated locally.

```
POST /introspect HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic czZCaGRSa3F0MzpnWDFmQmF0M2JW

token=mF_9.B5f-4.1JqM&token_type_hint=access_token

Response:
{
  "active": true,
  "client_id": "s6BhdRkqt3",
  "username": "jdoe",
  "scope": "read write",
  "sub": "Z5O3upPC88QrAjx00dis",
  "aud": "https://resource.example.com",
  "iss": "https://auth.example.com",
  "exp": 1419356238,
  "iat": 1419350238
}
```

### 3.5 JWT (JSON Web Tokens) — Deep Dive

#### 3.5.1 JWT Structure

A JWT consists of three base64url-encoded parts separated by dots:

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.POstGetfAytaZS82wHcjoTyoqhMyxXiWdR7Nn7A29DNSl0EiXLdwJ6xC6AfgZWF1bOsS_TuYI3OG85AmiExREkrS6tDfTQ2B3WXlrr-wp5AokiRbz3_oB4OxG-W9KcEEbDRcZc0nH3L7LzYptiy1PtAylQGxHTWZXtGz4ht0bAecBgmpdgXMguEIcoqPJ1n3pIWk_dUZegpqx0Lka21H6XxUTxiy8OcaarA8zdnPUnV6AmNP3ecFawIFYdvJB_cm-GvpCSbr8G8y_Mllj8f4x9nBH8pQux89_6gUY618iYv7tuPWBFfEbLxtF2pZS6YC1aSfLQxaOoaBSTNFw
  │                              │                                              │
  │         HEADER               │              PAYLOAD                         │              SIGNATURE
  │  {                           │  {                                           │
  │    "alg": "RS256",           │    "sub": "1234567890",                      │  RSASHA256(
  │    "typ": "JWT"              │    "name": "John Doe",                       │    base64UrlEncode(header) + "." +
  │  }                           │    "admin": true,                            │    base64UrlEncode(payload),
  │                              │    "iat": 1516239022                         │    privateKey
  │                              │  }                                           │  )
```

**Standard JWT claims (registered claims):**

| Claim | Full Name | Description |
|---|---|---|
| `iss` | Issuer | Who issued the token |
| `sub` | Subject | Who the token is about |
| `aud` | Audience | Who the token is intended for |
| `exp` | Expiration Time | When the token expires (Unix timestamp) |
| `nbf` | Not Before | Token is not valid before this time |
| `iat` | Issued At | When the token was issued |
| `jti` | JWT ID | Unique identifier for the token |

#### 3.5.2 Signing Algorithms

| Algorithm | Type | Key | Security | Performance | Use Case |
|---|---|---|---|---|---|
| HS256 | Symmetric | Shared secret | Good | Fast | Internal services sharing a secret |
| HS384 | Symmetric | Shared secret | Better | Fast | Same as HS256 |
| HS512 | Symmetric | Shared secret | Best (symmetric) | Fast | Same as HS256 |
| RS256 | Asymmetric | RSA key pair | Good | Slower (sign), Fast (verify) | Public-facing APIs |
| RS384 | Asymmetric | RSA key pair | Better | Slower | Same as RS256 |
| RS512 | Asymmetric | RSA key pair | Best (RSA) | Slowest (RSA) | High security |
| ES256 | Asymmetric | ECDSA P-256 | Good | Fast | Modern, compact signatures |
| ES384 | Asymmetric | ECDSA P-384 | Better | Medium | Higher security ECDSA |
| ES512 | Asymmetric | ECDSA P-521 | Best (ECDSA) | Slower | Maximum security |
| EdDSA | Asymmetric | Ed25519 | Excellent | Very fast | Modern, recommended |

**Symmetric vs asymmetric signing:**

```
Symmetric (HMAC):
┌──────────────────┐         ┌──────────────────┐
│  Auth Server     │         │  Resource Server  │
│  Same Secret Key │         │  Same Secret Key  │
│  Sign JWT ───────┼────────▶│  Verify JWT      │
│                  │         │                   │
│  ⚠️ Both can     │         │  ⚠️ Both can     │
│  create tokens   │         │  create tokens   │
└──────────────────┘         └──────────────────┘

Asymmetric (RSA/ECDSA):
┌──────────────────┐         ┌──────────────────┐
│  Auth Server     │         │  Resource Server  │
│  Private Key     │         │  Public Key       │
│  Sign JWT ───────┼────────▶│  Verify JWT      │
│                  │         │                   │
│  ✅ Only auth    │         │  ✅ Can only      │
│  server can sign │         │  verify, not sign│
└──────────────────┘         └──────────────────┘
```

#### 3.5.3 JWT Validation Flow

```mermaid
flowchart TD
    A[Receive JWT] --> B{Check token format}
    B -->|Invalid format| Z[Reject: Malformed token]
    B -->|Valid format| C[Decode header]
    C --> D{Check algorithm}
    D -->|none or unexpected| Z1[Reject: Invalid algorithm]
    D -->|Expected algorithm| E[Retrieve signing key]
    E --> F{Verify signature}
    F -->|Invalid| Z2[Reject: Invalid signature]
    F -->|Valid| G{Check exp claim}
    G -->|Expired| Z3[Reject: Token expired]
    G -->|Valid| H{Check nbf claim}
    H -->|Not yet valid| Z4[Reject: Token not yet valid]
    H -->|Valid| I{Check iss claim}
    I -->|Wrong issuer| Z5[Reject: Invalid issuer]
    I -->|Valid| J{Check aud claim}
    J -->|Wrong audience| Z6[Reject: Invalid audience]
    J -->|Valid| K{Check custom claims}
    K -->|Invalid| Z7[Reject: Custom validation failed]
    K -->|Valid| L[Accept: Token valid]
```

#### 3.5.4 Token Revocation Strategies

JWTs are stateless — once issued, they're valid until expiration. This creates a challenge when you need to revoke access immediately (e.g., user logs out, account is compromised).

**Strategy 1: Short-lived tokens + refresh token rotation**
```
Access token: 5-15 minutes TTL
Refresh token: days/weeks, stored server-side
On revocation: delete refresh token from database
Access token continues to work for remaining TTL (acceptable window)
```

**Strategy 2: Token blacklist/denylist**
```
On revocation: add token's JTI to a blacklist (Redis/database)
On validation: check if JTI is in blacklist
Cleanup: remove entries after their original expiry time
Downside: requires a network call for every validation (partially defeats JWT purpose)
```

**Strategy 3: Token versioning**
```
User record stores: token_version = 5
JWT contains: token_version = 5
On revocation: increment user's token_version to 6
Validation: compare JWT's version with stored version
Downside: requires database lookup, but only for the version field
```

**Strategy 4: Event-driven revocation**
```
On revocation: publish event to message broker
All services: subscribe to revocation events, maintain local cache
Pros: near-real-time revocation without per-request DB lookup
Cons: eventual consistency, complexity
```

#### 3.5.5 JWT vs Opaque Tokens

| Aspect | JWT (Self-contained) | Opaque Token (Reference) |
|---|---|---|
| **Content** | Contains claims in the payload | Random string, meaningless without server |
| **Validation** | Local verification (no network call) | Requires introspection endpoint |
| **Revocation** | Difficult (stateless) | Easy (delete from server) |
| **Size** | Large (hundreds of bytes to KB) | Small (typically 32-64 chars) |
| **Privacy** | Claims visible if not encrypted (JWE) | No information leakage |
| **Performance** | Fast validation | Network overhead for each validation |
| **Best for** | Microservices, stateless APIs | Sensitive data, easy revocation needs |

### 3.6 mTLS (Mutual TLS)

#### 3.6.1 How mTLS Works

In standard TLS, only the server presents a certificate. In mTLS, both the client and server present certificates and verify each other's identity.

```mermaid
sequenceDiagram
    participant Client
    participant Server

    Client->>Server: 1. ClientHello (supported cipher suites, TLS version)
    Server->>Client: 2. ServerHello (chosen cipher suite)
    Server->>Client: 3. Server Certificate
    Server->>Client: 4. CertificateRequest (requests client cert)
    Server->>Client: 5. ServerHelloDone
    Client->>Client: 6. Verify server certificate against CA
    Client->>Server: 7. Client Certificate
    Client->>Server: 8. ClientKeyExchange
    Client->>Server: 9. CertificateVerify (proof of private key)
    Client->>Server: 10. ChangeCipherSpec + Finished
    Server->>Server: 11. Verify client certificate against CA
    Server->>Client: 12. ChangeCipherSpec + Finished
    Note over Client,Server: Encrypted communication begins
```

#### 3.6.2 Certificate Management

**Certificate lifecycle:**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Generate │───▶│  Sign    │───▶│ Deploy   │───▶│ Monitor  │───▶│ Rotate   │
│ Key Pair │    │ by CA    │    │ to       │    │ Expiry   │    │ Before   │
│          │    │          │    │ Service  │    │          │    │ Expiry   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └─────┬────┘
                                                                      │
                                                              ┌───────▼────┐
                                                              │ Revoke     │
                                                              │ Old Cert   │
                                                              └────────────┘
```

**Certificate rotation strategies:**

1. **Graceful dual-certificate rotation:**
   - Deploy new certificate alongside old certificate
   - Both are valid during overlap period
   - Remove old certificate after all peers have updated trust stores

2. **Hot-reload rotation:**
   - Application watches certificate file for changes
   - When file is updated, reload without restart
   - Zero-downtime rotation

3. **Short-lived certificates (SPIFFE/SPIRE):**
   - Certificates valid for hours, not years
   - Automatically renewed by the identity framework
   - Eliminates need for manual rotation

#### 3.6.3 Service Mesh Integration

Service meshes like Istio and Linkerd automate mTLS across all service-to-service communication.

**How Istio handles mTLS:**

```
┌─────────────────────────────────────────────────────┐
│                    Istio Control Plane               │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Istiod  │  │ CA       │  │ Config Distribution│ │
│  │(Pilot)  │  │(Citadel) │  │                    │ │
│  └────┬────┘  └────┬─────┘  └────────┬───────────┘ │
│       │             │                 │              │
└───────┼─────────────┼─────────────────┼──────────────┘
        │             │                 │
    ┌───▼───┐    ┌────▼───┐       ┌────▼───┐
    │Envoy  │    │Envoy   │       │Envoy   │
    │Sidecar│◄───│Sidecar │       │Sidecar │
    │  🔒   │    │  🔒    │       │  🔒    │
    ├───────┤    ├────────┤       ├────────┤
    │Svc A  │    │Svc B   │       │Svc C   │
    └───────┘    └────────┘       └────────┘

    All traffic between sidecars is mTLS-encrypted
    Certificates are automatically provisioned and rotated
    Application code doesn't need to handle TLS at all
```

### 3.7 Zero Trust Architecture

#### 3.7.1 Core Principles

Zero Trust operates on the principle: **"Never trust, always verify."**

Traditional perimeter-based security assumes that everything inside the network is trusted. Zero trust assumes that threats exist both inside and outside the network.

**Zero Trust pillars:**

1. **Verify explicitly**: Always authenticate and authorize based on all available data points
2. **Use least privilege access**: Limit access with just-in-time and just-enough-access (JIT/JEA)
3. **Assume breach**: Minimize blast radius, segment access, verify end-to-end encryption

```mermaid
flowchart TD
    subgraph ZTA["Zero Trust Architecture"]
        A[Identity Verification] --> B[Device Verification]
        B --> C[Network Verification]
        C --> D[Application Verification]
        D --> E[Data Classification]
        E --> F[Access Decision]

        G[Continuous Monitoring] --> A
        G --> B
        G --> C
        G --> D
        G --> E
    end

    subgraph Signals["Trust Signals"]
        H[User identity + MFA]
        I[Device health + compliance]
        J[Network location + encryption]
        K[Application risk score]
        L[Data sensitivity level]
    end

    H --> A
    I --> B
    J --> C
    K --> D
    L --> E
```

#### 3.7.2 Google BeyondCorp

Google's BeyondCorp is the most well-known implementation of zero trust, developed after the Operation Aurora attack in 2009.

**Key principles:**
- Access to services is not determined by the network you connect from
- Access is granted based on device state and user credentials
- All access to services must be authenticated, authorized, and encrypted
- Access policies can be dynamic and based on multiple signals

**BeyondCorp architecture:**

```
                    ┌────────────────────────┐
                    │    Access Proxy        │
                    │  (Identity-Aware Proxy)│
                    └────────┬───────────────┘
                             │
                ┌────────────┼────────────────┐
                │            │                │
        ┌───────▼──┐  ┌─────▼────┐  ┌────────▼──┐
        │ Device   │  │ User     │  │ Access    │
        │ Trust    │  │ Identity │  │ Control   │
        │ Engine   │  │ (SSO)    │  │ Engine    │
        └───────┬──┘  └─────┬────┘  └────────┬──┘
                │            │                │
        ┌───────▼──┐  ┌─────▼────┐  ┌────────▼──┐
        │ Device   │  │ User     │  │ Policy    │
        │ Inventory│  │ Directory│  │ Repository│
        └──────────┘  └──────────┘  └───────────┘

Access Decision = f(user_identity, device_state, 
                    request_context, policy_rules)
```

### 3.8 API Security

#### 3.8.1 Rate Limiting

Rate limiting prevents abuse by controlling the number of requests a client can make in a given time period.

**Common algorithms:**

| Algorithm | Description | Pros | Cons |
|---|---|---|---|
| **Fixed Window** | Count requests in fixed time windows | Simple | Burst at window boundary |
| **Sliding Window** | Count requests in rolling window | Smooth | More memory |
| **Token Bucket** | Tokens refill at fixed rate, each request costs a token | Allows bursts | Slightly complex |
| **Leaky Bucket** | Requests processed at constant rate, excess queued/dropped | Smooth output | No burst handling |

#### 3.8.2 OWASP API Security Top 10

| # | Vulnerability | Description | Mitigation |
|---|---|---|---|
| API1 | Broken Object Level Authorization | Accessing other users' resources by changing IDs | Validate object ownership |
| API2 | Broken Authentication | Weak auth mechanisms | Strong auth, MFA, rate limiting |
| API3 | Broken Object Property Level Authorization | Exposing sensitive properties | Filter response fields |
| API4 | Unrestricted Resource Consumption | No rate limiting, large payloads | Rate limit, payload size limits |
| API5 | Broken Function Level Authorization | Accessing admin endpoints | Enforce RBAC on all endpoints |
| API6 | Unrestricted Access to Sensitive Business Flows | Automated abuse of business logic | Business logic rate limiting |
| API7 | Server-Side Request Forgery | Server making requests to internal resources | Validate and sanitize URLs |
| API8 | Security Misconfiguration | Default configs, unnecessary features | Security hardening, reviews |
| API9 | Improper Inventory Management | Undocumented or deprecated endpoints | API inventory, versioning |
| API10 | Unsafe Consumption of APIs | Trusting third-party API responses | Validate all external data |

### 3.9 Secrets Management

Secrets include passwords, API keys, certificates, encryption keys, and database credentials. In distributed systems, secrets must be managed centrally and distributed securely.

**Anti-patterns (what NOT to do):**
- ❌ Hardcoding secrets in source code
- ❌ Storing secrets in environment variables without encryption
- ❌ Committing secrets to version control
- ❌ Sharing secrets via email or chat
- ❌ Using the same secret across environments

```mermaid
flowchart TD
    subgraph Vault["HashiCorp Vault"]
        A[Secret Engine]
        B[Auth Methods]
        C[Policies]
        D[Audit Log]
    end

    E[Service A] -->|1. Authenticate| B
    B -->|2. Return client token| E
    E -->|3. Request secret| A
    A -->|4. Policy check| C
    C -->|5. Allow/Deny| A
    A -->|6. Return secret| E
    A -->|7. Log access| D

    F[Service B] -->|Kubernetes auth| B
    G[CI/CD Pipeline] -->|AppRole auth| B
    H[Developer] -->|OIDC auth| B
```

### 3.10 Encryption

#### Encryption at Rest

Data stored on disk is encrypted so that physical access to the storage medium doesn't compromise the data.

**Envelope encryption (used by AWS KMS, Google Cloud KMS):**

```
┌────────────────────────────────────────────────────┐
│                  KMS (Key Management Service)       │
│  ┌──────────────────────────────────────────────┐  │
│  │  Master Key (never leaves KMS)               │  │
│  │  Used to encrypt/decrypt Data Encryption Keys│  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
        │                                    ▲
        │ Encrypt DEK                       │ Decrypt DEK
        ▼                                    │
┌────────────────┐                  ┌────────────────┐
│ Data Encryption│                  │ Encrypted DEK  │
│ Key (DEK)      │                  │ (stored with   │
│ (plaintext)    │                  │  encrypted data)│
└───────┬────────┘                  └────────────────┘
        │
        │ Encrypt data
        ▼
┌────────────────┐
│ Encrypted Data │
│ (stored on     │
│  disk/S3/DB)   │
└────────────────┘
```

#### Encryption in Transit

All network communication uses TLS 1.3 (or 1.2 minimum).

**TLS 1.3 improvements over 1.2:**
- Reduced handshake from 2 round trips to 1 (0-RTT for resumption)
- Removed insecure cipher suites (RC4, 3DES, static RSA)
- Forward secrecy is mandatory (ECDHE)
- Encrypted handshake (certificate is encrypted)
- Simplified cipher suite negotiation

---

## 4. Architecture Deep Dive

### 4.1 End-to-End Security Architecture

A production-grade distributed system security architecture integrates all the components discussed:

```
                        ┌──────────────────────────────────────┐
                        │           External Traffic           │
                        └───────────────┬──────────────────────┘
                                        │
                                   ┌────▼────┐
                                   │   WAF   │ Web Application Firewall
                                   │ (OWASP  │ (Rate limiting, IP blocking,
                                   │  rules) │  Bot detection)
                                   └────┬────┘
                                        │
                                   ┌────▼────┐
                                   │  CDN /  │ DDoS protection
                                   │ DDoS    │ (CloudFlare, AWS Shield)
                                   │ Shield  │
                                   └────┬────┘
                                        │
                              ┌─────────▼─────────┐
                              │   API Gateway      │
                              │ ┌────────────────┐ │
                              │ │ TLS Termination│ │
                              │ │ Rate Limiting  │ │
                              │ │ Auth (JWT/API) │ │
                              │ │ Request Valid. │ │
                              │ └────────────────┘ │
                              └─────────┬─────────┘
                                        │
                    ┌───────────────────┬┼──────────────────┐
                    │                   ││                   │
              ┌─────▼────┐        ┌────▼▼───┐        ┌────▼─────┐
              │Service A │        │Service B│        │Service C │
              │(Envoy    │◄──────▶│(Envoy   │◄──────▶│(Envoy    │
              │ sidecar) │ mTLS   │ sidecar)│ mTLS   │ sidecar) │
              └─────┬────┘        └────┬────┘        └────┬─────┘
                    │                   │                   │
              ┌─────▼────┐        ┌────▼────┐        ┌────▼─────┐
              │  DB      │        │  Cache  │        │  Queue   │
              │(encrypted│        │(encrypt.│        │(encrypted│
              │ at rest) │        │ in mem) │        │ at rest) │
              └──────────┘        └─────────┘        └──────────┘

    All services authenticate to Vault for secrets
    All service-to-service traffic is mTLS via service mesh
    All data at rest is encrypted (AES-256)
    All audit logs go to centralized SIEM
```

### 4.2 Authentication Flow Deep Dive

**Multi-layer authentication in microservices:**

```
External Request:
  1. TLS handshake at API Gateway (server TLS)
  2. JWT validation at API Gateway
  3. Extract user identity from JWT
  4. Propagate identity via request headers (X-User-ID, X-User-Roles)
  5. Each downstream service validates the propagated identity

Service-to-Service Request:
  1. mTLS handshake (both certificates verified)
  2. Extract service identity from client certificate (SPIFFE ID)
  3. Check service-to-service authorization policy
  4. Optionally, propagate original user identity (via headers or nested JWT)
```

**SPIFFE (Secure Production Identity Framework for Everyone):**

SPIFFE provides a standard for service identity in distributed systems. Each service gets a SPIFFE ID:

```
spiffe://trust-domain/path

Examples:
spiffe://production.example.com/payment-service
spiffe://production.example.com/ns/default/sa/order-service
```

SPIFFE IDs are encoded in X.509 certificates (SVIDs - SPIFFE Verifiable Identity Documents) and can be used for mTLS authentication.

### 4.3 Authorization Decision Flow

```
┌────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request  │────▶│ Policy       │────▶│ Policy       │
│            │     │ Enforcement  │     │ Decision     │
│ User: alice│     │ Point (PEP)  │     │ Point (PDP)  │
│ Action: GET│     │              │     │              │
│ Resource:  │     │ Service code │     │ OPA / Custom │
│  /orders/5 │     │ or middleware│     │ engine       │
│            │     │              │     │              │
└────────────┘     └──────┬───────┘     └──────┬───────┘
                          │                     │
                          │                     │
                   ┌──────▼───────┐     ┌──────▼───────┐
                   │ Policy       │     │ Policy       │
                   │ Information  │     │ Administration│
                   │ Point (PIP)  │     │ Point (PAP)  │
                   │              │     │              │
                   │ User attrs   │     │ Policy       │
                   │ Resource meta│     │ management   │
                   │ Environment  │     │ UI / Git     │
                   └──────────────┘     └──────────────┘
```

### 4.4 Secrets Distribution Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    HashiCorp Vault Cluster                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │ Active  │  │Standby  │  │Standby  │                 │
│  │ Node    │──│ Node    │──│ Node    │  (Raft consensus)│
│  └────┬────┘  └─────────┘  └─────────┘                 │
│       │                                                  │
│  ┌────▼────────────────────────────────────┐            │
│  │          Storage Backend                 │            │
│  │  (Consul, integrated Raft, or cloud)    │            │
│  └──────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘
        │                    │                    │
        │ K8s Auth           │ AppRole Auth       │ AWS Auth
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │Pod      │         │CI/CD    │         │EC2      │
   │(sidecar │         │Pipeline │         │Instance │
   │ agent)  │         │         │         │         │
   └─────────┘         └─────────┘         └─────────┘

Vault Agent Sidecar Pattern:
┌─────────────────────────────────────┐
│  Kubernetes Pod                      │
│  ┌───────────────┐  ┌────────────┐ │
│  │ Application   │  │ Vault Agent│ │
│  │ Container     │  │ Sidecar    │ │
│  │               │  │            │ │
│  │ Reads secrets │◀─│ Fetches &  │ │
│  │ from file     │  │ renews     │ │
│  │ /vault/secrets│  │ secrets    │ │
│  └───────────────┘  └────────────┘ │
│         ▲                 │         │
│         │     Shared Volume         │
│         └─────────────────┘         │
└─────────────────────────────────────┘
```

---

## 5. Visual Diagrams

### 5.1 Complete OAuth 2.0 Authorization Code Flow with PKCE

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant C as Client App
    participant AS as Authorization Server
    participant RS as Resource Server

    Note over C: Generate PKCE values
    C->>C: code_verifier = random(43-128 chars)
    C->>C: code_challenge = BASE64URL(SHA256(code_verifier))

    U->>C: 1. Click "Login with Provider"
    C->>U: 2. Redirect to Authorization Server

    U->>AS: 3. GET /authorize?<br/>response_type=code<br/>&client_id=CLIENT_ID<br/>&redirect_uri=CALLBACK_URL<br/>&scope=openid profile email<br/>&state=RANDOM_STATE<br/>&code_challenge=CHALLENGE<br/>&code_challenge_method=S256

    AS->>U: 4. Show login page
    U->>AS: 5. Enter credentials + MFA
    AS->>AS: 6. Validate credentials
    AS->>U: 7. Show consent screen
    U->>AS: 8. Grant consent

    AS->>U: 9. Redirect to CALLBACK_URL?code=AUTH_CODE&state=RANDOM_STATE

    U->>C: 10. Follow redirect with auth code

    C->>C: 11. Verify state matches

    C->>AS: 12. POST /token<br/>grant_type=authorization_code<br/>&code=AUTH_CODE<br/>&redirect_uri=CALLBACK_URL<br/>&client_id=CLIENT_ID<br/>&code_verifier=VERIFIER

    AS->>AS: 13. Verify code_verifier matches code_challenge
    AS->>AS: 14. Validate authorization code

    AS->>C: 15. {access_token, refresh_token, id_token, expires_in}

    C->>RS: 16. GET /api/resource<br/>Authorization: Bearer ACCESS_TOKEN

    RS->>RS: 17. Validate JWT (signature, expiry, audience, issuer)

    RS->>C: 18. {resource data}
```

### 5.2 JWT Lifecycle and Validation

```mermaid
flowchart TD
    subgraph Creation["JWT Creation (Auth Server)"]
        A1[Build Header] --> A2[Build Payload]
        A2 --> A3[Encode header + payload]
        A3 --> A4[Sign with private key]
        A4 --> A5[Combine: header.payload.signature]
    end

    A5 --> B[Transmit JWT to client]

    B --> C[Client sends JWT to API]

    subgraph Validation["JWT Validation (Resource Server)"]
        C --> D1{Split into 3 parts?}
        D1 -->|No| REJECT1[REJECT: Malformed]
        D1 -->|Yes| D2[Decode header]
        D2 --> D3{Algorithm allowed?}
        D3 -->|No| REJECT2[REJECT: Bad algorithm]
        D3 -->|Yes| D4[Fetch public key via JWKS]
        D4 --> D5{Signature valid?}
        D5 -->|No| REJECT3[REJECT: Tampered]
        D5 -->|Yes| D6{Token expired?}
        D6 -->|Yes| REJECT4[REJECT: Expired]
        D6 -->|No| D7{Correct issuer?}
        D7 -->|No| REJECT5[REJECT: Wrong issuer]
        D7 -->|Yes| D8{Correct audience?}
        D8 -->|No| REJECT6[REJECT: Wrong audience]
        D8 -->|Yes| D9{Sufficient scopes?}
        D9 -->|No| REJECT7[REJECT: Insufficient scope]
        D9 -->|Yes| ACCEPT[ACCEPT: Authorized]
    end
```

### 5.3 mTLS Handshake Detail

```mermaid
sequenceDiagram
    participant C as Client Service
    participant S as Server Service
    participant CA as Certificate Authority

    Note over C,S: TLS 1.3 with mutual authentication

    C->>S: ClientHello<br/>(TLS version, cipher suites, random)
    S->>C: ServerHello<br/>(chosen cipher suite, random)
    S->>C: EncryptedExtensions
    S->>C: CertificateRequest<br/>(acceptable CAs, signature algorithms)
    S->>C: Server Certificate<br/>(X.509 cert chain)
    S->>C: CertificateVerify<br/>(signature over handshake)
    S->>C: Finished<br/>(MAC over handshake)

    C->>C: Verify server cert chain against trusted CAs
    C->>C: Verify CertificateVerify signature
    C->>C: Check certificate revocation (OCSP/CRL)

    C->>S: Client Certificate<br/>(X.509 cert chain)
    C->>S: CertificateVerify<br/>(signature over handshake)
    C->>S: Finished<br/>(MAC over handshake)

    S->>S: Verify client cert chain against trusted CAs
    S->>S: Verify CertificateVerify signature
    S->>S: Extract client identity (SPIFFE ID or CN)
    S->>S: Apply authorization policy

    Note over C,S: Encrypted application data exchange begins
```

### 5.4 Zero Trust Architecture

```mermaid
flowchart TD
    subgraph External["External Environment"]
        U1[Employee Laptop<br/>Corporate Network]
        U2[Employee Phone<br/>Coffee Shop WiFi]
        U3[Partner System<br/>External Network]
    end

    subgraph ZT["Zero Trust Control Plane"]
        IDP[Identity Provider<br/>OIDC / SAML]
        DT[Device Trust<br/>MDM / EDR]
        PE[Policy Engine<br/>Access Rules]
        CA_ZT[Certificate Authority<br/>Short-lived certs]
        SIEM[SIEM / Analytics<br/>Continuous monitoring]
    end

    subgraph IAP["Identity-Aware Proxy"]
        PROXY[Access Proxy<br/>Authentication<br/>Authorization<br/>Encryption]
    end

    subgraph Services["Protected Services"]
        S1[Internal App]
        S2[Database]
        S3[Internal API]
    end

    U1 --> PROXY
    U2 --> PROXY
    U3 --> PROXY

    PROXY --> IDP
    PROXY --> DT
    PROXY --> PE
    PROXY --> CA_ZT
    PROXY --> SIEM

    PROXY -->|Authorized| S1
    PROXY -->|Authorized| S2
    PROXY -->|Authorized| S3

    IDP -.->|User identity| PE
    DT -.->|Device posture| PE
    SIEM -.->|Risk signals| PE
```

### 5.5 Secrets Management Flow

```mermaid
flowchart LR
    subgraph Init["Service Initialization"]
        A[Service starts] --> B[Vault Agent authenticates<br/>via K8s service account]
        B --> C[Vault returns client token]
        C --> D[Agent requests secrets]
        D --> E[Vault checks policy]
        E --> F[Secrets written to<br/>shared volume]
    end

    subgraph Runtime["Runtime Secret Access"]
        G[Application reads<br/>/vault/secrets/db-cred] --> H[Connect to database]
        I[Vault Agent renews<br/>lease periodically]
        I --> J{Lease expired?}
        J -->|No| K[Continue]
        J -->|Yes| L[Fetch new secret]
        L --> M[Write to shared volume]
        M --> N[App detects change<br/>and reconnects]
    end

    subgraph Rotation["Secret Rotation"]
        O[Vault dynamic secret<br/>engine] --> P[Generate new<br/>DB credentials]
        P --> Q[Set TTL on credentials]
        Q --> R[Old credentials<br/>auto-expire]
    end
```

---

## 6. Real Production Examples

### 6.1 Google BeyondCorp — Zero Trust at Scale

**Background:** After the Operation Aurora attack (2009), where Chinese hackers breached Google's corporate network, Google realized that perimeter-based security was fundamentally broken. If attackers got past the firewall, they had unrestricted access.

**What Google built:**

1. **Identity-Aware Proxy (IAP):** Every request to any internal application passes through a proxy that checks:
   - User identity (via SSO)
   - Device state (is the laptop encrypted? up-to-date? managed?)
   - Context (location, time, risk score)

2. **Device Inventory:** Every device (laptop, phone, server) is tracked in a central inventory database. Device trust is continuously assessed based on:
   - OS patch level
   - Disk encryption status
   - Screen lock configured
   - Corporate management agent installed

3. **Access Control Engine:** Dynamic policies determine access. For example:
   - "Allow access to HR system only from managed devices with full disk encryption, for users in the HR group, during business hours"

4. **No VPN:** Google employees don't use VPN. There's no distinction between "internal" and "external" networks. All applications are accessed through the Identity-Aware Proxy.

**Key lessons:**
- The migration took 6+ years for a company with Google's resources
- Start with non-critical services and expand gradually
- Device trust is as important as user identity
- Continuous monitoring and analytics are essential for detecting anomalies

### 6.2 Netflix Security Architecture

**Netflix's security challenges:**
- 200+ microservices (at the time of public disclosures, now many more)
- Millions of devices accessing the platform
- Must protect content from piracy while maintaining streaming quality
- Must secure internal infrastructure (CI/CD, data pipelines)

**Key security components:**

1. **Zuul (API Gateway):** Handles authentication, rate limiting, and request filtering at the edge. All external traffic flows through Zuul, which validates JWT tokens and applies security policies.

2. **Metatron (Certificate Management):** Netflix's internal mTLS framework that:
   - Issues short-lived X.509 certificates to every service instance
   - Automates certificate rotation
   - Integrates with service discovery (Eureka)
   - Enables fine-grained service-to-service authorization

3. **Repokid (IAM Least Privilege):** An automated tool that:
   - Monitors AWS IAM role usage
   - Identifies unused permissions
   - Automatically removes permissions that haven't been used
   - Enforces least-privilege access across all AWS services

4. **Stethoscope (Device Trust):** A web application that:
   - Shows employees the security state of their devices
   - Recommends security improvements
   - Doesn't block access (nudge-based approach) but influences trust scoring

5. **Security Monkey:** Monitors AWS accounts for security policy changes, insecure configurations, and compliance violations.

### 6.3 Uber's Security Challenges

**The 2016 breach:**
- Two attackers found AWS credentials in a private GitHub repository
- Used the credentials to access an S3 bucket with rider and driver data
- 57 million records compromised
- Uber paid the attackers $100,000 to delete the data (and tried to cover it up)

**Root causes:**
1. **Hardcoded secrets:** AWS credentials were committed to a private GitHub repo
2. **Over-permissive IAM:** The compromised credentials had broad S3 access
3. **No MFA for critical systems:** GitHub access lacked MFA
4. **Lack of monitoring:** The access was not detected for months

**Post-breach improvements:**
1. Implemented comprehensive secrets management (Vault)
2. Enforced MFA for all employees
3. Implemented least-privilege IAM policies
4. Added monitoring and alerting for unusual data access patterns
5. Improved code review processes to catch credential exposure
6. Implemented network segmentation and zero trust principles

### 6.4 Cloudflare's Key Compromise (2023)

Cloudflare detected an attacker using stolen credentials (from the Okta breach) to access internal systems. Their response demonstrates exemplary incident response:

1. **Detection:** Abnormal behavior detected in internal wiki and source control
2. **Investigation:** Identified that the attacker used credentials that should have been rotated after the Okta breach
3. **Response:** Rotated 5,000+ credentials, physically segmented development environments, rebuilt and reimaged 4,893 systems
4. **Transparency:** Published a detailed public post-mortem

---

## 7. Java Implementations

### 7.1 JWT Generation and Validation with JJWT

```java
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Key;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.*;
import java.time.Instant;
import java.time.Duration;

/**
 * Production-grade JWT service supporting both symmetric (HMAC) 
 * and asymmetric (RSA) signing.
 * 
 * Features:
 * - Token generation with custom claims
 * - Token validation with comprehensive checks
 * - Refresh token support
 * - Token blacklisting for revocation
 * - JWKS (JSON Web Key Set) support
 */
public class JwtService {
    
    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    
    private final RSAPrivateKey privateKey;
    private final RSAPublicKey publicKey;
    private final String issuer;
    private final Duration accessTokenTTL;
    private final Duration refreshTokenTTL;
    private final TokenBlacklist blacklist;
    
    public JwtService(String issuer, Duration accessTokenTTL, 
                      Duration refreshTokenTTL, TokenBlacklist blacklist) {
        KeyPair keyPair = generateRSAKeyPair();
        this.privateKey = (RSAPrivateKey) keyPair.getPrivate();
        this.publicKey = (RSAPublicKey) keyPair.getPublic();
        this.issuer = issuer;
        this.accessTokenTTL = accessTokenTTL;
        this.refreshTokenTTL = refreshTokenTTL;
        this.blacklist = blacklist;
    }
    
    /**
     * Generate an RSA key pair for signing JWTs.
     * In production, load from a secure key store (HSM, Vault, etc.)
     */
    private KeyPair generateRSAKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048); // 2048-bit minimum for production
            return generator.generateKeyPair();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate RSA key pair", e);
        }
    }
    
    /**
     * Generate an access token with user claims.
     */
    public String generateAccessToken(String userId, String email, 
                                       Set<String> roles, Set<String> scopes) {
        Instant now = Instant.now();
        String tokenId = UUID.randomUUID().toString();
        
        return Jwts.builder()
                .id(tokenId)                                    // jti
                .issuer(issuer)                                 // iss
                .subject(userId)                                // sub
                .audience().add("api.example.com").and()        // aud
                .issuedAt(Date.from(now))                       // iat
                .notBefore(Date.from(now))                      // nbf
                .expiration(Date.from(now.plus(accessTokenTTL))) // exp
                .claim("email", email)
                .claim("roles", roles)
                .claim("scopes", scopes)
                .claim("token_type", "access")
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }
    
    /**
     * Generate a refresh token with minimal claims.
     * Refresh tokens should contain minimal information.
     */
    public String generateRefreshToken(String userId) {
        Instant now = Instant.now();
        String tokenId = UUID.randomUUID().toString();
        
        return Jwts.builder()
                .id(tokenId)
                .issuer(issuer)
                .subject(userId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(refreshTokenTTL)))
                .claim("token_type", "refresh")
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }
    
    /**
     * Validate and parse a JWT token.
     * Performs comprehensive validation:
     * 1. Signature verification
     * 2. Expiration check
     * 3. Not-before check
     * 4. Issuer validation
     * 5. Audience validation
     * 6. Blacklist check
     */
    public TokenValidationResult validateToken(String token) {
        try {
            // Parse and validate the token
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(publicKey)
                    .requireIssuer(issuer)
                    .requireAudience("api.example.com")
                    .clock(() -> Date.from(Instant.now()))
                    .build()
                    .parseSignedClaims(token);
            
            Claims claims = jws.getPayload();
            
            // Check blacklist
            String tokenId = claims.getId();
            if (tokenId != null && blacklist.isBlacklisted(tokenId)) {
                log.warn("Token {} has been revoked", tokenId);
                return TokenValidationResult.revoked(tokenId);
            }
            
            // Build result
            return TokenValidationResult.valid(claims);
            
        } catch (ExpiredJwtException e) {
            log.debug("Token expired: {}", e.getMessage());
            return TokenValidationResult.expired();
        } catch (SignatureException e) {
            log.warn("Invalid token signature: {}", e.getMessage());
            return TokenValidationResult.invalidSignature();
        } catch (MalformedJwtException e) {
            log.warn("Malformed token: {}", e.getMessage());
            return TokenValidationResult.malformed();
        } catch (UnsupportedJwtException e) {
            log.warn("Unsupported token: {}", e.getMessage());
            return TokenValidationResult.unsupported();
        } catch (JwtException e) {
            log.warn("Token validation failed: {}", e.getMessage());
            return TokenValidationResult.invalid(e.getMessage());
        }
    }
    
    /**
     * Revoke a token by adding its JTI to the blacklist.
     */
    public void revokeToken(String token) {
        try {
            // Parse without validation to extract JTI and expiry
            // (token might already be expired)
            Claims claims = Jwts.parser()
                    .verifyWith(publicKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            
            String tokenId = claims.getId();
            Date expiry = claims.getExpiration();
            
            if (tokenId != null && expiry != null) {
                blacklist.add(tokenId, expiry.toInstant());
                log.info("Token {} revoked, blacklisted until {}", tokenId, expiry);
            }
        } catch (ExpiredJwtException e) {
            // Token already expired, no need to blacklist
            log.debug("Token already expired, no revocation needed");
        }
    }
    
    /**
     * Refresh an access token using a valid refresh token.
     * Implements refresh token rotation for security.
     */
    public TokenPair refreshAccessToken(String refreshToken) {
        TokenValidationResult result = validateToken(refreshToken);
        
        if (!result.isValid()) {
            throw new SecurityException("Invalid refresh token: " + result.getReason());
        }
        
        Claims claims = result.getClaims();
        String tokenType = claims.get("token_type", String.class);
        
        if (!"refresh".equals(tokenType)) {
            throw new SecurityException("Token is not a refresh token");
        }
        
        String userId = claims.getSubject();
        
        // Revoke old refresh token (rotation)
        revokeToken(refreshToken);
        
        // Generate new token pair
        // In production, fetch user details from database
        String newAccessToken = generateAccessToken(
                userId, 
                "user@example.com",
                Set.of("user"),
                Set.of("read", "write")
        );
        String newRefreshToken = generateRefreshToken(userId);
        
        return new TokenPair(newAccessToken, newRefreshToken);
    }
    
    // --- Inner classes ---
    
    public static class TokenValidationResult {
        private final boolean valid;
        private final String reason;
        private final Claims claims;
        
        private TokenValidationResult(boolean valid, String reason, Claims claims) {
            this.valid = valid;
            this.reason = reason;
            this.claims = claims;
        }
        
        public static TokenValidationResult valid(Claims claims) {
            return new TokenValidationResult(true, null, claims);
        }
        
        public static TokenValidationResult expired() {
            return new TokenValidationResult(false, "Token expired", null);
        }
        
        public static TokenValidationResult invalidSignature() {
            return new TokenValidationResult(false, "Invalid signature", null);
        }
        
        public static TokenValidationResult malformed() {
            return new TokenValidationResult(false, "Malformed token", null);
        }
        
        public static TokenValidationResult unsupported() {
            return new TokenValidationResult(false, "Unsupported token", null);
        }
        
        public static TokenValidationResult revoked(String tokenId) {
            return new TokenValidationResult(false, "Token revoked: " + tokenId, null);
        }
        
        public static TokenValidationResult invalid(String reason) {
            return new TokenValidationResult(false, reason, null);
        }
        
        public boolean isValid() { return valid; }
        public String getReason() { return reason; }
        public Claims getClaims() { return claims; }
    }
    
    public record TokenPair(String accessToken, String refreshToken) {}
}

/**
 * Token blacklist backed by Redis for distributed token revocation.
 */
interface TokenBlacklist {
    void add(String tokenId, Instant expiry);
    boolean isBlacklisted(String tokenId);
}

/**
 * Redis-backed token blacklist implementation.
 * Uses Redis SET with TTL matching token expiry.
 */
class RedisTokenBlacklist implements TokenBlacklist {
    
    // In production, use Spring Data Redis or Jedis
    private final Map<String, Instant> blacklistedTokens = 
            new java.util.concurrent.ConcurrentHashMap<>();
    
    @Override
    public void add(String tokenId, Instant expiry) {
        blacklistedTokens.put(tokenId, expiry);
        // In production:
        // redisTemplate.opsForValue().set(
        //     "token:blacklist:" + tokenId,
        //     "revoked",
        //     Duration.between(Instant.now(), expiry)
        // );
    }
    
    @Override
    public boolean isBlacklisted(String tokenId) {
        Instant expiry = blacklistedTokens.get(tokenId);
        if (expiry == null) return false;
        
        // Auto-cleanup expired entries
        if (Instant.now().isAfter(expiry)) {
            blacklistedTokens.remove(tokenId);
            return false;
        }
        return true;
    }
}
```

### 7.2 OAuth 2.0 Resource Server with Spring Security

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@SpringBootApplication
public class SecureResourceServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(SecureResourceServerApplication.class, args);
    }
}

/**
 * Security configuration for OAuth 2.0 Resource Server.
 * 
 * Validates JWT tokens from the authorization server,
 * extracts roles/scopes, and enforces fine-grained access control.
 * 
 * application.yml:
 * spring:
 *   security:
 *     oauth2:
 *       resourceserver:
 *         jwt:
 *           issuer-uri: https://auth.example.com
 *           jwk-set-uri: https://auth.example.com/.well-known/jwks.json
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
class SecurityConfig {
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Stateless session management (no server-side sessions)
            .sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // Disable CSRF for stateless API
            .csrf(csrf -> csrf.disable())
            
            // Authorization rules
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/health", "/info", "/docs/**").permitAll()
                
                // Read operations require 'read' scope
                .requestMatchers(HttpMethod.GET, "/api/orders/**")
                    .hasAuthority("SCOPE_read")
                
                // Write operations require 'write' scope
                .requestMatchers(HttpMethod.POST, "/api/orders/**")
                    .hasAuthority("SCOPE_write")
                .requestMatchers(HttpMethod.PUT, "/api/orders/**")
                    .hasAuthority("SCOPE_write")
                .requestMatchers(HttpMethod.DELETE, "/api/orders/**")
                    .hasAuthority("SCOPE_write")
                
                // Admin endpoints require 'admin' role
                .requestMatchers("/api/admin/**")
                    .hasRole("ADMIN")
                
                // All other requests require authentication
                .anyRequest().authenticated()
            )
            
            // Configure as OAuth 2.0 Resource Server with JWT
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            );
        
        return http.build();
    }
    
    /**
     * Configure how JWT claims are mapped to Spring Security authorities.
     * 
     * Custom mapping to extract roles from a custom claim ('roles')
     * in addition to standard 'scope' claim.
     */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        // Default: extracts 'scope' claim as SCOPE_ authorities
        JwtGrantedAuthoritiesConverter scopeConverter = 
                new JwtGrantedAuthoritiesConverter();
        scopeConverter.setAuthorityPrefix("SCOPE_");
        scopeConverter.setAuthoritiesClaimName("scope");
        
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            // Get scope-based authorities
            var authorities = new java.util.ArrayList<>(
                    scopeConverter.convert(jwt));
            
            // Extract role-based authorities from custom 'roles' claim
            var roles = jwt.getClaimAsStringList("roles");
            if (roles != null) {
                roles.stream()
                    .map(role -> new org.springframework.security.core
                            .authority.SimpleGrantedAuthority("ROLE_" + 
                            role.toUpperCase()))
                    .forEach(authorities::add);
            }
            
            return authorities;
        });
        
        return converter;
    }
    
    /**
     * Custom JWT decoder with additional validation.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder
                .withJwkSetUri("https://auth.example.com/.well-known/jwks.json")
                .build();
        
        // Add custom token validation
        decoder.setJwtValidator(new org.springframework.security.oauth2.core
                .DelegatingOAuth2TokenValidator<>(
            // Standard validators
            JwtValidators.createDefaultWithIssuer("https://auth.example.com"),
            // Custom audience validator
            new JwtClaimValidator<List<String>>("aud", 
                    aud -> aud != null && aud.contains("api.example.com")),
            // Custom: reject tokens issued more than 24h ago
            new JwtClaimValidator<java.time.Instant>("iat", 
                    iat -> iat != null && iat.isAfter(
                            java.time.Instant.now().minus(java.time.Duration.ofHours(24))))
        ));
        
        return decoder;
    }
}

/**
 * Secure REST controller demonstrating various authorization patterns.
 */
@RestController
@RequestMapping("/api/orders")
class OrderController {
    
    /**
     * Get user's own orders.
     * Uses method-level security to ensure users can only access their own data.
     */
    @GetMapping
    public List<Map<String, Object>> getMyOrders(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        
        // Log for audit trail
        System.out.printf("User %s (%s) accessing their orders%n", userId, email);
        
        // In production, query database with userId filter
        return List.of(
            Map.of("orderId", "ORD-001", "userId", userId, "status", "completed"),
            Map.of("orderId", "ORD-002", "userId", userId, "status", "pending")
        );
    }
    
    /**
     * Get a specific order - with object-level authorization.
     * Prevents BOLA (Broken Object Level Authorization) - OWASP API1.
     */
    @GetMapping("/{orderId}")
    public Map<String, Object> getOrder(
            @PathVariable String orderId,
            @AuthenticationPrincipal Jwt jwt) {
        
        String userId = jwt.getSubject();
        List<String> roles = jwt.getClaimAsStringList("roles");
        
        // Fetch order from database
        Map<String, Object> order = fetchOrder(orderId);
        
        // Object-level authorization check
        String orderOwner = (String) order.get("userId");
        boolean isAdmin = roles != null && roles.contains("admin");
        
        if (!userId.equals(orderOwner) && !isAdmin) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "You can only access your own orders");
        }
        
        return order;
    }
    
    /**
     * Create a new order.
     * Demonstrates input validation and sanitization.
     */
    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize(
            "hasAuthority('SCOPE_write')")
    public Map<String, Object> createOrder(
            @RequestBody @jakarta.validation.Valid CreateOrderRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        String userId = jwt.getSubject();
        
        // Validate and sanitize input
        if (request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Order must have at least one item");
        }
        
        // Create order
        return Map.of(
            "orderId", "ORD-" + UUID.randomUUID().toString().substring(0, 8),
            "userId", userId,
            "status", "created",
            "items", request.items()
        );
    }
    
    private Map<String, Object> fetchOrder(String orderId) {
        // Simulated database lookup
        return Map.of(
            "orderId", orderId,
            "userId", "user-123",
            "status", "completed"
        );
    }
}

record CreateOrderRequest(
    @jakarta.validation.constraints.NotEmpty 
    List<OrderItem> items,
    
    @jakarta.validation.constraints.Size(max = 500, message = "Notes too long")
    String notes
) {}

record OrderItem(
    @jakarta.validation.constraints.NotBlank String productId,
    @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(100) int quantity
) {}
```

### 7.3 mTLS Client and Server

```java
import javax.net.ssl.*;
import java.io.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.security.*;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Duration;

/**
 * Production-grade mTLS configuration for Java services.
 * 
 * Supports:
 * - Loading certificates from Java KeyStore (JKS) or PKCS12
 * - Custom trust store for CA certificates
 * - Certificate rotation via file watching
 * - Connection pooling with mTLS
 */
public class MtlsConfiguration {
    
    /**
     * Create an SSLContext configured for mTLS.
     * 
     * @param keyStorePath Path to the key store containing the client/server certificate
     * @param keyStorePassword Password for the key store
     * @param trustStorePath Path to the trust store containing CA certificates
     * @param trustStorePassword Password for the trust store
     * @return Configured SSLContext
     */
    public static SSLContext createMtlsContext(
            String keyStorePath, String keyStorePassword,
            String trustStorePath, String trustStorePassword) 
            throws Exception {
        
        // Load the key store (contains our certificate + private key)
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (InputStream is = new FileInputStream(keyStorePath)) {
            keyStore.load(is, keyStorePassword.toCharArray());
        }
        
        // Initialize KeyManager with our certificate
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(
                KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(keyStore, keyStorePassword.toCharArray());
        
        // Load the trust store (contains CA certificates we trust)
        KeyStore trustStore = KeyStore.getInstance("PKCS12");
        try (InputStream is = new FileInputStream(trustStorePath)) {
            trustStore.load(is, trustStorePassword.toCharArray());
        }
        
        // Initialize TrustManager with CA certificates
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(
                TrustManagerFactory.getDefaultAlgorithm());
        tmf.init(trustStore);
        
        // Create SSL context with both key and trust managers
        SSLContext sslContext = SSLContext.getInstance("TLSv1.3");
        sslContext.init(kmf.getKeyManagers(), tmf.getTrustManagers(), 
                new SecureRandom());
        
        return sslContext;
    }
    
    /**
     * Create an HTTP client configured for mTLS.
     */
    public static HttpClient createMtlsHttpClient(SSLContext sslContext) {
        return HttpClient.newBuilder()
                .sslContext(sslContext)
                .connectTimeout(Duration.ofSeconds(10))
                .version(HttpClient.Version.HTTP_2)
                .build();
    }
    
    /**
     * Example: Making an mTLS-authenticated HTTP request.
     */
    public static void main(String[] args) throws Exception {
        // Create mTLS context
        SSLContext sslContext = createMtlsContext(
                "/etc/certs/client.p12", "client-password",
                "/etc/certs/ca-truststore.p12", "truststore-password"
        );
        
        // Create HTTP client with mTLS
        HttpClient client = createMtlsHttpClient(sslContext);
        
        // Make authenticated request
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://service-b.internal:8443/api/data"))
                .header("Content-Type", "application/json")
                .GET()
                .build();
        
        HttpResponse<String> response = client.send(
                request, HttpResponse.BodyHandlers.ofString());
        
        System.out.println("Status: " + response.statusCode());
        System.out.println("Body: " + response.body());
    }
}

/**
 * Spring Boot mTLS Server Configuration.
 * 
 * application.yml:
 * server:
 *   port: 8443
 *   ssl:
 *     enabled: true
 *     key-store: classpath:server.p12
 *     key-store-password: ${SERVER_KEYSTORE_PASSWORD}
 *     key-store-type: PKCS12
 *     trust-store: classpath:ca-truststore.p12
 *     trust-store-password: ${TRUSTSTORE_PASSWORD}
 *     trust-store-type: PKCS12
 *     client-auth: need  # 'need' = require client cert, 'want' = optional
 *     protocol: TLSv1.3
 *     enabled-protocols: TLSv1.3
 */

/**
 * Extract client certificate details in a Spring controller.
 */
@RestController
@RequestMapping("/api/internal")
class MtlsSecuredController {
    
    @GetMapping("/data")
    public Map<String, Object> getSecureData(
            jakarta.servlet.http.HttpServletRequest request) {
        
        // Extract client certificate from the request
        X509Certificate[] certs = (X509Certificate[]) request.getAttribute(
                "jakarta.servlet.request.X509Certificate");
        
        if (certs == null || certs.length == 0) {
            throw new SecurityException("No client certificate provided");
        }
        
        X509Certificate clientCert = certs[0];
        String clientCN = clientCert.getSubjectX500Principal().getName();
        String issuerCN = clientCert.getIssuerX500Principal().getName();
        
        // Extract SPIFFE ID from SAN (Subject Alternative Name) if present
        String spiffeId = extractSpiffeId(clientCert);
        
        System.out.printf("Request from client: %s, issuer: %s, SPIFFE: %s%n",
                clientCN, issuerCN, spiffeId);
        
        // Service-to-service authorization based on client identity
        if (!isAuthorizedService(spiffeId)) {
            throw new SecurityException(
                    "Service " + spiffeId + " is not authorized");
        }
        
        return Map.of(
            "data", "sensitive-information",
            "clientIdentity", clientCN,
            "spiffeId", spiffeId != null ? spiffeId : "N/A"
        );
    }
    
    private String extractSpiffeId(X509Certificate cert) {
        try {
            var sans = cert.getSubjectAlternativeNames();
            if (sans != null) {
                for (var san : sans) {
                    // Type 6 = URI
                    if ((Integer) san.get(0) == 6) {
                        String uri = (String) san.get(1);
                        if (uri.startsWith("spiffe://")) {
                            return uri;
                        }
                    }
                }
            }
        } catch (Exception e) {
            // SAN parsing failed
        }
        return null;
    }
    
    private boolean isAuthorizedService(String spiffeId) {
        // In production, check against a policy engine (OPA)
        Set<String> allowedServices = Set.of(
            "spiffe://production.example.com/order-service",
            "spiffe://production.example.com/payment-service"
        );
        return allowedServices.contains(spiffeId);
    }
}
```

### 7.4 API Key Authentication Middleware

```java
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * API Key authentication filter for Spring Boot.
 * 
 * Features:
 * - API key validation with timing-safe comparison
 * - Rate limiting per API key
 * - Key metadata extraction (owner, permissions, expiry)
 * - Audit logging
 * - Support for multiple key locations (header, query param)
 */
@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {
    
    private static final Logger log = LoggerFactory.getLogger(
            ApiKeyAuthenticationFilter.class);
    
    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String BEARER_PREFIX = "Bearer ";
    
    private final ApiKeyRepository apiKeyRepository;
    private final RateLimiter rateLimiter;
    
    // Paths that don't require API key
    private final Set<String> publicPaths = Set.of(
            "/health", "/info", "/docs", "/swagger-ui"
    );
    
    public ApiKeyAuthenticationFilter(ApiKeyRepository apiKeyRepository,
                                      RateLimiter rateLimiter) {
        this.apiKeyRepository = apiKeyRepository;
        this.rateLimiter = rateLimiter;
    }
    
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain)
            throws ServletException, IOException {
        
        // Skip public paths
        String path = request.getRequestURI();
        if (isPublicPath(path)) {
            filterChain.doFilter(request, response);
            return;
        }
        
        // Extract API key from request
        String apiKey = extractApiKey(request);
        
        if (apiKey == null) {
            sendUnauthorized(response, "Missing API key. " +
                    "Provide via X-API-Key header or Authorization: Bearer <key>");
            return;
        }
        
        // Hash the API key for lookup (never store/compare plaintext)
        String keyHash = hashApiKey(apiKey);
        
        // Look up key metadata
        Optional<ApiKeyMetadata> metadata = apiKeyRepository.findByHash(keyHash);
        
        if (metadata.isEmpty()) {
            log.warn("Invalid API key attempt from IP: {}", 
                    request.getRemoteAddr());
            sendUnauthorized(response, "Invalid API key");
            return;
        }
        
        ApiKeyMetadata keyMeta = metadata.get();
        
        // Check if key is expired
        if (keyMeta.expiresAt() != null && 
                Instant.now().isAfter(keyMeta.expiresAt())) {
            log.warn("Expired API key used: owner={}", keyMeta.owner());
            sendUnauthorized(response, "API key expired");
            return;
        }
        
        // Check if key is active
        if (!keyMeta.active()) {
            log.warn("Inactive API key used: owner={}", keyMeta.owner());
            sendUnauthorized(response, "API key is inactive");
            return;
        }
        
        // Check rate limit
        if (!rateLimiter.allowRequest(keyHash, keyMeta.rateLimit())) {
            log.warn("Rate limit exceeded for API key: owner={}", keyMeta.owner());
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.getWriter().write("{\"error\": \"Rate limit exceeded\"}");
            return;
        }
        
        // Check permissions for the requested path/method
        if (!hasPermission(keyMeta, request.getMethod(), path)) {
            log.warn("Insufficient permissions: owner={}, method={}, path={}",
                    keyMeta.owner(), request.getMethod(), path);
            sendForbidden(response, "Insufficient permissions for this operation");
            return;
        }
        
        // Set authenticated context for downstream handlers
        request.setAttribute("api.key.owner", keyMeta.owner());
        request.setAttribute("api.key.permissions", keyMeta.permissions());
        request.setAttribute("api.key.id", keyMeta.keyId());
        
        // Audit log
        log.info("API key auth success: owner={}, method={}, path={}, ip={}",
                keyMeta.owner(), request.getMethod(), path, 
                request.getRemoteAddr());
        
        filterChain.doFilter(request, response);
    }
    
    private String extractApiKey(HttpServletRequest request) {
        // Check X-API-Key header first
        String apiKey = request.getHeader(API_KEY_HEADER);
        if (apiKey != null) return apiKey;
        
        // Check Authorization: Bearer header
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX)) {
            return authHeader.substring(BEARER_PREFIX.length());
        }
        
        // Check query parameter (less secure, for webhook callbacks etc.)
        return request.getParameter("api_key");
    }
    
    /**
     * Hash API key using SHA-256 for secure storage/lookup.
     * API keys should NEVER be stored in plaintext.
     */
    private String hashApiKey(String apiKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(apiKey.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to hash API key", e);
        }
    }
    
    private boolean isPublicPath(String path) {
        return publicPaths.stream().anyMatch(path::startsWith);
    }
    
    private boolean hasPermission(ApiKeyMetadata meta, 
                                   String method, String path) {
        // Check if the key's permissions cover this operation
        Set<String> perms = meta.permissions();
        
        return switch (method) {
            case "GET" -> perms.contains("read") || perms.contains("admin");
            case "POST", "PUT", "PATCH" -> perms.contains("write") || 
                    perms.contains("admin");
            case "DELETE" -> perms.contains("delete") || 
                    perms.contains("admin");
            default -> perms.contains("admin");
        };
    }
    
    private void sendUnauthorized(HttpServletResponse response, String message) 
            throws IOException {
        response.setStatus(401);
        response.setContentType("application/json");
        response.getWriter().write(
                String.format("{\"error\": \"%s\"}", message));
    }
    
    private void sendForbidden(HttpServletResponse response, String message) 
            throws IOException {
        response.setStatus(403);
        response.setContentType("application/json");
        response.getWriter().write(
                String.format("{\"error\": \"%s\"}", message));
    }
}

record ApiKeyMetadata(
    String keyId,
    String owner,
    Set<String> permissions,
    Instant expiresAt,
    boolean active,
    int rateLimit  // requests per minute
) {}

interface ApiKeyRepository {
    Optional<ApiKeyMetadata> findByHash(String keyHash);
}

/**
 * Simple token bucket rate limiter.
 */
class RateLimiter {
    private final ConcurrentHashMap<String, TokenBucket> buckets = 
            new ConcurrentHashMap<>();
    
    public boolean allowRequest(String key, int maxRequestsPerMinute) {
        TokenBucket bucket = buckets.computeIfAbsent(key, 
                k -> new TokenBucket(maxRequestsPerMinute));
        return bucket.tryConsume();
    }
    
    private static class TokenBucket {
        private final int maxTokens;
        private double tokens;
        private long lastRefillTime;
        
        TokenBucket(int maxTokensPerMinute) {
            this.maxTokens = maxTokensPerMinute;
            this.tokens = maxTokensPerMinute;
            this.lastRefillTime = System.nanoTime();
        }
        
        synchronized boolean tryConsume() {
            refill();
            if (tokens >= 1) {
                tokens -= 1;
                return true;
            }
            return false;
        }
        
        private void refill() {
            long now = System.nanoTime();
            double elapsed = (now - lastRefillTime) / 1_000_000_000.0;
            tokens = Math.min(maxTokens, tokens + elapsed * (maxTokens / 60.0));
            lastRefillTime = now;
        }
    }
}
```

### 7.5 OPA Integration for Authorization

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Set;

/**
 * OPA (Open Policy Agent) client for distributed authorization.
 * 
 * This client communicates with an OPA sidecar or centralized OPA service
 * to make authorization decisions. Policies are managed externally in Rego.
 * 
 * Deployment options:
 * 1. OPA as sidecar (lowest latency, <1ms decisions)
 * 2. OPA as centralized service (simpler management)
 * 3. OPA as library (Go only, embedded in application)
 */
public class OpaAuthorizationClient {
    
    private static final Logger log = LoggerFactory.getLogger(
            OpaAuthorizationClient.class);
    
    private final HttpClient httpClient;
    private final String opaBaseUrl;
    private final ObjectMapper objectMapper;
    private final String defaultPolicyPath;
    
    public OpaAuthorizationClient(String opaBaseUrl, String defaultPolicyPath) {
        this.opaBaseUrl = opaBaseUrl;
        this.defaultPolicyPath = defaultPolicyPath;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(500))
                .build();
    }
    
    /**
     * Check if an action is authorized.
     * 
     * @param userId The user making the request
     * @param roles User's roles
     * @param action The action being performed (GET, POST, etc.)
     * @param resource The resource being accessed (/api/orders/123)
     * @param context Additional context (IP, time, device info)
     * @return Authorization decision
     */
    public AuthorizationDecision isAuthorized(
            String userId,
            Set<String> roles,
            String action,
            String resource,
            Map<String, Object> context) {
        
        try {
            // Build OPA input document
            ObjectNode input = objectMapper.createObjectNode();
            ObjectNode inputWrapper = objectMapper.createObjectNode();
            
            // User attributes
            ObjectNode user = objectMapper.createObjectNode();
            user.put("id", userId);
            user.set("roles", objectMapper.valueToTree(roles));
            input.set("user", user);
            
            // Request attributes
            input.put("method", action);
            input.put("path", resource);
            
            // Environment/context attributes
            if (context != null) {
                input.set("context", objectMapper.valueToTree(context));
            }
            
            inputWrapper.set("input", input);
            
            // Query OPA
            String requestBody = objectMapper.writeValueAsString(inputWrapper);
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(opaBaseUrl + "/v1/data/" + defaultPolicyPath))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofMillis(100)) // Strict timeout for auth decisions
                    .build();
            
            HttpResponse<String> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                log.error("OPA returned non-200: status={}, body={}",
                        response.statusCode(), response.body());
                // Fail closed: deny access if OPA is unavailable
                return AuthorizationDecision.denied("Policy engine unavailable");
            }
            
            // Parse response
            JsonNode result = objectMapper.readTree(response.body());
            JsonNode resultNode = result.path("result");
            
            boolean allowed = resultNode.path("allow").asBoolean(false);
            String reason = resultNode.path("reason").asText(null);
            
            if (allowed) {
                log.debug("OPA authorized: user={}, action={}, resource={}",
                        userId, action, resource);
                return AuthorizationDecision.allowed();
            } else {
                log.info("OPA denied: user={}, action={}, resource={}, reason={}",
                        userId, action, resource, reason);
                return AuthorizationDecision.denied(
                        reason != null ? reason : "Access denied by policy");
            }
            
        } catch (Exception e) {
            log.error("OPA communication failed", e);
            // IMPORTANT: Fail closed — deny access if policy engine is down
            return AuthorizationDecision.denied(
                    "Authorization service unavailable");
        }
    }
    
    public record AuthorizationDecision(boolean allowed, String reason) {
        public static AuthorizationDecision allowed() {
            return new AuthorizationDecision(true, null);
        }
        
        public static AuthorizationDecision denied(String reason) {
            return new AuthorizationDecision(false, reason);
        }
    }
}

/**
 * Spring Security integration with OPA.
 * Intercepts requests and delegates authorization to OPA.
 */
@Component
class OpaAuthorizationInterceptor implements 
        org.springframework.web.servlet.HandlerInterceptor {
    
    private final OpaAuthorizationClient opaClient;
    
    OpaAuthorizationInterceptor(OpaAuthorizationClient opaClient) {
        this.opaClient = opaClient;
    }
    
    @Override
    public boolean preHandle(HttpServletRequest request, 
                              HttpServletResponse response,
                              Object handler) throws Exception {
        
        // Extract user identity (set by JWT filter upstream)
        String userId = (String) request.getAttribute("user.id");
        Set<String> roles = (Set<String>) request.getAttribute("user.roles");
        
        if (userId == null) {
            response.setStatus(401);
            return false;
        }
        
        // Build context
        Map<String, Object> context = Map.of(
            "ip", request.getRemoteAddr(),
            "userAgent", Objects.requireNonNullElse(
                    request.getHeader("User-Agent"), "unknown"),
            "timestamp", Instant.now().toString()
        );
        
        // Check authorization with OPA
        var decision = opaClient.isAuthorized(
                userId, roles,
                request.getMethod(),
                request.getRequestURI(),
                context
        );
        
        if (!decision.allowed()) {
            response.setStatus(403);
            response.setContentType("application/json");
            response.getWriter().write(String.format(
                    "{\"error\": \"Forbidden\", \"reason\": \"%s\"}",
                    decision.reason()));
            return false;
        }
        
        return true;
    }
}
```

---

## 8. Performance Analysis

### 8.1 Authentication Performance

| Method | Latency (p50) | Latency (p99) | Throughput | Scalability |
|---|---|---|---|---|
| API Key (hash lookup) | <1ms | 2ms | 100K+ rps | Excellent |
| JWT Validation (local) | 0.5ms | 2ms | 50K+ rps | Excellent |
| JWT Validation (JWKS fetch) | 1-5ms | 50ms | 10K rps | Good (with caching) |
| OAuth Token Introspection | 5-20ms | 100ms | 5K rps | Moderate |
| mTLS Handshake | 5-30ms | 100ms | N/A (one-time) | Good (connection reuse) |
| Password Verification (Argon2id) | 100-500ms | 1s | 10-100 rps | Poor (by design) |
| SAML Assertion Validation | 10-50ms | 200ms | 5K rps | Moderate |

### 8.2 JWT Performance Characteristics

```
Token Size Impact:
┌────────────────────────────────────────────────────────┐
│ Claim Count   │ Token Size    │ Parse Time    │ Note   │
│───────────────│───────────────│───────────────│────────│
│ Minimal (5)   │ ~300 bytes    │ ~0.3ms        │ Ideal  │
│ Standard (10) │ ~500 bytes    │ ~0.5ms        │ Good   │
│ Heavy (20+)   │ ~1-2 KB       │ ~1ms          │ Watch  │
│ Excessive     │ ~5+ KB        │ ~3ms          │ Too big│
└────────────────────────────────────────────────────────┘

Signing Algorithm Performance (operations/second):
┌─────────────────────────────────────────────────────┐
│ Algorithm │ Sign          │ Verify        │ Size    │
│───────────│───────────────│───────────────│─────────│
│ HS256     │ 200,000       │ 200,000       │ 32B     │
│ RS256     │ 1,000         │ 25,000        │ 256B    │
│ ES256     │ 15,000        │ 8,000         │ 64B     │
│ EdDSA     │ 40,000        │ 20,000        │ 64B     │
└─────────────────────────────────────────────────────┘
```

### 8.3 mTLS Performance Impact

```
Connection Establishment:
  Without TLS:     ~1ms (TCP handshake)
  With TLS 1.2:    ~3-5ms (+ TLS handshake, 2 RTT)
  With TLS 1.3:    ~2-3ms (+ TLS handshake, 1 RTT)
  With mTLS 1.3:   ~3-5ms (+ client cert exchange)
  With 0-RTT:      ~1-2ms (resumption, no additional RTT)

Throughput Impact:
  TLS encryption overhead: ~2-5% CPU for bulk data
  TLS handshake: significant for short-lived connections
  Solution: connection pooling, HTTP/2 multiplexing, session resumption

Memory Impact:
  Each TLS session: ~20-50 KB memory
  10,000 concurrent connections: ~200-500 MB
  Certificate validation: ~1-5 MB for CRL/OCSP cache
```

### 8.4 Rate Limiting Algorithm Comparison

| Algorithm | Memory | Accuracy | Burst Handling | Implementation |
|---|---|---|---|---|
| Fixed Window | O(n) per key | Low (boundary burst) | Poor | Simple |
| Sliding Log | O(n * log_size) | High | Good | Complex |
| Sliding Window Counter | O(n) per key | Good | Good | Moderate |
| Token Bucket | O(n) per key | Good | Good (controlled) | Moderate |
| Leaky Bucket | O(n) per key | High | None (smoothed) | Moderate |

### 8.5 OPA Decision Latency

```
Deployment Model vs Latency:
┌──────────────────────────────────────────────────────┐
│ Deployment         │ p50 Latency │ p99 Latency      │
│────────────────────│─────────────│──────────────────│
│ OPA Sidecar        │ 0.1-0.5ms   │ 1-2ms            │
│ OPA Centralized    │ 1-5ms       │ 10-50ms          │
│ OPA + Network hop  │ 5-20ms      │ 50-100ms         │
│ External Policy SaaS│ 20-100ms    │ 200-500ms        │
└──────────────────────────────────────────────────────┘

Key insight: For the hot authorization path, deploy OPA as a sidecar.
For administrative policy checks, centralized is fine.
```

---

## 9. Tradeoffs

### 9.1 JWT vs Opaque Tokens

```
                         JWT                    Opaque Token
                    ┌────────────┐           ┌────────────┐
  Validation Speed  │ ★★★★★      │           │ ★★         │
                    │ Local, fast│           │ Network    │
                    └────────────┘           └────────────┘
  Revocation        │ ★★         │           │ ★★★★★      │
                    │ Difficult  │           │ Immediate  │
                    └────────────┘           └────────────┘
  Scalability       │ ★★★★★      │           │ ★★★        │
                    │ Stateless  │           │ Central DB │
                    └────────────┘           └────────────┘
  Security          │ ★★★        │           │ ★★★★       │
                    │ Claims     │           │ No data    │
                    │ visible    │           │ leakage    │
                    └────────────┘           └────────────┘
  Debugging         │ ★★★★       │           │ ★★         │
                    │ Readable   │           │ Opaque     │
                    └────────────┘           └────────────┘
```

**When to use JWT:**
- Microservices architecture where services need to validate tokens independently
- High-throughput APIs where network calls for validation would be a bottleneck
- Cross-domain/cross-service authentication
- When you need to propagate user context without database lookups

**When to use opaque tokens:**
- When immediate revocation is critical (banking, financial systems)
- When token content must remain confidential
- When you have a reliable, low-latency token store (Redis)
- Simpler systems with a centralized auth service

### 9.2 RBAC vs ABAC

| Dimension | RBAC | ABAC |
|---|---|---|
| **Complexity** | Low | High |
| **Flexibility** | Limited | Very flexible |
| **Performance** | Fast (role lookup) | Slower (attribute evaluation) |
| **Audit** | Easy (role assignments) | Complex (attribute combinations) |
| **Maintenance** | Role explosion risk | Policy complexity risk |
| **Best for** | Stable organizations | Dynamic, context-dependent access |
| **Implementation** | Simple DB schema | Policy engine (OPA) |
| **Example** | "Admins can delete orders" | "Managers in finance dept can approve expenses > $1000 during business hours" |

### 9.3 Centralized vs Decentralized Authorization

```
Centralized Authorization:
┌──────────────────────────────────────────────────┐
│ Pros:                                             │
│ ✅ Single source of truth                        │
│ ✅ Easy to audit and manage                      │
│ ✅ Consistent policy enforcement                 │
│ ✅ Real-time policy updates                      │
│                                                   │
│ Cons:                                             │
│ ❌ Single point of failure                       │
│ ❌ Network latency for every decision            │
│ ❌ Scalability bottleneck                        │
│ ❌ Cross-region latency                          │
└──────────────────────────────────────────────────┘

Decentralized Authorization (JWT + local policy):
┌──────────────────────────────────────────────────┐
│ Pros:                                             │
│ ✅ No single point of failure                    │
│ ✅ No additional network calls                   │
│ ✅ Scales independently                          │
│ ✅ Works during network partitions               │
│                                                   │
│ Cons:                                             │
│ ❌ Policy updates have propagation delay         │
│ ❌ Token revocation is delayed                   │
│ ❌ Consistency challenges                        │
│ ❌ More complex debugging                        │
└──────────────────────────────────────────────────┘

Hybrid (recommended):
  - JWT for authentication (decentralized validation)
  - OPA sidecar for authorization (local policy evaluation)
  - Centralized policy management with async distribution
  - Redis for token revocation blacklist (fast, replicated)
```

### 9.4 Security vs Performance vs Developer Experience

```
Security Level      Performance Impact     Developer Complexity
     │                    │                       │
     ▼                    ▼                       ▼
 API Key only         Minimal                 Very simple
     │                    │                       │
 JWT + TLS           ~1ms per request         Moderate
     │                    │                       │
 JWT + mTLS          ~5ms first request       Complex setup
     │                    │                       │
 JWT + mTLS + OPA    ~2-10ms per request      High
     │                    │                       │
 Zero Trust +        ~10-50ms per request     Very high
 continuous eval         │                       │
     │                    │                       │
     ▼                    ▼                       ▼
 Maximum security    Significant overhead     Maximum complexity
```

### 9.5 Short-lived vs Long-lived Tokens

| Aspect | Short-lived (5-15 min) | Long-lived (hours-days) |
|---|---|---|
| **Security** | Better (limited window of compromise) | Riskier (longer exposure) |
| **User experience** | More refresh flows (transparent) | Fewer interruptions |
| **Revocation** | Less critical (auto-expires) | Essential (must be revocable) |
| **Performance** | More token refresh traffic | Less overhead |
| **Offline access** | Not suitable | Needed for mobile apps |

---

## 10. Failure Scenarios

### 10.1 Token Theft and Replay Attacks

**Scenario:** An attacker intercepts a JWT access token (e.g., via XSS, logging, or network sniffing).

**Impact:** The attacker can impersonate the user for the token's remaining lifetime.

**Mitigations:**
1. **Short token lifetimes** — limit exposure window
2. **Token binding** — bind tokens to specific clients (DPoP - Demonstrating Proof of Possession)
3. **TLS everywhere** — prevent network interception
4. **HttpOnly + Secure cookies** — prevent XSS-based token theft
5. **Monitoring** — detect token use from unusual locations/devices

```
Attack:
User ──[JWT]──▶ API Gateway ──────▶ Service
                    │
                    │ (Token logged
                    │  or intercepted)
                    │
Attacker ──[JWT]──▶ API Gateway ──────▶ Service
                    (Valid token! Access granted)

Mitigation with DPoP (Demonstration of Proof of Possession):
User creates DPoP proof = JWT signed with user's private key
User sends: Authorization: DPoP <access_token>
            DPoP: <proof_jwt>
Server verifies: proof JWT signature matches token's bound key
Attacker has token but NOT user's private key → Cannot create valid proof
```

### 10.2 Certificate Expiry

**Scenario:** A service's TLS certificate expires, and mTLS connections start failing.

**Impact:** Complete loss of service-to-service communication if mTLS is mandatory.

**Symptoms:**
- Sudden spike in connection errors
- "certificate has expired" errors in logs
- Cascading failures as dependent services lose connectivity

**Prevention:**
```
1. Certificate Monitoring:
   - Alert at 30 days before expiry (warning)
   - Alert at 7 days before expiry (critical)
   - Alert at 1 day before expiry (emergency)

2. Automated Renewal:
   - cert-manager (Kubernetes)
   - Let's Encrypt / ACME protocol
   - Vault PKI secrets engine
   - Service mesh auto-rotation (Istio: 24h default)

3. Graceful Degradation:
   - Accept both old and new certificates during rotation
   - Dual-stack certificate deployment
   - Fallback to alternative authentication during emergencies
```

### 10.3 Key Compromise

**Scenario:** A JWT signing key is compromised.

**Impact:** Attacker can forge valid JWT tokens for any user.

**Response procedure:**

```
Incident Timeline:
T+0:    Key compromise detected
T+5m:   Rotate to new signing key
T+10m:  Distribute new public key via JWKS endpoint
T+15m:  All services pick up new JWKS (assuming 5-min cache TTL)
T+15m:  Old tokens (signed with compromised key) are rejected
T+20m:  Force re-authentication for all active sessions

Key Rotation Strategy:
1. JWKS endpoint should list BOTH old and new keys
2. New tokens are signed with new key (identified by 'kid' claim)
3. Old tokens continue to be verifiable during transition
4. Remove old key from JWKS after transition period
5. Investigate and remediate root cause
```

### 10.4 Authorization Service Outage

**Scenario:** OPA / policy engine is down, and services can't make authorization decisions.

**Options:**

| Strategy | Behavior | Risk |
|---|---|---|
| **Fail closed** | Deny all requests | Availability loss |
| **Fail open** | Allow all requests | Security compromise |
| **Cached decisions** | Use last-known decisions | Stale permissions |
| **Default policy** | Apply minimal permissions | Degraded functionality |
| **Circuit breaker** | Switch to local RBAC | Reduced authorization fidelity |

**Recommended approach:**
```java
AuthorizationDecision authorize(Request request) {
    try {
        // Primary: OPA sidecar
        return opaClient.isAuthorized(request);
    } catch (TimeoutException | ConnectionException e) {
        // Fallback 1: Cached decision
        var cached = cache.getDecision(request.cacheKey());
        if (cached != null && !cached.isExpired()) {
            metrics.increment("auth.fallback.cache");
            return cached;
        }
        
        // Fallback 2: Local RBAC for critical paths
        if (isCriticalPath(request)) {
            metrics.increment("auth.fallback.local_rbac");
            return localRbac.evaluate(request);
        }
        
        // Fallback 3: Fail closed for unknown paths
        metrics.increment("auth.fallback.denied");
        return AuthorizationDecision.denied("Auth service unavailable");
    }
}
```

### 10.5 Secret Sprawl and Leakage

**Scenario:** Secrets proliferate across multiple systems — config files, environment variables, CI/CD pipelines, developer laptops, chat messages.

**Detection strategies:**
1. **Git scanning:** Tools like TruffleHog, GitLeaks scan repositories for committed secrets
2. **Runtime scanning:** Monitor logs and HTTP traffic for secret-like patterns
3. **Secret rotation:** Rotate all secrets regularly; if a compromised secret is old, the window of exposure is limited
4. **Audit logging:** Track who accessed which secrets and when

### 10.6 SSRF (Server-Side Request Forgery) in Distributed Systems

**Scenario:** An attacker tricks a service into making requests to internal services or cloud metadata endpoints.

```
Attacker → Public API → Internal Service → Cloud Metadata
                                          → Internal Database
                                          → Admin Panel

Example (Capital One breach):
1. Attacker sends: GET /api?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/
2. Public service fetches the URL
3. Returns AWS IAM temporary credentials
4. Attacker uses credentials to access S3 buckets
```

**Mitigations:**
- Validate and sanitize all URLs
- Block requests to internal IP ranges (10.x, 172.16.x, 192.168.x, 169.254.x)
- Use allowlists for external URLs
- IMDSv2 (Instance Metadata Service v2) requires session token
- Network segmentation (services shouldn't be able to reach metadata endpoint)

---

## 11. Debugging & Observability

### 11.1 Security Logging Best Practices

```java
/**
 * Security event logger that captures structured security events
 * for SIEM integration and compliance.
 */
public class SecurityEventLogger {
    
    private static final Logger securityLog = LoggerFactory.getLogger("SECURITY");
    
    public void logAuthenticationSuccess(String userId, String method, 
                                          String sourceIP, String userAgent) {
        securityLog.info("AUTH_SUCCESS user={} method={} ip={} ua={}",
                userId, method, sourceIP, truncate(userAgent, 100));
    }
    
    public void logAuthenticationFailure(String attemptedUser, String method,
                                          String sourceIP, String reason) {
        securityLog.warn("AUTH_FAILURE user={} method={} ip={} reason={}",
                attemptedUser, method, sourceIP, reason);
    }
    
    public void logAuthorizationDenied(String userId, String action,
                                        String resource, String reason) {
        securityLog.warn("AUTHZ_DENIED user={} action={} resource={} reason={}",
                userId, action, resource, reason);
    }
    
    public void logTokenRevocation(String tokenId, String userId, String reason) {
        securityLog.info("TOKEN_REVOKED tokenId={} user={} reason={}",
                tokenId, userId, reason);
    }
    
    public void logSuspiciousActivity(String userId, String description,
                                       Map<String, Object> details) {
        securityLog.warn("SUSPICIOUS_ACTIVITY user={} description={} details={}",
                userId, description, details);
    }
    
    // NEVER log: passwords, tokens, keys, PII in plaintext
    // DO log: user IDs, actions, resources, outcomes, timestamps, source IPs
    
    private String truncate(String s, int maxLen) {
        return s != null && s.length() > maxLen ? s.substring(0, maxLen) + "..." : s;
    }
}
```

### 11.2 Key Security Metrics

```
Authentication Metrics:
├── auth.login.success.count          (Counter)
├── auth.login.failure.count          (Counter)
├── auth.login.failure.by_reason      (Counter with labels)
├── auth.token.issued.count           (Counter)
├── auth.token.validated.count        (Counter)
├── auth.token.rejected.count         (Counter)
├── auth.token.validation.latency     (Histogram)
└── auth.mfa.challenge.count          (Counter)

Authorization Metrics:
├── authz.decision.allowed.count      (Counter)
├── authz.decision.denied.count       (Counter)
├── authz.decision.latency            (Histogram)
├── authz.policy.evaluation.count     (Counter)
└── authz.policy.error.count          (Counter)

Certificate Metrics:
├── tls.cert.expiry.seconds           (Gauge - time until expiry)
├── tls.handshake.success.count       (Counter)
├── tls.handshake.failure.count       (Counter)
├── tls.handshake.latency             (Histogram)
└── tls.cert.rotation.count           (Counter)

Rate Limiting Metrics:
├── ratelimit.requests.allowed.count  (Counter)
├── ratelimit.requests.denied.count   (Counter)
└── ratelimit.bucket.usage            (Gauge)

Secret Management Metrics:
├── vault.secret.read.count           (Counter)
├── vault.secret.read.latency         (Histogram)
├── vault.lease.renewal.count         (Counter)
├── vault.lease.renewal.failure.count (Counter)
└── vault.auth.failure.count          (Counter)
```

### 11.3 Distributed Tracing for Security

```
Trace: api-gateway → auth-service → order-service → payment-service

Span: api-gateway
├── http.method: POST
├── http.url: /api/orders
├── http.status_code: 200
├── auth.method: JWT
├── auth.user_id: user-123
├── auth.token_type: access
├── security.tls_version: TLSv1.3
├── security.cipher_suite: TLS_AES_256_GCM_SHA384
└── ratelimit.remaining: 95

Span: auth-service (JWT validation)
├── jwt.valid: true
├── jwt.issuer: https://auth.example.com
├── jwt.subject: user-123
├── jwt.expires_in_seconds: 245
├── jwt.algorithm: RS256
└── jwt.validation_ms: 0.5

Span: order-service (OPA authorization)
├── authz.policy: orders.allow
├── authz.decision: allow
├── authz.evaluation_ms: 0.3
├── authz.user_roles: [user, premium]
└── authz.resource: /api/orders

Span: payment-service (mTLS)
├── mtls.client_cert_cn: order-service
├── mtls.client_spiffe_id: spiffe://prod/order-service
├── mtls.cert_expiry: 2024-06-15T00:00:00Z
└── mtls.handshake_ms: 3.2
```

### 11.4 Security Alerting Rules

```yaml
# Prometheus alerting rules for security events

groups:
  - name: security_alerts
    rules:
      # Brute force detection
      - alert: HighAuthFailureRate
        expr: rate(auth_login_failure_count[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"
          description: "More than 10 login failures per second for 2 minutes"

      # Certificate expiry
      - alert: CertificateExpiringSoon
        expr: tls_cert_expiry_seconds < 604800  # 7 days
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "TLS certificate expiring within 7 days"

      # Unusual token revocation
      - alert: MassTokenRevocation
        expr: rate(auth_token_revoked_count[5m]) > 100
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Unusual mass token revocation detected"

      # Authorization errors spike
      - alert: AuthorizationDenialSpike
        expr: rate(authz_decision_denied_count[5m]) / rate(authz_decision_allowed_count[5m]) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High authorization denial rate (>50%)"

      # Vault unavailable
      - alert: VaultUnavailable
        expr: vault_auth_failure_count > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Unable to authenticate to HashiCorp Vault"
```

---

## 12. Interview Questions

### Beginner Level

**Q1: What is the difference between authentication and authorization?**

**Expected Answer:** Authentication verifies *who you are* (identity). Authorization determines *what you can do* (permissions). Authentication happens first — you must prove your identity before the system can determine your permissions. Example: Logging in with username/password is authentication; whether you can access the admin panel is authorization.

**Q2: What is a JWT and what are its three parts?**

**Expected Answer:** JWT (JSON Web Token) is a compact, URL-safe token format. It has three parts separated by dots: (1) Header — contains the algorithm and token type, (2) Payload — contains claims about the user (sub, exp, iat, custom claims), (3) Signature — cryptographic signature that proves the token hasn't been tampered with. Each part is Base64URL-encoded.

**Q3: Why should you never store passwords in plaintext?**

**Expected Answer:** If the database is breached, attackers immediately have all passwords. Users often reuse passwords across sites, amplifying the damage. Instead, use password hashing algorithms like bcrypt or Argon2id, which are:
- Slow (computationally expensive, preventing brute-force)
- Salted (preventing rainbow table attacks)
- One-way (cannot be reversed to obtain the original password)

### Intermediate Level

**Q4: Explain the OAuth 2.0 Authorization Code flow and why it's more secure than the implicit flow.**

**Expected Answer:** The Authorization Code flow has the client redirect the user to the authorization server, which authenticates the user and returns an authorization code to the client via redirect. The client then exchanges this code for tokens via a back-channel (server-to-server) request, including its client secret. This is more secure than the implicit flow because:
1. The access token is never exposed in the browser URL
2. The authorization code is short-lived and one-time use
3. The token exchange uses client authentication
4. With PKCE, even public clients are protected against code interception

The implicit flow has been deprecated in OAuth 2.1 because it exposes tokens in the URL fragment, making them vulnerable to history/referrer leakage and browser-based attacks.

**Q5: How would you handle JWT revocation in a microservices architecture?**

**Expected Answer:** JWTs are stateless, making revocation inherently challenging. Strategies include:
1. **Short-lived tokens** (5-15 minutes) with refresh token rotation — the simplest approach; revoke the refresh token, and the access token expires quickly
2. **Token blacklist** in Redis — add revoked token JTIs; fast lookup but requires a centralized store
3. **Event-driven revocation** — publish revocation events, services maintain local blacklist caches
4. **Token versioning** — store a version counter per user; increment on revocation, validate version on each request

The trade-off is between revocation speed and architectural complexity. Most production systems use short-lived tokens + refresh token revocation as the primary strategy.

**Q6: What is mTLS and when would you use it?**

**Expected Answer:** mTLS (Mutual TLS) is TLS where both the client and server present certificates to authenticate each other. In standard TLS, only the server proves its identity. In mTLS, both parties verify each other's identity through certificate validation.

Use mTLS for:
- Service-to-service communication in microservices
- Zero trust architectures where network location doesn't imply trust
- Regulatory environments requiring strong mutual authentication

It's typically managed by a service mesh (Istio, Linkerd) which automates certificate provisioning, rotation, and mTLS enforcement.

### Advanced Level

**Q7: Design a complete authentication and authorization system for a microservices architecture at scale (100+ services, millions of users).**

**Expected Answer:** 

**Authentication layer:**
- External users: OAuth 2.0 + OIDC via centralized identity provider (Keycloak/Auth0)
- JWT access tokens (RS256, 15-min TTL) with refresh tokens (rotated, 7-day TTL)
- MFA for sensitive operations
- API keys for partner integrations

**Authorization layer:**
- OPA deployed as sidecar to each service for <1ms policy decisions
- Policies stored in Git, distributed via OPA bundles
- RBAC for coarse-grained access, ABAC for fine-grained (time, location, resource attributes)

**Service-to-service:**
- mTLS via service mesh (Istio/Linkerd)
- SPIFFE IDs for service identity
- Short-lived certificates (24h) auto-rotated

**Secrets management:**
- HashiCorp Vault with Kubernetes auth
- Dynamic secrets for database credentials
- Vault Agent sidecar for transparent secret injection

**Observability:**
- Security events to centralized SIEM
- Distributed tracing with security context
- Real-time alerting for anomalies

**Q8: Explain the "confused deputy" problem and how OAuth 2.0 addresses it.**

**Expected Answer:** The confused deputy problem occurs when a program with legitimate authority is tricked into misusing that authority on behalf of an attacker. In distributed systems, Service A might make requests to Service B on behalf of users. Without proper authorization delegation, Service A must use its own credentials, which might have broader access than the user should have.

OAuth 2.0 addresses this by:
1. **Scoped tokens** — the access token carries only the permissions the user consented to
2. **Audience restriction** — tokens are bound to specific resource servers (aud claim)
3. **User context** — the token carries the user's identity (sub claim), allowing the resource server to apply user-level authorization
4. **Proof of Possession** — DPoP binds tokens to specific clients, preventing token theft

**Q9: How does Google's BeyondCorp differ from traditional VPN-based security, and what are the implementation challenges?**

**Expected Answer:** 

**Differences:**
- VPN creates a trusted network zone; BeyondCorp eliminates the concept of a trusted network
- VPN: once inside, lateral movement is unrestricted; BeyondCorp: every access request is authenticated and authorized independently
- VPN: binary (connected or not); BeyondCorp: continuous evaluation of trust based on device state, user identity, and request context
- VPN adds latency for all traffic; BeyondCorp applies controls only at access points

**Implementation challenges:**
1. **Gradual migration** — can't switch overnight; need to run both VPN and zero trust in parallel
2. **Device trust** — requires MDM enrollment, compliance checking, continuous assessment
3. **Application compatibility** — legacy apps may not support modern auth (OIDC/SAML)
4. **Policy complexity** — defining fine-grained access policies for hundreds of applications
5. **User experience** — continuous authentication must be seamless (SSO, device trust caching)
6. **Organizational resistance** — teams accustomed to "inside the firewall = trusted"

### FAANG-Level

**Q10: You're designing the authentication system for a global financial services platform with these requirements: sub-second latency worldwide, immediate account lockout capability, regulatory compliance (SOX, PCI-DSS), support for 50 million users. Walk through your design.**

**Expected Answer:** This requires a multi-layered approach:

**Global architecture:**
- Deploy authentication services in multiple regions (US, EU, APAC)
- Use geo-routing (Anycast DNS) to route users to nearest region
- Global session store in CockroachDB or Spanner for strong consistency

**Token strategy:**
- Opaque tokens (not JWT) for financial operations — enables immediate revocation
- Token store in Redis Cluster (multi-region) with sub-millisecond lookups
- 5-minute token TTL with sliding expiration
- Alternative: JWT with 1-minute TTL + per-request introspection for high-value operations

**Immediate lockout:**
- Account lockout state in global, strongly consistent database
- Async event propagation to all regions
- Token revocation via distributed blacklist (Redis Cluster)
- Maximum lockout propagation delay: <5 seconds globally

**Compliance:**
- PCI-DSS: encrypt all cardholder data, strong access controls, audit trails
- SOX: separation of duties, change management, immutable audit logs
- All authentication events logged to append-only audit store
- Key ceremony for signing key generation (multi-person authorization)

**Performance:**
- Redis for session/token store: <1ms reads
- Connection pooling and HTTP/2 for internal communication
- Pre-computed authorization decisions cached locally
- Warm standby in each region for failover

---

## 13. Exercises

### Exercise 1: Implement JWT Authentication (Beginner)

Build a complete JWT authentication service in Java that:
1. Registers users with bcrypt password hashing
2. Authenticates users and issues JWT access + refresh tokens
3. Validates tokens on protected endpoints
4. Implements token refresh
5. Implements token revocation via blacklist

### Exercise 2: Build an API Key Management System (Intermediate)

Design and implement an API key management system that:
1. Generates cryptographically secure API keys
2. Stores hashed keys (never plaintext)
3. Supports key rotation (issue new key, grace period for old key)
4. Implements rate limiting per API key
5. Supports scoped permissions (read, write, admin)
6. Provides audit logging

### Exercise 3: Design a Zero Trust Architecture (Advanced)

Design a zero trust architecture for an e-commerce platform with:
- 50 microservices
- 3 environments (dev, staging, production)
- External partner integrations
- Mobile app and web app clients
- Compliance requirements (PCI-DSS for payments)

Your design should include:
1. Identity and access management (users + services)
2. Network security (service mesh, network policies)
3. Secrets management strategy
4. Certificate management and rotation
5. Monitoring and incident response
6. Migration plan from existing VPN-based security

### Exercise 4: Implement mTLS in Java (Intermediate)

Create a Java application that:
1. Generates CA, server, and client certificates (using keytool or programmatically)
2. Configures a Spring Boot server with mTLS (client-auth=need)
3. Implements a client that connects using client certificates
4. Demonstrates certificate rotation without downtime
5. Logs certificate details (CN, expiry, issuer) for audit

### Exercise 5: OPA Policy Design (Advanced)

Design OPA/Rego policies for the following scenarios:
1. Multi-tenant SaaS: users can only access resources within their tenant
2. Data classification: access based on user clearance level and data sensitivity
3. Time-based access: certain operations only allowed during business hours
4. Geographic restrictions: certain data can only be accessed from specific regions
5. Rate-based policies: deny if a user has made more than N requests in the last hour

Write the Rego policies and test them with example inputs.

---

## 14. Expert Insights

### 14.1 Common Mistakes Engineers Make

1. **"We're behind a firewall, we don't need service-to-service auth"**
   - The firewall is a single point of failure. Internal threats (compromised services, lateral movement) are a real and growing threat vector. Always authenticate service-to-service calls.

2. **"Let's put everything in the JWT"**
   - Bloated JWTs add latency (every request carries the token), increase bandwidth usage, and risk exposing sensitive data. Keep JWTs minimal — use claims for authorization decisions, not as a data transport mechanism.

3. **"We'll handle security later"**
   - Retrofitting security into an existing architecture is 10-100x more expensive than building it in from the start. Security is an architectural decision, not a feature.

4. **"Our API is internal, it doesn't need rate limiting"**
   - Retry storms from a buggy internal service can DDoS your system as effectively as an external attack. Rate limit all APIs, internal and external.

5. **"We rotate keys annually"**
   - Modern best practice is to rotate keys frequently (hours to days for service certificates, days to weeks for signing keys). Short-lived credentials limit the blast radius of compromise.

6. **"We use the 'none' algorithm for development"**
   - The JWT 'none' algorithm is a well-known attack vector. Never accept 'none' — validate the algorithm against an explicit allowlist.

7. **"Secrets in environment variables are secure"**
   - Environment variables can be leaked via process dumps, debug endpoints, error pages, and child processes. Use a proper secrets manager (Vault, AWS Secrets Manager).

### 14.2 Industry Lessons

**Netflix:** "Security must be automated and built into the deployment pipeline. Manual security reviews don't scale at Netflix's pace of deployment (thousands of deployments per day). We invest heavily in automated security tooling — static analysis, dependency scanning, runtime anomaly detection."

**Google:** "Zero trust was not a project with a completion date — it's an ongoing evolution. Even after 10 years, we're still finding new ways to improve trust evaluation and reduce our attack surface."

**Uber (post-breach):** "The most dangerous secrets are the ones you don't know about. Implementing comprehensive secrets scanning across all repositories, CI/CD systems, and developer machines is essential."

### 14.3 Scaling Pain Points

1. **JWKS endpoint as a hot path:** When every service validates JWTs by fetching the public key from the JWKS endpoint, this endpoint becomes critical infrastructure. Cache aggressively (but not too long for key rotation), use CDN, and have fallback mechanisms.

2. **OPA policy bundle distribution at scale:** With 1000+ services running OPA sidecars, distributing policy bundles efficiently becomes a challenge. Use a CDN or distributed cache for bundle distribution.

3. **Certificate management at scale:** Managing certificates for 10,000+ service instances requires full automation. Manual processes will fail. Invest in SPIFFE/SPIRE or service mesh from the start.

4. **Cross-region token validation:** In multi-region deployments, token validation must work even if the auth service's region is down. Pre-distribute JWKS and maintain regional token blacklists.

5. **Secret rotation coordination:** When a database password is rotated, all services using that password must be updated simultaneously. Dynamic secrets (Vault) solve this by giving each service instance its own short-lived credentials.

### 14.4 When NOT to Use These Approaches

- **Don't use mTLS if**: You have a simple monolith with no service-to-service calls. The complexity isn't justified.
- **Don't use OPA if**: Your authorization model is simple RBAC with a few roles. A database table with role assignments is sufficient.
- **Don't use JWT if**: You need immediate revocation for every token operation. Use opaque tokens with Redis instead.
- **Don't use zero trust if**: You're a 5-person startup. Focus on getting the basics right (TLS, proper auth, secrets management) before investing in zero trust infrastructure.
- **Don't use a service mesh if**: You have fewer than 10 services. The operational overhead of running Istio outweighs the benefits at small scale.

---

## 15. Chapter Summary

### Key Takeaways

- **Security in distributed systems is fundamentally different** from monolithic security due to expanded attack surfaces, multiple trust boundaries, and network-based communication.

- **Authentication** proves identity. Use the appropriate mechanism for the context:
  - API keys for simple service identification
  - JWT/OAuth for user-delegated access
  - Certificates/mTLS for strong service identity
  - MFA for sensitive operations

- **Authorization** determines permissions. Choose the right model:
  - RBAC for stable, role-based structures
  - ABAC for dynamic, context-dependent access
  - Policy engines (OPA) for complex, cross-cutting policies

- **OAuth 2.0** is the standard for delegated authorization. Use Authorization Code + PKCE for all client types. Client Credentials for service-to-service. Never use the implicit grant.

- **JWT** provides stateless, verifiable tokens but has trade-offs:
  - Use asymmetric signing (RS256, ES256) for public-facing APIs
  - Keep tokens small and short-lived
  - Implement a revocation strategy (blacklist, short TTL, versioning)
  - Validate everything: signature, expiry, issuer, audience, algorithm

- **mTLS** provides strong mutual authentication:
  - Essential for zero trust architectures
  - Automate with service mesh (Istio, Linkerd) or SPIFFE/SPIRE
  - Use short-lived certificates with automated rotation

- **Zero Trust** eliminates implicit trust:
  - Never trust, always verify
  - Use least privilege access
  - Assume breach, minimize blast radius
  - Google BeyondCorp is the reference implementation

- **API Security** requires defense in depth:
  - Rate limiting (token bucket algorithm)
  - Input validation and sanitization
  - OWASP API Top 10 awareness
  - WAF and DDoS protection

- **Secrets management** is non-negotiable:
  - Use HashiCorp Vault or cloud-native solutions
  - Dynamic secrets eliminate shared, long-lived credentials
  - Never hardcode, commit, or share secrets insecurely

- **Encryption** must be comprehensive:
  - In transit: TLS 1.3 everywhere
  - At rest: Envelope encryption with cloud KMS
  - Key management: HSM-backed, automated rotation

- **Observability** is essential for security:
  - Structured security event logging
  - Metrics for all auth/authz operations
  - Distributed tracing with security context
  - Alerting for anomalies and policy violations

- **Security is not a feature — it's a property of the entire system.** Every design decision, every API, every data flow must be evaluated through a security lens.

---

*"The only truly secure system is one that is powered off, cast in a block of concrete, and sealed in a lead-lined room with armed guards — and even then I have my doubts." — Gene Spafford*

---

### Further Reading

1. **"BeyondCorp: A New Approach to Enterprise Security"** — Google (2014)
2. **"Zero Trust Networks"** — Evan Gilman & Doug Barth (O'Reilly)
3. **OWASP API Security Top 10** — owasp.org
4. **RFC 6749** — The OAuth 2.0 Authorization Framework
5. **RFC 7519** — JSON Web Token (JWT)
6. **RFC 8705** — OAuth 2.0 Mutual-TLS Client Authentication
7. **SPIFFE Specification** — spiffe.io
8. **"Securing Microservices"** — Netflix Technology Blog
9. **HashiCorp Vault Documentation** — vaultproject.io
10. **NIST Special Publication 800-207** — Zero Trust Architecture
