# McLaren Canadian source research

Research status on October 26, 2026 UTC: Canadian presence and anonymous
configuration access are verified; an app import and full national lineup/trim
reconciliation remain open. McLaren is absent from the current NRCan snapshot.
See [the additional-make ledger](canadian-market-universe.json) for checksummed
receipts and unresolved work.

The current manufacturer navigation links five configurator profiles: Artura,
Artura Spider, 750S, 750S Spider and GTS. Each public landing response includes
Canada in the country list, accepts `country=CA`, returns country preference CA,
does not restrict Canada and sets `loginRequired=false`. These observations
establish public Canadian configuration selection; they do not assign a model
year, base MSRP, exact retail trim or complete Canadian offering universe.

The public configurator bootstrap currently loads
`/mclaren-ui/assets/index-8XucOWk-.js`, SHA-256
`27cec051d887efdaae7e5f57fc1545bc7ecf79cdd32f601ae7a1f73af679f540`.
Its native landing GET is `/configuration/ajaxLandingPageData.do` with
`profileName`, `country` and `language`. Ordinary browser selection of Canada
followed by **Configure from Base Model** starts an unsaved configuration with
`configCountry=CA`. The GTS and Artura initial responses confirm country CA,
public access and disabled `webui.showPriceSummary` and
`webui.showPricesByCountry` flags. No exact model-year assignment is established
by those profile metadata. Neither a calendar footer nor a first-delivery year
can supply one. No lead, saved build, account, reservation or order was submitted.

The official manufacturer Toronto page identifies a certified Canadian
new/pre-owned retailer. Its matching franchise inventory currently lists three
new references: two 2027 750S Spider vehicles and one 2026 GTS, all with pricing
on request. These are observed dealer stock years, not proof of the year for a
particular factory profile. Different indexed copies report different counts;
the dated captured response takes precedence for this observation. This is one
retailer's inventory, not a complete national stock count.

The manufacturer public website's live site list does not include `ca_en`.
An ordinary attempt at that locale renders a page-not-found state, while the
global Toronto retailer route works. A direct CMS GET without the site context
returns an invalid-origin error; the ordinary public website browser retrieves
the public retailer content successfully. These observations do not establish
absence of Canadian offerings or require an account.

Next work: normalize exact Canadian offering identities and model-year evidence;
review the current public model pages, limited/special models and every Canadian
retailer's new stock; distinguish base MSRP from configured quotes and incentives;
source exact technical facts; implement atomic source replay, validation and
coverage reporting. The five linked profiles are not an exhaustive denominator.
Original responses remain in the ignored raw cache; tracked records retain
receipt metadata and factual projections without session identifiers or full
marketing descriptions.
