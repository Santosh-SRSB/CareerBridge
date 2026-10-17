/**
 * Approximate city-centre coordinates for India (WGS84).
 * Used to geocode Job.city / candidate preferred city when GPS is unavailable.
 * Keys are lowercase trimmed city names.
 */
export type CityCentroid = { lat: number; lng: number; name: string };

const RAW: Array<[string, number, number]> = [
  ['mumbai', 19.076, 72.8777],
  ['delhi', 28.6139, 77.209],
  ['new delhi', 28.6139, 77.209],
  ['bengaluru', 12.9716, 77.5946],
  ['bangalore', 12.9716, 77.5946],
  ['hyderabad', 17.385, 78.4867],
  ['ahmedabad', 23.0225, 72.5714],
  ['chennai', 13.0827, 80.2707],
  ['kolkata', 22.5726, 88.3639],
  ['pune', 18.5204, 73.8567],
  ['jaipur', 26.9124, 75.7873],
  ['surat', 21.1702, 72.8311],
  ['lucknow', 26.8467, 80.9462],
  ['kanpur', 26.4499, 80.3319],
  ['nagpur', 21.1458, 79.0882],
  ['indore', 22.7196, 75.8577],
  ['thane', 19.2183, 72.9781],
  ['bhopal', 23.2599, 77.4126],
  ['visakhapatnam', 17.6868, 83.2185],
  ['patna', 25.5941, 85.1376],
  ['vadodara', 22.3072, 73.1812],
  ['ghaziabad', 28.6692, 77.4538],
  ['ludhiana', 30.901, 75.8573],
  ['agra', 27.1767, 78.0081],
  ['nashik', 19.9975, 73.7898],
  ['faridabad', 28.4089, 77.3178],
  ['meerut', 28.9845, 77.7064],
  ['rajkot', 22.3039, 70.8022],
  ['varanasi', 25.3176, 82.9739],
  ['srinagar', 34.0837, 74.7973],
  ['aurangabad', 19.8762, 75.3433],
  ['dhanbad', 23.7957, 86.4304],
  ['amritsar', 31.634, 74.8723],
  ['navi mumbai', 19.033, 73.0297],
  ['allahabad', 25.4358, 81.8463],
  ['prayagraj', 25.4358, 81.8463],
  ['ranchi', 23.3441, 85.3096],
  ['howrah', 22.5958, 88.2636],
  ['coimbatore', 11.0168, 76.9558],
  ['jabalpur', 23.1815, 79.9864],
  ['gwalior', 26.2183, 78.1828],
  ['vijayawada', 16.5062, 80.648],
  ['jodhpur', 26.2389, 73.0243],
  ['madurai', 9.9252, 78.1198],
  ['raipur', 21.2514, 81.6296],
  ['kota', 25.2138, 75.8648],
  ['guwahati', 26.1445, 91.7362],
  ['chandigarh', 30.7333, 76.7794],
  ['solapur', 17.6599, 75.9064],
  ['hubli', 15.3647, 75.124],
  ['hubballi', 15.3647, 75.124],
  ['tiruchirappalli', 10.7905, 78.7047],
  ['bareilly', 28.367, 79.4304],
  ['mysore', 12.2958, 76.6394],
  ['mysuru', 12.2958, 76.6394],
  ['tiruppur', 11.1085, 77.3411],
  ['gurgaon', 28.4595, 77.0266],
  ['gurugram', 28.4595, 77.0266],
  ['aligarh', 27.8974, 78.088],
  ['jalandhar', 31.326, 75.5762],
  ['bhubaneswar', 20.2961, 85.8245],
  ['salem', 11.6643, 78.146],
  ['warangal', 17.9689, 79.5941],
  ['mira bhayandar', 19.2952, 72.8544],
  ['thiruvananthapuram', 8.5241, 76.9366],
  ['bhiwandi', 19.2813, 73.0485],
  ['saharanpur', 29.968, 77.5552],
  ['gorakhpur', 26.7606, 83.3732],
  ['guntur', 16.3067, 80.4365],
  ['bikaner', 28.0229, 73.3119],
  ['amravati', 20.9374, 77.7796],
  ['noida', 28.5355, 77.391],
  ['jamshedpur', 22.8046, 86.2029],
  ['bhilai', 21.1938, 81.3509],
  ['cuttack', 20.4625, 85.883],
  ['firozabad', 27.1591, 78.3958],
  ['kochi', 9.9312, 76.2673],
  ['nellore', 14.4426, 79.9865],
  ['bhavnagar', 21.7645, 72.1519],
  ['dehradun', 30.3165, 78.0322],
  ['durgapur', 23.5204, 87.3119],
  ['asansol', 23.6739, 86.9524],
  ['nanded', 19.1383, 77.321],
  ['kolhapur', 16.705, 74.2433],
  ['ajmer', 26.4499, 74.6399],
  ['gulbarga', 17.3297, 76.8343],
  ['kalaburagi', 17.3297, 76.8343],
  ['jamnagar', 22.4707, 70.0577],
  ['ujjain', 23.1765, 75.7885],
  ['loni', 28.733, 77.288],
  ['siliguri', 26.7271, 88.3953],
  ['jhansi', 25.4484, 78.5685],
  ['ulhasnagar', 19.2183, 73.163],
  ['jammu', 32.7266, 74.857],
  ['sangli', 16.8524, 74.5815],
  ['mangalore', 12.9141, 74.856],
  ['mangaluru', 12.9141, 74.856],
  ['erode', 11.341, 77.7172],
  ['belgaum', 15.8497, 74.4977],
  ['belagavi', 15.8497, 74.4977],
  ['ambattur', 13.1143, 80.1548],
  ['tirunelveli', 8.7139, 77.7567],
  ['malegaon', 20.5579, 74.5089],
  ['gaya', 24.7914, 85.0002],
  ['jalgaon', 21.0077, 75.5626],
  ['udaipur', 24.5854, 73.7125],
  ['maheshtala', 22.5086, 88.2322],
  ['tirupati', 13.6288, 79.4192],
  ['nagarbhavi', 12.965, 77.508],
  ['rajajinagar', 12.991, 77.552],
  ['whitefield', 12.9698, 77.75],
  ['electronic city', 12.8399, 77.677],
  ['andheri', 19.1197, 72.8468],
  ['powai', 19.117, 72.905],
  ['koramangala', 12.9352, 77.6245],
  ['indiranagar', 12.9784, 77.6408],
  ['hsr layout', 12.9116, 77.6473],
  ['marathahalli', 12.9591, 77.6974],
  ['port blair', 11.6234, 92.7265],
  ['itanagar', 27.0844, 93.6053],
  ['imphal', 24.817, 93.9368],
  ['shillong', 25.5788, 91.8933],
  ['aizawl', 23.7271, 92.7176],
  ['kohima', 25.6751, 94.1086],
  ['agartala', 23.8315, 91.2868],
  ['gangtok', 27.3389, 88.6065],
  ['panaji', 15.4909, 73.8278],
  ['shimla', 31.1048, 77.1734],
  ['puducherry', 11.9416, 79.8083],
  ['pondicherry', 11.9416, 79.8083],
];

const BY_KEY = new Map<string, CityCentroid>(
  RAW.map(([name, lat, lng]) => [name, { lat, lng, name }]),
);

export function normalizeCityKey(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,.*$/, '')
    .trim();
}

/** Resolve approximate lat/lng for a city name; returns null if unknown. */
export function lookupCityCentroid(city: string | null | undefined): CityCentroid | null {
  if (!city?.trim()) return null;
  const key = normalizeCityKey(city);
  if (BY_KEY.has(key)) return BY_KEY.get(key)!;
  // Try first token (e.g. "Aurangabad, Maharashtra")
  const first = key.split(/[|,/]/)[0]?.trim();
  if (first && BY_KEY.has(first)) return BY_KEY.get(first)!;
  for (const [k, v] of BY_KEY) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

export function listCityCentroids(): CityCentroid[] {
  return [...BY_KEY.values()];
}
