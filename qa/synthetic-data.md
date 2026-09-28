# Synthetic staging data specification
Staging only. Prefix fixtures with `qa-`. Required fixture families: users, operators, admins, stations, reports, favourites, claims, marketplace listings, providers, service enquiries, trips and notification subscriptions.
Use deterministic seeded identifiers and cleanup. Include dense-city, sparse-interstate, pagination and PostGIS-nearest-neighbour distributions. Never copy production PII or user location histories. Synthetic writes/load wait for L1C staging.
