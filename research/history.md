# History, people and claims

**Date:** 2026-11-12. Read from Matthew Reed's TRS-80.org (`[reed-m1]`, `[reed-intro1]`, `[reed-intro2]`, `[reed-uc]`, `[reed-l1]`), Wikipedia's *TRS-80*, *Level I BASIC* and *Li-Chen Wang* (`[wp-trs80]`, `[wp-l1]`, `[wp-wang]`), the Computer History Museum (`[chm-*]`) and the Commons category. Keys are in [bibliography.md](bibliography.md). Where the sources disagree, the disagreement is kept, not resolved by choice. **Not yet read:** the period sources themselves (the 1977 press release, Radio Shack's 1977 annual report, *80 Microcomputing*, Lien's 1983 "A Look Back"); they are the next step for every claim marked *secondary*.

## 1. Timeline

| When | What | Sources |
|---|---|---|
| 1976 | Don French, a Radio Shack buyer who had bought an Altair, designs a computer in his own time and hires Steve Leininger (lately of National Semiconductor; Wikipedia says he was found working at a Byte Shop) in June 1976 | `[reed-intro1]`, `[wp-trs80]` |
| Dec 1976 – 2 Feb 1977 | Approval: Wikipedia has a first go-ahead in December 1976; the prototype, built by Leininger on breadboards around a Z80, is shown to Charles Tandy on 2 February 1977 and approved | `[reed-intro1]`, `[wp-trs80]` |
| 1977 | Level I BASIC: Leininger, French and David Lien adapt Li-Chen Wang's Palo Alto Tiny BASIC (Dr. Dobb's, May 1976); Leininger adds floating point, cassette, keyboard and video, doubling it to 4 KB | `[wp-l1]`, `[reed-l1]` |
| 3 Aug 1977 | Announced at a press conference at the Warwick Hotel, New York, on a day when FALN bombings took the headlines; shown at the Boston personal computer fair on 5 August | `[reed-intro2]`, `[wp-trs80]` |
| Sep – Dec 1977 | Deliveries begin: "began to fill orders in September" `[reed-intro2]` against "first units delivered in November, in stores the third week of December" `[wp-trs80]` | *conflict, open* |
| mid-1978 | Level II BASIC (Microsoft, 12 KB of ROM), the Expansion Interface (up to 48 KB, floppy controller, printer, RS-232), floppy drives (July 1978) | `[wp-trs80]`, `[reed-m1]` |
| 1978 | "100,000 computers in 1978" `[reed-m1]`; "well over 100,000" `[reed-intro2]`; "55,000 in its first year" `[wp-trs80]` | *conflict, open* |
| 1 Mar 1980 | Network I, a classroom link from a teacher's disk Model I to up to 16 student machines, $499 | `[reed-net1]` |
| mid-1980 | Model III announced (lower case, internal expansion, 1,500-baud cassette) | `[reed-m1]`, `[wp-trs80]` |
| end 1980 – Jan 1981 | Model I discontinued in the US: it could not meet the FCC's new rules on radio-frequency interference, in force from 1 January 1981; remaining stock sold out in January 1981; sales continued abroad | `[reed-m1]`, `[wp-trs80]` |

## 2. The people

| Person | Role | Note |
|---|---|---|
| **Don French** | Radio Shack buyer; "the originator of the TRS-80 project" `[reed-uc]` | Left in 1981 to found a software company `[wp-trs80]` |
| **Steve Leininger** | Designed almost all the hardware; wrote Level I BASIC | Chose the Z80 over the SC/MP, 6800 and 8080 `[reed-intro1]` |
| **Charles Tandy** | Head of Tandy Corporation; approved the prototype | Could not type his salary into the prototype's integer BASIC (16-bit, maximum 32,767), hence floating point in Level I `[wp-l1]` |
| **John Roach** | Vice-president of manufacturing; argued for building about one per store | Later CEO of Tandy `[wp-trs80]` |
| **Lewis Kornfeld** | Radio Shack president, sceptical of demand | `[wp-trs80]` |
| **David A. Lien** | Wrote the *User's Manual for Level I* (1977), praised for teaching people who had never seen a computer | `[reed-l1]`, `[reed-m1]` |
| **Li-Chen Wang** | Author of Palo Alto Tiny BASIC, on which Level I is based | `[wp-wang]` |
| **Van Chandler** | Head of the software applications group | `[reed-intro2]` |

## 3. Prices at launch

From `[reed-m1]`, the most detailed list, agreeing with `[wp-trs80]` on the headline figures:

| Catalogue no. | What | Price |
|---|---|---|
| 26-1001 | The computer: keyboard unit with power supply | $399.95 |
| 26-1201 | 12-inch Video Display | $199.95 |
| 14-841 | Realistic CTR-41 cassette recorder | $49.95 |
| 26-1051 | The complete system, Level I, 4 KB (the one almost everyone bought) | $599.95 (later $499) |
| 26-1120 | Level II BASIC upgrade kit | $120 (`[wp-trs80]`, from its summary only: $199; *open*) |

For comparison `[reed-uc]`: the Apple II cost $1,298. The original target price was $199, later raised to $399 `[reed-uc]`.

## 4. Claims to check, and what we found

| Claim | Verdict so far |
|---|---|
| **"Tandy expected to sell only 1,000"** | Partly true and often simplified. Leininger and French proposed 50,000; management thought 1,000 reasonable `[reed-intro2]`, `[wp-trs80]`; the first run was set at about 3,000 (one per store) `[reed-intro2]` or 3,500 `[wp-trs80]`, so that unsold machines could be used in the stores' own accounts. |
| **"It sold 10,000 in the first month"** | `[reed-uc]`, close to `[wp-trs80]`'s "over 10,000 in the first 1.5 months"; the pre-orders were reported as 10,000 `[reed-intro2]` against a 250,000-name waiting list `[wp-trs80]`. *Needs a period source.* |
| **"The best-selling computer of its day"** | Plausible for 1977–1979 (over 100,000 by 1979; Radio Shack claimed "almost 70 %" of the 1977 market `[reed-intro2]`). The lesson should say "one of the best-selling", citing figures with their sources. |
| **"One of the first fully assembled personal computers"** | True, with the PET and the Apple II: the "1977 Trinity" (BYTE's phrase, `[wp-trs80]`). Not "the first". |
| **"Upper case only to save money"** | True: lower case needed one more 2102 RAM chip in the video memory (seven, not eight); the saving was $1.50 in parts, $5 at retail `[reed-uc]`, `[wp-trs80]`. The circuit consequence is exact and checkable (see [how-it-worked.md](how-it-worked.md), §3). |
| **"Trash-80"** | Real, and disliked by Tandy `[wp-trs80]`. Its cause (the Expansion Interface's unreliable connectors, the keyboard bounce, the RF interference) is folklore to be sourced, not taught as fact. |
| **"Killed by the FCC"** | True in substance: the Model I could not meet the RF-interference rules of 1 January 1981, and Tandy judged a redesign too costly `[reed-m1]`, `[wp-trs80]`. A nice side story: an AM radio beside it could play its "music". |
| **"Level I is public-domain Tiny BASIC"** | Half true. It *derives* from Wang's Palo Alto Tiny BASIC, which carried "@COPYLEFT ALL WRONGS RESERVED" (10 June 1976) and was shared freely `[wp-wang]`; Reed calls it public domain `[reed-l1]`, Wikipedia's Wang article says there was no formal licence. Leininger removed about 60 % of Wang's code and doubled the size `[wp-l1]`, so most of the ROM is Tandy's work. |
| **Clock speed** | 1.774 MHz `[wp-trs80]` (Reed: 1.77; Wikipedia body: 1.78). The precise figure, 10.6445 MHz ÷ 6 = 1.77408 MHz, is from the RetroStack reference `[rs-info]`; to be confirmed in the Technical Manual. |

## 5. Software of the time

- **At launch** `[reed-m1]`: five Level I cassettes: the Game Package (Blackjack and Backgammon, included with the computer), Payroll, Math 1 (education), Kitchen (later Home Recipe) and Personal Finance.
- **Scott Adams's *Adventureland*** (1978), written on a 16 KB Model I, widely called the first commercial adventure game for a home computer; the first order came from a Chicago-area Radio Shack (50 copies); sold through *SoftSide* from January 1979 at $24.95. Still commercial (licence to check), so a candidate for the showcase rather than for shipping.
- **Lien's manual** taught BASIC through the machine's own graphics (`SET`, `RESET`, `POINT`). A scan is on the Internet Archive (`Level_1_Users_Manual_1977_David_Lien`, to confirm).

## 6. What survives

The Model I is common: museums hold many (Computer History Museum, at least three Video Displays and computers; Smithsonian NMAH 334337; Science Museum Group; Heinz Nixdorf MuseumsForum; Computerspielemuseum), and working ones are bought and restored today. The RetroStack project rebuilds the boards from scratch. There is no shortage of objects to photograph or measure; the open question is only licences.
