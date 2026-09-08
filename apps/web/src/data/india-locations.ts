export const INDIA_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export type IndiaState = (typeof INDIA_STATES)[number];

export const CITIES_BY_STATE: Record<IndiaState, string[]> = {
  'Andaman and Nicobar Islands': ['Port Blair', 'Diglipur', 'Mayabunder', 'Rangat', 'Car Nicobar'],
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Kakinada',
    'Rajahmundry', 'Kadapa', 'Anantapur', 'Vizianagaram', 'Eluru', 'Ongole', 'Nandyal',
    'Machilipatnam', 'Adoni', 'Tenali', 'Chittoor', 'Hindupur', 'Proddatur', 'Bhimavaram',
    'Madanapalle', 'Guntakal', 'Dharmavaram', 'Gudivada', 'Narasaraopet', 'Tadipatri',
    'Tadepalligudem', 'Chilakaluripet', 'Amaravati',
  ],
  'Arunachal Pradesh': [
    'Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Bomdila', 'Tezu', 'Roing',
    'Along', 'Changlang', 'Khonsa', 'Seppa', 'Yingkiong', 'Anini',
  ],
  Assam: [
    'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon',
    'Dhubri', 'North Lakhimpur', 'Karimganj', 'Sivasagar', 'Goalpara', 'Barpeta', 'Diphu',
    'Lanka', 'Mangaldoi', 'Morigaon', 'Hailakandi', 'Golaghat', 'Kokrajhar', 'Haflong',
  ],
  Bihar: [
    'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Arrah', 'Begusarai',
    'Katihar', 'Munger', 'Chhapra', 'Saharsa', 'Sasaram', 'Hajipur', 'Dehri', 'Siwan',
    'Motihari', 'Nawada', 'Bagaha', 'Buxar', 'Kishanganj', 'Sitamarhi', 'Jamalpur',
    'Jehanabad', 'Aurangabad', 'Bettiah', 'Samastipur', 'Madhubani', 'Bhabua',
  ],
  Chandigarh: ['Chandigarh'],
  Chhattisgarh: [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Raigarh',
    'Ambikapur', 'Mahasamund', 'Dhamtari', 'Chirmiri', 'Janjgir', 'Kanker', 'Kawardha',
    'Koriya', 'Mungeli', 'Narayanpur', 'Sukma', 'Balod', 'Bemetara', 'Gariaband',
  ],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  Delhi: [
    'New Delhi', 'Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi',
    'Central Delhi', 'North East Delhi', 'North West Delhi', 'South East Delhi', 'South West Delhi',
    'Shahdara',
  ],
  Goa: [
    'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem',
    'Sanquelim', 'Cuncolim', 'Quepem', 'Canacona', 'Pernem',
  ],
  Gujarat: [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh',
    'Gandhinagar', 'Anand', 'Nadiad', 'Morbi', 'Mehsana', 'Bharuch', 'Vapi', 'Navsari',
    'Veraval', 'Porbandar', 'Godhra', 'Palanpur', 'Bhuj', 'Surendranagar', 'Gandhidham',
    'Valsad', 'Patan', 'Amreli', 'Dahod', 'Botad', 'Ankleshwar', 'Gondal', 'Jetpur',
  ],
  Haryana: [
    'Faridabad', 'Gurgaon', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal',
    'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Thanesar', 'Kaithal',
    'Rewari', 'Palwal', 'Hansi', 'Narnaul', 'Fatehabad', 'Gohana', 'Tohana', 'Narwana',
  ],
  'Himachal Pradesh': [
    'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Palampur', 'Baddi', 'Nahan', 'Kullu',
    'Chamba', 'Una', 'Hamirpur', 'Bilaspur', 'Nurpur', 'Kangra', 'Manali', 'Dalhousie',
  ],
  'Jammu and Kashmir': [
    'Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua', 'Udhampur', 'Poonch',
    'Rajouri', 'Kupwara', 'Pulwama', 'Budgam', 'Bandipore', 'Ganderbal', 'Kulgam', 'Shopian',
    'Reasi', 'Ramban', 'Doda', 'Kishtwar', 'Samba',
  ],
  Jharkhand: [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Phusro', 'Hazaribagh', 'Giridih',
    'Ramgarh', 'Medininagar', 'Chirkunda', 'Dumka', 'Chaibasa', 'Gumla', 'Lohardaga',
    'Pakur', 'Sahebganj', 'Simdega', 'Latehar', 'Koderma', 'Chatra', 'Garhwa', 'Godda',
  ],
  Karnataka: [
    'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davanagere', 'Ballari',
    'Tumakuru', 'Shivamogga', 'Raichur', 'Bidar', 'Hospet', 'Hassan', 'Gadag', 'Udupi',
    'Robertsonpet', 'Bhadravati', 'Chitradurga', 'Kolar', 'Mandya', 'Chikkamagaluru',
    'Gangavati', 'Bagalkot', 'Ranebennuru', 'Gokak', 'Yadgir', 'Karwar', 'Madikeri',
    'Chamarajanagar', 'Ramanagara', 'Dharwad', 'Kalaburagi', 'Vijayapura',
  ],
  Kerala: [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha',
    'Malappuram', 'Kannur', 'Kasaragod', 'Kottayam', 'Pathanamthitta', 'Idukki', 'Wayanad',
    'Ernakulam', 'Thalassery', 'Ponnani', 'Vatakara', 'Kanhangad', 'Taliparamba', 'Neyyattinkara',
    'Changanassery', 'Punalur', 'Mattannur', 'Perinthalmanna', 'Manjeri', 'Cherthala',
  ],
  Ladakh: ['Leh', 'Kargil', 'Nubra', 'Drass', 'Zanskar'],
  Lakshadweep: ['Kavaratti', 'Agatti', 'Minicoy', 'Amini', 'Andrott'],
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam',
    'Rewa', 'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind', 'Chhindwara', 'Guna',
    'Shivpuri', 'Vidisha', 'Chhatarpur', 'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Pithampur',
    'Hoshangabad', 'Itarsi', 'Sehore', 'Betul', 'Datia', 'Shahdol', 'Balaghat', 'Morena',
  ],
  Maharashtra: [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur',
    'Amravati', 'Nanded', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar',
    'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Ambarnath', 'Bhiwandi', 'Panvel',
    'Ulhasnagar', 'Satara', 'Ratnagiri', 'Osmanabad', 'Nandurbar', 'Wardha', 'Yavatmal',
    'Gondia', 'Barshi', 'Achalpur', 'Hinganghat', 'Malegaon', 'Miraj', 'Udgir', 'Beed',
  ],
  Manipur: [
    'Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching', 'Ukhrul', 'Senapati',
    'Tamenglong', 'Jiribam', 'Moreh', 'Moirang', 'Lilong',
  ],
  Meghalaya: [
    'Shillong', 'Tura', 'Nongstoin', 'Jowai', 'Baghmara', 'Williamnagar', 'Resubelpara',
    'Mairang', 'Nongpoh', 'Mawkyrwat', 'Ampati', 'Khliehriat',
  ],
  Mizoram: [
    'Aizawl', 'Lunglei', 'Saiha', 'Champhai', 'Kolasib', 'Serchhip', 'Lawngtlai', 'Mamit',
    'Khawzawl', 'Hnahthial', 'Saitual',
  ],
  Nagaland: [
    'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Mon', 'Phek',
    'Kiphire', 'Longleng', 'Peren', 'Noklak', 'Chumoukedima',
  ],
  Odisha: [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore',
    'Bhadrak', 'Baripada', 'Jharsuguda', 'Jeypore', 'Bargarh', 'Paradip', 'Bhawanipatna',
    'Dhenkanal', 'Barbil', 'Kendujhar', 'Sunabeda', 'Rayagada', 'Angul', 'Talcher',
    'Nabarangpur', 'Koraput', 'Jagatsinghpur', 'Kendrapara', 'Phulbani', 'Boudh',
  ],
  Puducherry: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam', 'Oulgaret', 'Villianur'],
  Punjab: [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot',
    'Hoshiarpur', 'Batala', 'Moga', 'Abohar', 'Malerkotla', 'Khanna', 'Phagwara', 'Muktsar',
    'Barnala', 'Rajpura', 'Firozpur', 'Kapurthala', 'Faridkot', 'Sangrur', 'Gurdaspur',
    'Nawanshahr', 'Mansa', 'Fazilka', 'Zirakpur', 'Kharar', 'Gobindgarh',
  ],
  Rajasthan: [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur',
    'Sikar', 'Pali', 'Sri Ganganagar', 'Tonk', 'Kishangarh', 'Beawar', 'Hanumangarh',
    'Dhaulpur', 'Gangapur', 'Sawai Madhopur', 'Churu', 'Jhunjhunu', 'Baran', 'Banswara',
    'Dungarpur', 'Jhalawar', 'Nagaur', 'Chittorgarh', 'Mount Abu', 'Barmer', 'Jaisalmer',
    'Bundi', 'Rajsamand', 'Karauli', 'Sirohi', 'Pratapgarh',
  ],
  Sikkim: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo', 'Jorethang', 'Singtam'],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur',
    'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi',
    'Karur', 'Udhagamandalam', 'Hosur', 'Nagercoil', 'Kanchipuram', 'Cuddalore', 'Tiruvannamalai',
    'Pollachi', 'Rajapalayam', 'Gudiyatham', 'Pudukkottai', 'Vaniyambadi', 'Ambur', 'Nagapattinam',
    'Krishnagiri', 'Dharmapuri', 'Namakkal', 'Theni', 'Ramanathapuram', 'Virudhunagar',
    'Sivaganga', 'Perambalur', 'Ariyalur', 'Mayiladuthurai', 'Tenkasi', 'Chengalpattu',
    'Kallakurichi', 'Tirupattur', 'Avadi', 'Tambaram', 'Pallavaram',
  ],
  Telangana: [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 'Khammam', 'Mahbubnagar',
    'Nalgonda', 'Adilabad', 'Suryapet', 'Miryalaguda', 'Jagtial', 'Mancherial', 'Nirmal',
    'Kamareddy', 'Siddipet', 'Wanaparthy', 'Bhongir', 'Sangareddy', 'Vikarabad', 'Medak',
    'Bodhan', 'Bellampalle', 'Mandamarri', 'Tandur', 'Gadwal', 'Narayanpet',
  ],
  Tripura: [
    'Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia', 'Khowai', 'Ambassa',
    'Sabroom', 'Teliamura', 'Kumarghat', 'Amarpur',
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly',
    'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida', 'Firozabad', 'Jhansi',
    'Muzaffarnagar', 'Mathura', 'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Ayodhya', 'Mau',
    'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Sambhal', 'Amroha', 'Hardoi', 'Fatehpur',
    'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Modinagar', 'Unnao', 'Jaunpur', 'Lakhimpur',
    'Hathras', 'Banda', 'Pilibhit', 'Barabanki', 'Khurja', 'Gonda', 'Mainpuri', 'Lalitpur',
    'Etah', 'Deoria', 'Bijnor', 'Basti', 'Chandausi', 'Akbarpur', 'Ballia', 'Budaun',
  ],
  Uttarakhand: [
    'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh',
    'Nainital', 'Almora', 'Pithoragarh', 'Srinagar', 'Tehri', 'Pauri', 'Chamoli', 'Uttarkashi',
    'Bageshwar', 'Champawat', 'Mussoorie', 'Kotdwara', 'Ramnagar', 'Jaspur', 'Manglaur',
  ],
  'West Bengal': [
    'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Malda', 'Baharampur',
    'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat', 'Haldia', 'Raiganj',
    'Krishnanagar', 'Nabadwip', 'Medinipur', 'Jalpaiguri', 'Balurghat', 'Basirhat', 'Bankura',
    'Chakdaha', 'Darjeeling', 'Alipurduar', 'Cooch Behar', 'Purulia', 'Jangipur', 'Bolpur',
    'Bangaon', 'Kalyani', 'Bishnupur', 'Tamluk', 'Midnapore', 'Contai',
  ],
};

export function getCitiesForState(state: string): string[] {
  if (!state) return [];
  return CITIES_BY_STATE[state as IndiaState] ?? [];
}

export function formatCityState(city: string, state: string): string {
  if (city && state) return `${city}, ${state}`;
  return city || state || '';
}

export function parseCityState(location: string): { city: string; state: string } {
  if (!location.trim()) return { city: '', state: '' };
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const state = parts[parts.length - 1];
    const city = parts.slice(0, -1).join(', ');
    if ((INDIA_STATES as readonly string[]).includes(state)) {
      return { city, state };
    }
  }
  for (const state of INDIA_STATES) {
    if (location.includes(state)) {
      return { city: location.replace(state, '').replace(/,\s*$/, '').trim(), state };
    }
  }
  return { city: location, state: '' };
}

export const REGISTRATION_CITIES = [
  ...new Set(INDIA_STATES.flatMap((state) => CITIES_BY_STATE[state])),
].sort((a, b) => a.localeCompare(b));
