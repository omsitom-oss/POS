# Company profile

The customer POS database now has a dedicated single-row `dbo.CompanyProfile` table. It carries the legacy `SettingsCompanyProfile` report fields: company name, address, two phone fields, mobile, fax, email, website, and logo. The profile is separate from generic `SettingTypes`/`Settings` because it is report and invoice configuration.

Migration 004 creates the row with `CompanyProfileId=1`. The logo is stored as Base64 text in `LogoBase64` with its MIME type in `LogoContentType`; supported formats are PNG, JPEG, WEBP, and GIF, with a 5 MB source limit. The API is `GET /api/company-profile` and `PUT /api/company-profile`. The React Company Profile screen is opened from the Settings home card and stores the values through the .NET service. Reports should read this server-side profile rather than accepting company identity or logo data from a client request.
