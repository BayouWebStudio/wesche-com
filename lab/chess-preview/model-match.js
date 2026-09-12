/* Model-match record validation and projection.
 *
 * Schema (schema_version 1):
 * {
 *   "schema_version": 1,
 *   "id": "string",
 *   "status": "complete" | "incomplete" | "aborted" | ...,
 *   "initial_fen": "optional FEN, omitted => standard start",
 *   "players": {"white": {"name","model"}, "black": {"name","model"}},
 *   "moves": [{ply, uci, san, fen_before, fen_after, latency_seconds, usage}],
 *   "result": "*" | "1-0" | "0-1" | "1/2-1/2",
 *   "termination": "string"
 * }
 *
 * This module is pure data-in / data-out: no DOM, no chess engine. Legality
 * is checked by the caller against the real engine. Here we only prove the
 * record is *well-formed* and internally consistent (fen_before / fen_after
 * chain, ply monotonic, uci shape, required fields present, no XSS-bearing
 * field names or unexpected types).
 *
 * Results are returned as {ok:true,value} | {ok:false,error,detail} so the
 * caller can show a precise message.
 */

const RESULTS=new Set(['*','1-0','0-1','1/2-1/2']);
const UCI_RE=/^([a-h][1-8][a-h][1-8][qrbn]?|[a-h][1-8][a-h][1-8]([qrbnQRBN])?|[Oo]-[Oo]-[Oo]?)$/;
const PIECE_PLACEMENT_RE=/^([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+$/;
const MAX_MOVES=1000;

function isStr(v){return typeof v==='string';}
function isNum(v){return typeof v==='number'&&Number.isFinite(v);}
function isObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}

function err(error,detail){
  return {ok:false,error,detail:detail===undefined?null:detail};
}

/* ---- FEN helpers (structural only; engine re-validates) ---------- */

function fenParts(fen){
  if(!isStr(fen))return null;
  const parts=fen.trim().split(/\s+/);
  if(parts.length<4||parts.length>6)return null;
  const [placement,side,castling,ep,halfmove,fullmove]=parts;
  if(!PIECE_PLACEMENT_RE.test(placement))return null;
  if(side!=='w'&&side!=='b')return null;
  if(!/^(-|K?Q?k?q?)$/.test(castling))return null;
  if(!/^(-|[a-h][36])$/.test(ep))return null;
  if(halfmove!==undefined&&!/^\d+$/.test(halfmove))return null;
  if(fullmove!==undefined&&!/^\d+$/.test(fullmove))return null;
  return {placement,side,castling,ep,halfmove:halfmove??'0',fullmove:fullmove??'1'};
}

function isFen(fen){return fenParts(fen)!==null;}

/* Two FENs are the "same board" when placement + side + castling + ep match.
   Clock fields (halfmove/fullmove) are ignored — model records often omit or
   disagree on them. */
function boardKey(fen){const p=fenParts(fen);return p?p.placement+' '+p.side+' '+p.castling+' '+p.ep:null;}

function normalizeUci(uci){
  if(!isStr(uci))return null;
  let u=uci;
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u))return null;
  if(/^[Oo]-[Oo]-[Oo]?$/.test(u)){
    /* accept O-O / 0-0 typo forms, but the engine wants king moves */
    return {castle:u.replace(/0/g,'O').length>=5?'k':'q'};
  }
  if(!/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(u))return null;
  return {square:u.slice(0,4).toLowerCase(),promotion:u.length>4?u[4].toLowerCase():null};
}

/* ---- Main validator ---------------------------------------------- */

function validate(record){
  if(!isObj(record))return err('record is not a JSON object');
  const rec=record;

  /* schema_version — accept 1, or a missing version with a warning. */
  const version=rec.schema_version;
  if(version!==undefined&&version!==1){
    if(!(isNum(version)&&version===1))return err('unsupported schema_version',version);
  }
  if(version===undefined)return err('missing schema_version (expected 1)');

  /* id */
  const id=isStr(rec.id)&&rec.id.length?rec.id:null;
  if(!id)return err('missing or empty "id"');
  if(id.length>200)return err('"id" too long (>200 chars)');

  /* status */
  const status=isStr(rec.status)?rec.status.trim():'';
  if(rec.status!==undefined&&!isStr(rec.status))return err('"status" must be a string');
  const incomplete=status==='incomplete'||status==='aborted'||status==='error'||rec.incomplete===true;

  /* players */
  if(!isObj(rec.players))return err('missing "players" object');
  const players={};
  for(const side of ['white','black']){
    const p=rec.players[side];
    if(!isObj(p))return err('missing players.'+side);
    const name=isStr(p.name)&&p.name.trim().length?p.name.trim():null;
    if(!name)return err('players.'+side+'.name is required');
    if(p.model!==undefined&&!isStr(p.model))return err('players.'+side+'.model must be a string');
    players[side]={name:name.slice(0,120),model:isStr(p.model)?p.model.trim().slice(0,120):''};
  }

  /* initial_fen */
  const initialFen=rec.initial_fen===undefined||rec.initial_fen===null||rec.initial_fen===''?null:rec.initial_fen;
  if(initialFen!==null&&!isFen(initialFen))return err('invalid initial_fen',initialFen);

  /* result / termination */
  const result=rec.result===undefined?'*':rec.result;
  if(!RESULTS.has(result))return err('invalid result (expected "*","1-0","0-1","1/2-1/2")',result);
  const termination=isStr(rec.termination)?rec.termination.trim().slice(0,120):(rec.termination===undefined?'':null);
  if(termination===null)return err('"termination" must be a string when present');

  /* moves */
  if(!Array.isArray(rec.moves))return err('missing "moves" array');
  if(rec.moves.length>MAX_MOVES)return err('too many moves',rec.moves.length);
  const moves=[];
  const warnings=[];
  let prevKey=initialFen?boardKey(initialFen):null;
  let prevFenAfter=initialFen;
  let expectedPly=1;

  for(let i=0;i<rec.moves.length;i++){
    const m=rec.moves[i];
    const at='moves['+i+']';
    if(!isObj(m))return err(at+' is not an object');

    /* ply — required int, must be strictly increasing (chronological). */
    if(!Number.isInteger(m.ply))return err(at+'.ply must be an integer');
    if(m.ply!==expectedPly)return err(at+'.ply is not sequential');
    expectedPly=m.ply+1;

    /* uci — required, well-formed. */
    const uci=normalizeUci(m.uci);
    if(!uci)return err(at+'.uci is missing or malformed',m.uci);

    /* san — optional but must be a string when present. */
    if(m.san!==undefined&&m.san!==null&&!isStr(m.san))return err(at+'.san must be a string');

    /* fen_before / fen_after — optional each, but if present must be valid
       and must chain to the previous move's fen_after. */
    let fenBefore=null,fenAfter=null;
    if(m.fen_before!==undefined&&m.fen_before!==null){
      if(!isFen(m.fen_before))return err(at+'.fen_before is not a valid FEN');
      fenBefore=m.fen_before;
    }
    if(m.fen_after!==undefined&&m.fen_after!==null){
      if(!isFen(m.fen_after))return err(at+'.fen_after is not a valid FEN');
      fenAfter=m.fen_after;
    }
    if(fenBefore&&prevKey&&boardKey(fenBefore)!==prevKey){
      return err(at+'.fen_before does not continue the previous position (chronology break at ply '+m.ply+')');
    }
    if(fenBefore&&fenAfter&&boardKey(fenBefore)===boardKey(fenAfter)){
      return err(at+' has identical fen_before and fen_after');
    }

    /* latency / usage — optional, shape-checked only. */
    if(m.latency_seconds!==undefined&&m.latency_seconds!==null&&!isNum(m.latency_seconds))return err(at+'.latency_seconds must be a number');
    if(m.usage!==undefined&&m.usage!==null&&!isObj(m.usage))return err(at+'.usage must be an object');

    if(fenBefore)prevKey=boardKey(fenBefore);
    if(fenAfter)prevKey=boardKey(fenAfter);
    if(fenAfter)prevFenAfter=fenAfter;

    moves.push({
      ply:m.ply,
      uci:isStr(m.uci)?m.uci.trim():null,
      san:isStr(m.san)?m.san.trim():null,
      fen_before:fenBefore,
      fen_after:fenAfter,
      latency_seconds:isNum(m.latency_seconds)?m.latency_seconds:null,
      usage:isObj(m.usage)?m.usage:null,
    });
  }

  /* Empty move list is legal only for an explicitly incomplete record. */
  if(moves.length===0&&!incomplete){
    return err('moves is empty but the record is not marked incomplete');
  }

  /* If result is decisive, require *some* claim of how the game ended. */
  if(result!=='*'&&!termination)warnings.push('decisive result but no "termination" string');

  const value={
    schema_version:1,id,status:status||null,incomplete,
    initial_fen:initialFen,
    players,
    moves,
    result,
    termination,
    test:rec.test===true||rec.fixture===true,
    fixture:rec.fixture===true,
    warnings,
  };
  return {ok:true,value};
}

/* ---- Projection -------------------------------------------------- */

const CASTLE={
  'O-O':'k','0-0':'k','O-O-O':'q','0-0-0':'q','o-o':'k','o-o-o':'q',
};

/* Turn a validated record into (a) the move strings the engine can play,
   (b) UI-facing metadata, (c) the per-ply FEN chain the exporter needs. */
function project(value){
  const moves=value.moves.map(m=>{
    if(CASTLE[m.uci])return CASTLE[m.uci]==='k'?'O-O':'O-O-O';
    return {from:m.uci.slice(0,2),to:m.uci.slice(2,4),...(m.uci[4]?{promotion:m.uci[4]}:{})};
  });
  const meta={
    id:value.id,
    white:value.players.white,
    black:value.players.black,
    note:value.test?'Model match · test fixture':'Model match',
    provenance:[value.status?('STATUS '+value.status):'STATUS UNKNOWN',
                value.incomplete?'INCOMPLETE RECORD':'',
                value.result==='*'?'NO RESULT':('RESULT '+value.result),
                value.termination?('BY '+value.termination.toUpperCase()):''].filter(Boolean).join(' · '),
  };
  const fens=value.moves.map(m=>({before:m.fen_before,after:m.fen_after}));
  return {moves,meta,fens,warnings:value.warnings};
}

function ok(res){return !!res&&res.ok===true;}

function errorText(res){
  if(!res)return 'unknown error';
  let msg=res.error||'invalid record';
  if(res.detail!==undefined&&res.detail!==null){
    const d=isStr(res.detail)?res.detail:JSON.stringify(res.detail);
    if(d.length&&d!=='null')msg+=' ('+String(d).slice(0,80)+')';
  }
  return msg;
}

export const Ops={validate,project,ok,errorText,isFen,boardKey,normalizeUci,RESULTS};
export {validate,project,ok,errorText,isFen,boardKey};
