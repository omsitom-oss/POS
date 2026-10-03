# Dedicated location tables

The Locations card remains part of Settings navigation, but location data no longer uses generic `Settings` rows. POS migration 003 creates `Countries` and `Cities`; `Cities.CountryId` references `Countries.CountryId` with no cascade delete. Both tables store Arabic and English names, active status, UTC timestamps, and system-managed sort order.

The existing four generic `LOCATION` rows were intentionally removed before migration 003 because their values could not be safely classified without guessing. The `LOCATION` SettingType remains as the stable card entry point. The backend exposes `/api/locations/countries` and `/api/locations/countries/{countryId}/cities`; the React Locations screen presents those dedicated records as an expandable country/city tree and uses the shared modal/action design.
