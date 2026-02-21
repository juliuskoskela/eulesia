# EUDI Wallet Integration

This document describes Eulesia's planned integration with the European Digital Identity (EUDI) Wallet ecosystem for citizen authentication.

## Overview

Eulesia will support two authentication methods:

1. **Email Magic Link** (current) - Basic identity verification
2. **EUDI Wallet PID** (planned) - Strong identity verification via European Digital Identity

EUDI Wallet provides a standardized way for European citizens to prove their identity across all EU member states, using a government-issued Personal Identification Data (PID) credential.

## Architecture

### Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Eulesia   │────▶│ EUDI Wallet  │────▶│ PID Issuer      │
│   (RP)      │◀────│ (User's)     │◀────│ (Government)    │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                    │
       │   OpenID4VP        │
       │   Presentation     │
       └────────────────────┘
```

1. User clicks "Login with EUDI Wallet"
2. Eulesia (as Relying Party) creates a presentation request
3. Wallet shows user what data Eulesia wants (minimal: name)
4. User approves, wallet creates signed presentation
5. Eulesia verifies the presentation and PID issuer trust chain
6. User is authenticated with verified identity

### Identity Levels

| Level         | Method           | Verification                        |
| ------------- | ---------------- | ----------------------------------- |
| `basic`       | Email magic link | Email address verified              |
| `substantial` | Bank ID (legacy) | Government ID via bank              |
| `high`        | EUDI Wallet PID  | eIDAS LoA High, cryptographic proof |

## Technical Implementation

### OpenID4VP (Verifiable Presentations)

Eulesia acts as an OpenID4VP Relying Party (verifier). Key components:

#### 1. Presentation Request

```typescript
interface PresentationRequest {
  // Request only what we need (data minimization)
  requested_credentials: [{
    format: 'mso_mdoc' | 'vc+sd-jwt',
    doctype: 'eu.europa.ec.eudi.pid.1',
    claims: {
      'given_name': { essential: true },
      'family_name': { essential: true },
      // Optional: birth_date for additional verification
    }
  }],
  client_id: 'https://eulesia.eu',
  response_uri: 'https://api.eulesia.eu/api/v1/auth/eudi/callback',
  nonce: crypto.randomUUID(),
  state: crypto.randomUUID()
}
```

#### 2. Verification Process

```typescript
async function verifyEudiPresentation(
  presentation: Presentation,
): Promise<VerifiedIdentity> {
  // 1. Verify presentation signature
  const isSignatureValid = await verifyPresentationSignature(presentation);

  // 2. Verify PID issuer is trusted (via EU Trust List)
  const issuer = extractIssuer(presentation);
  const isTrustedIssuer = await verifyIssuerTrust(issuer);

  // 3. Check credential not revoked
  const isNotRevoked = await checkRevocationStatus(presentation);

  // 4. Extract verified claims
  if (isSignatureValid && isTrustedIssuer && isNotRevoked) {
    return {
      givenName: presentation.claims.given_name,
      familyName: presentation.claims.family_name,
      identityLevel: "high",
      verifiedAt: new Date(),
      issuerCountry: issuer.country,
    };
  }

  throw new Error("Verification failed");
}
```

### Data Minimization

Following GDPR and ARF principles, Eulesia requests only:

- `given_name` (etunimi)
- `family_name` (sukunimi)

We do NOT request:

- Birth date (unless required for specific services)
- National ID number
- Address
- Other personal data

### Trust Framework

Eulesia verifies PID credentials against the EU Trust List:

- Each member state registers its PID issuers
- Issuers have certificates signed by national root
- National roots are in the EU-wide trust list

## Database Schema Extensions

```sql
-- Add EUDI-specific fields to users
ALTER TABLE users ADD COLUMN eudi_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN eudi_issuer_country varchar(2);
ALTER TABLE users ADD COLUMN eudi_verified_at timestamp;
ALTER TABLE users ADD COLUMN eudi_subject_id varchar(255); -- For linking presentations

-- Store verification audit log
CREATE TABLE eudi_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  issuer_country varchar(2) NOT NULL,
  claims_requested jsonb NOT NULL,
  verification_status varchar(20) NOT NULL,
  created_at timestamp DEFAULT now()
);
```

## API Endpoints

### POST `/api/v1/auth/eudi/start`

Initiate EUDI Wallet authentication.

**Response:**

```json
{
  "success": true,
  "data": {
    "requestUri": "openid4vp://authorize?...",
    "qrCode": "data:image/png;base64,...",
    "sessionId": "uuid"
  }
}
```

### POST `/api/v1/auth/eudi/callback`

Handle wallet response.

### GET `/api/v1/auth/eudi/status/:sessionId`

Poll for authentication status (while waiting for wallet).

## Testing Strategy

### Phase 1: Reference Implementation Testing

Use EU Commission's Launchpad testing tools:

- Test against reference wallet implementations
- Verify conformance to OpenID4VP spec

### Phase 2: Peer-to-Peer Testing

- Connect with other Launchpad participants
- Test cross-border scenarios (FI wallet → Eulesia)

### Phase 3: Pilot Wallets

- Finnish national wallet pilot
- Other LSP consortium wallets

## Implementation Timeline

### Now (2024-2025)

- [x] Email magic link authentication
- [ ] EUDI integration architecture design
- [ ] Launchpad registration

### Q1 2025

- [ ] OpenID4VP RP implementation
- [ ] Reference implementation testing

### Q2 2025

- [ ] Peer-to-peer interoperability testing
- [ ] UI/UX for wallet login flow

### 2026+

- [ ] Integration with production PID issuers
- [ ] RP access certificate from national registry

## Code Structure

```
apps/api/src/
├── routes/
│   ├── auth.ts              # Existing auth routes
│   └── eudi.ts              # EUDI-specific routes
├── services/
│   ├── email.ts             # Email service
│   └── eudi/
│       ├── index.ts         # EUDI service
│       ├── openid4vp.ts     # OpenID4VP request/response
│       ├── verification.ts  # Credential verification
│       └── trust-list.ts    # EU Trust List client
└── middleware/
    └── auth.ts              # Updated for EUDI sessions
```

## Dependencies

```json
{
  "@sphereon/oid4vci-client": "^0.x",
  "@sphereon/ssi-types": "^0.x"
  // Or use direct OpenID4VP implementation
}
```

## Security Considerations

1. **Replay Protection**: Nonce in every request
2. **Session Binding**: Link presentation to session
3. **Trust Verification**: Always verify against EU Trust List
4. **Audit Logging**: Log all verification attempts
5. **Data Minimization**: Request only needed claims

## Resources

- [EUDI Wallet ARF](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework)
- [OpenID4VP Specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [EUDI Wallet Launchpad](https://europa.eu/digital-identity-wallet/)
- [PID Rulebook](https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework)

## Glossary

| Term  | Description                                     |
| ----- | ----------------------------------------------- |
| ARF   | Architecture and Reference Framework            |
| eIDAS | Electronic Identification and Trust Services    |
| LoA   | Level of Assurance                              |
| PID   | Personal Identification Data                    |
| RP    | Relying Party (service requesting verification) |
| VP    | Verifiable Presentation                         |
| VCI   | Verifiable Credential Issuance                  |
