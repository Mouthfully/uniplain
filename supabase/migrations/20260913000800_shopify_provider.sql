-- Shopify: the connector the site has been selling since it shipped.
--
-- TWO ENUMS MOVE TOGETHER IN ONE MIGRATION, for the reason `20260913000300_loyverse_provider.sql`
-- sets out at length: `shopify` is both a SOURCE (the envelope carries rows from it) and a PROVIDER
-- (a merchant authorises a connection to it), those are different enums watched by different
-- guards, and splitting them across two migrations would let one ship without the other. A source
-- with no provider is a connector nobody can connect; a provider with no source is a connection
-- whose rows the envelope refuses.
--
-- WHY THIS ONE WAS URGENT RATHER THAN NEXT. `apps/web/app/connectors/shopify/page.tsx` has existed
-- since the site shipped: a full landing page, with a heading, a feature grid and a connect button,
-- for a platform that appeared in neither of these enums, in no source list, in no provider list
-- and in no connector directory. A merchant who followed it reached a form that could not have
-- stored what they gave it. Of every false claim on that site this was the worst kind, because it
-- ended in a button.
--
-- APPEND-ONLY, NEVER INSERTED. PostgreSQL orders an enum by definition order and `add value` with
-- no `before`/`after` appends, which is what both guards compare against the tail of the TypeScript
-- list. Adding `before`/`after` would silently rewrite every `order by` on either column.
--
-- NO `if not exists`, for the reason the Loyverse migration gives: a re-run that finds the member
-- already present means this migration has been applied twice, and that is worth failing on rather
-- than absorbing.

-- The source: `packages/contract/src/source.ts` SOURCES, last member.
alter type app.envelope_source add value 'shopify';

-- The provider: `packages/connections/src/connections.ts` PROVIDER_LANES, last key.
--
-- ITS LANE IS `oauth` AND ONLY `oauth`, and unlike Loyverse that is not a refusal of an alternative
-- -- it is the only lane Shopify offers a third-party app at all. A merchant CAN mint a custom-app
-- access token in their own admin, which would land in the existing `bearer` lane, and that token's
-- scopes are chosen by the merchant on a screen this product does not control. Offering it would
-- mean the same connector sometimes satisfies the read-only pillar and sometimes only promises to,
-- which is the argument `PROVIDER_LANES.loyverse` already makes. So no lane is added here and none
-- is needed.
alter type app.connection_provider add value 'shopify';
