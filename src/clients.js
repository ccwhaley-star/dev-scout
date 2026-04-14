// BairesDev existing client list — used to flag prospects and find upsell opportunities
export const BAIRESDEV_CLIENTS = [
  "AWS", "Google", "IBM", "Cisco", "EY", "Adobe", "Amdocs", "Capgemini", "Concentrix",
  "Pavilion", "KPMG", "AbbVie", "Epam Systems", "McKinsey", "Autodesk", "Nike", "Intuitive",
  "TransUnion", "Procore Technologies", "Stratascale", "GitLab", "Iqvia", "MuleSoft",
  "Regeneron", "OneTrust", "Duck Creek Technologies", "Thomson Reuters", "6sense", "Walgreens",
  "Guidewire Software", "Nasdaq", "ZS", "Tableau", "NXP Semiconductors", "Riviera Partners",
  "Airtable", "Oxy", "Square", "Alation", "Scale AI", "Chime", "KKR", "Keurig Dr Pepper",
  "Logitech", "Dragos", "SpyCloud", "Quantiphi", "ID.me", "Bounteous", "DataRobot",
  "Novant Health", "NetDocuments", "Bullhorn", "Aristocrat Gaming", "EssilorLuxottica",
  "Netgear", "Restaurant Brands International", "Kemper", "Smarsh", "Capitalize Analytics",
  "Fortune Brands Innovations", "A+E Networks", "Litera", "Nexxen", "UP.Labs",
  "Bentley Systems", "Twist Bioscience", "Alloy", "MBO Partners", "Levelpath", "Petco",
  "Sitetracker", "Southern Company", "DLA Piper", "Tala", "Clear Street", "Luxury Presence",
  "Unify Consulting", "Bbva", "Triverus Consulting", "ActivTrak", "Shutterstock", "WeWork",
  "Brightspot", "Vouched", "Derivative Path", "CareMetx", "Lionsgate", "Grata", "XOi", "TMB",
  "Kraken", "SpotHero", "Lessen", "Milliman", "Arcserve", "Akqa", "AppLovin", "Industrious",
  "IT Convergence", "Air", "Earnest", "GoFundMe", "Remax", "SambaSafety", "Canopy", "Bridg",
  "Wiser Solutions", "Tovuti LMS", "Spekit", "Shipium", "Revenue", "Cars Commerce",
  "Rolls-Royce", "Mural Pay", "Signet Jewelers", "EOS IT Solutions", "Fujifilm Sonosite",
  "Fabric", "Globalstar", "Expensify", "Onapsis", "Panasonic", "Evalueserve", "Netomi",
  "Mural", "Redesign Health", "Rego Consulting", "QuantumBlack", "Opportunity Fund",
  "Modern Campus", "A-lign", "Lucidworks", "nOps", "ACA Group", "Socotra", "Ascensus",
  "Alo Yoga", "Akko", "Artera", "Trust & Will", "Staples Canada", "Standard Industries",
  "TeamSnap", "Spotter", "Subject", "11x AI", "Teletrac Navman", "Thales", "Thinkific",
  "Society6", "Stocktwits", "Imaware", "Kizen", "Aamc", "Karat", "Apartment List", "Agero",
  "American Osteopathic Association", "AllGear Digital", "Ascend Learning", "Arthrex",
  "MJH Life Sciences", "HSI", "Maxwell Leadership", "Loka", "MarginEdge", "InductiveHealth",
  "Mitsubishi Electric Trane US", "Metalab", "HeyGen", "Hyperproof", "Infillion", "Dave",
  "DaySmart", "DryvIQ", "Eastern Standard", "Blackline Safety", "Degreed", "Prodigy Education",
  "Point", "Pluto TV", "ViacomCBS", "Vivid Seats", "Whereoware", "Servpro", "SMA America",
  "CoderPad", "Consumer Edge", "Varsity Tutors", "BiggerPockets", "Windfall",
  "Wizards of the Coast", "Cavallo", "Credible", "SevenRooms", "Science 37", "Slice",
  "Scorpion", "SRS Acquiom", "Rosendin", "Rapyd", "E78 Partners", "ECRS",
  "DAT Freight & Analytics", "NerdWallet", "Reaktor", "Real Geeks", "Paradigm", "Further",
  "Nowsta", "Network to Code", "Newsela", "Providence Medical Technology", "Piñata Rent",
  "Pypestream", "PuzzleHR", "T2 Systems", "Sovereign", "SonderMind", "Softensity", "TerraTrue",
  "The Associated Press", "Syllable", "Thoughtbot", "Toca Football",
  "Fundamental Research Labs", "Gun", "Gretchen Rubin Media", "Gogo Business Aviation",
  "Heroic Public Benefit", "Hero Digital", "Hello Alice", "Harmonate", "Hansen Technologies",
  "Guru", "Gunderson Dettmer", "CrossFit", "LeaseQuery", "LensLock", "Leafplanner",
  "Leaf Group", "Millennium Systems International", "Lumen Energy",
  "Luma Financial Technologies", "Loyal", "Lottery Now", "Maryknoll Fathers and Brothers",
  "Lynden Door", "MVP", "Miso Robotics", "Juul Labs", "Institute for Supply Management",
  "Infotech", "Hireguide", "Honorlock", "ITX", "MediaValet", "Altos Planos Collective",
  "Amount", "KM2 Solutions", "Kaleris", "Kitestring Technical Services", "Klue", "Koho",
  "Industrial Resolution", "Jiobit", "Ideas To Go", "Instrument", "StudyFetch", "Ovida",
  "Opal Group", "Otto", "OrderPort", "RVshare", "Quickplay", "Redica Systems",
  "Red Pepper Software", "Readyset", "Nydig", "New Level Work", "Mudflap", "Numa", "Finfare",
  "Germinate", "Fluke", "Givebacks", "Euclid Power", "Fieldguide", "Geospan",
  "ConsumerAffairs", "Detect", "Disys", "Ensora Health", "Ethisphere", "Direct Supply",
  "Dye & Durham", "Pivotal", "Praxent", "Rally Ventures", "Rapid POS", "Reactor Data",
  "PayByPhone", "PaymentWorks", "Penn Foster Group", "Ghgsat", "Nowcom", "PatientIQ",
  "P3 Media", "Savana", "Siege Media", "CropTrak", "SKU IQ", "Roivant", "Seattle Mariners",
  "SchoolPass", "SiriusXM Canada", "CrossBar", "Playwire", "Corcentric", "Context Travel",
  "Context", "CAI", "Clipboard Health", "Revel", "CheckAlt", "ResortPass", "Republic Finance",
  "STX", "Relish", "Axiom Cloud", "Avigilon", "Buildout", "Beeby Clark Meyler", "Braidio",
  "CDI", "Bluecrew", "Bold Orange", "iBwave Solutions", "Xypro Technology",
  "Behaviour Interactive", "River Point Technology", "VillageMD", "WillDom", "TuneCore",
  "23andMe", "Underline", "Vector Remote Care", "Vessel Technologies", "Tokio Marine HCC",
  "Tribune Publishing Company", "Trinity Life Sciences", "TrubAI", "Absorb Software",
];

// Create a lowercase Set for fast matching
export const CLIENT_SET = new Set(BAIRESDEV_CLIENTS.map(c => c.toLowerCase()));

// Check if a company name matches a client (fuzzy: checks if either contains the other)
export function isExistingClient(companyName) {
  if (!companyName) return false;
  const lower = companyName.toLowerCase().trim();
  if (CLIENT_SET.has(lower)) return true;
  // Fuzzy: check if company name contains or is contained by a client name
  for (const client of CLIENT_SET) {
    if (lower.includes(client) || client.includes(lower)) return true;
  }
  return false;
}
