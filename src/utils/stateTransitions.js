const transitions = {
  sikayet: {
    bekliyor: new Set(["inceleniyor", "reddedildi"]),
    inceleniyor: new Set(["bekliyor", "cozuldu", "reddedildi"]),
    cozuldu: new Set(["inceleniyor"]),
    reddedildi: new Set(["inceleniyor"]),
  },
  talep: {
    bekliyor: new Set(["onaylandi", "reddedildi", "iptal_edildi"]),
    onaylandi: new Set(["tamamlandi", "iptal_edildi"]),
    reddedildi: new Set(["bekliyor"]),
    tamamlandi: new Set(),
    iptal_edildi: new Set(["bekliyor"]),
  },
  sirket: {
    bekliyor: new Set(["onaylandi", "reddedildi", "pasif"]),
    onaylandi: new Set(["pasif"]),
    reddedildi: new Set(["bekliyor", "onaylandi", "pasif"]),
    pasif: new Set(["onaylandi"]),
  },
};

function canTransition(type, from, to) {
  if (from === to) return true;
  return Boolean(transitions[type]?.[from]?.has(to));
}

module.exports = {
  canTransition,
  transitions,
};
