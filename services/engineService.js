const { JavaBridge } = require('./javaBridge');
const Organ = require('../models/Organ');

const bridge = new JavaBridge();
const iso = (d) => new Date(d).toISOString();
const idOf = (x) => String(x && x._id ? x._id : x);

const toEngineOrgan = (o) => ({
  id: String(o._id), organType: o.organType, donorId: idOf(o.donor), bloodType: o.bloodType,
  harvestTime: iso(o.harvestDatetime), viabilityHours: o.viabilityHours, status: o.status
});
// request.patient must be populated (needs bloodType)
const toEngineRequest = (r) => ({
  id: String(r._id), patientId: idOf(r.patient), bloodType: r.patient.bloodType,
  organType: r.organType, urgency: r.urgency, listingDate: iso(r.listingDate), status: r.status
});

module.exports = {
  bridge,
  start: () => bridge.start(),
  stop: () => bridge.stop(),
  status: () => bridge.status(),
  rank: (organ, requests) => bridge.call('rank', { organ: toEngineOrgan(organ), requests: requests.map(toEngineRequest) }),
  allocate: (organ, requests) => bridge.call('allocate', { organ: toEngineOrgan(organ), requests: requests.map(toEngineRequest) }),
  watch: (organs) => bridge.call('watch', { organs: organs.map(toEngineOrgan) }),
  /** (Re)load every live organ into the Java watch-list: at boot and after any engine restart. */
  async syncFromDb() {
    const organs = await Organ.find({ status: { $in: ['AVAILABLE', 'ALLOCATED'] } });
    if (organs.length) await bridge.call('watch', { organs: organs.map(toEngineOrgan) });
    return organs.length;
  }
};
