import { Injectable } from '@nestjs/common';

/** India's 28 states only (excludes union territories). */
const STATES = [
  { id: 'ap', name: 'Andhra Pradesh', code: 'AP' },
  { id: 'ar', name: 'Arunachal Pradesh', code: 'AR' },
  { id: 'as', name: 'Assam', code: 'AS' },
  { id: 'br', name: 'Bihar', code: 'BR' },
  { id: 'cg', name: 'Chhattisgarh', code: 'CG' },
  { id: 'ga', name: 'Goa', code: 'GA' },
  { id: 'gj', name: 'Gujarat', code: 'GJ' },
  { id: 'hr', name: 'Haryana', code: 'HR' },
  { id: 'hp', name: 'Himachal Pradesh', code: 'HP' },
  { id: 'jh', name: 'Jharkhand', code: 'JH' },
  { id: 'ka', name: 'Karnataka', code: 'KA' },
  { id: 'kl', name: 'Kerala', code: 'KL' },
  { id: 'mp', name: 'Madhya Pradesh', code: 'MP' },
  { id: 'mh', name: 'Maharashtra', code: 'MH' },
  { id: 'mn', name: 'Manipur', code: 'MN' },
  { id: 'ml', name: 'Meghalaya', code: 'ML' },
  { id: 'mz', name: 'Mizoram', code: 'MZ' },
  { id: 'nl', name: 'Nagaland', code: 'NL' },
  { id: 'od', name: 'Odisha', code: 'OD' },
  { id: 'pb', name: 'Punjab', code: 'PB' },
  { id: 'rj', name: 'Rajasthan', code: 'RJ' },
  { id: 'sk', name: 'Sikkim', code: 'SK' },
  { id: 'tn', name: 'Tamil Nadu', code: 'TN' },
  { id: 'ts', name: 'Telangana', code: 'TS' },
  { id: 'tr', name: 'Tripura', code: 'TR' },
  { id: 'up', name: 'Uttar Pradesh', code: 'UP' },
  { id: 'uk', name: 'Uttarakhand', code: 'UK' },
  { id: 'wb', name: 'West Bengal', code: 'WB' },
];

const CITIES: Record<string, Array<{ id: string; name: string; stateId: string }>> = {
  ap: [
    { id: 'visakhapatnam', name: 'Visakhapatnam', stateId: 'ap' },
    { id: 'vijayawada', name: 'Vijayawada', stateId: 'ap' },
    { id: 'tirupati', name: 'Tirupati', stateId: 'ap' },
  ],
  ar: [
    { id: 'itanagar', name: 'Itanagar', stateId: 'ar' },
    { id: 'tawang', name: 'Tawang', stateId: 'ar' },
  ],
  as: [
    { id: 'guwahati', name: 'Guwahati', stateId: 'as' },
    { id: 'silchar', name: 'Silchar', stateId: 'as' },
    { id: 'dibrugarh', name: 'Dibrugarh', stateId: 'as' },
  ],
  br: [
    { id: 'patna', name: 'Patna', stateId: 'br' },
    { id: 'gaya', name: 'Gaya', stateId: 'br' },
    { id: 'muzaffarpur', name: 'Muzaffarpur', stateId: 'br' },
  ],
  cg: [
    { id: 'raipur', name: 'Raipur', stateId: 'cg' },
    { id: 'bilaspur', name: 'Bilaspur', stateId: 'cg' },
    { id: 'bhilai', name: 'Bhilai', stateId: 'cg' },
  ],
  ga: [
    { id: 'panaji', name: 'Panaji', stateId: 'ga' },
    { id: 'margao', name: 'Margao', stateId: 'ga' },
    { id: 'vasco', name: 'Vasco da Gama', stateId: 'ga' },
  ],
  gj: [
    { id: 'ahmedabad', name: 'Ahmedabad', stateId: 'gj' },
    { id: 'surat', name: 'Surat', stateId: 'gj' },
    { id: 'vadodara', name: 'Vadodara', stateId: 'gj' },
    { id: 'rajkot', name: 'Rajkot', stateId: 'gj' },
  ],
  hr: [
    { id: 'gurugram', name: 'Gurugram', stateId: 'hr' },
    { id: 'faridabad', name: 'Faridabad', stateId: 'hr' },
    { id: 'chandigarh-hr', name: 'Panchkula', stateId: 'hr' },
  ],
  hp: [
    { id: 'shimla', name: 'Shimla', stateId: 'hp' },
    { id: 'dharamshala', name: 'Dharamshala', stateId: 'hp' },
    { id: 'mandi', name: 'Mandi', stateId: 'hp' },
  ],
  jh: [
    { id: 'ranchi', name: 'Ranchi', stateId: 'jh' },
    { id: 'jamshedpur', name: 'Jamshedpur', stateId: 'jh' },
    { id: 'dhanbad', name: 'Dhanbad', stateId: 'jh' },
  ],
  ka: [
    { id: 'bengaluru', name: 'Bengaluru', stateId: 'ka' },
    { id: 'mysuru', name: 'Mysuru', stateId: 'ka' },
    { id: 'mangaluru', name: 'Mangaluru', stateId: 'ka' },
    { id: 'hubballi', name: 'Hubballi', stateId: 'ka' },
  ],
  kl: [
    { id: 'kochi', name: 'Kochi', stateId: 'kl' },
    { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', stateId: 'kl' },
    { id: 'kozhikode', name: 'Kozhikode', stateId: 'kl' },
  ],
  mp: [
    { id: 'bhopal', name: 'Bhopal', stateId: 'mp' },
    { id: 'indore', name: 'Indore', stateId: 'mp' },
    { id: 'gwalior', name: 'Gwalior', stateId: 'mp' },
  ],
  mh: [
    { id: 'mumbai', name: 'Mumbai', stateId: 'mh' },
    { id: 'pune', name: 'Pune', stateId: 'mh' },
    { id: 'nagpur', name: 'Nagpur', stateId: 'mh' },
    { id: 'nashik', name: 'Nashik', stateId: 'mh' },
  ],
  mn: [
    { id: 'imphal', name: 'Imphal', stateId: 'mn' },
    { id: 'thoubal', name: 'Thoubal', stateId: 'mn' },
  ],
  ml: [
    { id: 'shillong', name: 'Shillong', stateId: 'ml' },
    { id: 'tura', name: 'Tura', stateId: 'ml' },
  ],
  mz: [
    { id: 'aizawl', name: 'Aizawl', stateId: 'mz' },
    { id: 'lunglei', name: 'Lunglei', stateId: 'mz' },
  ],
  nl: [
    { id: 'kohima', name: 'Kohima', stateId: 'nl' },
    { id: 'dimapur', name: 'Dimapur', stateId: 'nl' },
  ],
  od: [
    { id: 'bhubaneswar', name: 'Bhubaneswar', stateId: 'od' },
    { id: 'cuttack', name: 'Cuttack', stateId: 'od' },
    { id: 'rourkela', name: 'Rourkela', stateId: 'od' },
  ],
  pb: [
    { id: 'ludhiana', name: 'Ludhiana', stateId: 'pb' },
    { id: 'amritsar', name: 'Amritsar', stateId: 'pb' },
    { id: 'jalandhar', name: 'Jalandhar', stateId: 'pb' },
  ],
  rj: [
    { id: 'jaipur', name: 'Jaipur', stateId: 'rj' },
    { id: 'jodhpur', name: 'Jodhpur', stateId: 'rj' },
    { id: 'udaipur', name: 'Udaipur', stateId: 'rj' },
  ],
  sk: [
    { id: 'gangtok', name: 'Gangtok', stateId: 'sk' },
    { id: 'namchi', name: 'Namchi', stateId: 'sk' },
  ],
  tn: [
    { id: 'chennai', name: 'Chennai', stateId: 'tn' },
    { id: 'coimbatore', name: 'Coimbatore', stateId: 'tn' },
    { id: 'madurai', name: 'Madurai', stateId: 'tn' },
    { id: 'tiruchirappalli', name: 'Tiruchirappalli', stateId: 'tn' },
  ],
  ts: [
    { id: 'hyderabad', name: 'Hyderabad', stateId: 'ts' },
    { id: 'warangal', name: 'Warangal', stateId: 'ts' },
    { id: 'nizamabad', name: 'Nizamabad', stateId: 'ts' },
  ],
  tr: [
    { id: 'agartala', name: 'Agartala', stateId: 'tr' },
    { id: 'udaipur-tr', name: 'Udaipur', stateId: 'tr' },
  ],
  up: [
    { id: 'lucknow', name: 'Lucknow', stateId: 'up' },
    { id: 'noida', name: 'Noida', stateId: 'up' },
    { id: 'kanpur', name: 'Kanpur', stateId: 'up' },
    { id: 'varanasi', name: 'Varanasi', stateId: 'up' },
  ],
  uk: [
    { id: 'dehradun', name: 'Dehradun', stateId: 'uk' },
    { id: 'haridwar', name: 'Haridwar', stateId: 'uk' },
    { id: 'nainital', name: 'Nainital', stateId: 'uk' },
  ],
  wb: [
    { id: 'kolkata', name: 'Kolkata', stateId: 'wb' },
    { id: 'howrah', name: 'Howrah', stateId: 'wb' },
    { id: 'durgapur', name: 'Durgapur', stateId: 'wb' },
  ],
};

@Injectable()
export class LocationsService {
  listActiveStates() {
    return Promise.resolve(STATES);
  }

  listActiveCities(stateId?: string) {
    if (!stateId) {
      return Promise.resolve(
        Object.values(CITIES)
          .flat()
          .map((city) => ({
            ...city,
            state: STATES.find((state) => state.id === city.stateId) ?? null,
          })),
      );
    }
    const cities = CITIES[stateId] ?? [];
    const state = STATES.find((item) => item.id === stateId) ?? null;
    return Promise.resolve(cities.map((city) => ({ ...city, state })));
  }
}
