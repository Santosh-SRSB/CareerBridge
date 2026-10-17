// Centralized ATS scoring weights. Keep all overall-score weights here —
// do not scatter them across routes or the frontend.
// Values are percentages and must sum to 100.

const ATS_WEIGHTS = {
  roleMatch: 35,
  skills: 20,
  experience: 15,
  projects: 10,
  certifications: 5,
  education: 5,
  formatting: 5,
  contentQuality: 5,
};

function assertWeights() {
  const total = Object.values(ATS_WEIGHTS).reduce((sum, n) => sum + n, 0);
  if (total !== 100) {
    throw new Error(`ATS_WEIGHTS must sum to 100, got ${total}`);
  }
}

assertWeights();

module.exports = { ATS_WEIGHTS };
