# Director feedback on the prototypes

Feedback collected by the product owner while showing the static prototypes
(`public/prototypes/`) to the director. Answers are kept in the director's words (Catalan),
with the decision they imply for the real app.

## Round 1: Saldos (vacation and AP balances)

| Question | Answer | Implication |
|---|---|---|
| Overall | "M'agrada, ho faria servir." | The balances view is the right shape. |
| Are these the numbers you check every day? | "Sí, és la informació que necessito portar al dia." | Keep exactly: vacation days to plan (with AA), AP no recuperables (24 h, 5 days), AP recuperables, calendar surplus. |
| Hours as 3:45 or 3,75? | "Deixa-ho així, ja anirem provant-ho." | Accept both formats for now. |
| Deduct AP recuperables from the surplus automatically? | "Sí, si no se'n té, que el negatiu pugui pujar." | Never block an AP recuperable for lack of surplus; let the balance go (further) negative. |
| How do people return owed hours today? | "Quan hi ha necessitat de treball se li demana que retorni hores." | Returning hours is ad hoc, on the director's request. Open question: record returned hours in the app so the surplus goes back up. |
| Both Houses at once or one at a time? | "Una per una." | Keep one House at a time (already the URL model). |

Other: the CT role is called **"corretorn"**, not "corretor". Fixed in the prototypes; the app's
role catalogue (`src/lib/roles.ts`, staffing migration) still says "Corretor".

## Still to show

- Vacances 2027 (end-of-year vacation negotiation).
- El mes (printable monthly rota and absences).
