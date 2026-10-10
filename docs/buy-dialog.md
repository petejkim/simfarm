# Original Buy catalog

Evidence uses SIMFARM.EXE SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`. Addresses below are hexadecimal file offsets; initialized DS6190 begins at846f0. Static analysis only; supplied files remain unchanged.

Descriptor DSb4a6 places Buy at128,96, size256×240, including a16-pixel title. Its nine linked controls begin at DSb490: previous5, next6, Buy9, Close10 and category12–16. Category order on screen is machinery, seeds, livestock, buildings, chemicals; livestock starts selected. Callback stub142e resolves to overlay24:02b2/file47b12. The dispatch table47f6c and wrap comparisons47fae..47fc9 establish the counterintuitive original up-arrow=next and down-arrow=previous ordering.

DSb516 contains six boundaries0,4,20,28,37,41. The41 words atb51e contain livestock161/162/163/160, seeds192..207, machinery0/1/2/3/4/5/7/8, buildings64..72 and chemicals220..223. Type6 is absent;8 is Crop Duster. Category callbacks47f16..47f59 select those ranges. The native seed category deliberately exposes all24 supplied crops, using actual CRP identities/photos instead of swapped sixteen-slot labels.

Archive resources:

| Resource | EEA offset / size | SHA-256 |
| --- | --- | --- |
| buywndo.bmp |193712 /28680|`892ce962a019d605a94106ed183c177b6a4b15c3267554275adf030df601cb37`|
| alltiles.btl |593168 /286900|`f77032c6726cc13c38adf15082c59babf0573724a8a0a01dc7a61d866e4dd502`|
| itemtext.dat |912662 /18929|`63469b3bf1adcf819b65b88b8d7d783f3ff7a0f82a38e9d6afc774b4b365db75`|

The bitmap is256×224. Import erases only PRICE/OWN/BUY/CLOSE caption interiors with palette12; React supplies all text. Loader4a202/4a21d seeks20+index×0xe02, reads an unknown word then3584 planar bytes for each112×64 photograph. All80 records are preserved; the unknown words receive no invented semantics. Text reader480ae seeks graphic×128. The supplied text includes irregular CRLF boundaries; raw physical bytes remain intact, with bounded128-byte display reads, padding removal and tilde line breaks.

Buy redraw47860 places the photograph at client48,8, description in48,96,112×112, price176,128 and count176,160. The sprite uses the definition's low graphic byte through the160-word table at **2be7:085e/file4f4be**, not the same offset in DS6190. It is centered at client212,40 using row-major16-pixel tiles and the848 masked-tile threshold. Native grass variation is deterministic decoration, leaving simulation RNG untouched. HTML font metrics/description wrapping and a scrollable text area are native adaptations.

BUY47bc6 checks the source gate;47c08 routes type8 to the aircraft path. Other products install footprint/definition state and Edit mode9 at47d7e/47e67. The native UI closes Buy, shows a footprint on the permanent Edit map and sends the existing canonical purchase command on a click; repeated clicks purchase repeatedly, Escape/Cancel stops placement. Aircraft uses the existing airport purchase command. Source repeat/drag/cancel event ordering remains incompletely traced; these explicit native gestures are not claimed as complete callback equivalence. Existing legacy tool panels remain transitional alternate access. Farming transactions, storage checks, finances, saves and timing are unchanged.

Validation pins executable descriptors, control links/dispatch, wrapping instructions, asset pixel boundaries, all80 photographs, truncated binaries and product definitions across all eight farms. Browser checks cover1× geometry, category wrap, all24 crop identities, nonmutating browsing, repeated purchases, rejected placement, cancellation and exact checkpoint agreement with simulation commands. No new original-game defect is established.
