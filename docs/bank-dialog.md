# Original Bank terminal

Evidence uses the supplied `SIMFARM.EXE`, SHA-256 `8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce`, DS6190 at file846f0. Analysis is static; no DOS/x86 code runs.

## Window and artwork

Windows dispatch3e976..3e97c opens descriptor DSb32a through24e6:1028. Its position is176,96 and size288×240; the client begins below a16-pixel title. DSb15c is `BANK`; DSb161 is `bankterm.bmp`. That archive resource is at67344, length32264, SHA-256 `0808f7e390e8bbae23828204134dbd12ce840af994457f656b44ed647bd8b0f9`. Its bitmap header is `24 00 e0 00 04 00 01 00`, giving288×224 four-plane pixels. The native title/frame and artwork use1× source dimensions.

Import writes a separate ignored `bank-terminal.png`. `BANK_TEXT_MASKS` removes only label and key-caption interiors with source palette14 (terminal) or12 (keys); all other artwork pixels remain identical. Original resources are never changed. Titles, captions, keypad digits, labels, values and Help text are HTML/React. Palette/bevels and surrounding terminal decoration remain source artwork. Replacement font metrics are not claimed identical to the DOS font.

## Controls and displayed accounts

The linked22-byte control descriptors begin at DSb314, reached from Bank descriptor+30. For each node, +2/+4 are window-relative x/y, +6/+8 width/height, +a callback ID, +c type8, +12/+14 the next far pointer. The live chain contains15 controls, ends atb19e and omits the three separate grouping descriptors. Subtract16 from the window y to locate each control in the bitmap.

| IDs | Controls | Bitmap bounds |
| --- | --- | --- |
| 1/2/3 | C / 0 / ? | x96, y152/184/168,16×16 |
| 4–12 | 1–9 | x48/64/80, y184/168/152,16×16 |
| 13 | OK |144,176,40×24 |
| 17 | CLOSE |184,176,48×24 |
| 18 | REPAY |144,152,88×24 |

Callback472aa reads ID at47322 and selects the18-entry table4769a (overlay base46e90). ID1 clears the selection at4733f..47344;2 appends zero at47367;3 displays Help at47406..47485;4–12 append ID-3 at474a7..474c2;13 confirms at47533..4756b;17 closes at475f7..4760b;18 repays the entire loan at47623..47687. IDs14–16 only redraw and are not live visible buttons. Digits clamp against collateral credit and the cash cap. The zero-key cash-cap discrepancy is retained as SF-155, not reproduced by the browser.

Keyboard callback46eae..47023 accepts digits, period to clear, and Enter to confirm. A nonzero successful confirmation clears the selection but leaves Bank open; zero OK closes it (46fd6..4701a /47577..475bb). Native direct entry, Backspace and focus navigation supplement those original controls. Close cancels an unsubmitted draft without altering the farm. The draft starts from the retained loan selection on farm load and is then UI state, while all financial commands and accounts remain in GameSimulation. This is not a new serialization of in-progress editor input.

Refresh47028 calls the original collateral limit. The native snapshot now exposes that read-only collateral figure separately from the cash-capped entry allowance, without overwriting the saved cached credit. Draw calls place cash at client(192,24), principal at(192,40), credit at(192,56), rate at(192,72), existing scheduled payment at(192,88), and selected amount at(176,128). The artwork calls these Cash Available, Total Debts, Credit Limit, Interest Rate, Quarterly Payment and Loan Amount. Total Debts reads principal only, not tax debt or overdue installments. Quarterly Payment is the existing scheduled amount, not a quote for a draft loan; actual collections remain January/March/July/October. See [finances.md](finances.md) and retained SF-074 for the separate arrears after payoff.

`bankhelp.bmp` is at archive99608, length4488, SHA-256 `d788be1b7e353c5eee1be5990bd1288d717335ea3c8cebff410de0d8fd3a9ee6`, dimensions224×40. The original help draw adds32,120 to the window origin at47429..4743c. Native Help uses HTML at bitmap32,104, with the same three captions. A click toggles it, replacing the DOS held-button loop. Supplemental feedback/arrears explanations below the terminal and accessible installment previews are native affordances. Window dragging and original wooden titlebars are now implemented; see window-titlebars.md. Original pressed-state raster feedback, computer-beep routing and the complete DOS window event lifecycle remain unfinished; existing native pause/time policy is unchanged.

Source tests pin the full control chain, dispatch destinations, artwork/hash, all pixels outside caption masks and invalid binary boundaries. Browser tests exercise source-sized geometry, keypad/keyboard entry, borrowing/payoff, credit limits, Help, zero OK, cancellation, save/load, launchers and missing-asset failure.

2026-10-11 user follow-up: the interim feedback area below this window was removed; outcomes show through the source controls, readouts and Funds. See progress.md.

## Rebuilt in CSS on shared chrome (2026-10-12)

User request (ui-components.md). The terminal is no longer `bank-terminal.png` with text and transparent keys over it. It is a framed `GameWindow` around a 272×216 client built from CSS panels that follow the source's structure:
- **Bezel and recess:** a 2px raised bezel, then an 8px sunken recess.
- **Screen:** a 4px black, rounded-cornered dark screen (palette 14) with green (palette 9) monospace readouts on the source rows. A green-outlined box holds interest rate and quarterly payment, followed by the prompt and the green-outlined LOAN AMOUNT field. Help replaces the prompt and amount rows with the source's three-cell legend.
- **Ledge and bay:** a light ledge with white/grey edges, then a black-bordered dark keypad bay. Its 4×3 keypad (7 8 9 C / 4 5 6 ? / 1 2 3 0) and REPAY / OK / CLOSE are shared `BevelButton`s with HTML captions.

Proportions are approximate (user rule: not pixel-perfect). Key ids, labels and the source switch semantics are unchanged.

`bank-terminal.png` is no longer loaded at runtime, and the 2026-10-14 [asset cleanup](generated-assets.md) removes its unused export. Raw source bytes, mask constants and decoder tests remain as preservation evidence; its browser missing-asset test was removed.
