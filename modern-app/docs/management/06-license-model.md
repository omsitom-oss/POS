# License model

`Licenses` records voucher/license history independently of customer identity. A customer can hold multiple historical licenses; `LicenseId`, `PublicId` and unique `LicenseCode` identify a license. A code is never a customer ID.

Statuses are `ISSUED`, `ACTIVE`, `EXPIRED` and `REVOKED`. `IssuedAt` and `ExpiresAt` are required, with a check that expiration is later than issuance. `ActivatedAt` is nullable until activation. Revocation requires `Status=REVOKED` and `RevokedAt`; other statuses must have `RevokedAt` NULL. Expiration must eventually be evaluated from `ExpiresAt` as well as stored status; status alone does not establish validity.

No billing, subscription/payment logic, license code generation, activation API or license UI is implemented in this phase. When codes are generated, use a cryptographically secure random generator. License rows reference Customers without cascade deletion so license history is retained.
