# Interim UI retirement audit

User priority2026-10-11: after click feedback/Examine corrections, restore original interactions for actions available only through interim controls, then remove redundant windows. Do not preserve a scaffold because tests happen to use it. Do not delete an action until its original route is verified. Mobile and audiovisual enhancement remain excluded.

Current evidence from src/ui/FarmView.tsx and the referenced components:

| Interim surface | Current replacement / remaining audit |
| --- | --- |
| Farm controls (FarmNavigation) | Navigation only. Planner, land, new field, supplies, roads and loans have Schedule/Map/Plant/Buy/palette/Bank counterparts. Remove after routing its remaining entry points directly and migrating tests to real controls. |
| Edit tools | Mixes scenario/debug selectors, zoom/centering and interim window launchers. New Game, Map, original menus and palette replace much of it; separate necessary view controls from debugging scaffolding before retirement. |
| Land purchase / New field (LandPanel) | Original Map Property already dispatches buy-land/sell-land; Plant dispatches create-field. These are redundant gameplay forms, not reasons to retain an exclusive action. |
| Field information (FieldPanel/FieldCare) | Direct plant-field, harvest-field and treat-field orders plus field selection. Spray covers treatments; Schedule covers planning. **First replacement audit:** trace original immediate replant/harvest routing and establish the corresponding original controls before removing these direct-order paths. Do not equate future calendar orders with immediate commands without evidence. |
| Edit object / action window | Hosts building, removal, networks, irrigation, equipment and supply movement and shops. Buy/palette/Move/Examine replace many paths. Audit command-by-command; useConstruction already handles existing valve/gate toggles. Source gestures, not the old forms, are the intended interface. |
| Machinery / Livestock | Interim inventories and notices with purchase/move/sale/locate actions. Buy/Move/Sell/Examine cover core object operations; verify location/selection and relevant original messages before removal. |
| Tax details / Disaster details | Primarily diagnostic summaries around original Balance/Disasters interactions; review for any exclusive action, then retire or move debugging information out of gameplay. |
| Audio and tools / Game files | Transitional access wrappers. Menus already expose primary audio/load/save; native volume/file-error handling needs a deliberate accessible home. |

Examine's Object actions shortcut is removed. Its supported building interior toggle stays available. No broader window deletion is claimed in this audit. Full preservation remains incomplete, and the original action evidence in subsystem documents remains authoritative.
