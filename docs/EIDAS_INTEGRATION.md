# eIDAS/EUDI Wallet Integration for Eulesia

## Overview

Eulesia is designed with European Digital Identity (EUDI) Wallet integration as a core architectural principle. This document outlines the integration strategy, technical requirements, and implementation roadmap for eIDAS 2.0 and EUDI Wallet support.

## Background

### eIDAS 2.0 Regulation

The revised eIDAS Regulation (eIDAS 2.0) mandates that all EU member states provide their citizens with a EUDI Wallet by 2026. Key aspects:

- **Universal Availability**: All EU citizens will have access to a digital identity wallet
- **Cross-border Recognition**: Identity verified in one member state must be recognized across the EU
- **High Level of Assurance**: EUDI provides "high" level identity assurance under eIDAS

### EUDI Wallet Capabilities

The EUDI Wallet will support:
- **Personal Identification Data (PID)**: Name, date of birth, nationality
- **Electronic Attestation of Attributes (EAA)**: Additional verified claims
- **Qualified Electronic Signatures**: Legally binding digital signatures
- **Age Verification**: Without revealing exact date of birth
- **Pseudonymous Authentication**: Unique identifiers without revealing full identity

## Integration Architecture

### Authentication Flow

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│   Eulesia   │    │    Verifier   │    │ EUDI Wallet   │    │  Identity   │
│   Frontend  │───▶│    Backend    │───▶│  (User App)   │───▶│  Provider   │
└─────────────┘    └──────────────┘    └───────────────┘    └─────────────┘
       │                  │                    │                    │
       │  1. Auth Request │                    │                    │
       │─────────────────▶│                    │                    │
       │                  │  2. Create Session │                    │
       │                  │  + Generate URI    │                    │
       │  3. Return URI   │                    │                    │
       │◀─────────────────│                    │                    │
       │                  │                    │                    │
       │  4. Deep Link    │                    │                    │
       │──────────────────────────────────────▶│                    │
       │                  │                    │  5. Request PID    │
       │                  │                    │───────────────────▶│
       │                  │                    │                    │
       │                  │                    │  6. Issue VP       │
       │                  │                    │◀───────────────────│
       │                  │  7. Present VP     │                    │
       │                  │◀───────────────────│                    │
       │                  │                    │                    │
       │                  │  8. Verify VP      │                    │
       │  9. Issue Token  │                    │                    │
       │◀─────────────────│                    │                    │
```

### Data Model Extensions

Eulesia's user model already supports eIDAS identity levels:

```typescript
interface User {
  id: string
  identityVerified: boolean
  identityProvider: 'magic_link' | 'eudi' | 'institutional'
  identityLevel: 'basic' | 'substantial' | 'high'

  // EUDI-specific fields (when available)
  eudiSubjectId?: string        // Unique, stable identifier
  eudiVerifiedAt?: Date         // When identity was last verified
  eudiClaims?: {
    givenName?: string
    familyName?: string
    dateOfBirth?: string        // ISO 8601
    nationality?: string[]      // ISO 3166-1 alpha-2
    ageOver18?: boolean         // Age attestation
  }
}
```

### Trust Framework

Eulesia will implement a trust framework that:

1. **Accepts** EUDI Wallets from all EU member states
2. **Verifies** credentials against the EU Trust List
3. **Validates** revocation status of credentials
4. **Logs** authentication events for audit purposes (privacy-preserving)

## Implementation Phases

### Phase 1: Preparation (Current)
- [x] Design user model with eIDAS identity levels
- [x] Implement magic link as transitional authentication
- [x] Build UI that communicates verified identity concept
- [ ] Register as a Relying Party in pilot programs

### Phase 2: Pilot Integration (2025)
- [ ] Join EU EUDI Wallet pilot program
- [ ] Implement OpenID4VP (Verifiable Presentations)
- [ ] Integrate with test wallets
- [ ] Conduct security audit

### Phase 3: Production Rollout (2026)
- [ ] Connect to production EUDI infrastructure
- [ ] Implement credential refresh flows
- [ ] Add support for additional attestations
- [ ] Enable cross-border authentication

## Technical Requirements

### Backend Requirements

1. **OpenID4VP Support**
   - Implement OpenID for Verifiable Presentations protocol
   - Support SD-JWT format for credentials
   - Handle multiple credential formats

2. **Trust Services**
   - EU Trust List integration
   - Certificate validation
   - Revocation checking (OCSP/CRL)

3. **Security**
   - Secure session management
   - Replay attack prevention
   - Audit logging

### Frontend Requirements

1. **Wallet Invocation**
   - Deep link support for wallet apps
   - QR code generation for cross-device flows
   - Same-device flow handling

2. **User Experience**
   - Clear consent dialogs
   - Progress indicators
   - Error handling

### Dependencies

```json
{
  "eudi-dependencies": {
    "@eu-digital-identity-wallet/openid4vp": "^1.0.0",
    "@eu-digital-identity-wallet/sd-jwt": "^1.0.0",
    "@eu-digital-identity-wallet/trust-list": "^1.0.0"
  }
}
```

*Note: Package names are placeholders - actual packages will be determined as EUDI ecosystem matures.*

## Privacy Considerations

### Data Minimization

Eulesia will only request the minimum necessary attributes:
- **For registration**: Given name, family name (for display)
- **For age-restricted content**: Age over 18 attestation only
- **For municipal features**: Residence claim (if available)

### Pseudonymous Options

Where possible, Eulesia will:
- Use opaque subject identifiers rather than PII
- Support pseudonymous participation in discussions
- Allow users to control what identity information is displayed

### Data Retention

- EUDI claims are cached only for active sessions
- Full PID is not stored permanently
- Only verified identity level is retained

## Regulatory Compliance

### eIDAS 2.0 Compliance

As a relying party, Eulesia must:
- Only request attributes with user consent
- Display clear purpose statements
- Support credential revocation
- Maintain audit trails

### GDPR Compliance

- Implement data subject rights (access, deletion, portability)
- Conduct Data Protection Impact Assessment
- Maintain records of processing activities

## Testing Strategy

### Sandbox Testing

1. **EU Reference Implementation**
   - Use EU's reference wallet for development
   - Test with synthetic identities

2. **Member State Pilots**
   - Participate in national pilot programs
   - Test cross-border scenarios

### Integration Tests

```typescript
describe('EUDI Authentication', () => {
  it('should accept valid EUDI presentation')
  it('should reject expired credentials')
  it('should handle revoked credentials')
  it('should support cross-border authentication')
})
```

## Resources

### Official Documentation
- [EU Digital Identity Wallet Architecture](https://eu-digital-identity-wallet.github.io/)
- [eIDAS 2.0 Regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1183)
- [OpenID for Verifiable Presentations](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)

### Technical Resources
- [SD-JWT Specification](https://datatracker.ietf.org/doc/draft-ietf-oauth-selective-disclosure-jwt/)
- [EU Trust List Browser](https://eidas.ec.europa.eu/efda/tl-browser/)

### Community
- [EU Digital Identity Wallet GitHub](https://github.com/eu-digital-identity-wallet)
- [OpenID Foundation](https://openid.net/)

## Timeline

| Phase | Timeline | Milestones |
|-------|----------|------------|
| Preparation | Q1-Q2 2025 | Register as RP, complete documentation |
| Pilot | Q3-Q4 2025 | Join pilot, implement integration |
| Testing | Q1 2026 | Security audit, performance testing |
| Production | Q2 2026 | Go-live with EUDI support |

## Conclusion

Eulesia's architecture is designed from the ground up to support European Digital Identity. The current magic link authentication serves as a transitional solution while maintaining the UX patterns and identity concepts that will seamlessly transition to EUDI Wallet when available.

The verified identity model—one person, one account—is fundamental to Eulesia's civic infrastructure vision, and EUDI provides the technical foundation to make this a reality across Europe.
