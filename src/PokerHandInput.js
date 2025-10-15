import React, { useEffect, useState } from "react";

export default function PokerHandInput() {
  // === 외부 전송용 Apps Script Web App URL ===
  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxQ-RQQDgm3nTg4NRTcOlkDgiivyLg2GHVNEr7jB0yasxZX3fjor4ENODqobrOhyy7B/exec";

  // ====== 기본 정보 ======
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [gameType, setGameType] = useState("T");
  const [speed, setSpeed] = useState("Turbo");
  const [venue, setVenue] = useState("");
  const [tableSize, setTableSize] = useState(""); // 숫자 또는 ""
  const [sb, setSb] = useState("");
  const [bb, setBb] = useState("");
  const [ante, setAnte] = useState("");
  const [heroStack, setHeroStack] = useState("");
  const [heroBB, setHeroBB] = useState(0);
  const [heroPosition, setHeroPosition] = useState("");
  const [card1Suit, setCard1Suit] = useState("");
  const [card1Rank, setCard1Rank] = useState("");
  const [card2Suit, setCard2Suit] = useState("");
  const [card2Rank, setCard2Rank] = useState("");

  // ====== 보드 카드 ======
  const [flopCards, setFlopCards] = useState([
    { suit: "", rank: "" },
    { suit: "", rank: "" },
    { suit: "", rank: "" },
  ]);
  const [turnCard, setTurnCard] = useState({ suit: "", rank: "" });
  const [riverCard, setRiverCard] = useState({ suit: "", rank: "" });

  // ====== 액션 상태 ======
  const [preflopActions, setPreflopActions] = useState([
    { pos: "", action: "", amount: "", bbValue: 0 },
    { pos: "", action: "", amount: "", bbValue: 0 },
  ]);
  const [flopActions, setFlopActions] = useState([
    { pos: "", action: "", amount: "", potPct: 0 },
  ]);
  const [turnActions, setTurnActions] = useState([
    { pos: "", action: "", amount: "", potPct: 0 },
  ]);
  const [riverActions, setRiverActions] = useState([
    { pos: "", action: "", amount: "", potPct: 0 },
  ]);

  // ====== 결과 및 상대 정보 ======
  const [result, setResult] = useState(""); // WIN / LOSE / EVEN
  const [villainName, setVillainName] = useState("");
  const [villainPosition, setVillainPosition] = useState("");
  const [villainCard1, setVillainCard1] = useState({ suit: "", rank: "" });
  const [villainCard2, setVillainCard2] = useState({ suit: "", rank: "" });

  // ====== 상수/도우미 ======
  const suits = ["♠", "♥", "♦", "♣"]; // ♠♣=green, ♥♦=red
  const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const preflopPositions = ["UTG", "UTG+1", "UTG+2", "UTG+3", "LJ", "MP", "HJ", "CO", "BTN", "SB", "BB"]; // 프리플랍: BTN 뒤에 SB,BB
  const postflopPositions = ["SB", "BB", "UTG", "UTG+1", "UTG+2", "UTG+3", "LJ", "MP", "HJ", "CO", "BTN"]; // 보드 이후: SB,BB 먼저
  const preflopActionsList = ["RAISE", "CALL", "FOLD", "3BET", "4BET", "ALL-IN", "CHECK"];
  const postflopActionsList = ["CHECK", "BET", "CALL", "RAISE", "3BET", "ALL-IN", "FOLD"]; // CHECK,BET,CALL,... 순서

  const updateHeroBB = (stack, bigBlind) =>
    setHeroBB(Number(bigBlind) > 0 ? Number((Number(stack) / Number(bigBlind)).toFixed(1)) : 0);

  const colorOf = (s) => (s === "♥" || s === "♦" ? "red" : "green");
  const SuitOption = ({ s }) => (
    <option value={s} style={{ color: colorOf(s) }}>
      {s}
    </option>
  );
  const CardBox = ({ s, r }) =>
    !s || !r ? null : (
      <div className={`border rounded px-2 py-1 ${colorOf(s) === "red" ? "text-red-500" : "text-green-500"}`}>
        {s}
        {r}
      </div>
    );

  const getPositionLabel = (pos) => (pos && pos === heroPosition ? `${pos} (HERO)` : pos);

  // 폴드 제외하고 이전 스트리트에서 남은 포지션만 노출
  const survivorsFrom = (actions) => {
    const folded = new Set(actions.filter((a) => a.action === "FOLD").map((a) => a.pos));
    const acted = actions.map((a) => a.pos).filter(Boolean);
    return [...new Set(acted.filter((p) => !folded.has(p)))];
  };

  // ====== POT 계산 ======
  const sumAmt = (arr) => arr.reduce((s, a) => s + (Number(a.amount) || 0), 0);

  // SB/BB가 액션에 들어오면(콜/레이즈 등) 기본 스택에서 중복 차감 방지
  const preflopPotBase = () => {
    let base = (Number(sb) || 0) + (Number(bb) || 0) + (Number(ante) || 0); // ANTE는 BB만 낸다고 가정
    const sbIn = preflopActions.some((a) => a.pos === "SB" && a.action && a.action !== "FOLD");
    const bbIn = preflopActions.some((a) => a.pos === "BB" && a.action && a.action !== "FOLD");
    if (sbIn) base -= Number(sb) || 0;
    if (bbIn) base -= Number(bb) || 0;
    return base;
  };
  const preflopPot = () => preflopPotBase() + sumAmt(preflopActions);
  const flopPot = () => preflopPot() + sumAmt(flopActions);
  const turnPot = () => flopPot() + sumAmt(turnActions);
  const riverPot = () => turnPot() + sumAmt(riverActions);

  // ====== 액션 변경 핸들러 ======
  const onActionChange = (street, i, field, value, actions, setActions) => {
    const next = [...actions];
    next[i][field] = value;

    if (street === "프리플랍" && field === "amount" && bb !== "") {
      const v = Number(value);
      next[i].bbValue = Number(bb) ? Number((v / Number(bb)).toFixed(1)) : 0;
    }

    if (street !== "프리플랍" && field === "amount") {
      const prevPot = street === "플랍" ? preflopPot() : street === "턴" ? flopPot() : turnPot();
      const v = Number(value);
      next[i].potPct = prevPot ? Number(((v / prevPot) * 100).toFixed(1)) : 0;
    }

    setActions(next);
  };

  const addAction = (setActions, isPreflop = false) =>
    setActions((prev) => [
      ...prev,
      isPreflop ? { pos: "", action: "", amount: "", bbValue: 0 } : { pos: "", action: "", amount: "", potPct: 0 },
    ]);
  const removeAction = (setActions, idx) => setActions((prev) => prev.filter((_, i) => i !== idx));

  // ====== 저장 ======
    const handleSave = async () => {
    const payload = {
      date,
      gameType,
      speed,
      venue,
      tableSize,
      sb,
      bb,
      ante,
      heroStack,
      heroBB,
      heroPosition,
      card1: card1Suit + card1Rank,
      card2: card2Suit + card2Rank,
      flop: flopCards,
      turn: turnCard,
      river: riverCard,
      preflopActions,
      flopActions,
      turnActions,
      riverActions,
      pots: {
        preflop: preflopPot(),
        flop: flopPot(),
        turn: turnPot(),
        river: riverPot(),
      },
      result,
      villain: {
        name: villainName,
        position: villainPosition,
        card1: villainCard1,
        card2: villainCard2,
      },
    };

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const text = await res.text();
      alert("서버 응답: " + text);
    } catch (err) {
      console.error("저장 오류:", err);
      alert("스프레드시트 저장 실패: " + err);
    }
  }; 


  // ====== UI ======
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">POKER HAND INPUT</h1>

      {/* 상단 기본 정보 */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block mb-1">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800"
            />
          </div>
          <div>
            <label className="block mb-1">타입</label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800"
            >
              <option value="C">C (Cash)</option>
              <option value="T">T (Tournament)</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">속도</label>
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800"
            >
              <option value="Turbo">Turbo</option>
              <option value="H.Turbo">H.Turbo</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">장소</label>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800"
            />
          </div>
          <div>
            <label className="block mb-1">인원</label>
            <input
              type="number"
              value={tableSize}
              onChange={(e) => setTableSize(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full px-3 py-2 rounded bg-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-1">SB</label>
            <input
              type="number"
              value={sb}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setSb(v);
                updateHeroBB(heroStack === "" ? 0 : Number(heroStack), e.target.value === "" ? 0 : Number(bb));
              }}
              className="w-full px-3 py-2 rounded bg-slate-800"
            />
          </div>
          <div>
            <label className="block mb-1">BB</label>
            <input
              type="number"
              value={bb}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setBb(v);
                updateHeroBB(heroStack === "" ? 0 : Number(heroStack), v === "" ? 0 : Number(v));
              }}
              className="w-full px-3 py-2 rounded bg-slate-800"
            />
          </div>
          <div>
            <label className="block mb-1">ANTE</label>
            <input
              type="number"
              value={ante}
              onChange={(e) => setAnte(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full px-3 py-2 rounded bg-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">HERO 스택</label>
            <input
              type="number"
              value={heroStack}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setHeroStack(v);
                updateHeroBB(v === "" ? 0 : Number(v), bb === "" ? 0 : Number(bb));
              }}
              className="w-full px-3 py-2 rounded bg-slate-800"
            />
            <div className="text-sm text-slate-400 mt-1">≈ {heroBB} BB</div>
          </div>
          <div>
            <label className="block mb-1">HERO 포지션</label>
            <select
              value={heroPosition}
              onChange={(e) => setHeroPosition(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800"
            >
              <option value="">-</option>
              {preflopPositions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* HERO 카드 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">HERO 카드 1</label>
            <div className="flex gap-2">
              <select value={card1Suit} onChange={(e) => setCard1Suit(e.target.value)} className="px-2 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {suits.map((s) => (
                  <SuitOption key={s} s={s} />
                ))}
              </select>
              <select value={card1Rank} onChange={(e) => setCard1Rank(e.target.value)} className="px-2 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {ranks.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block mb-1">HERO 카드 2</label>
            <div className="flex gap-2">
              <select value={card2Suit} onChange={(e) => setCard2Suit(e.target.value)} className="px-2 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {suits.map((s) => (
                  <SuitOption key={s} s={s} />
                ))}
              </select>
              <select value={card2Rank} onChange={(e) => setCard2Rank(e.target.value)} className="px-2 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {ranks.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 스트리트 루프 ===== */}
      {[
        { name: "프리플랍", actions: preflopActions, setActions: setPreflopActions, pot: preflopPotBase(), isPre: true, list: preflopActionsList },
        { name: "플랍", actions: flopActions, setActions: setFlopActions, pot: preflopPot(), list: postflopActionsList },
        { name: "턴", actions: turnActions, setActions: setTurnActions, pot: flopPot(), list: postflopActionsList },
        { name: "리버", actions: riverActions, setActions: setRiverActions, pot: turnPot(), list: postflopActionsList },
      ].map((st, idx) => (
        <div key={st.name} className="border-top border-slate-700 pt-4">
          <div className="flex items-center gap-3 mb-2">
            <label className="text-lg font-semibold">{st.name} 액션</label>
            <span className="text-slate-400 text-sm">POT: {st.pot + sumAmt(st.actions)}</span>

            {/* 보드 프리뷰 */}
            {st.name === "플랍" && <div className="flex gap-1">{flopCards.map((c, i) => <CardBox key={i} s={c.suit} r={c.rank} />)}</div>}
            {st.name === "턴" && (
              <div className="flex gap-1 items-center">
                {flopCards.map((c, i) => (
                  <CardBox key={i} s={c.suit} r={c.rank} />
                ))}
                <span className="mx-1">|</span>
                <CardBox s={turnCard.suit} r={turnCard.rank} />
              </div>
            )}
            {st.name === "리버" && (
              <div className="flex gap-1 items-center">
                {flopCards.map((c, i) => (
                  <CardBox key={i} s={c.suit} r={c.rank} />
                ))}
                <span className="mx-1">|</span>
                <CardBox s={turnCard.suit} r={turnCard.rank} />
                <span className="mx-1">|</span>
                <CardBox s={riverCard.suit} r={riverCard.rank} />
              </div>
            )}
          </div>

          {/* 보드 카드 선택 UI */}
          {st.name === "플랍" && (
            <div className="flex gap-2 mb-2">
              {flopCards.map((c, i) => (
                <div key={i} className="flex gap-1">
                  <select
                    value={c.suit}
                    onChange={(e) => {
                      const u = [...flopCards];
                      u[i].suit = e.target.value;
                      setFlopCards(u);
                    }}
                    className="px-1 py-1 rounded bg-slate-800"
                  >
                    <option value="">-</option>
                    {suits.map((s) => (
                      <SuitOption key={s} s={s} />
                    ))}
                  </select>
                  <select
                    value={c.rank}
                    onChange={(e) => {
                      const u = [...flopCards];
                      u[i].rank = e.target.value;
                      setFlopCards(u);
                    }}
                    className="px-1 py-1 rounded bg-slate-800"
                  >
                    <option value="">-</option>
                    {ranks.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          {st.name === "턴" && (
            <div className="flex gap-1 mb-2">
              <select value={turnCard.suit} onChange={(e) => setTurnCard({ ...turnCard, suit: e.target.value })} className="px-1 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {suits.map((s) => (
                  <SuitOption key={s} s={s} />
                ))}
              </select>
              <select value={turnCard.rank} onChange={(e) => setTurnCard({ ...turnCard, rank: e.target.value })} className="px-1 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {ranks.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
          {st.name === "리버" && (
            <div className="flex gap-1 mb-2">
              <select value={riverCard.suit} onChange={(e) => setRiverCard({ ...riverCard, suit: e.target.value })} className="px-1 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {suits.map((s) => (
                  <SuitOption key={s} s={s} />
                ))}
              </select>
              <select value={riverCard.rank} onChange={(e) => setRiverCard({ ...riverCard, rank: e.target.value })} className="px-1 py-1 rounded bg-slate-800">
                <option value="">-</option>
                {ranks.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 헤더 라벨 */}
          <div className="grid grid-cols-4 gap-2 mb-1 text-slate-400 text-sm">
            <div>포지션</div>
            <div>액션</div>
            <div>{st.name === "프리플랍" ? "금액 / BB" : "금액 / POT(%)"}</div>
            <div></div>
          </div>

          {/* 액션 라인들 */}
          <div className="flex flex-col gap-2">
            {st.actions.map((a, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-center">
                <select
                  value={a.pos}
                  onChange={(e) => onActionChange(st.name, i, "pos", e.target.value, st.actions, st.setActions)}
                  className="px-2 py-1 rounded bg-slate-800"
                >
                  <option value="">-</option>
                  {(st.name === "프리플랍"
                    ? preflopPositions
                    : postflopPositions.filter((p) =>
                        survivorsFrom(idx === 1 ? preflopActions : idx === 2 ? flopActions : turnActions).includes(p)
                      )
                  ).map((p) => (
                    <option key={p} value={p}>
                      {getPositionLabel(p)}
                    </option>
                  ))}
                </select>
                <select
                  value={a.action}
                  onChange={(e) => onActionChange(st.name, i, "action", e.target.value, st.actions, st.setActions)}
                  className="px-2 py-1 rounded bg-slate-800"
                >
                  <option value="">-</option>
                  {st.list.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={a.amount}
                    onChange={(e) => onActionChange(st.name, i, "amount", e.target.value, st.actions, st.setActions)}
                    placeholder="금액"
                    className="px-3 py-2 rounded bg-slate-800 w-full"
                  />
                  <span className="text-slate-400 text-sm whitespace-nowrap">
                    {st.name === "프리플랍" ? `${a.bbValue || 0} BB` : `${a.potPct || 0}%`}
                  </span>
                </div>
                <button onClick={() => removeAction(st.setActions, i)} className="w-5 h-5 flex items-center justify-center bg-red-600 text-xs rounded">
                  ✕
                </button>
              </div>
            ))}
            <button onClick={() => addAction(st.setActions, st.isPre)} className="mt-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm w-fit">
              + 액션 추가
            </button>
          </div>
        </div>
      ))}

      {/* ===== 결과 & 상대 정보 ===== */}
      <div className="mt-10 border-t border-slate-700 pt-6 pb-8">
        <h2 className="text-xl font-semibold mb-6 text-center">RESULT & OPPONENT</h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block mb-1">승패</label>
            <select value={result} onChange={(e) => setResult(e.target.value)} className="w-full px-3 py-2 rounded bg-slate-800">
              <option value="">-</option>
              <option value="WIN">WIN</option>
              <option value="LOSE">LOSE</option>
              <option value="EVEN">EVEN</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">상대 이름</label>
            <input value={villainName} onChange={(e) => setVillainName(e.target.value)} className="w-full px-3 py-2 rounded bg-slate-800" />
          </div>
          <div>
            <label className="block mb-1">상대 포지션</label>
            <select value={villainPosition} onChange={(e) => setVillainPosition(e.target.value)} className="w-full px-3 py-2 rounded bg-slate-800">
              <option value="">-</option>
              {preflopPositions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[villainCard1, villainCard2].map((card, idx) => (
            <div key={idx}>
              <label className="block mb-1">상대 카드 {idx + 1}</label>
              <div className="flex gap-2">
                <select
                  value={card.suit}
                  onChange={(e) =>
                    idx === 0
                      ? setVillainCard1({ ...villainCard1, suit: e.target.value })
                      : setVillainCard2({ ...villainCard2, suit: e.target.value })
                  }
                  className="px-2 py-1 rounded bg-slate-800"
                >
                  <option value="">-</option>
                  {suits.map((s) => (
                    <SuitOption key={s} s={s} />
                  ))}
                </select>
                <select
                  value={card.rank}
                  onChange={(e) =>
                    idx === 0
                      ? setVillainCard1({ ...villainCard1, rank: e.target.value })
                      : setVillainCard2({ ...villainCard2, rank: e.target.value })
                  }
                  className="px-2 py-1 rounded bg-slate-800"
                >
                  <option value="">-</option>
                  {ranks.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === 저장 버튼 === */}
      <div className="mt-8 flex justify-center">
        <button onClick={handleSave} className="px-6 py-2 rounded bg-green-600 hover:bg-green-500 font-bold">
          저장
        </button>
      </div>
    </div>
  );
}
